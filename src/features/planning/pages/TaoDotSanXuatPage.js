import { useEffect, useMemo, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import { Field, Input, Select } from '../../../components/common/controls';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import QrScanner from '../../../components/common/QrScanner';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import ReleaseListModal from '../components/ReleaseListModal';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listRelease1Candidates, createDotSanXuat, listChuyen } from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

const norm = (s) => (s || '').trim().toLowerCase();

// Chọn giờ 24h (0h–23h) + phút, KHÔNG có AM/PM — dễ chọn hơn <input type="time">.
// value/onChange dạng "HH:MM" (rỗng = chưa chọn). Đặt ở module level để không bị remount.
const HOURS = Array.from({ length: 24 }, (_, i) => i);        // 0h → 23h
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
function TimeSelect({ value, onChange }) {
  const [rawH = '', rawM = ''] = value ? value.split(':') : [];
  const hh = rawH === '' ? '' : String(Number(rawH));
  const mm = rawM === '' ? '' : String(Number(rawM));
  const emit = (nh, nm) => {
    if (nh === '' && nm === '') { onChange(''); return; } // xóa cả hai → bỏ chọn
    const H = String(nh === '' ? 0 : Number(nh)).padStart(2, '0');
    const M = String(nm === '' ? 0 : Number(nm)).padStart(2, '0');
    onChange(`${H}:${M}`);
  };
  return (
    <div className="flex items-center gap-1.5">
      <Select value={hh} onChange={(e) => emit(e.target.value, mm)} className="!px-2 tabular-nums" aria-label="Giờ">
        <option value="">-- giờ --</option>
        {HOURS.map((x) => <option key={x} value={x}>{x}h</option>)}
      </Select>
      <span className="text-ink-soft">:</span>
      <Select value={mm} onChange={(e) => emit(hh, e.target.value)} className="!px-2 tabular-nums" aria-label="Phút">
        <option value="">phút</option>
        {MINUTES.map((x) => <option key={x} value={x}>{String(x).padStart(2, '0')}</option>)}
      </Select>
    </div>
  );
}

// Ngày mai (giờ máy) dạng YYYY-MM-DD — mặc định cho ô "Ngày kế hoạch".
const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

// Màn "Tạo đợt sản xuất": chọn nhiều đợt vải CÙNG PHẦN IN (code phần) để gộp, hoặc 1 đợt nhập một phần (tách),
// nhập SL từng đợt (≤ còn đưa), rồi Xác nhận → tạo 1 đợt SX (lenh_san_xuat) + so_luong junction.
// Gom nhiều PHẦN IN khác nhau (cùng màu) là việc của Gom set ở READY — KHÔNG làm ở đây.
export default function TaoDotSanXuatPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRelease = can('RELEASE1');

  const [rows, setRows] = useState([]);
  const [chuyen, setChuyen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [basket, setBasket] = useState([]); // [{ dot_vai_id, soLuong, ...row }]
  const [chuyenId, setChuyenId] = useState('');
  const [ngayKeHoach, setNgayKeHoach] = useState(tomorrowStr());
  const [gioBd, setGioBd] = useState('');
  const [gioKt, setGioKt] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRelease1Candidates({ search, limit: 1000 });
      setRows(res.data.items);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { listChuyen().then((r) => setChuyen(r.data || [])).catch(() => {}); }, []);

  const basketIds = useMemo(() => new Set(basket.map((b) => b.dot_vai_id)), [basket]);
  const basketPin = basket.length ? basket[0].phan_in_id : null;

  // Đợt bên trái: chưa trong giỏ; nếu giỏ đã có phần in → CHỈ cho thêm đợt CÙNG PHẦN IN (code phần).
  const leftRows = rows.filter((r) => !basketIds.has(r.dot_vai_id));

  const MIXED_MSG = 'Chỉ gộp các đợt vải CÙNG PHẦN IN (code phần). Muốn gom nhiều phần in cùng màu → dùng Gom set ở READY.';
  const addToBasket = (r) => {
    if (basketPin && r.phan_in_id !== basketPin) {
      show(MIXED_MSG, 'error');
      return;
    }
    setBasket((b) => [...b, { ...r, soLuong: r.con_release }]);
  };
  const removeFromBasket = (id) => setBasket((b) => b.filter((x) => x.dot_vai_id !== id));
  const setQty = (id, v) => setBasket((b) => b.map((x) => x.dot_vai_id === id ? { ...x, soLuong: v } : x));

  // Quét QR đợt vải: khớp theo mã đợt / ID → điện thoại: nhảy vào giỏ; máy tính: cũng hiện trong ô tìm kiếm.
  const handleScan = (code) => {
    setScanOpen(false);
    const c = (code || '').trim();
    if (!c) return;
    setSearch(c); // hiện trong ô tìm kiếm (lọc danh sách bên trái)
    const found = rows.find((r) => norm(r.ma_dot_vai) === norm(c) || String(r.dot_vai_id) === c || norm(r.dot_vai_id) === norm(c));
    if (!found) { show(`Không thấy đợt vải "${c}" đủ điều kiện tạo đợt SX — xem danh sách bên trái`, 'error'); return; }
    if (basketIds.has(found.dot_vai_id)) { show(`Đợt ${found.ma_dot_vai} đã ở trong đợt đang soạn`, 'info'); return; }
    if (basketPin && found.phan_in_id !== basketPin) { show(MIXED_MSG, 'error'); return; }
    addToBasket(found);
    show(`Đã thêm đợt ${found.ma_dot_vai} vào đợt đang soạn`);
  };

  const tongSL = basket.reduce((s, b) => s + (Number(b.soLuong) || 0), 0);
  const hanList = basket.map((b) => b.han_giao_hang).filter(Boolean);
  const hanMin = hanList.length ? hanList.reduce((m, h) => (new Date(h) < new Date(m) ? h : m)) : null;
  const lechHan = new Set(hanList.map((h) => new Date(h).toDateString())).size > 1;
  const overRow = basket.find((b) => (Number(b.soLuong) || 0) > b.con_release || (Number(b.soLuong) || 0) <= 0);

  const submit = async () => {
    if (basket.length === 0) { show('Chọn ít nhất một đợt vải', 'error'); return; }
    if (!chuyenId) { show('Chọn chuyền sản xuất', 'error'); return; }
    if (overRow) { show(`SL đợt ${overRow.ma_dot_vai} không hợp lệ (0 < SL ≤ ${overRow.con_release})`, 'error'); return; }
    // Giờ BD/KT (HH:MM) ghép với ngày kế hoạch → timestamp (giờ máy). Bỏ trống nếu chưa chọn ngày/giờ.
    const mkTs = (gio) => (ngayKeHoach && gio ? `${ngayKeHoach}T${gio}:00` : null);
    setBusy(true);
    try {
      const res = await createDotSanXuat({
        items: basket.map((b) => ({ dotVaiId: b.dot_vai_id, soLuong: Number(b.soLuong) })),
        chuyenId, ngayKeHoach: ngayKeHoach || null,
        tgBdKh: mkTs(gioBd), tgKtKh: mkTs(gioKt),
      });
      const skip = res.data?.skipped_test;
      show(skip ? 'Đã tạo đợt sản xuất — bỏ Test Run (vào thẳng Release 2)' : 'Đã tạo đợt sản xuất — chờ Test Run');
      setBasket([]); setChuyenId(''); setNgayKeHoach(tomorrowStr()); setGioBd(''); setGioKt('');
      load();
    } catch (e) {
      show(e.message || 'Tạo đợt sản xuất thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Toolbar title="Tạo đợt sản xuất" subtitle="Gộp nhiều đợt vải CÙNG PHẦN IN (code phần) / tách một đợt, nhập SL từng đợt rồi đưa xuống sản xuất. (Gom nhiều phần in cùng màu → Gom set ở READY.)">
        <Button variant="secondary" icon="list" onClick={() => setReleaseOpen(true)}>Danh sách release</Button>
        <div className="relative w-full sm:w-64">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm code phần, mã hàng, màu/kích..."
            className="h-10 w-full rounded-control border border-line pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
        </div>
        <Button variant="secondary" icon="qr-code" onClick={() => setScanOpen(true)}>Quét QR đợt vải</Button>
        <Badge tone="info">{leftRows.length} đợt vải</Badge>
      </Toolbar>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* TRÁI: đợt vải đủ điều kiện */}
        <div className="rounded-card border border-line bg-surface p-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Đợt vải đủ điều kiện{basketPin ? ` · lọc phần in "${basket[0].ma_phan}"` : ''}
          </h3>
          {loading ? (
            <div className="py-10 text-center text-ink-soft">Đang tải...</div>
          ) : leftRows.length === 0 ? (
            <div className="py-10 text-center text-ink-soft">Không còn đợt vải phù hợp</div>
          ) : (
            <div className="max-h-[calc(100vh-15rem)] space-y-1.5 overflow-auto">
              {leftRows.map((r) => {
                const disabled = basketPin && r.phan_in_id !== basketPin;
                return (
                  <button key={r.dot_vai_id} type="button" disabled={disabled} onClick={() => addToBasket(r)}
                    className={`flex w-full items-start justify-between gap-2 rounded-control border px-3 py-2 text-left text-sm ${disabled ? 'cursor-not-allowed border-line opacity-40' : 'border-line hover:border-primary hover:bg-primary/5'}`}>
                    <div className="min-w-0 leading-tight">
                      {/* Hàng 1: code phần · khách hàng · đơn hàng */}
                      <div className="truncate font-medium text-ink">
                        {r.ma_phan} · <span className="font-normal text-ink-soft">{r.ten_khach_hang}</span> · <span className="font-normal text-ink-soft">{r.ma_don_hang}</span>
                      </div>
                      {/* Hàng 2: mã hàng · tính chất in */}
                      <div className="truncate text-xs text-ink-soft">
                        {r.ma_hang}{r.tinh_chat_in ? <> · <span className="text-ink">{r.tinh_chat_in}</span></> : null}
                      </div>
                      {/* Hàng 3: màu vải · kích vải · kích phim · loại đợt vải · hạn giao */}
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
                        <span>{[r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</span>
                        <LoaiDotVaiBadge value={r.loai_dot_vai} />
                        {r.han_giao_hang ? <span>· hạn {fmtDate(r.han_giao_hang)}</span> : null}
                      </div>
                    </div>
                    {/* Góc phải: SLĐH / còn (+ SL nhận nếu đã tách đợt) */}
                    <div className="shrink-0 text-right text-xs leading-tight">
                      <div className="tabular-nums text-ink">ĐH {fmtNum(r.so_luong_don_hang)} / còn <b className="text-primary">{fmtNum(r.con_release)}</b></div>
                      {r.da_release > 0 && <div className="tabular-nums text-ink-soft">nhận {fmtNum(r.so_luong_vai_ve)}</div>}
                      <Icon name="plus" className="ml-auto mt-1 h-4 w-4 text-primary" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* PHẢI: giỏ soạn đợt sản xuất */}
        <div className="rounded-card border border-line bg-surface p-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Đợt sản xuất đang soạn ({basket.length})</h3>
          {basket.length === 0 ? (
            <div className="py-10 text-center text-ink-soft">Bấm đợt vải bên trái để thêm vào</div>
          ) : (
            <div className="space-y-1.5">
              {basket.map((b) => {
                const over = (Number(b.soLuong) || 0) > b.con_release || (Number(b.soLuong) || 0) <= 0;
                return (
                  <div key={b.dot_vai_id} className="flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate font-medium text-ink">{b.ma_phan} · <span className="font-normal text-ink-soft">{b.ten_khach_hang}</span> · <span className="font-normal text-ink-soft">{b.ma_don_hang}</span></div>
                      {/* Hàng 2: mã hàng · tính chất in */}
                      <div className="truncate text-xs text-ink-soft">
                        {b.ma_hang}{b.tinh_chat_in ? <> · <span className="text-ink">{b.tinh_chat_in}</span></> : null}
                      </div>
                      <div className="truncate text-xs text-ink-soft">{[b.mau_vai, b.kich_vai, b.kich_phim].filter(Boolean).join(' · ') || '—'}{b.loai_dot_vai ? ` · ${b.loai_dot_vai}` : ''}{b.han_giao_hang ? ` · hạn ${fmtDate(b.han_giao_hang)}` : ''} · còn đưa {fmtNum(b.con_release)}</div>
                    </div>
                    <Input type="number" value={b.soLuong} onChange={(e) => setQty(b.dot_vai_id, e.target.value)}
                      className={`!w-24 shrink-0 text-right ${over ? 'border-danger' : ''}`} />
                    <button type="button" onClick={() => removeFromBasket(b.dot_vai_id)} className="text-ink-soft hover:text-danger">
                      <Icon name="x" className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 space-y-3 border-t border-line pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">Tổng SL đưa vào</span>
              <b className="tabular-nums text-ink">{fmtNum(tongSL)}</b>
            </div>
            {hanMin && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">Hạn giao đợt SX (sớm nhất)</span>
                <b className="text-ink">{fmtDate(hanMin)}</b>
              </div>
            )}
            {lechHan && (
              <div className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ⚠ Các đợt LỆCH hạn giao — đợt sản xuất sẽ bị siết theo hạn sớm nhất ({fmtDate(hanMin)}).
              </div>
            )}
            <Field label="Chuyền sản xuất" required>
              <ChuyenPicker chuyen={chuyen} value={chuyenId} onChange={setChuyenId} />
            </Field>
            <Field label="Ngày kế hoạch (tùy chọn)">
              <Input type="date" value={ngayKeHoach} onChange={(e) => setNgayKeHoach(e.target.value)}
                className="cursor-pointer"
                onClick={(e) => { try { e.target.showPicker?.(); } catch { /* trình duyệt không hỗ trợ showPicker */ } }} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Giờ bắt đầu (tùy chọn)">
                <TimeSelect value={gioBd} onChange={setGioBd} />
              </Field>
              <Field label="Giờ kết thúc (tùy chọn)">
                <TimeSelect value={gioKt} onChange={setGioKt} />
              </Field>
            </div>
            <Button className="w-full" onClick={submit} loading={busy}
              disabled={!canRelease || basket.length === 0 || !chuyenId || !!overRow}>
              Xác nhận &amp; đưa xuống sản xuất
            </Button>
          </div>
        </div>
      </div>

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} title="Quét QR đợt vải" />
      <ReleaseListModal open={releaseOpen} onClose={() => setReleaseOpen(false)} />
      <Toast toast={toast} />
    </div>
  );
}
