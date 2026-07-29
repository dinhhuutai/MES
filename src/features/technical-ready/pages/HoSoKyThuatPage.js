import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import QrScanner from '../../../components/common/QrScanner';
import LoaiDotVaiBadge from '../../planning/components/LoaiDotVaiBadge';
import { Input, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listHskt, getHskt, getHsktByBarcode, changePhuongAnIn, PHUONG_AN_IN } from '../../../services/hsktService';
import { fmtNum } from '../../../utils/format';

const COLS = 12; // số cột bảng (cho colSpan hàng trống)
const fmtDateTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');
const paBadge = (v) => (v == null ? <span className="text-ink-soft">—</span>
  : <Badge tone="info">{PHUONG_AN_IN[Number(v)] || v}</Badge>);

// Danh sách phần in trong 1 HSKT.
function PhanInList({ rows }) {
  if (!rows || rows.length === 0) return <div className="py-6 text-center text-sm text-ink-soft">Không có phần in</div>;
  return (
    <div className="space-y-1.5">
      {rows.map((p) => (
        <div key={p.id} className="rounded-control border border-line px-3 py-2 text-sm">
          <div className="font-medium text-ink">{p.ma_phan} · {p.mau_vai || '—'}</div>
          <div className="truncate text-xs text-ink-soft">
            {p.ten_khach_hang || '—'} · {p.ma_hang} · Kích {p.kich_vai || '—'}/{p.kich_phim || '—'} · SLĐH {fmtNum(p.so_luong_don_hang)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HoSoKyThuatPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('READY_KHUON') || can('READY_FILM') || can('READY_MUC');

  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanVal, setScanVal] = useState('');

  const [detail, setDetail] = useState(null);      // { hskt, phan_in, lich_su }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [camOpen, setCamOpen] = useState(false);   // quét mã vạch HSKT bằng camera
  const [savingPa, setSavingPa] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listHskt({ search, limit: 100 });
      setRows(res.data.items);
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); } finally { setLoading(false); }
  }, [search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openDetail = async (id) => {
    setLoadingDetail(true); setDetail({ hskt: { id } });
    try { const res = await getHskt(id); setDetail(res.data); }
    catch (e) { show(e.message || 'Lỗi tải chi tiết', 'error'); setDetail(null); }
    finally { setLoadingDetail(false); }
  };

  // Quét / nhập mã vạch HSKT (đầu đọc USB, camera hoặc gõ tay) → MỞ THẲNG SidePanel của HSKT đó
  // để xem thông tin & cập nhật phương án in.
  const doScan = async (code) => {
    const bc = String(code || '').trim();
    if (!bc) return;
    setCamOpen(false);
    try {
      const res = await getHsktByBarcode(bc);
      setScanVal('');
      await openDetail(res.data.hskt.id);
    } catch (e) { show(e.message || 'Không tìm thấy HSKT', 'error'); }
  };

  // Deep-link từ nút Quét (bottom nav): ?bc=<barcode HSKT> → tự mở SidePanel HSKT đó.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const bc = searchParams.get('bc');
    if (bc) doScan(bc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onChangePa = async (val) => {
    if (!detail?.hskt?.id) return;
    setSavingPa(true);
    try {
      const res = await changePhuongAnIn(detail.hskt.id, Number(val));
      setDetail(res.data); load();
      show('Đã đổi phương án in (tạo phiên bản mới)');
    } catch (e) { show(e.message || 'Đổi phương án in thất bại', 'error'); }
    finally { setSavingPa(false); }
  };

  return (
    <div>
      <Toolbar title="Hồ sơ kỹ thuật"
        subtitle="HSKT theo phần in (mới nhất). 1 HSKT có nhiều phần in (gom set); đổi phương án in tạo phiên bản mới, giữ lịch sử.">
        <div className="flex items-center gap-2">
          <Icon name="scan" size={16} className="text-ink-soft" />
          <Input value={scanVal} onChange={(e) => setScanVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doScan(scanVal); }}
            placeholder="Quét / nhập mã vạch HSKT..." className="w-56" />
          <Button variant="secondary" icon="scan-line" onClick={() => setCamOpen(true)}>Quét camera</Button>
        </div>
      </Toolbar>

      <div className="mb-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm mã vạch HSKT / code phần..." className="max-w-md" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-16rem)]">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted text-left text-xs font-semibold uppercase text-ink-soft">
              <tr>
                <th className="px-3 py-2">STT</th>
                <th className="px-3 py-2">Mã vạch HSKT</th>
                <th className="px-3 py-2">Phương án in</th>
                <th className="px-3 py-2 text-right">Số phần in</th>
                <th className="px-3 py-2">Code phần</th>
                <th className="px-3 py-2">Khách hàng</th>
                <th className="px-3 py-2">Đơn hàng</th>
                <th className="px-3 py-2">Mã hàng</th>
                <th className="px-3 py-2">Màu vải</th>
                <th className="px-3 py-2">Kích vải</th>
                <th className="px-3 py-2">Kích phim</th>
                <th className="px-3 py-2">Loại đợt vải</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLS} className="py-10 text-center text-ink-soft">Đang tải...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={COLS} className="py-10 text-center text-ink-soft">Chưa có HSKT</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} onClick={() => openDetail(r.id)}
                  className="cursor-pointer border-t border-line hover:bg-surface-muted/50">
                  <td className="px-3 py-2 text-ink-soft">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-ink">{r.barcode_hskt || '—'}</td>
                  <td className="px-3 py-2">{paBadge(r.phuong_an_in)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.so_phan_in}</td>
                  <td className="px-3 py-2 text-ink-soft max-w-[18rem] truncate">{r.code_phan_list || '—'}</td>
                  <td className="px-3 py-2 font-medium text-ink">{r.ten_khach_hang || '—'}</td>
                  <td className="px-3 py-2">{r.ma_don_hang || '—'}</td>
                  <td className="px-3 py-2">{r.ma_hang || '—'}</td>
                  <td className="px-3 py-2">{r.mau_vai || '—'}</td>
                  <td className="px-3 py-2">{r.kich_vai || '—'}</td>
                  <td className="px-3 py-2">{r.kich_phim || '—'}</td>
                  <td className="px-3 py-2"><LoaiDotVaiBadge value={r.loai_dot_vai} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chi tiết HSKT */}
      <SidePanel open={!!detail} onClose={() => setDetail(null)}
        title={detail?.hskt?.barcode_hskt ? `HSKT ${detail.hskt.barcode_hskt}` : 'Chi tiết HSKT'}
        subtitle={detail?.phan_in ? `${detail.phan_in.length} phần in · phiên bản ${detail.hskt.phien_ban}` : ''}
        width="max-w-2xl">
        {loadingDetail || !detail?.hskt?.id ? (
          <div className="py-10 text-center text-ink-soft">Đang tải...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-control border border-line p-3 text-sm">
              <div><div className="text-xs text-ink-soft">Mã vạch HSKT</div><div className="font-medium text-ink">{detail.hskt.barcode_hskt || '—'}</div></div>
              {/* ERP `Inset` = SỐ NHÓM gom set trong phạm vi đợt ready (ma_don_ready), 0 = không gom. */}
              <div><div className="text-xs text-ink-soft">Gom set</div><div className="mt-1">{Number(detail.hskt.inset) > 0 ? <Badge tone="warning">Nhóm set {detail.hskt.inset}</Badge> : <Badge tone="default">Không</Badge>}</div></div>
              <div>
                <div className="text-xs text-ink-soft">Phương án in</div>
                <div className="mt-1 flex items-center gap-2">
                  <Select value={detail.hskt.phuong_an_in || ''} disabled={!canManage || savingPa}
                    onChange={(e) => onChangePa(e.target.value)} className="w-40">
                    <option value="" disabled>— Chọn —</option>
                    <option value={1}>Bàn</option>
                    <option value={2}>Máy</option>
                    <option value={3}>Robot</option>
                  </Select>
                  {savingPa && <span className="text-xs text-ink-soft">Đang lưu...</span>}
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-ink">Phần in trong HSKT ({detail.phan_in.length})</h4>
              <PhanInList rows={detail.phan_in} />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-ink">Lịch sử thao tác</h4>
              {(!detail.lich_su || detail.lich_su.length === 0) ? (
                <div className="text-sm text-ink-soft">Chưa có lịch sử</div>
              ) : (
                <div className="space-y-1.5">
                  {detail.lich_su.map((h, i) => (
                    <div key={i} className="rounded-control border border-line px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">{h.hanh_dong} <span className="text-ink-soft">v{h.phien_ban}</span></span>
                        <span className="text-ink-soft">{fmtDateTime(h.tg)}</span>
                      </div>
                      {h.chi_tiet && <div className="text-ink-soft">{h.chi_tiet}</div>}
                      <div className="text-ink-soft">{h.nguoi || '—'}{h.ma_phan ? ` · ${h.ma_phan}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SidePanel>

      {/* Quét mã vạch HSKT bằng camera (QR + barcode) → mở SidePanel HSKT */}
      <QrScanner open={camOpen} onClose={() => setCamOpen(false)} onResult={doScan}
        title="Quét mã vạch HSKT" />

      <Toast toast={toast} />
    </div>
  );
}
