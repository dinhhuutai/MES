import React, { useCallback, useEffect, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Input, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listKhachHang, updateKhachHang } from '../../../services/khachHangService';

// ─────────────────────────────────────────────────────────────────────────────
// THÔNG TIN KHÁCH HÀNG (mig 099) — địa chỉ để IN LÊN PHIẾU GIAO.
//
// ⚠⚠ CHỈ SỬA 3 TRƯỜNG MES TỰ QUẢN. Mã + tên khách do ERP đẩy sang mỗi lần đồng bộ
//   (`erpsync.upsertKhachHang` khớp theo `ma_khach_hang`) ⇒ sửa ở đây thì lần sync sau ghi đè, và
//   mọi chỗ tra theo TÊN khách (vd hàng gia công II/AD được miễn Khuôn — `utils/tech.js`) sẽ lệch.
//
// ⚠ HAI Ô ĐỊA CHỈ TÁCH RIÊNG (người dùng chốt 16/09/2026): trụ sở và kho nhận hàng thường KHÁC nhau.
//   `dia_chi_giao` là thứ được gợi ý sẵn vào ô "Giao hàng tại" lúc in phiếu — sửa được trước khi in,
//   và phiếu lưu địa điểm của RIÊNG nó nên khách đổi địa chỉ không làm sai phiếu cũ.
// ─────────────────────────────────────────────────────────────────────────────

export default function KhachHangPage() {
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const canSua = can('KHACH_HANG_MANAGE');

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [coCot, setCoCot] = useState(true);     // đã chạy mig 099 chưa
  const [coCotTen, setCoCotTen] = useState(true); // đã chạy mig 101 chưa (dò RIÊNG)
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);       // null = đóng
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listKhachHang({ search, page, limit: 20 });
      setRows(res.data.items || []);
      setTotal(res.data.meta?.total || 0);
      setCoCot(res.data.meta?.co_cot !== false);
      setCoCotTen(res.data.meta?.co_cot_ten !== false);
    } catch (e) { show(e.message || 'Không tải được danh sách khách hàng', 'error'); }
    setLoading(false);
    // ⚠ deps là `show` (ổn định nhờ useCallback([])) — KHÔNG để cả object `useToast()` vào đây.
  }, [search, page, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  // Gõ ô tìm thì về trang 1, nếu không sẽ đứng ở trang 3 của kết quả cũ và tưởng là không có dữ liệu.
  useEffect(() => { setPage(1); }, [search]);

  const doSave = async () => {
    setSaving(true);
    try {
      await updateKhachHang(form.id, {
        // ⚠ Chỉ gửi khi đã có cột — gửi lên khi thiếu mig 101 là ăn 409 THIEU_MIGRATION, chặn luôn
        //   việc lưu địa chỉ.
        ...(coCotTen ? { tenDayDu: form.ten_day_du || '' } : {}),
        diaChi: form.dia_chi || '',
        diaChiGiao: form.dia_chi_giao || '',
        ghiChu: form.ghi_chu || '',
      });
      show(`Đã lưu thông tin khách ${form.ma_khach_hang}`);
      setForm(null); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    setSaving(false);
  };

  // ⚠ `DataTable` đọc `c.key` để lấy giá trị ô — không có `col`, không có `center`.
  const columns = [
    { key: 'ma_khach_hang', header: 'Mã khách', render: (r) => <Badge tone="info">{r.ma_khach_hang}</Badge> },
    { key: 'ten_khach_hang', header: 'Tên khách hàng (ERP)', className: 'font-medium text-ink' },
    { key: 'ten_day_du', header: 'Tên đầy đủ công ty', render: (r) => (
      <span className="whitespace-normal break-words">{r.ten_day_du || <span className="text-ink-soft">—</span>}</span>
    ) },
    { key: 'dia_chi', header: 'Địa chỉ', render: (r) => (
      <span className="whitespace-normal break-words">{r.dia_chi || <span className="text-ink-soft">—</span>}</span>
    ) },
    { key: 'dia_chi_giao', header: 'Địa chỉ giao mặc định', render: (r) => (
      <span className="whitespace-normal break-words">{r.dia_chi_giao || <span className="text-ink-soft">—</span>}</span>
    ) },
    { key: 'so_don_hang', header: 'Số đơn', className: 'text-right tabular-nums', render: (r) => r.so_don_hang ?? 0 },
    { key: 'ghi_chu', header: 'Ghi chú', render: (r) => (
      <span className="whitespace-normal break-words text-xs text-ink-soft">{r.ghi_chu || '—'}</span>
    ) },
    { key: 'nguoi_sua', header: 'Người sửa gần nhất', render: (r) => r.nguoi_sua || '—' },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      canSua && (
        <Button variant="secondary" className="px-2.5 py-1 text-xs"
          onClick={() => setForm({ ...r })}>Sửa</Button>
      ) },
  ];

  return (
    <div>
      <Toolbar title="Khách hàng"
        subtitle="Địa chỉ & địa chỉ giao hàng mặc định — dùng để in lên phiếu giao"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã khách, tên, địa chỉ...">
        <Badge tone="info">{total} khách hàng</Badge>
      </Toolbar>

      {!coCotTen && (
        <div className="mb-4 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <b>Chưa chạy migration 101.</b> Chưa lưu được tên đầy đủ công ty — phiếu giao đang in mã khách.
          Chạy
          <code className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-900/60">database/migrations/101_khach_hang_ten_day_du.sql</code>
          bằng user <code>postgres</code> rồi tải lại trang.
        </div>
      )}

      {!coCot && (
        <div className="mb-4 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <b>Chưa chạy migration 099.</b> Chưa lưu được địa chỉ khách hàng, và ô <i>"Giao hàng tại"</i>
          ở màn in phiếu giao đang tạm ẩn. Chạy
          <code className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-900/60">database/migrations/099_khach_hang_dia_chi_giao_hang_tai.sql</code>
          bằng user <code>postgres</code> rồi tải lại trang.
        </div>
      )}

      <div className="mb-3 rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
        <b>Mã</b> và <b>tên khách</b> do ERP đẩy sang nên không sửa được ở đây (sửa cũng bị lần đồng bộ
        sau ghi đè). <b>Địa chỉ giao mặc định</b> được gợi ý sẵn vào ô <i>"Giao hàng tại"</i> khi lập
        phiếu giao — vẫn sửa lại được trước khi in, và phiếu giữ địa điểm của riêng nó.
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="id"
        pageSize={0} onRowClick={canSua ? (r) => setForm({ ...r }) : undefined}
        emptyText="Không có khách hàng nào" />
      {/* ⚠ `Pagination` nhận `totalPages` + `onPage` (KHÔNG phải `limit`/`onChange`) — truyền sai tên
          thì thanh phân trang im lặng không hiện, ESLint không bắt được. */}
      <Pagination page={page} totalPages={Math.ceil(total / 20) || 1} total={total} onPage={setPage} />

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={`Sửa thông tin — ${form?.ma_khach_hang || ''}`}
        footer={
          <>
            <Button chiXemOk variant="ghost" onClick={() => setForm(null)}>Đóng</Button>
            <Button onClick={doSave} loading={saving} disabled={!coCot}>Lưu</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm">
          <div className="font-medium text-ink">{form?.ten_khach_hang}</div>
          <div className="text-xs text-ink-soft">Mã ERP: {form?.ma_khach_hang} · {form?.so_don_hang ?? 0} đơn hàng</div>
        </div>
        {coCotTen && (
          <Field label="Tên đầy đủ công ty (in lên phiếu giao)">
            <Input value={form?.ten_day_du || ''} maxLength={255}
              onChange={(e) => setForm((f) => ({ ...f, ten_day_du: e.target.value }))}
              placeholder="Vd: Công ty TNHH ABC Việt Nam — bỏ trống thì phiếu in mã khách" />
          </Field>
        )}
        <Field label="Địa chỉ (trụ sở)">
          <Textarea rows={2} value={form?.dia_chi || ''}
            onChange={(e) => setForm((f) => ({ ...f, dia_chi: e.target.value }))}
            placeholder="Vd: Lô A1, KCN Long An, huyện Bến Lức, tỉnh Long An" />
        </Field>
        <Field label="Địa chỉ giao hàng mặc định">
          <Textarea rows={2} value={form?.dia_chi_giao || ''}
            onChange={(e) => setForm((f) => ({ ...f, dia_chi_giao: e.target.value }))}
            placeholder="Nơi nhận hàng — gợi ý sẵn vào ô “Giao hàng tại” lúc in phiếu" />
        </Field>
        <Field label="Ghi chú">
          <Textarea rows={2} value={form?.ghi_chu || ''}
            onChange={(e) => setForm((f) => ({ ...f, ghi_chu: e.target.value }))}
            placeholder="Vd: giao giờ hành chính, gọi trước khi tới..." />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
