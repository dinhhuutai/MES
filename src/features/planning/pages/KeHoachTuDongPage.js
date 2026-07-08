import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import { Field, Input, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import { autoPlanCandidates, createRelease1 } from '../../../services/planningService';
import { fmtNum } from '../../../utils/format';

const LIMIT = 50;
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-0.5 font-medium text-ink">{value || '—'}</div>
    </div>
  );
}

export default function KeHoachTuDongPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRelease = can('RELEASE1');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState(null);
  const [chuyenId, setChuyenId] = useState('');
  const [soLuong, setSoLuong] = useState('');
  const [ngay, setNgay] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await autoPlanCandidates({ search, page, limit: LIMIT });
      setRows(res.data.items);
      setMeta(res.data.meta);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openDetail = (row) => {
    setDetail(row);
    setChuyenId(row.best_chuyen?.chuyen_id || '');
    setSoLuong(String(row.so_luong_vai_ve ?? ''));
    setNgay(todayStr());
  };

  const selectedChuyen = detail?.chuyen_options?.find((c) => c.chuyen_id === chuyenId) || null;

  const submit = async () => {
    if (!chuyenId) { show('Chọn chuyền sản xuất', 'error'); return; }
    setSaving(true);
    try {
      await createRelease1({
        dotVaiIds: [detail.dot_vai_id],
        chuyenId,
        soLuongRelease: soLuong === '' ? null : Number(soLuong),
        ngayKeHoach: ngay || todayStr(),
      });
      show(`Đã xác nhận kế hoạch — Release 1 cho ${detail.ma_phan}`);
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Xác nhận kế hoạch thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => r.ma_phan },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'ma_dot_vai', header: 'Đợt vải', render: (r) => (
      <div className="flex items-center gap-1.5">
        <span>{r.ma_dot_vai}</span><LoaiDotVaiBadge value={r.loai_dot_vai} />
      </div>
    ) },
    { key: 'so_luong_vai_ve', header: 'SL nhận vải', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_vai_ve) },
    { key: 'hskt', header: 'HSKT (vải/pass · lần in · pass bỏ)', className: 'tabular-nums text-ink-soft', render: (r) => (
      `${fmtNum(r.hskt.so_luong_vai_pass)} · ${fmtNum(r.hskt.so_lan_in)} · ${fmtNum(r.hskt.so_pass_bo)}`
    ) },
    { key: 'chuyen', header: 'Chuyền đề xuất', render: (r) => (
      r.best_chuyen
        ? <span>{r.best_chuyen.ten_chuyen} <Badge tone="default">{r.best_chuyen.so_pass} pass</Badge></span>
        : <span className="text-ink-soft">Chưa có chuyền</span>
    ) },
    { key: 'thoi_gian', header: 'Thời gian SX', className: 'text-right tabular-nums', render: (r) => (
      r.best_chuyen ? `${fmtNum(r.best_chuyen.thoi_gian_sx)} phút` : '—'
    ) },
    { key: 'nang_suat', header: 'Năng suất/giờ', className: 'text-right tabular-nums', render: (r) => (
      r.best_chuyen ? <Badge tone="success">{fmtNum(r.best_chuyen.nang_suat_gio)}</Badge> : '—'
    ) },
    { key: 'action', header: '', className: 'text-right', render: (r) => (
      <Button variant="secondary" className="!px-3 !py-1.5 !text-xs"
        onClick={(e) => { e.stopPropagation(); openDetail(r); }}>Xác nhận</Button>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Kế hoạch tự động"
        subtitle="Đề xuất chuyền tối ưu theo năng suất cho từng phần in chờ Release 1 — xác nhận để tạo lệnh sản xuất"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, mã hàng, màu/kích, đợt vải...">
        <Badge tone="info">{meta.total} phần in</Badge>
      </Toolbar>

      <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        Thông số HSKT (vải/pass, số lần in, pass bỏ) và số pass mỗi chuyền hiện là <b>dữ liệu tạm</b> — sẽ lấy từ ERP.
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={openDetail}
        sttStart={(meta.page - 1) * LIMIT}
        emptyText="Không có phần in nào chờ Release 1" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Kế hoạch tự động — ${detail.ma_phan}` : 'Kế hoạch tự động'}
        subtitle={detail ? `${detail.ten_khach_hang || ''} · ${detail.mau_vai || ''}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>Đóng</Button>
            <Button onClick={submit} loading={saving} disabled={!canRelease || !chuyenId}>Xác nhận kế hoạch</Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info label="Code phần" value={detail.ma_phan} />
              <Info label="Đơn hàng" value={detail.ma_don_hang} />
              <Info label="Mã hàng" value={detail.ma_hang} />
              <Info label="Màu vải" value={detail.mau_vai} />
              <Info label="Kích vải" value={detail.kich_vai} />
              <Info label="Kích phim" value={detail.kich_phim} />
              <Info label="Đợt vải" value={detail.ma_dot_vai} />
              <Info label="SL nhận vải" value={fmtNum(detail.so_luong_vai_ve)} />
            </div>

            <div className="rounded-control border border-line p-3">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Hồ sơ kỹ thuật (tạm)</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Info label="SL vải/pass" value={fmtNum(detail.hskt.so_luong_vai_pass)} />
                <Info label="Số lần in" value={fmtNum(detail.hskt.so_lan_in)} />
                <Info label="Số pass bỏ" value={fmtNum(detail.hskt.so_pass_bo)} />
              </div>
            </div>

            <div className="space-y-3 border-t border-line pt-4">
              <Field label="Chuyền sản xuất" hint="Mặc định chọn chuyền cho năng suất cao nhất">
                <Select value={chuyenId} onChange={(e) => setChuyenId(e.target.value)}>
                  <option value="">— Chọn chuyền —</option>
                  {detail.chuyen_options.map((c) => (
                    <option key={c.chuyen_id} value={c.chuyen_id}>
                      {c.ten_chuyen} · {c.so_pass} pass · {fmtNum(c.nang_suat_gio)}/giờ
                    </option>
                  ))}
                </Select>
              </Field>

              {selectedChuyen && (
                <div className="grid grid-cols-2 gap-3 rounded-control bg-surface-muted p-3 text-sm sm:grid-cols-4">
                  <Info label="Số vải/vòng in" value={fmtNum(selectedChuyen.so_vai_vong_in)} />
                  <Info label="X (min vải về/vòng)" value={fmtNum(selectedChuyen.x)} />
                  <Info label="Thời gian SX" value={`${fmtNum(selectedChuyen.thoi_gian_sx)} phút`} />
                  <Info label="Năng suất/giờ" value={fmtNum(selectedChuyen.nang_suat_gio)} />
                </div>
              )}

              <Field label="SL release">
                <Input type="number" min="0" value={soLuong} onChange={(e) => setSoLuong(e.target.value)} />
              </Field>
              <Field label="Ngày sản xuất kế hoạch">
                <Input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
              </Field>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">So sánh chuyền (theo năng suất)</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-xs">
                  <thead>
                    <tr className="text-ink-soft">
                      <th className="px-2 py-1 text-left font-medium">Chuyền</th>
                      <th className="px-2 py-1 text-right font-medium">Pass</th>
                      <th className="px-2 py-1 text-right font-medium">Vải/vòng</th>
                      <th className="px-2 py-1 text-right font-medium">Thời gian</th>
                      <th className="px-2 py-1 text-right font-medium">NS/giờ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.chuyen_options.slice(0, 8).map((c) => (
                      <tr key={c.chuyen_id}
                        className={`cursor-pointer text-ink hover:bg-surface-muted ${c.chuyen_id === chuyenId ? 'bg-primary-wash font-semibold' : ''}`}
                        onClick={() => setChuyenId(c.chuyen_id)}>
                        <td className="px-2 py-1 text-left">{c.ten_chuyen}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{c.so_pass}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{fmtNum(c.so_vai_vong_in)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{fmtNum(c.thoi_gian_sx)}′</td>
                        <td className="px-2 py-1 text-right tabular-nums">{fmtNum(c.nang_suat_gio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      <Toast toast={toast} />
    </div>
  );
}
