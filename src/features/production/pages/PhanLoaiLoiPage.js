import React, { useCallback, useEffect, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Pagination from '../../../components/common/Pagination';
import QrScanner from '../../../components/common/QrScanner';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import PhanLoaiLoiPanel from '../components/PhanLoaiLoiPanel';
import { listLoaiLoi } from '../../../services/qualityService';
import {
  listPhanLoaiLoi, traTemPhanLoai, luuPhanLoaiLoi, listBienPhap,
} from '../../../services/phanLoaiLoiService';
import { fmtDateTime, temCode } from '../../../utils/format';
import exportCheckpointExcel, { cotTemChung, moTaBoLoc } from '../../../utils/exportCheckpointExcel';
import taiHetTrang from '../../../utils/taiHetTrang';
import ChipTabs from '../../../components/common/ChipTabs';
import Badge from '../../../components/common/Badge';

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN LOẠI LỖI (mig 075) — module Sản xuất, dưới KCS.
// Danh sách tem ĐÃ KCS (có hàng hư) theo ngày KCS — cả tem ĐÃ lẫn CHƯA phân loại (21/09/2026); tem chưa
// phân loại hiện chữ "Chưa phân loại lỗi" ở cột giờ. Bấm 1 dòng / nút "Thêm" mở modal quét mã vạch / gõ mã → tra được tem
// thì mở SidePanel nhập bảng lỗi.
// ⚠ Ô nhập mã LUÔN có bên cạnh camera (máy tính không có webcam vẫn dùng được) — cùng quy ước với
//   `ScanCollectModal` ở các màn quét khác.
// ─────────────────────────────────────────────────────────────────────────────

const homNay = () => {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const TT_TABS = [
  { v: '', label: 'Tất cả' }, { v: 'CHUA', label: 'Chưa phân loại lỗi' }, { v: 'DA', label: 'Đã phân loại' },
];
const TEN_TT = { CHUA: 'chưa phân loại', DA: 'đã phân loại' };

const O_MA = 'h-11 w-full rounded-input border border-line bg-surface px-3.5 text-base md:text-sm outline-none focus:border-primary';

export default function PhanLoaiLoiPage() {
  const { toast, show } = useToast();
  const [ngay, setNgay] = useState(homNay());
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tinhTrang, setTinhTrang] = useState('');   // '' · CHUA · DA
  const [dem, setDem] = useState({});

  const [moThem, setMoThem] = useState(false);
  const [maNhap, setMaNhap] = useState('');
  const [quet, setQuet] = useState(false);
  const [dangTra, setDangTra] = useState(false);

  const [chon, setChon] = useState(null);      // { tem, phieu }
  const [dangLuu, setDangLuu] = useState(false);
  const [loaiLoi, setLoaiLoi] = useState([]);
  const [bienPhap, setBienPhap] = useState([]);
  const [dangXuat, setDangXuat] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPhanLoaiLoi({ ngay, search, tinhTrang, page, limit: 20 });
      setRows(res.data.rows || []); setTotal(res.data.total || 0); setDem(res.data.dem || {});
    } catch (e) { show(e.message || 'Không tải được danh sách', 'error'); }
    setLoading(false);
    // ⚠ deps là `show` (ổn định), KHÔNG để cả object useToast() vào — sẽ chạy vòng lặp vô hạn.
  }, [ngay, search, tinhTrang, page, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // Danh mục nạp 1 lần, dùng cho dropdown trong bảng nhập.
  useEffect(() => {
    (async () => {
      try {
        const [a, b] = await Promise.all([listLoaiLoi({ search: '' }), listBienPhap({})]);
        setLoaiLoi(Array.isArray(a.data) ? a.data : (a.data.items || []));
        setBienPhap(b.data || []);
      } catch (e) { show(e.message || 'Không tải được danh mục lỗi / biện pháp', 'error'); }
    })();
  }, [show]);

  const traTem = async (code) => {
    const ma = String(code || '').trim();
    if (!ma) return;
    setDangTra(true);
    try {
      const res = await traTemPhanLoai(ma);
      setChon(res.data);
      setMoThem(false); setMaNhap(''); setQuet(false);
    } catch (e) { show(e.message || 'Không tìm thấy tem', 'error'); }
    setDangTra(false);
  };

  const doLuu = async ({ dong, ghiChu }) => {
    if (!chon?.tem) return;
    setDangLuu(true);
    try {
      const res = await luuPhanLoaiLoi(chon.tem.tem_id, { dong, ghiChu });
      show(`Đã lưu — sửa ${res.data.tong_sua} · hủy ${res.data.tong_huy}`);
      setChon(null); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    setDangLuu(false);
  };

  // ⚠⚠ Màn này phân trang Ở SERVER (20 dòng/trang) ⇒ PHẢI tải hết mọi trang trước khi xuất, nếu không
  //   file Excel chỉ có ĐÚNG TRANG ĐANG XEM mà không báo gì (đúng ca "Excel cụt ở 200 dòng" đã ghi §11.3).
  //   `taiHetTrang` đọc được cả hình dạng `{rows,total}` của endpoint này.
  // ⚠ Mã tem hiện tiền tố **16** = nhãn HÀNG LỖI dán túi sửa, khớp đúng cột trên bảng.
  const doExcel = async () => {
    setDangXuat(true);
    try {
      const { items, thieu, total } = await taiHetTrang((p) => listPhanLoaiLoi({ ngay, search, tinhTrang, ...p }));
      if (thieu) show(`Chỉ tải được ${items.length}/${total} dòng — hãy thu hẹp bằng ngày hoặc ô tìm`, 'error');
      await exportCheckpointExcel({
        cols: [
          { header: 'Giờ KCS', width: 18, center: true,
            value: (r) => (r.tg_kcs ? new Date(r.tg_kcs).toLocaleString('vi-VN') : '') },
          { header: 'Giờ phân loại', width: 20, center: true,
            value: (r) => (r.created_date ? new Date(r.created_date).toLocaleString('vi-VN') : 'Chưa phân loại lỗi') },
          ...cotTemChung((r) => temCode(r.ma_tem, 16)),
          { header: 'SL in', width: 12, num: true, value: (r) => (r.so_luong == null ? null : Number(r.so_luong)) },
          { header: 'Đạt', width: 10, num: true, value: (r) => Number(r.sl_kcs_dat) || 0 },
          { header: 'Sửa', width: 10, num: true, value: (r) => Number(r.sl_kcs_sua) || 0 },
          { header: 'Hủy', width: 10, num: true, value: (r) => Number(r.sl_kcs_huy) || 0 },
          { header: 'Lỗi đã phân loại', width: 40, value: (r) => (r.cac_loi == null ? '' : String(r.cac_loi)) },
          { header: 'Người nhập', width: 18, value: (r) => (r.nguoi == null ? '' : String(r.nguoi)) },
        ],
        rows: items,
        title: 'Phân loại lỗi',
        fileName: 'phan-loai-loi',
        moTaLoc: moTaBoLoc({ 'ngày KCS': ngay || 'mọi ngày', 'tình trạng': TEN_TT[tinhTrang] || '', 'tìm kiếm': search }),
      });
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setDangXuat(false);
    }
  };

  const columns = [
    { key: 'tg_kcs', header: 'Giờ KCS', render: (r) => fmtDateTime(r.tg_kcs), width: 130 },
    { key: 'created_date', header: 'Giờ phân loại', width: 150,
      render: (r) => (r.created_date ? fmtDateTime(r.created_date)
        : <Badge tone="warning">Chưa phân loại lỗi</Badge>) },
    {
      header: 'Khách hàng · Đơn hàng',
      render: (r) => (<><div className="text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div></>),
    },
    { header: 'Mã hàng', key: 'ma_hang' },
    { header: 'Code phần', key: 'ma_phan' },
    {
      header: 'Màu · Kích',
      render: (r) => (<><div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{r.kich_vai || '—'} / {r.kich_phim || '—'}</div></>),
    },
    { header: 'Chuyền', key: 'ten_chuyen' },
    // ⚠ Hiện mã tem với TIỀN TỐ 16 = nhãn HÀNG LỖI dán túi sửa — đúng cái nhãn người phân loại đang
    //   cầm trên tay. DB lưu mã gốc tiền tố 15 (KCS đạt); chỉ đổi phần HIỂN THỊ, `traTem` vẫn gửi
    //   `r.ma_tem` gốc (backend quy mọi công đoạn về mã gốc bằng `baseMaTem`).
    { header: 'Mã tem', render: (r) => <span className="font-mono text-xs">{temCode(r.ma_tem, 16)}</span> },
    { header: 'SL in', render: (r) => Number(r.so_luong || 0).toLocaleString('vi-VN'), center: true },
    { header: 'Đạt', render: (r) => <span className="text-emerald-600">{Number(r.sl_kcs_dat || 0)}</span>, center: true },
    { header: 'Sửa', render: (r) => <span className="text-amber-600">{Number(r.sl_kcs_sua || 0)}</span>, center: true },
    { header: 'Hủy', render: (r) => <span className="text-danger">{Number(r.sl_kcs_huy || 0)}</span>, center: true },
    { header: 'Lỗi đã phân loại', render: (r) => <span className="text-xs text-ink-soft">{r.cac_loi || '—'}</span> },
    { header: 'Người nhập', key: 'nguoi' },
  ];

  return (
    <div>
      <Toolbar
        title="Phân loại lỗi" subtitle="Tem đã KCS có hàng hư — chia SL hư thành sửa / hủy theo từng loại lỗi và biện pháp xử lý"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm mã tem / code phần / khách hàng..."
      >
        <input type="date" value={ngay} onChange={(e) => { setNgay(e.target.value); setPage(1); }}
          className="h-11 rounded-input border border-line bg-surface px-3 text-sm outline-none focus:border-primary" />
        {ngay && <Button variant="ghost" onClick={() => { setNgay(''); setPage(1); }}>Mọi ngày</Button>}
        <Button chiXemOk variant="secondary" icon="download" onClick={doExcel}
          loading={dangXuat} disabled={!total}>Excel ({total})</Button>
        <Button icon="plus" onClick={() => { setMoThem(true); setMaNhap(''); }}>Thêm</Button>
      </Toolbar>

      <ChipTabs tabs={TT_TABS} value={tinhTrang} counts={dem}
        onChange={(v) => { setTinhTrang(v); setPage(1); }} />
      <DataTable columns={columns} rows={rows} loading={loading} pageSize={0}
        onRowClick={(r) => traTem(r.ma_tem)}
        rowClassName={(r) => (r.da_phan_loai ? '' : 'bg-amber-50/60 dark:bg-amber-950/20')}
        emptyText={ngay ? 'Không có tem nào KCS có hàng hư trong ngày này' : 'Chưa có dữ liệu'} />
      <Pagination page={page} total={total} totalPages={Math.ceil(total / 20)} onPage={setPage} />

      {/* ── Modal THÊM: quét mã vạch hoặc gõ mã ─────────────────────────── */}
      <Modal open={moThem} onClose={() => setMoThem(false)} title="Thêm phân loại lỗi — quét hoặc nhập mã tem"
        footer={<>
          <Button chiXemOk variant="ghost" onClick={() => setMoThem(false)}>Hủy</Button>
          <Button icon="search" loading={dangTra} disabled={!maNhap.trim()} onClick={() => traTem(maNhap)}>Tìm tem</Button>
        </>}>
        <div className="space-y-3">
          <Button variant="secondary" icon="scan-line" className="w-full" onClick={() => setQuet(true)}>
            Quét mã vạch / QR bằng camera
          </Button>
          <div className="text-center text-xs text-ink-soft">— hoặc —</div>
          <div>
            <div className="mb-1 text-xs font-medium text-ink">Nhập mã tem (đầu đọc USB cũng gõ vào đây)</div>
            <input autoFocus className={O_MA} value={maNhap} placeholder="vd 152608057689"
              onChange={(e) => setMaNhap(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); traTem(maNhap); } }} />
            <p className="mt-1 text-xs text-ink-soft">
              Quét nhãn công đoạn nào cũng được (<b>13/15/16/17…</b>) — hệ thống tự quy về mã tem gốc.
            </p>
          </div>
        </div>
      </Modal>

      <QrScanner open={quet} onClose={() => setQuet(false)} title="Quét mã tem"
        onResult={(text) => { setQuet(false); traTem(text); }} />

      <PhanLoaiLoiPanel
        open={!!chon} onClose={() => setChon(null)} data={chon}
        loaiLoi={loaiLoi} bienPhap={bienPhap} onLuu={doLuu} dangLuu={dangLuu} />

      <Toast toast={toast} />
    </div>
  );
}
