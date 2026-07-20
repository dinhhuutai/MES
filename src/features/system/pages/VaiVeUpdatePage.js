import { useEffect, useState, useCallback } from 'react';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import { inputClass } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import { fmtNum } from '../../../utils/format';
import { searchVaiVe, updateVaiVe, updateRelease } from '../../../services/manualEntryService';

const LSX_TT = {
  RELEASE_1: { ten: 'Release 1', tone: 'info' },
  RELEASE_2: { ten: 'Release 2', tone: 'info' },
  SAN_XUAT: { ten: 'Đang SX', tone: 'warning' },
  HOAN_TAT: { ten: 'Hoàn tất', tone: 'success' },
  CHO_IN_XONG: { ten: 'Chờ in xong', tone: 'default' },
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—');

// 1 ô nhập số + nút Lưu (hiện nút khi giá trị thay đổi).
function NumberSave({ value, onSave, label }) {
  const [v, setV] = useState(String(value ?? 0));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setV(String(value ?? 0)); }, [value]);
  const changed = String(value ?? 0) !== String(v).trim() && v.trim() !== '';
  const save = async () => {
    setSaving(true);
    try { await onSave(Number(v)); } finally { setSaving(false); }
  };
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-ink-soft">{label}</span>}
      <input
        type="number" min="0" value={v}
        onChange={(e) => setV(e.target.value)}
        className={`${inputClass} !h-9 w-28 text-right tabular-nums`} />
      <Button icon="check-circle" className="!px-3 !py-1.5" disabled={!changed || saving} loading={saving} onClick={save}>Lưu</Button>
    </div>
  );
}

export default function VaiVeUpdatePage() {
  const { toast, show } = useToast();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await searchVaiVe(q); setRows(r.data || []); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
    finally { setLoading(false); }
  }, [q, show]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const onSaveVaiVe = async (dv, val) => {
    try {
      await updateVaiVe(dv.id, val);
      show(`Đã cập nhật SL nhận vải đợt ${dv.ma_dot_vai}`, 'success');
      load();
    } catch (e) { show(e.message || 'Lỗi cập nhật', 'error'); }
  };
  const onSaveRelease = async (dv, rel, val) => {
    try {
      await updateRelease(rel.lenh_san_xuat_id, dv.id, val);
      show(`Đã cập nhật SL release lệnh ${rel.ma_lenh_san_xuat}`, 'success');
      load();
    } catch (e) { show(e.message || 'Lỗi cập nhật', 'error'); }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-ink">Cập nhật số lượng nhận vải</h1>
        <p className="text-sm text-ink-soft">
          Sửa <b>SL nhận vải</b> của đợt vải. Nếu đợt đã <b>Release</b> thì cập nhật thêm <b>SL release</b> của lệnh (không cho giảm dưới SL đã in).
        </p>
      </div>

      <div className="mb-4 relative max-w-xl">
        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo code phần / mã đợt vải / mã hàng / màu vải / đơn hàng..."
          className="h-11 w-full rounded-input border border-line bg-surface pl-9 pr-3 text-sm" />
      </div>

      {loading && rows.length === 0 ? (
        <div className="card p-10 text-center text-ink-soft">Đang tải...</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-ink-soft">
          {q.trim() ? `Không tìm thấy đợt vải khớp "${q.trim()}".` : 'Nhập từ khóa để tìm đợt vải cần cập nhật.'}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((dv) => (
            <div key={dv.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{dv.ma_phan}</div>
                  <div className="text-xs text-ink-soft">
                    {[dv.ten_khach_hang, dv.ma_don_hang, dv.ma_hang].filter(Boolean).join(' · ')}
                  </div>
                  <div className="text-xs text-ink-soft">
                    {[dv.mau_vai, dv.kich_vai, dv.kich_phim].filter(Boolean).join(' · ')}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                    <Badge tone="default">Đợt {dv.ma_dot_vai}</Badge>
                    <span>Vải về: {fmtDate(dv.ngay_vai_ve)}</span>
                    <span>· Hạn giao: {fmtDate(dv.han_giao_hang)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="info">Đã release {fmtNum(dv.da_release)}</Badge>
                  <Badge tone={dv.con_release > 0 ? 'warning' : 'success'}>Còn release {fmtNum(dv.con_release)}</Badge>
                </div>
              </div>

              {/* SL nhận vải */}
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface-muted px-3 py-2">
                <span className="text-sm font-medium text-ink">SL nhận vải</span>
                <NumberSave value={dv.so_luong_vai_ve} onSave={(val) => onSaveVaiVe(dv, val)} />
              </div>

              {/* SL release (nếu đã release) */}
              {dv.releases.length > 0 && (
                <div className="mt-2 rounded-control border border-primary/25 bg-primary-wash/50 px-3 py-2">
                  <div className="mb-1.5 text-sm font-medium text-primary">SL release (đợt vải này trong từng lệnh)</div>
                  <div className="space-y-2">
                    {dv.releases.map((rel) => {
                      const tt = LSX_TT[rel.trang_thai] || { ten: rel.trang_thai, tone: 'default' };
                      return (
                        <div key={rel.lenh_san_xuat_id} className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-ink">{rel.ma_lenh_san_xuat}</span>
                          <Badge tone={tt.tone}>{tt.ten}</Badge>
                          <span className="text-xs text-ink-soft">SL lệnh: {fmtNum(rel.so_luong_release)}</span>
                          <div className="ml-auto">
                            <NumberSave value={rel.so_luong} label="SL release" onSave={(val) => onSaveRelease(dv, rel, val)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
