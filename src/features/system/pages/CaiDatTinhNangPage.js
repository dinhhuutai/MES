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
import {
  listCaiDatTinhNang, saveCaiDatTinhNang, xoaCacheTinhNang,
} from '../../../services/caiDatTinhNangService';

// Hệ thống > Cài đặt tính năng (mig 087) — bật/tắt LUẬT NGHIỆP VỤ.
// Dựng lại y hệt `CaiDatApiPage` để 2 trang cấu hình nhìn như một.
//
// ⚠ Danh mục tính năng nằm ở BACKEND (`utils/caiDatTinhNang.js`) ⇒ thêm toggle mới KHÔNG phải sửa
//   trang này, cũng không cần migration.

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

export default function CaiDatTinhNangPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canEdit = can('WORKFLOW_MANAGE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [xacNhan, setXacNhan] = useState(null); // hỏi lại trước khi TẮT
  const [hauQua, setHauQua] = useState([]);     // kết quả duyệt sạch hàng đợi sau khi tắt

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCaiDatTinhNang();
      setRows(res.data.items || []);
      setDirty(false);
    } catch (e) { show(e.message || 'Lỗi tải cài đặt tính năng', 'error'); } finally { setLoading(false); }
  }, [show]);
  useEffect(() => { load(); }, [load]);

  const dat = (ma, thayDoi) => {
    setRows((old) => old.map((r) => (r.ma === ma ? { ...r, ...thayDoi } : r)));
    setDirty(true);
  };

  // TẮT là thao tác có hậu quả (bỏ qua một luật kiểm soát) ⇒ hỏi lại. BẬT thì cho luôn.
  const doiTrangThai = (r, on) => {
    if (!on && r.canh_bao) { setXacNhan(r); return; }
    dat(r.ma, { bat: on });
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const res = await saveCaiDatTinhNang(rows.map((r) => ({
        ma: r.ma, bat: r.bat, ghi_chu: r.ghi_chu || null,
      })));
      setRows(res.data.items || []);
      setDirty(false);
      // ⚠ Trang này ĐỔI HÀNH VI của các màn khác ⇒ xóa cache trạng thái ở FE ngay, không chờ TTL 60s.
      xoaCacheTinhNang();

      // Tắt công tắc duyệt ⇒ hàng đợi được duyệt sạch. PHẢI nói rõ đã áp dụng bao nhiêu — im lặng
      // thì người bấm không biết mình vừa đổi phương án in cho hàng loạt hồ sơ.
      const hq = res.data.hau_qua || [];
      setHauQua(hq);
      const tong = hq.reduce((a, b) => a + (b.da_duyet || 0), 0);
      const loi = hq.reduce((a, b) => a + ((b.loi || []).length), 0);
      show(`Đã lưu cài đặt — có hiệu lực ngay, không cần khởi động lại`
        + (tong ? ` · đã áp dụng ${tong} yêu cầu đang chờ duyệt` : '')
        + (loi ? ` · ${loi} yêu cầu KHÔNG áp dụng được` : ''), loi ? 'error' : undefined);
    } catch (e) { show(e.message || 'Lỗi lưu', 'error'); } finally { setSaving(false); }
  };

  return (
    <div>
      <Toolbar title="Cài đặt tính năng"
        subtitle="Bật / tắt các luật nghiệp vụ siết chặt. Đổi xong bấm Lưu — có hiệu lực ngay, không cần khởi động lại máy chủ.">
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
          {rows.map((r) => (
            <div key={r.ma} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">{r.ten}</h3>
                    <Badge tone={r.bat ? 'success' : 'danger'}>{r.bat ? 'Đang bật' : 'ĐANG TẮT'}</Badge>
                    {r.theo_mac_dinh && (
                      <Badge tone="default" title="Chưa ai đổi — đang chạy theo mặc định của hệ thống">
                        Theo mặc định
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{r.mo_ta}</p>
                  {!r.bat && r.khi_tat && (
                    <p className="mt-1 text-sm text-ink">
                      <b>Đang áp dụng:</b> {r.khi_tat}
                    </p>
                  )}
                  {r.nguoi_sua && (
                    <p className="mt-1 text-xs text-ink-soft">
                      Sửa gần nhất: <b>{r.nguoi_sua}</b> · {fmtDT(r.tg_sua)}
                      {r.ghi_chu ? ` · ${r.ghi_chu}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
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

              {canEdit && !r.bat && (
                <div className="mt-3">
                  <Textarea rows={2} value={r.ghi_chu || ''}
                    placeholder="Lý do tắt (tùy chọn) — để người sau biết vì sao và khi nào bật lại…"
                    onChange={(e) => dat(r.ma, { ghi_chu: e.target.value })} />
                </div>
              )}
            </div>
          ))}

          {/* Kết quả duyệt sạch hàng đợi — chỉ hiện ngay sau lần lưu vừa rồi. */}
          {hauQua.map((h) => (
            <div key={h.ma} className="rounded-card border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-sm">
                <Icon name="check" size={16} className="text-success" />
                <span>
                  Hàng đợi duyệt: <b>{h.da_duyet}</b>/{h.tong} yêu cầu đã được áp dụng do tắt tính năng.
                </span>
              </div>
              {(h.loi || []).length > 0 && (
                <div className="mt-2 rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <b>{h.loi.length} yêu cầu KHÔNG áp dụng được</b> (vẫn nằm chờ trong hàng đợi):
                  <ul className="mt-1 list-disc pl-5">
                    {h.loi.map((x, i) => (
                      <li key={x.id || i}>{x.mo_ta ? `${x.mo_ta} — ` : ''}{x.thong_diep}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

          <p className="text-xs text-ink-soft">
            ⓘ Cấu hình này chỉ nới/siết <b>luật kiểm tra</b>, không đụng tới dữ liệu đã có. Chưa ai đổi
            thì hệ thống chạy theo mặc định — đúng như trước khi có trang này.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={!!xacNhan}
        onClose={() => setXacNhan(null)}
        onConfirm={() => { dat(xacNhan.ma, { bat: false }); setXacNhan(null); }}
        title={`Tắt: ${xacNhan?.ten || ''}`}
        /* ⚠ `ConfirmDialog` bọc `message` trong <p> ⇒ CHỈ dùng phần tử inline (<span>/<b>), đưa
           <div>/<p> vào là HTML lồng sai và React cảnh báo ngay trên console. */
        message={
          <>
            <span className="block">{xacNhan?.canh_bao}</span>
            {xacNhan?.khi_tat && (
              <span className="mt-2 block text-ink"><b>Sau khi tắt:</b> {xacNhan.khi_tat}</span>
            )}
            <span className="mt-2 block">Thay đổi chỉ thật sự có hiệu lực khi bạn bấm <b>Lưu thay đổi</b>.</span>
          </>
        }
        confirmText="Tắt tính năng"
        variant="danger"
      />

      <Toast toast={toast} />
    </div>
  );
}
