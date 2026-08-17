import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Modal from '../../../components/common/Modal';
import { Input } from '../../../components/common/controls';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import GiaCongHistoryPanel from '../components/GiaCongHistoryPanel';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import TraVeBadge from '../../../components/common/TraVeBadge';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import PhanInLenhCell from '../components/PhanInLenhCell';
import taiHetTrang from '../../../utils/taiHetTrang';
import { listGiaCong, giaCongToOqc, giaCongTraLai } from '../../../services/planningService';
import { printGiaCongVeTem } from '../../production/utils/printTemLabel';
import { fmtNum, fmtDate } from '../../../utils/format';

// Lọc nhiều trường (client-side, kết hợp AND) — trang tải-hết (limit 500) nên lọc đủ mọi dòng.
// `col` = tên thuộc tính trên hàng do `listGiaCong` trả về.
const FILTER_FIELDS = [
  { key: 'maLenh', label: 'Mã đợt SX', col: 'ma_lenh_san_xuat' },
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' },
  { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' },
  { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' },
  { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
  { key: 'nhaGiaCong', label: 'Nhà gia công', col: 'nha_gia_cong' },
  { key: 'chuyen', label: 'Chuyền gia công', col: 'ten_chuyen' },
];

// Chuẩn hóa 1 dòng (lệnh gia công hoặc dòng lịch sử) → dữ liệu nhãn "TH VỀ" (đầu 13).
// SL trên tem = SL của ĐÚNG lần nhận (`so_luong_lan_nay`, hàng gia công về nhiều lần); dòng lịch sử cũ
// không có khóa này → lùi về SL release của cả lệnh như trước.
const buildVeLabel = (r) => ({
  ma_tem: r.ma_tem || r.ma_lenh_san_xuat,
  so_luong: r.so_luong_lan_nay != null ? r.so_luong_lan_nay : r.so_luong_release,
  so_luong_don_hang: r.so_luong_don_hang,
  ten_khach_hang: r.ten_khach_hang,
  ma_don_hang: r.ma_don_hang,
  ma_hang: r.ma_hang,
  mau_vai: r.mau_vai,
  kich_vai: r.kich_vai,
  kich_phim: r.kich_phim,
  ten_chuyen: r.ten_chuyen,
  ma_chuyen: r.ma_chuyen,
  created_date: r.created_date,
});

// Màn "Gia công" (Kế hoạch): lệnh đã Release 1 lên chuyền gia công đang chờ nhận lại → bấm "Chuyển OQC".
export default function GiaCongPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canDo = can('RELEASE1') || can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null); // { ids:[], label } — chuyển HÀNG LOẠT (nhận nốt phần còn lại)
  const [nhan, setNhan] = useState(null); // { row, qty } — nhận 1 lệnh, nhập SL của lần này
  const [traLai, setTraLai] = useState(null); // { row, ghiChu } — trả hàng bị OQC trả về cho nhà gia công
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const activeCount = Object.values(filters).filter(Boolean).length;
  const filtered = useMemo(() => filterRows(rows, filters, FILTER_FIELDS), [rows, filters]);

  const printVe = async (r) => {
    try { await printGiaCongVeTem(buildVeLabel(r)); }
    catch (e) { show(e.message || 'In tem thất bại', 'error'); }
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // TẢI HẾT MỌI TRANG — bộ lọc chạy ở client nên phải có đủ dòng mới lọc đúng.
      // ⚠ `getPaging` cắt `limit` còn 200; danh sách ≤200 dòng thì vòng lặp chỉ tốn 1 lời gọi.
      const { items, total, thieu } = await taiHetTrang((p) => listGiaCong({ search, ...p }));
      setRows(items);
      setMeta({ total });
      if (thieu && !silent) show(`Mới tải được ${items.length}/${total} lệnh — hãy thu hẹp tìm kiếm`, 'error');
      if (!silent) setSelected(new Set());
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Tự tải lại khi trạm khác xác nhận (tránh màn để lâu → dữ liệu cũ).
  // Bỏ qua khi đang tick dở để không mất lựa chọn — `load` xóa danh sách đã chọn.
  // ⚠ Tải NGẦM khi có sự kiện realtime: `load(true)` bỏ qua `setLoading(true)` (bảng không bị
  // thay bằng spinner) và KHÔNG xóa dòng đang tích. Nhiều sự kiện trong 400ms gộp thành 1 lần tải.
  useSocketReload(['workflow:updated', 'quality:updated'], () => load(true));

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Lệnh đang CHỜ TRẢ LẠI nhà gia công không nhận hàng tiếp được ⇒ loại khỏi chọn hàng loạt.
  // Tính trên tập ĐANG HIỆN (đã lọc): "chọn tất cả" mà ôm luôn lệnh ngoài bộ lọc thì người dùng
  // không kiểm soát được mình đang chuyển OQC cho những lệnh nào.
  const rowsChon = filtered.filter((r) => !r.cho_tra_lai);
  const allChecked = rowsChon.length > 0 && rowsChon.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(rowsChon.map((r) => r.id))));

  // Hàng loạt: mỗi lệnh nhận NỐT phần còn lại (không nhập SL từng dòng).
  const doConfirm = async () => {
    if (!confirm) return;
    setSaving(true);
    let okCount = 0; let failCount = 0;
    for (const id of confirm.ids) {
      try { await giaCongToOqc(id); okCount += 1; } catch (_) { failCount += 1; }
    }
    setSaving(false);
    setConfirm(null);
    show(failCount ? `Đã chuyển ${okCount} lệnh sang OQC, ${failCount} lỗi` : `Đã chuyển ${okCount} lệnh sang OQC`,
      failCount ? 'error' : 'success');
    load();
  };

  // Còn lại của 1 lệnh = SL release − SL đã chuyển (BE trả sẵn `con_lai`; fallback tự tính cho dữ liệu cũ).
  const conLaiCua = (r) => (r?.con_lai != null
    ? Number(r.con_lai)
    : (Number(r?.so_luong_release) || 0) - (Number(r?.da_chuyen) || 0));

  const openNhan = (r) => setNhan({ row: r, qty: String(conLaiCua(r)) });

  // Nhận 1 lần: SL nhập ≤ phần còn lại. Chưa đủ SL thì lệnh VẪN ở màn này để nhận tiếp.
  const doNhan = async () => {
    if (!nhan) return;
    const conLai = conLaiCua(nhan.row);
    const qty = Math.trunc(Number(nhan.qty));
    if (!Number.isFinite(qty) || qty <= 0) { show('Nhập số lượng nhận về lớn hơn 0', 'error'); return; }
    if (qty > conLai) { show(`Số lượng nhận về vượt phần còn lại (${fmtNum(conLai)})`, 'error'); return; }
    setSaving(true);
    try {
      const res = await giaCongToOqc(nhan.row.id, qty);
      const d = res.data || {};
      show(d.hoan_tat
        ? `Đã nhận đủ ${fmtNum(d.da_chuyen)} — lệnh chuyển sang OQC`
        : `Đã chuyển ${fmtNum(d.so_luong)} sang OQC — còn lại ${fmtNum(d.con_lai)}`);
      setNhan(null);
      load();
    } catch (e) {
      show(e.message || 'Chuyển OQC thất bại', 'error');
    } finally { setSaving(false); }
  };

  const doTraLai = async () => {
    if (!traLai) return;
    setSaving(true);
    try {
      await giaCongTraLai(traLai.row.id, traLai.ghiChu);
      show(`Đã ghi nhận trả lại nhà gia công (${traLai.row.ma_lenh_san_xuat})`);
      setTraLai(null);
      load();
    } catch (e) {
      show(e.message || 'Ghi nhận trả lại thất bại', 'error');
    } finally { setSaving(false); }
  };

  const columns = [
    ...(canDo ? [{ key: 'sel', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)} disabled={r.cho_tra_lai}
          title={r.cho_tra_lai ? 'Đang chờ trả lại nhà gia công' : undefined}
          onClick={(e) => e.stopPropagation()} onChange={() => toggleOne(r.id)} aria-label="Chọn lệnh" />
      ) }] : []),
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    // Hàng bị OQC kiểm không đạt → trả về Kế hoạch; badge đỏ bấm ra lý do/người/giờ.
    { key: 'tra_ve', header: 'Tình trạng', render: (r) => (r.cho_tra_lai
      ? <TraVeBadge data={r.tra_ve} label="OQC trả về" nguon="OQC" />
      : <span className="text-xs text-ink-soft">Đang gia công</span>) },
    { key: 'ten_chuyen', header: 'Chuyền gia công', render: (r) => r.ten_chuyen || '—' },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    // Hiện Code phần vì đây là trường được lọc — lọc theo giá trị không nhìn thấy thì không đối chiếu được.
    { key: 'ma_phan', header: 'Code phần', render: (r) => <PhanInLenhCell row={r} /> },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'nha_gia_cong', header: 'Nhà gia công', render: (r) => r.nha_gia_cong || '—' },
    { key: 'so_luong_release', header: 'SL release', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_release) },
    // Hàng gia công về nhiều lần → theo dõi phần đã nhận / còn phải nhận.
    { key: 'da_chuyen', header: 'Đã chuyển OQC', className: 'text-right tabular-nums', render: (r) => fmtNum(r.da_chuyen || 0) },
    { key: 'con_lai', header: 'Còn lại', className: 'text-right tabular-nums',
      render: (r) => {
        const c = conLaiCua(r);
        return c > 0 ? <span className="font-medium text-warning">{fmtNum(c)}</span> : fmtNum(0);
      } },
    { key: 'nguoi_release', header: 'Người release', render: (r) => r.nguoi_release || '—' },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'ngay_ke_hoach', header: 'Ngày SX kế hoạch', render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'act', header: '', className: 'text-right whitespace-nowrap', render: (r) => (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="secondary" icon="printer" onClick={(e) => { e.stopPropagation(); printVe(r); }}>
          In tem
        </Button>
        {/* Bị OQC trả về → phải ghi nhận ĐÃ TRẢ LẠI nhà gia công trước, rồi mới nhận hàng về lượt sau. */}
        {canDo && r.cho_tra_lai && (
          <Button size="sm" variant="danger" icon="undo-2"
            onClick={(e) => { e.stopPropagation(); setTraLai({ row: r, ghiChu: '' }); }}>
            Trả lại nhà gia công
          </Button>
        )}
        {canDo && !r.cho_tra_lai && (
          <Button size="sm" icon="arrow-right" onClick={(e) => { e.stopPropagation(); openNhan(r); }}>
            Nhận hàng → OQC
          </Button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Gia công" subtitle="Lệnh đã release lên chuyền gia công — nhận lại hàng (có thể NHIỀU LẦN) rồi chuyển sang kiểm OQC; đủ số lượng thì lệnh mới rời màn này"
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        {canDo && selected.size > 0 && (
          <Button onClick={() => setConfirm({ ids: [...selected], label: `${selected.size} lệnh` })}>
            Chuyển OQC ({selected.size})
          </Button>
        )}
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử chuyển</Button>
        <Badge tone="info">{activeCount ? `${filtered.length}/` : ''}{meta.total || rows.length} lệnh</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters}
        onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => setFilters({})} open={showFilters} />

      <DataTable columns={columns} rows={filtered} loading={loading} sttStart={0}
        emptyText={activeCount ? 'Không có lệnh nào khớp bộ lọc' : 'Không có lệnh gia công nào đang chờ chuyển OQC'} />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        loading={saving}
        title="Chuyển gia công sang OQC"
        confirmText="Chuyển OQC"
        message={confirm ? `Xác nhận đã nhận NỐT phần còn lại của ${confirm.label} và chuyển sang kiểm OQC? Mỗi lệnh tạo 1 tem coi như đã KCS đạt. Muốn nhận từng phần thì bấm "Nhận hàng → OQC" ở từng dòng.` : ''}
      />

      {/* Nhận hàng gia công từng lần: nhập SL của lần này (≤ phần còn lại). */}
      <Modal open={!!nhan} onClose={() => setNhan(null)} title="Nhận hàng gia công → OQC" size="sm">
        {nhan && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-muted p-3 text-sm">
              <div className="font-medium text-ink">{nhan.row.ma_lenh_san_xuat}</div>
              <div className="mt-1 text-ink-soft">
                {[nhan.row.ten_khach_hang, nhan.row.ma_hang, nhan.row.mau_vai].filter(Boolean).join(' · ') || '—'}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                <span>SL release: <b className="text-ink">{fmtNum(nhan.row.so_luong_release)}</b></span>
                <span>Đã chuyển: <b className="text-ink">{fmtNum(nhan.row.da_chuyen || 0)}</b></span>
                <span>Còn lại: <b className="text-warning">{fmtNum(conLaiCua(nhan.row))}</b></span>
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-ink">Số lượng nhận về lần này</div>
              <Input type="number" min={1} max={conLaiCua(nhan.row)} value={nhan.qty}
                onChange={(e) => setNhan((s) => ({ ...s, qty: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') doNhan(); }} autoFocus />
              <div className="mt-1 text-xs text-ink-soft">
                Tạo 1 tem riêng cho lần nhận này (coi như đã KCS đạt) rồi sang OQC.
                Chưa đủ số lượng thì lệnh vẫn ở màn Gia công để nhận tiếp.
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setNhan(null)} disabled={saving}>Hủy</Button>
              <Button onClick={doNhan} loading={saving}>Chuyển OQC</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Ghi nhận đã mang hàng bị OQC trả về giao lại cho nhà gia công (người + giờ vào lịch sử). */}
      <Modal open={!!traLai} onClose={() => setTraLai(null)} title="Trả lại nhà gia công" size="sm">
        {traLai && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/30">
              <div className="font-medium text-ink">{traLai.row.ma_lenh_san_xuat} — OQC kiểm không đạt</div>
              <div className="mt-1 text-ink-soft">Lý do OQC: {traLai.row.tra_ve?.ly_do || '—'}</div>
              <div className="mt-1 text-ink-soft">
                Số lượng chờ gia công lại: <b className="text-ink">{fmtNum(conLaiCua(traLai.row))}</b>
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-ink">Ghi chú (không bắt buộc)</div>
              <Input value={traLai.ghiChu}
                onChange={(e) => setTraLai((s) => ({ ...s, ghiChu: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') doTraLai(); }}
                placeholder="Vd: đã giao lại cho nhà gia công X ngày..." autoFocus />
              <div className="mt-1 text-xs text-ink-soft">
                Ghi nhận xong, lệnh trở lại trạng thái đang gia công và nhận hàng về bằng nút "Nhận hàng → OQC".
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTraLai(null)} disabled={saving}>Hủy</Button>
              <Button onClick={doTraLai} loading={saving}>Xác nhận đã trả lại</Button>
            </div>
          </div>
        )}
      </Modal>

      <GiaCongHistoryPanel open={histOpen} onClose={() => setHistOpen(false)} onPrint={printVe} />

      <Toast toast={toast} />
    </div>
  );
}
