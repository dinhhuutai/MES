import { useCallback, useEffect, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listCaiDatApi, saveCaiDatApi, thuKetNoiApi } from '../../../services/caiDatApiService';

// Công tắc gạt — dựng lại y hệt `HienThiPainPage` để 2 trang cấu hình nhìn như một.
function Toggle({ on, onChange, disabled, title }) {
  return (
    <button type="button" title={title} disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
        ${on ? 'bg-primary' : 'bg-line'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <span className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform
        ${on ? 'translate-x-[22px]' : 'translate-x-1'}`} />
    </button>
  );
}

const fmtDT = (s) => {
  if (!s) return '';
  const x = new Date(s);
  const p = (n) => String(n).padStart(2, '0');
  return Number.isNaN(+x) ? '' : `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}`;
};

export default function CaiDatApiPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canEdit = can('WORKFLOW_MANAGE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [thu, setThu] = useState({});       // { ma: {dangThu, ok, thong_diep} }
  const [xacNhan, setXacNhan] = useState(null); // { ma, ten, canh_bao } — hỏi lại trước khi TẮT

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCaiDatApi();
      setRows(res.data.items || []);
      setDirty(false);
    } catch (e) { show(e.message || 'Lỗi tải cài đặt API', 'error'); } finally { setLoading(false); }
  }, [show]);
  useEffect(() => { load(); }, [load]);

  const dat = (ma, thayDoi) => {
    setRows((old) => old.map((r) => (r.ma === ma ? { ...r, ...thayDoi } : r)));
    setDirty(true);
  };

  // TẮT là thao tác có hậu quả (ngừng gọi ERP) ⇒ hỏi lại khi API đó có cảnh báo. BẬT thì cho luôn.
  const doiTrangThai = (r, on) => {
    if (!on && r.canh_bao) { setXacNhan({ ...r, batTiep: on }); return; }
    dat(r.ma, { bat: on });
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const res = await saveCaiDatApi(rows.map((r) => ({
        ma: r.ma, bat: r.bat, ghi_chu: r.ghi_chu || null, code_phan: r.code_phan || null,
      })));
      setRows(res.data.items || []);
      setDirty(false);
      show('Đã lưu cài đặt API — có hiệu lực ngay, không cần khởi động lại');
    } catch (e) { show(e.message || 'Lỗi lưu', 'error'); } finally { setSaving(false); }
  };

  const doThu = async (ma) => {
    setThu((t) => ({ ...t, [ma]: { dangThu: true } }));
    try {
      const res = await thuKetNoiApi(ma);
      setThu((t) => ({ ...t, [ma]: { ...res.data, dangThu: false } }));
    } catch (e) {
      setThu((t) => ({ ...t, [ma]: { ok: false, thong_diep: e.message || 'Lỗi thử kết nối', dangThu: false } }));
    }
  };

  return (
    <div>
      <Toolbar title="Cài đặt API" subtitle="Bật / tắt các API gọi sang ERP. Đổi xong bấm Lưu — có hiệu lực ngay, không cần khởi động lại máy chủ.">
        {canEdit && (
          <Button onClick={doSave} loading={saving} disabled={!dirty} icon="save">
            Lưu thay đổi
          </Button>
        )}
      </Toolbar>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const t = thu[r.ma] || {};
            return (
              <div key={r.ma} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-ink">{r.ten}</h3>
                      <Badge tone={r.bat ? 'success' : 'danger'}>{r.bat ? 'Đang bật' : 'ĐANG TẮT'}</Badge>
                      {r.bat && r.so_code_phan > 0 && (
                        <Badge tone="warning" title="Chỉ gọi API cho các code phần đã liệt kê — phần in khác bị bỏ qua">
                          Giới hạn {r.so_code_phan} code phần
                        </Badge>
                      )}
                      {r.theo_mac_dinh && (
                        <Badge tone="default" title="Chưa ai đổi — đang chạy theo cấu hình .env của máy chủ">
                          Theo mặc định
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">{r.mo_ta}</p>
                    <p className="mt-1 break-all font-mono text-xs text-ink-soft">{r.url || '(chưa có URL)'}</p>
                    {r.nguoi_sua && (
                      <p className="mt-1 text-xs text-ink-soft">
                        Sửa gần nhất: <b>{r.nguoi_sua}</b> · {fmtDT(r.tg_sua)}
                        {r.ghi_chu ? ` · ${r.ghi_chu}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="secondary" icon="wifi" loading={t.dangThu} onClick={() => doThu(r.ma)}>
                      Thử kết nối
                    </Button>
                    <Toggle on={r.bat} disabled={!canEdit} onChange={(v) => doiTrangThai(r, v)}
                      title={canEdit ? (r.bat ? 'Bấm để TẮT' : 'Bấm để BẬT') : 'Không có quyền sửa'} />
                  </div>
                </div>

                {!r.bat && r.canh_bao && (
                  <div className="mt-3 flex items-start gap-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    <Icon name="alert-triangle" size={16} className="mt-0.5 shrink-0" />
                    <span>{r.canh_bao}</span>
                  </div>
                )}

                {t.thong_diep && (
                  <div className={`mt-3 flex items-start gap-2 rounded-control border px-3 py-2 text-sm ${
                    t.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    <Icon name={t.ok ? 'check' : 'x'} size={16} className="mt-0.5 shrink-0" />
                    <span>{t.thong_diep}</span>
                  </div>
                )}

                {canEdit && !r.bat && (
                  <div className="mt-3">
                    <Textarea rows={2} value={r.ghi_chu || ''} placeholder="Lý do tắt (tùy chọn) — để người sau biết vì sao và khi nào bật lại…"
                      onChange={(e) => dat(r.ma, { ghi_chu: e.target.value })} />
                  </div>
                )}

                {/* Giới hạn phạm vi — chỉ hiện khi API ĐANG BẬT và API đó cho phép lọc theo code phần.
                    Tắt rồi thì danh sách vô nghĩa, hiện ra chỉ làm rối. */}
                {r.bat && r.loc_code_phan && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Chỉ áp dụng cho code phần
                      {r.so_code_phan > 0
                        ? <Badge tone="warning">{r.so_code_phan} mã</Badge>
                        : <Badge tone="default">đang áp dụng cho TẤT CẢ</Badge>}
                    </div>
                    {canEdit ? (
                      <Textarea rows={3} value={r.code_phan || ''}
                        placeholder={'Để TRỐNG = áp dụng cho tất cả phần in.\nMuốn chạy thử thì dán từng code phần, mỗi mã 1 dòng (hoặc ngăn bằng dấu phẩy):\nSL-2608-006-A07-F01-C05'}
                        onChange={(e) => dat(r.ma, { code_phan: e.target.value })} />
                    ) : (
                      <p className="whitespace-pre-line text-sm text-ink-soft">{r.code_phan || 'Tất cả phần in'}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-soft">
                      Khớp <b>chính xác</b> cả mã (không phân biệt hoa–thường). Phần in ngoài danh sách
                      được <b>bỏ qua im lặng</b> — không gọi ERP, không ghi nhật ký.
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-xs text-ink-soft">
            ⓘ &ldquo;Thử kết nối&rdquo; chỉ kiểm xem có ra tới máy chủ ERP hay không — cố ý KHÔNG gọi vào
            đúng chức năng, vì gọi thử API mã tem sẽ <b>tiêu mất một mã</b>, còn API ghi in tem sẽ ghi
            một bản ghi rác sang ERP.
          </p>
        </div>
      )}

      <ConfirmDialog open={!!xacNhan} onClose={() => setXacNhan(null)}
        title={`Tắt: ${xacNhan?.ten || ''}?`}
        message={xacNhan?.canh_bao}
        confirmText="Tắt API này" variant="danger"
        onConfirm={() => { dat(xacNhan.ma, { bat: false }); setXacNhan(null); }} />

      <Toast toast={toast} />
    </div>
  );
}
