import { useCallback, useEffect, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import Spinner from '../../../components/common/Spinner';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { layCaiDatHeThong, luuCaiDatHeThong } from '../../../services/thongBaoService';
import { fmtDateTime } from '../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// HỆ THỐNG > CÀI ĐẶT THÔNG BÁO (mig 085) — bật/tắt cho CẢ HỆ THỐNG.
//
// ⚠⚠ TẮT Ở ĐÂY LÀ TẮT CHO MỌI NGƯỜI: người dùng có bật ở trang cá nhân cũng KHÔNG nhận.
//   Ngược lại bật ở đây chỉ là "cho phép" — từng người vẫn tự tắt phần của mình được.
// ⚠ THIẾU DÒNG = BẬT (fail-open): chưa chạy mig 085 hay DB lỗi thì thông báo vẫn chạy, không tự tắt
//   câm lặng. Vì vậy trang này hiện "Bật" cho mọi dòng khi bảng chưa có.
// ─────────────────────────────────────────────────────────────────────────────

// Công tắc gạt dùng lại nhiều chỗ trong trang.
function Gat({ bat, onChange, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={bat} disabled={disabled}
      onClick={() => onChange(!bat)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition
        ${bat ? 'bg-primary' : 'bg-line'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition
        ${bat ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function CaiDatThongBaoPage() {
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const suaDuoc = can('WORKFLOW_MANAGE');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sua, setSua] = useState({});      // { ma_loai: { bat, ghi_chu } } — thay đổi CHƯA lưu
  const [hoi, setHoi] = useState(null);

  const tai = useCallback(async () => {
    setLoading(true);
    try {
      const r = await layCaiDatHeThong();
      setData(r.data);
      setSua({});
    } catch (e) { show(e.message || 'Không tải được cài đặt', 'error'); }
    finally { setLoading(false); }
  }, [show]);

  useEffect(() => { tai(); }, [tai]);

  const tatCa = [...(data?.loai || []), ...(data?.co_he_thong || [])];
  const giaTri = (r) => (sua[r.ma_loai] ? sua[r.ma_loai] : { bat: r.bat, ghi_chu: r.ghi_chu });
  const doi = (r, patch) => setSua((s) => ({ ...s, [r.ma_loai]: { ...giaTri(r), ...patch } }));
  const soDoi = Object.keys(sua).length;

  const luu = async () => {
    setSaving(true);
    try {
      const items = Object.entries(sua).map(([ma_loai, v]) => ({ ma_loai, bat: v.bat, ghi_chu: v.ghi_chu }));
      await luuCaiDatHeThong(items);
      show(`Đã lưu ${items.length} thay đổi`);
      await tai();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    finally { setSaving(false); setHoi(null); }
  };

  // Tắt là ảnh hưởng CẢ NHÀ MÁY → hỏi lại, liệt kê rõ cái nào bị tắt.
  const truocKhiLuu = () => {
    const tat = Object.entries(sua).filter(([, v]) => !v.bat)
      .map(([ma]) => tatCa.find((x) => x.ma_loai === ma)?.ten || ma);
    if (tat.length) setHoi(tat); else luu();
  };

  const The = ({ r, laCo }) => {
    const v = giaTri(r);
    const doiSoVoiLuu = sua[r.ma_loai] && (sua[r.ma_loai].bat !== r.bat || (sua[r.ma_loai].ghi_chu || '') !== (r.ghi_chu || ''));
    return (
      <div className={`card p-4 ${doiSoVoiLuu ? 'ring-2 ring-primary/40' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{r.ten}</span>
              {laCo && <Badge tone="info">Cờ hệ thống</Badge>}
              <Badge tone={v.bat ? 'success' : 'danger'}>{v.bat ? 'Đang bật' : 'Đang tắt'}</Badge>
              {doiSoVoiLuu && <Badge tone="warning">chưa lưu</Badge>}
            </div>
            <p className="mt-1 text-sm text-ink-soft">{r.mo_ta}</p>
            <p className="mt-1 text-[11px] text-ink-soft">
              Mã: <code>{r.ma_loai}</code>
              {r.updated_date && ` · sửa lần cuối ${fmtDateTime(r.updated_date)}${r.nguoi_sua ? ` bởi ${r.nguoi_sua}` : ''}`}
            </p>
          </div>
          <Gat bat={v.bat} disabled={!suaDuoc} onChange={(b) => doi(r, { bat: b })} />
        </div>
        {suaDuoc && (
          <div className="mt-3">
            <Input value={v.ghi_chu || ''} placeholder="Ghi chú (vì sao bật/tắt) — tùy chọn"
              onChange={(e) => doi(r, { ghi_chu: e.target.value })} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl">
      <Toolbar title="Cài đặt thông báo" subtitle="Bật/tắt thông báo ở mức HỆ THỐNG — áp cho mọi người dùng">
        {soDoi > 0 && suaDuoc && (
          <Button loading={saving} onClick={truocKhiLuu}>Lưu {soDoi} thay đổi</Button>
        )}
        {soDoi > 0 && <Button variant="ghost" onClick={() => setSua({})}>Hủy thay đổi</Button>}
      </Toolbar>

      {loading && <div className="flex justify-center py-16"><Spinner size={28} /></div>}

      {!loading && data && (
        <div className="space-y-5">
          {!suaDuoc && (
            <div className="rounded-control border border-line bg-surface-muted p-3 text-sm text-ink-soft">
              Bạn chỉ có quyền XEM cài đặt này (cần <code>WORKFLOW_MANAGE</code> để sửa).
            </div>
          )}

          {data.thieu_bang && (
            <div className="rounded-control border border-warning/40 bg-warning/5 p-3 text-sm">
              <b>Chưa chạy migration 085.</b> Mọi loại đang hiển thị mặc định là <b>Bật</b> và bấm lưu
              sẽ lỗi. Chạy <code>database/migrations/085_thong_bao.sql</code> bằng user <code>postgres</code>.
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
              Loại thông báo
            </h2>
            <p className="mb-3 text-sm text-ink-soft">
              Tắt loại nào thì <b>không ai</b> nhận loại đó nữa, kể cả người đã bật ở trang cá nhân.
            </p>
            <div className="space-y-3">
              {(data.loai || []).map((r) => <The key={r.ma_loai} r={r} />)}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
              Cách gửi
            </h2>
            <div className="space-y-3">
              {(data.co_he_thong || []).map((r) => <The key={r.ma_loai} r={r} laCo />)}
            </div>

            {/* ⚠ Trạng thái Web Push — thiếu dòng này thì admin bật `PUSH_NEN` mà máy không nhận
                được gì cũng không biết vì sao (thiếu VAPID key / chưa cài `web-push`). */}
            <div className="card mt-3 flex items-start gap-2.5 p-4">
              <Icon name={data.push?.san_sang ? 'check-circle' : 'alert-triangle'} size={18}
                className={data.push?.san_sang ? 'mt-0.5 text-success' : 'mt-0.5 text-warning'} />
              <div className="text-sm">
                <div className="font-medium text-ink">
                  Máy chủ Web Push: {data.push?.san_sang ? 'sẵn sàng' : 'chưa dùng được'}
                </div>
                {!data.push?.san_sang && (
                  <p className="mt-1 text-ink-soft">
                    {data.push?.ly_do}. Khi chưa sẵn sàng, bật &quot;{(data.co_he_thong || [])[0]?.ten}&quot;
                    cũng <b>không</b> gửi được khi app đã đóng — người dùng vẫn nhận popup lúc app đang mở.
                    Sinh khóa: <code>npx web-push generate-vapid-keys</code> rồi đặt
                    <code> VAPID_PUBLIC_KEY</code> / <code>VAPID_PRIVATE_KEY</code> vào <code>.env</code> và khởi động lại backend.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!hoi}
        onClose={() => setHoi(null)}
        onConfirm={luu}
        title="Tắt thông báo cho cả hệ thống?"
        confirmText="Tắt và lưu"
        variant="danger"
        message={hoi && (
          <div className="space-y-2 text-sm">
            <p>Các mục sau sẽ bị <b>tắt cho toàn bộ người dùng</b>:</p>
            <ul className="list-inside list-disc text-ink">{hoi.map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="text-ink-soft">
              Người dùng đã bật ở trang cá nhân cũng sẽ không nhận nữa, và cái chuông của họ sẽ
              không còn đếm loại này.
            </p>
          </div>
        )}
      />
      <Toast toast={toast} />
    </div>
  );
}
