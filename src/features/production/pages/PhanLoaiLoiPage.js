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
import { fmtDateTime } from '../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN LOẠI LỖI (mig 075) — module Sản xuất, dưới KCS.
// Danh sách tem ĐÃ phân loại theo ngày → nút "Thêm" mở modal quét mã vạch / gõ mã → tra được tem
// thì mở SidePanel nhập bảng lỗi.
// ⚠ Ô nhập mã LUÔN có bên cạnh camera (máy tính không có webcam vẫn dùng được) — cùng quy ước với
//   `ScanCollectModal` ở các màn quét khác.
// ─────────────────────────────────────────────────────────────────────────────

const homNay = () => {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const O_MA = 'h-11 w-full rounded-input border border-line bg-surface px-3.5 text-base md:text-sm outline-none focus:border-primary';

export default function PhanLoaiLoiPage() {
  const { toast, show } = useToast();
  const [ngay, setNgay] = useState(homNay());
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [moThem, setMoThem] = useState(false);
  const [maNhap, setMaNhap] = useState('');
  const [quet, setQuet] = useState(false);
  const [dangTra, setDangTra] = useState(false);

  const [chon, setChon] = useState(null);      // { tem, phieu }
  const [dangLuu, setDangLuu] = useState(false);
  const [loaiLoi, setLoaiLoi] = useState([]);
  const [bienPhap, setBienPhap] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPhanLoaiLoi({ ngay, search, page, limit: 20 });
      setRows(res.data.rows || []); setTotal(res.data.total || 0);
    } catch (e) { show(e.message || 'Không tải được danh sách', 'error'); }
    setLoading(false);
    // ⚠ deps là `show` (ổn định), KHÔNG để cả object useToast() vào — sẽ chạy vòng lặp vô hạn.
  }, [ngay, search, page, show]);

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

  const columns = [
    { header: 'Giờ phân loại', render: (r) => fmtDateTime(r.created_date), width: 140 },
    {
      header: 'Khách hàng · Đơn hàng',
      render: (r) => (<><div className="text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div></>),
    },
    { header: 'Mã hàng', col: 'ma_hang' },
    { header: 'Code phần', col: 'ma_phan' },
    {
      header: 'Màu · Kích',
      render: (r) => (<><div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{r.kich_vai || '—'} / {r.kich_phim || '—'}</div></>),
    },
    { header: 'Chuyền', col: 'ten_chuyen' },
    { header: 'Mã tem', render: (r) => <span className="font-mono text-xs">{r.ma_tem}</span> },
    { header: 'SL in', render: (r) => Number(r.so_luong || 0).toLocaleString('vi-VN'), center: true },
    { header: 'Đạt', render: (r) => <span className="text-emerald-600">{Number(r.sl_kcs_dat || 0)}</span>, center: true },
    { header: 'Sửa', render: (r) => <span className="text-amber-600">{Number(r.sl_kcs_sua || 0)}</span>, center: true },
    { header: 'Hủy', render: (r) => <span className="text-danger">{Number(r.sl_kcs_huy || 0)}</span>, center: true },
    { header: 'Lỗi đã phân loại', render: (r) => <span className="text-xs text-ink-soft">{r.cac_loi || '—'}</span> },
    { header: 'Người nhập', col: 'nguoi' },
  ];

  return (
    <div>
      <Toolbar
        title="Phân loại lỗi" subtitle="Chia SL hư của tem thành sửa / hủy theo từng loại lỗi và biện pháp xử lý"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm mã tem / code phần / khách hàng..."
      >
        <input type="date" value={ngay} onChange={(e) => { setNgay(e.target.value); setPage(1); }}
          className="h-11 rounded-input border border-line bg-surface px-3 text-sm outline-none focus:border-primary" />
        {ngay && <Button variant="ghost" onClick={() => { setNgay(''); setPage(1); }}>Mọi ngày</Button>}
        <Button icon="plus" onClick={() => { setMoThem(true); setMaNhap(''); }}>Thêm</Button>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} pageSize={0}
        onRowClick={(r) => traTem(r.ma_tem)}
        emptyText={ngay ? 'Chưa có tem nào được phân loại lỗi trong ngày này' : 'Chưa có dữ liệu'} />
      <Pagination page={page} total={total} totalPages={Math.ceil(total / 20)} onPage={setPage} />

      {/* ── Modal THÊM: quét mã vạch hoặc gõ mã ─────────────────────────── */}
      <Modal open={moThem} onClose={() => setMoThem(false)} title="Thêm phân loại lỗi — quét hoặc nhập mã tem"
        footer={<>
          <Button variant="ghost" onClick={() => setMoThem(false)}>Hủy</Button>
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
