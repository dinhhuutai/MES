import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import { Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { autoPlanCandidates, createDotSanXuat } from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

// Sơ đồ mặt bằng chuyền theo file PDF nhà máy. 'h' = thanh ngang, 'v' = thanh dọc.
// A: cụm trái (M7..M1 thanh ngang). B: cụm giữa (M8 trên + M1A-1B..M8A-8B thanh dọc).
// C: MRB1..3 thanh dọc. D: cụm phải 2 hàng (trên M10B..M13B, dưới M10A..M13A).
const FLOOR = {
  A: ['M7', 'M6', 'M5', 'M4', 'M3', 'M2', 'M1'],
  B_top: 'M8',
  B: ['M1A-1B', 'M2A-2B', 'M3A-3B', 'M4A-4B', 'M5A-5B', 'M6A-6B', 'M7A-7B', 'M8A-8B', 'M9A-9B'],
  C: ['MRB1', 'MRB2', 'MRB3'],
  D_top: ['M10B', 'M11B', 'M12B', 'M13B', 'M14B'],
  D_bot: ['M10A', 'M11A', 'M12A', 'M13A', 'M14A'],
};

const norm = (s) => String(s || '').trim().toUpperCase();

// 1 ô chuyền trên sơ đồ. info = { chuyenId, chuyen, count, pcs } (null nếu chưa gắn chuyền hệ thống).
function Box({ code, orient, info, selected, onSelect }) {
  const mapped = !!(info && info.chuyenId);
  const has = mapped && info.count > 0;
  const tone = selected
    ? 'border-primary bg-primary-wash text-primary ring-2 ring-primary/30'
    : has ? 'border-primary/60 bg-primary-wash/50 text-ink'
      : mapped ? 'border-line bg-surface text-ink'
        : 'border-dashed border-line bg-surface-muted/40 text-ink-soft';
  const common = `flex items-center justify-center rounded border text-[11px] font-semibold transition ${tone} ${mapped ? 'cursor-pointer hover:border-primary' : 'cursor-default'}`;
  const label = `${code}${has ? ` · ${info.count}` : ''}`;
  if (orient === 'v') {
    return (
      <button type="button" disabled={!mapped} onClick={() => onSelect(code)}
        title={info?.chuyen?.ten_chuyen || code}
        className={`${common} min-h-[190px] w-[30px] px-0.5`}
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
        <span className="py-1">{label}</span>
      </button>
    );
  }
  return (
    <button type="button" disabled={!mapped} onClick={() => onSelect(code)}
      title={info?.chuyen?.ten_chuyen || code}
      className={`${common} h-9 w-full px-2`}>
      {label}{has ? ' đợt' : ''}
    </button>
  );
}

function FloorMap({ boxInfo, selected, onSelect }) {
  const b = (code, orient) => (
    <Box key={code} code={code} orient={orient} info={boxInfo(code)} selected={selected === code} onSelect={onSelect} />
  );
  return (
    <div className="flex items-start gap-6 overflow-x-auto rounded-card border border-line bg-surface p-4">
      {/* Cụm trái: M7..M1 (thanh ngang) */}
      <div className="flex w-[188px] shrink-0 flex-col gap-2">
        {FLOOR.A.map((c) => b(c, 'h'))}
      </div>
      {/* Cụm giữa: M8 (ngang) + M1A-1B..M8A-8B (dọc) */}
      <div className="flex shrink-0 flex-col gap-2">
        <div className="w-full">{b(FLOOR.B_top, 'h')}</div>
        <div className="flex gap-1.5">{FLOOR.B.map((c) => b(c, 'v'))}</div>
      </div>
      {/* MRB1..3 (dọc) — hạ xuống ngang hàng thanh dọc cụm giữa */}
      <div className="flex shrink-0 gap-1.5 pt-[46px]">{FLOOR.C.map((c) => b(c, 'v'))}</div>
      {/* Cụm phải: 2 hàng thanh dọc */}
      <div className="flex shrink-0 flex-col gap-5">
        <div className="flex gap-1.5">{FLOOR.D_top.map((c) => b(c, 'v'))}</div>
        <div className="flex gap-1.5">{FLOOR.D_bot.map((c) => b(c, 'v'))}</div>
      </div>
    </div>
  );
}

export default function KeHoachTuDongPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRelease = can('RELEASE1');

  const [chuyens, setChuyens] = useState([]);
  const [items, setItems] = useState([]);       // chưa lên KH (đợt chờ Release 1)
  const [planned, setPlanned] = useState([]);   // đã lên KH (lệnh RELEASE_1/2 chưa chạy)
  const [viewMode, setViewMode] = useState('chua'); // 'chua' | 'da' | 'all'
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // chuyen_id đang chọn để lọc list bên phải
  const [busyId, setBusyId] = useState(null);
  const [busyChuyen, setBusyChuyen] = useState(null);
  const [qtyMap, setQtyMap] = useState({}); // dot_vai_id -> SL release nhập (mặc định con_release)

  const conOf = (it) => Number(it.con_release ?? it.so_luong_vai_ve) || 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await autoPlanCandidates({ search });
      setChuyens(res.data.chuyens || []);
      setItems(res.data.items || []);
      setPlanned(res.data.planned || []);
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); } finally { setLoading(false); }
  }, [search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // Danh sách hiển thị theo toggle: chưa lên KH / đã lên KH / tất cả.
  const viewItems = useMemo(() => {
    if (viewMode === 'chua') return items;
    if (viewMode === 'da') return planned;
    return [...items, ...planned];
  }, [viewMode, items, planned]);

  const keyOf = (it) => it.dot_vai_id || `L-${it.id}`;

  // Nhóm đợt theo chuyền được xếp (best_chuyen).
  const itemsByChuyen = useMemo(() => {
    const m = {};
    viewItems.forEach((it) => { const cid = it.best_chuyen && it.best_chuyen.chuyen_id; if (cid) (m[cid] = m[cid] || []).push(it); });
    return m;
  }, [viewItems]);

  // Gắn chuyền hệ thống vào ô sơ đồ theo tên (ma_chuyen hoặc ten_chuyen == mã ô).
  const chuyenByCode = useMemo(() => {
    const m = {};
    chuyens.forEach((c) => { m[norm(c.ma_chuyen)] = c; if (c.ten_chuyen) m[norm(c.ten_chuyen)] = m[norm(c.ten_chuyen)] || c; });
    return m;
  }, [chuyens]);

  const boxInfo = useCallback((code) => {
    const c = chuyenByCode[norm(code)];
    if (!c) return null;
    const list = itemsByChuyen[c.id] || [];
    return { chuyenId: c.id, chuyen: c, count: list.length, pcs: list.reduce((s, x) => s + (Number(x.so_luong_vai_ve) || 0), 0) };
  }, [chuyenByCode, itemsByChuyen]);

  // Chuyền hệ thống KHÔNG khớp ô sơ đồ nào (vd C01/C02) — hiện dải riêng để vẫn thao tác được.
  const mappedIds = useMemo(() => {
    const set = new Set();
    [...FLOOR.A, FLOOR.B_top, ...FLOOR.B, ...FLOOR.C, ...FLOOR.D_top, ...FLOOR.D_bot].forEach((code) => {
      const c = chuyenByCode[norm(code)]; if (c) set.add(c.id);
    });
    return set;
  }, [chuyenByCode]);
  const unmapped = chuyens.filter((c) => !mappedIds.has(c.id));

  const selectedChuyen = chuyens.find((c) => c.id === selected) || null;
  const backlog = selected ? (itemsByChuyen[selected] || []) : viewItems;
  const backlogReleasable = backlog.filter((it) => !it.planned); // chỉ đợt "chưa lên KH" mới release được

  const releaseOne = async (it) => {
    if (!canRelease) return;
    const con = conOf(it);
    const raw = qtyMap[it.dot_vai_id];
    const qty = raw != null && raw !== '' ? Number(raw) : con;
    if (!(qty > 0) || qty > con) { show(`SL release phải trong khoảng 1..${fmtNum(con)}`, 'error'); return; }
    setBusyId(it.dot_vai_id);
    try {
      const res = await createDotSanXuat({
        items: [{ dotVaiId: it.dot_vai_id, soLuong: qty }],
        chuyenId: it.best_chuyen.chuyen_id, ngayKeHoach: it.ngay_ke_hoach,
      });
      setQtyMap((m) => { const n = { ...m }; delete n[it.dot_vai_id]; return n; });
      if (res.data?.chi_tam) show(`Chưa Ready → lưu Kế hoạch tạm — ${it.ma_phan}`, 'success');
      else show(qty < con
        ? `Đã Release 1 ${fmtNum(qty)}/${fmtNum(con)} — ${it.ma_phan} · còn ${fmtNum(con - qty)}`
        : `Đã Release 1 — ${it.ma_phan} · ${it.ma_dot_vai}`);
      load(); // nạp lại để cập nhật phần còn lại (đợt ở lại nếu release chưa đủ)
    } catch (e) { show(e.message || 'Xác nhận thất bại', 'error'); } finally { setBusyId(null); }
  };

  const releaseChuyen = async (chuyenId, list) => {
    if (!canRelease || !list.length) return;
    setBusyChuyen(chuyenId);
    let ok = 0; let fail = 0;
    for (const it of list) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await createDotSanXuat({
          items: [{ dotVaiId: it.dot_vai_id, soLuong: conOf(it) }], // release hết phần còn lại mỗi đợt
          chuyenId: it.best_chuyen.chuyen_id, ngayKeHoach: it.ngay_ke_hoach,
        });
        ok += 1;
      } catch (e) { fail += 1; }
    }
    show(fail ? `Xác nhận ${ok} đợt, ${fail} lỗi` : `Đã Release 1 ${ok} đợt trên chuyền`, fail ? 'error' : 'success');
    setBusyChuyen(null);
    load();
  };

  return (
    <div>
      <Toolbar title="Kế hoạch tự động"
        subtitle="Sơ đồ chuyền theo mặt bằng nhà máy — chọn 1 chuyền để lọc, xác nhận Release 1 ở danh sách bên phải"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm code phần, mã hàng, màu/kích, đợt vải...">
        <Badge tone="info">{items.length} chưa · {planned.length} đã lên KH · {chuyens.length} chuyền</Badge>
      </Toolbar>

      <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        Thông số HSKT hiện là <b>dữ liệu tạm</b> (sẽ lấy từ ERP); <b>số pass</b> cấu hình ở <b>Hệ thống → Chuyền sản xuất</b> (chưa đặt → dùng tạm).
        Ô sơ đồ tô đậm = chuyền có đợt được xếp; ô nét đứt = vị trí chuyền chưa cấu hình trong hệ thống.
      </div>

      {loading ? (
        <div className="py-16 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Trái: sơ đồ mặt bằng chuyền */}
          <div className="min-w-0 flex-1">
            <FloorMap boxInfo={boxInfo} selected={selectedChuyen ? norm(selectedChuyen.ma_chuyen) : null}
              onSelect={(code) => { const c = chuyenByCode[norm(code)]; if (c) setSelected((p) => (p === c.id ? null : c.id)); }} />

            {unmapped.length > 0 && (
              <div className="mt-3 rounded-card border border-line bg-surface p-3">
                <div className="mb-2 text-xs font-semibold text-ink-soft">Chuyền khác (chưa xếp vào sơ đồ)</div>
                <div className="flex flex-wrap gap-2">
                  {unmapped.map((c) => {
                    const n = (itemsByChuyen[c.id] || []).length;
                    return (
                      <button key={c.id} type="button" onClick={() => setSelected((p) => (p === c.id ? null : c.id))}
                        className={`rounded-control border px-3 py-1.5 text-xs font-medium transition ${selected === c.id ? 'border-primary bg-primary-wash text-primary' : n > 0 ? 'border-primary/50 bg-primary-wash/40 text-ink' : 'border-line text-ink-soft'}`}>
                        {c.ten_chuyen || c.ma_chuyen}{n > 0 ? ` · ${n} đợt` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Phải: danh sách đợt chờ xác nhận Release 1 (chưa release) */}
          <div className="w-full shrink-0 lg:w-[380px]">
            <div className="flex h-full flex-col rounded-card border border-line bg-surface">
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">
                    {selectedChuyen ? (selectedChuyen.ten_chuyen || selectedChuyen.ma_chuyen) : 'Danh sách đợt vải'}
                  </div>
                  <div className="text-[11px] text-ink-soft">{backlog.length} dòng</div>
                </div>
                {selectedChuyen && (
                  <Button variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => setSelected(null)}>Bỏ lọc</Button>
                )}
              </div>

              {/* Toggle: chưa lên KH (đang ở Release 1) / đã lên KH (đã XN Release 1 → chờ SX) / tất cả */}
              <div className="flex gap-1 border-b border-line p-1.5">
                {[['chua', `Chưa lên KH (${items.length})`], ['da', `Đã lên KH (${planned.length})`], ['all', 'Tất cả']].map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setViewMode(k)}
                    className={`flex-1 rounded-[8px] px-2 py-1 text-[11px] font-semibold transition ${
                      viewMode === k ? 'bg-primary-wash text-primary' : 'text-ink-soft hover:bg-surface-muted'
                    }`}>{label}</button>
                ))}
              </div>

              {canRelease && selectedChuyen && backlogReleasable.length > 0 && (
                <div className="border-b border-line px-3 py-2">
                  <Button variant="primary" className="w-full !py-1.5 !text-xs" loading={busyChuyen === selected}
                    onClick={() => releaseChuyen(selected, backlogReleasable)}>Xác nhận cả chuyền ({backlogReleasable.length})</Button>
                </div>
              )}

              <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5" style={{ maxHeight: '68vh' }}>
                {backlog.length === 0 ? (
                  <div className="py-10 text-center text-xs text-ink-soft">Không có đợt vải nào.</div>
                ) : backlog.map((it) => {
                  const bc = it.best_chuyen || {};
                  // Hàng "đã lên KH" (đã tạo lệnh Release 1/2, chưa chạy) — chỉ hiển thị, không release lại.
                  if (it.planned) {
                    return (
                      <div key={keyOf(it)} className="rounded-control border border-indigo-200 bg-indigo-50/40 p-2.5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink">{it.ma_phan}{it.ten_khach_hang ? ` · ${it.ten_khach_hang}` : ''}</div>
                          <div className="truncate text-xs text-ink-soft">{[it.ma_hang, it.mau_vai, it.kich_vai, it.kich_phim].filter(Boolean).join(' · ')}{it.tinh_chat_in ? <> · <span className="text-ink">{it.tinh_chat_in}</span></> : null}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-soft">
                            <Badge tone="info">{it.ma_lenh_san_xuat}</Badge>
                            <Badge tone={it.trang_thai === 'RELEASE_2' ? 'success' : 'warning'}>
                              {it.trang_thai === 'RELEASE_2' ? 'Chờ sản xuất' : 'Đã Release 1'}
                            </Badge>
                            <span>SL {fmtNum(it.so_luong_release)}</span>
                            {bc.ten_chuyen && <span>· {bc.ten_chuyen}</span>}
                            {it.ngay_ke_hoach && <span className="inline-flex items-center gap-0.5"><Icon name="calendar-days" size={11} />{fmtDate(it.ngay_ke_hoach)}</span>}
                            {it.han_giao_hang && <span>· hạn {fmtDate(it.han_giao_hang)}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={keyOf(it)} className="rounded-control border border-line p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink">{it.ma_phan}{it.ten_khach_hang ? ` · ${it.ten_khach_hang}` : ''}</div>
                          <div className="truncate text-xs text-ink-soft">{[it.ma_hang, it.mau_vai, it.kich_vai, it.kich_phim].filter(Boolean).join(' · ')}{it.tinh_chat_in ? <> · <span className="text-ink">{it.tinh_chat_in}</span></> : null}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-soft">
                            <Badge tone="info">{it.ma_dot_vai}</Badge>
                            {it.qc_done ? <Badge tone="success">Đã Ready</Badge> : <Badge tone="warning">Chờ Ready</Badge>}
                            <span>SL {fmtNum(it.so_luong_vai_ve)}</span>
                            <span className="font-medium text-primary">còn {fmtNum(conOf(it))}</span>
                            {bc.ten_chuyen && <span>· {bc.ten_chuyen}</span>}
                            {it.ngay_ke_hoach && <span className="inline-flex items-center gap-0.5"><Icon name="calendar-days" size={11} />{fmtDate(it.ngay_ke_hoach)}</span>}
                            {it.han_giao_hang && <span>· hạn {fmtDate(it.han_giao_hang)}</span>}
                          </div>
                          {it.tra_ve_ly_do && <div className="mt-1"><Badge tone="danger" title={it.tra_ve_ly_do}>Test Run trả về</Badge></div>}
                        </div>
                        {canRelease && (
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Input type="number" min="1" max={conOf(it)}
                              value={qtyMap[it.dot_vai_id] ?? String(conOf(it))}
                              onChange={(e) => setQtyMap((m) => ({ ...m, [it.dot_vai_id]: e.target.value }))}
                              className="!w-20 !py-1 text-right text-xs" title="SL release lần này" />
                            <Button variant="secondary" className="!px-3 !py-1 !text-xs" loading={busyId === it.dot_vai_id}
                              onClick={() => releaseOne(it)}>Xác nhận</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
