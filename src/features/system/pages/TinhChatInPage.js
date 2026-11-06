import { useCallback, useEffect, useMemo, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import ChipTabs from '../../../components/common/ChipTabs';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import { Field, Input, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useChiXem from '../../../hooks/useChiXem';
import { fmtNum, fmtDateTime } from '../../../utils/format';
import { khopTungTu } from '../../../utils/timKiem';
import { listTinhChatIn, saveTinhChatIn, addTinhChatIn, removeTinhChatIn } from '../../../services/tinhChatInService';

// ─────────────────────────────────────────────────────────────────────────────
// TÍNH CHẤT IN (mig 123, 04/11/2026, người dùng yêu cầu) — quản lý từng tính chất in: thuộc LUỒNG nào + có BỎ QUA khi đồng bộ
// ERP không. `luong` hiện chỉ là phân loại (luồng riêng chưa làm); `bo_qua` có hiệu lực từ lượt đồng bộ kế tiếp nên lúc lưu
// có đổi bỏ qua thì phải hỏi lại. Luật + danh mục luồng ở BE `utils/tinhChatIn.js`.
// ─────────────────────────────────────────────────────────────────────────────

const LOC_BO_QUA = [
  { v: '', label: 'Tất cả' },
  { v: 'CO', label: 'Đang bỏ qua' },
  { v: 'KHONG', label: 'Không bỏ qua' },
];
const TOI_DA_LIET_KE = 12;

const ghiChuCua = (r) => String(r.ghi_chu ?? '').trim();
const doiGoc = (r, g) => !!g && (r.luong !== g.luong || r.bo_qua !== g.bo_qua || ghiChuCua(r) !== ghiChuCua(g));
const gocTu = (items) => Object.fromEntries(items.map((r) => [r.ma_chuan, r]));

// Tính chất này hiện đang đi đâu trong MES — đọc `da_lam` của luồng (luồng chưa làm thì hàng vào MES đi luồng in thường).
function hienTai(r, dsLuong) {
  if (r.bo_qua) return { ten: 'Không vào MES', tone: 'default' };
  const l = dsLuong.find((x) => x.ma === r.luong);
  if (l && l.da_lam) return { ten: 'Vào MES', tone: 'success' };
  return { ten: 'Vào MES · tạm đi luồng in thường', tone: 'warning' };
}

// Công tắc gạt — dựng lại y hệt `HienThiPainPage` để các trang cấu hình nhìn như một.
function Toggle({ on, onChange, disabled, title }) {
  return (
    <button type="button" title={title} disabled={disabled} aria-pressed={on} aria-label={title}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
        ${on ? 'bg-primary' : 'bg-line'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <span className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform
        ${on ? 'translate-x-[22px]' : 'translate-x-1'}`} />
    </button>
  );
}

// Khối liệt kê tên trong hộp xác nhận lưu (nhiều quá thì cắt, tránh hộp dài hết màn hình).
function DanhSachTen({ tieuDe, ds }) {
  if (!ds.length) return null;
  const hien = ds.slice(0, TOI_DA_LIET_KE);
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-sm font-semibold text-ink">{tieuDe}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
        {hien.map((r) => (
          <li key={r.ma_chuan}>
            {r.ten}{r.so_phan_in > 0 ? ` (${fmtNum(r.so_phan_in)} phần in trong MES)` : ''}
          </li>
        ))}
        {ds.length > hien.length && <li>… và {fmtNum(ds.length - hien.length)} tính chất khác</li>}
      </ul>
    </div>
  );
}

export default function TinhChatInPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const chiXem = useChiXem();                    // tài khoản khách / vào được nhờ HE_THONG_XEM
  const canEdit = can('WORKFLOW_MANAGE') && !chiXem;

  const [rows, setRows] = useState([]);
  const [goc, setGoc] = useState({});            // giá trị đang lưu trên server, theo `ma_chuan`
  const [dsLuong, setDsLuong] = useState([]);
  const [chuaMig, setChuaMig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [chip, setChip] = useState('');
  const [locBoQua, setLocBoQua] = useState('');
  const [search, setSearch] = useState('');
  const [chon, setChon] = useState(() => new Set());

  const [hoiLuu, setHoiLuu] = useState(false);
  const [them, setThem] = useState(null);        // form "Thêm tính chất"
  const [xoa, setXoa] = useState(null);          // dòng đang hỏi xóa

  const nap = useCallback((d) => {
    setRows(d.items || []);
    setGoc(gocTu(d.items || []));
    setDsLuong(d.luong || []);
    setChuaMig(!!d.chua_migration);
  }, []);

  useEffect(() => {
    let huy = false;
    (async () => {
      try {
        const res = await listTinhChatIn();
        if (!huy) nap(res.data);
      } catch (e) {
        if (!huy) show(e.message || 'Lỗi tải danh mục', 'error');
      } finally {
        if (!huy) setLoading(false);
      }
    })();
    return () => { huy = true; };
  }, [nap, show]);

  const suaDuoc = canEdit && !chuaMig;
  const tenLuong = useCallback((ma) => (dsLuong.find((l) => l.ma === ma) || {}).ten || ma, [dsLuong]);

  const dsDoi = useMemo(() => rows.filter((r) => doiGoc(r, goc[r.ma_chuan])), [rows, goc]);
  const dsMo = useMemo(() => dsDoi.filter((r) => goc[r.ma_chuan].bo_qua && !r.bo_qua), [dsDoi, goc]);
  const dsBoQuaMoi = useMemo(() => dsDoi.filter((r) => !goc[r.ma_chuan].bo_qua && r.bo_qua), [dsDoi, goc]);

  // Tập đang xét TRƯỚC khi áp chip luồng (số trên chip không tự áp chính chip đó).
  const truocChip = useMemo(() => rows.filter((r) => {
    if (locBoQua === 'CO' && !r.bo_qua) return false;
    if (locBoQua === 'KHONG' && r.bo_qua) return false;
    return khopTungTu(`${r.ten} ${r.ma_chuan} ${r.ghi_chu || ''} ${tenLuong(r.luong)}`, search);
  }), [rows, locBoQua, search, tenLuong]);
  const hien = useMemo(() => (chip ? truocChip.filter((r) => r.luong === chip) : truocChip), [truocChip, chip]);

  const tabs = useMemo(() => [{ v: '', label: 'Tất cả' }, ...dsLuong.map((l) => ({ v: l.ma, label: l.ten }))], [dsLuong]);
  const counts = useMemo(() => {
    const c = { '': truocChip.length };
    truocChip.forEach((r) => { c[r.luong] = (c[r.luong] || 0) + 1; });
    return c;
  }, [truocChip]);

  // Số đang bỏ qua của luồng đang xem (không phụ thuộc ô lọc bỏ qua / ô tìm).
  const tongLuong = useMemo(() => (chip ? rows.filter((r) => r.luong === chip) : rows), [rows, chip]);
  const soBoQua = tongLuong.filter((r) => r.bo_qua).length;

  const doiDong = (ma, patch) => setRows((rs) => rs.map((r) => (r.ma_chuan === ma ? { ...r, ...patch } : r)));
  const doiNhieu = (patch) => setRows((rs) => rs.map((r) => (chon.has(r.ma_chuan) ? { ...r, ...patch } : r)));

  const hienDaChon = hien.filter((r) => chon.has(r.ma_chuan)).length;
  const chonHet = hien.length > 0 && hienDaChon === hien.length;
  const doiTatCa = () => setChon(chon.size > 0 ? new Set() : new Set(hien.map((r) => r.ma_chuan)));
  const doiMot = (ma) => setChon((cu) => {
    const m = new Set(cu);
    if (m.has(ma)) m.delete(ma); else m.add(ma);
    return m;
  });

  const luu = async () => {
    setSaving(true);
    const coDoiBoQua = dsMo.length + dsBoQuaMoi.length > 0;
    try {
      const res = await saveTinhChatIn(dsDoi.map((r) => ({ ten: r.ten, luong: r.luong, bo_qua: r.bo_qua, ghi_chu: ghiChuCua(r) })));
      nap(res.data);
      setChon(new Set());
      setHoiLuu(false);
      show(coDoiBoQua ? 'Đã lưu — đồng bộ ERP áp dụng từ lượt kế tiếp' : 'Đã lưu danh mục tính chất in');
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };
  const bamLuu = () => {
    if (dsMo.length + dsBoQuaMoi.length > 0) setHoiLuu(true);
    else luu();
  };

  // Thêm / xóa tải lại danh mục từ server nhưng GIỮ các dòng đang sửa dở chưa lưu.
  const napGiuSua = (d) => {
    const dangSua = new Map(dsDoi.map((r) => [r.ma_chuan, r]));
    setGoc(gocTu(d.items || []));
    setRows((d.items || []).map((r) => {
      const s = dangSua.get(r.ma_chuan);
      return s ? { ...r, luong: s.luong, bo_qua: s.bo_qua, ghi_chu: s.ghi_chu } : r;
    }));
  };
  const luuThem = async () => {
    setSaving(true);
    try {
      const res = await addTinhChatIn({ ten: them.ten, luong: them.luong, bo_qua: them.bo_qua, ghi_chu: them.ghi_chu });
      napGiuSua(res.data);
      setThem(null);
      show('Đã thêm tính chất in');
    } catch (e) {
      show(e.message || 'Thêm thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };
  const luuXoa = async () => {
    setSaving(true);
    try {
      const res = await removeTinhChatIn(xoa.id);
      napGiuSua(res.data);
      setChon((cu) => { const m = new Set(cu); m.delete(xoa.ma_chuan); return m; });
      setXoa(null);
      show('Đã xóa tính chất in');
    } catch (e) {
      show(e.message || 'Xóa thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    ...(suaDuoc ? [{
      key: 'sel', selection: true,
      header: <input type="checkbox" aria-label="Chọn tất cả / bỏ tích tất cả" checked={chonHet}
        ref={(el) => { if (el) el.indeterminate = chon.size > 0 && !chonHet; }} onChange={doiTatCa} />,
      render: (r) => <input type="checkbox" aria-label={`Chọn ${r.ten}`} checked={chon.has(r.ma_chuan)} onChange={() => doiMot(r.ma_chuan)} />,
    }] : []),
    {
      key: 'ten', header: 'Tính chất in',
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-ink">{r.ten}</span>
          {r.moi && <Badge tone="info">Mới từ ERP</Badge>}
        </span>
      ),
    },
    {
      key: 'luong', header: 'Luồng',
      render: (r) => (suaDuoc ? (
        <div className="min-w-[10rem]">
          <Select aria-label={`Luồng của ${r.ten}`} value={r.luong} onChange={(e) => doiDong(r.ma_chuan, { luong: e.target.value })}>
            {dsLuong.map((l) => <option key={l.ma} value={l.ma}>{l.ten}</option>)}
          </Select>
        </div>
      ) : tenLuong(r.luong)),
    },
    {
      key: 'bo_qua', header: 'Bỏ qua',
      render: (r) => (
        <Toggle on={r.bo_qua} disabled={!suaDuoc} title={`Bỏ qua ${r.ten}`}
          onChange={(v) => doiDong(r.ma_chuan, { bo_qua: v })} />
      ),
    },
    {
      key: 'hien_tai', header: 'Hiện tại',
      render: (r) => { const h = hienTai(r, dsLuong); return <Badge tone={h.tone}>{h.ten}</Badge>; },
    },
    { key: 'so_phan_in', header: 'Phần in trong MES', className: 'text-right tabular-nums', headerClassName: 'text-right', render: (r) => fmtNum(r.so_phan_in) },
    { key: 'so_dot_erp', header: 'Đợt ERP ~10 ngày', className: 'text-right tabular-nums', headerClassName: 'text-right', render: (r) => fmtNum(r.so_dot_erp) },
    {
      key: 'ghi_chu', header: 'Ghi chú',
      render: (r) => (suaDuoc ? (
        <div className="min-w-[16rem]">
          <Input aria-label={`Ghi chú của ${r.ten}`} value={r.ghi_chu || ''} maxLength={300}
            onChange={(e) => doiDong(r.ma_chuan, { ghi_chu: e.target.value })} />
        </div>
      ) : (r.ghi_chu || '—')),
    },
    {
      key: 'sua', header: 'Sửa gần nhất',
      render: (r) => (r.nguoi_sua
        ? <span className="text-xs text-ink-soft">{r.nguoi_sua}<br />{fmtDateTime(r.updated_date)}</span>
        : <span className="text-ink-soft">—</span>),
    },
    ...(suaDuoc ? [{
      key: 'xoa', header: '',
      render: (r) => (r.id && !r.bo_qua && !r.so_phan_in
        ? <Button variant="ghost" onClick={() => setXoa(r)}>Xóa</Button>
        : null),
    }] : []),
  ];

  return (
    <div>
      <Toolbar title="Tính chất in" search={search} onSearch={setSearch} searchPlaceholder="Tìm tính chất, ghi chú...">
        {suaDuoc && (
          <>
            <Button variant="secondary" icon="plus" onClick={() => setThem({ ten: '', luong: chip || 'CHUA_PHAN_LOAI', bo_qua: false, ghi_chu: '' })}>
              Thêm tính chất
            </Button>
            <Button icon="check" loading={saving && !hoiLuu && !them && !xoa} disabled={!dsDoi.length} onClick={bamLuu}>
              Lưu thay đổi{dsDoi.length ? ` (${fmtNum(dsDoi.length)})` : ''}
            </Button>
          </>
        )}
      </Toolbar>

      {chuaMig && (
        <p className="mb-3 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          Chưa chạy migration 123 nên chưa lưu được. Đồng bộ ERP đang dùng danh sách bỏ qua mặc định.
        </p>
      )}

      <ChipTabs tabs={tabs} value={chip} counts={counts} onChange={setChip} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-control border border-line p-0.5">
          {LOC_BO_QUA.map((o) => (
            <button key={o.v || 'all'} type="button" onClick={() => setLocBoQua(o.v)}
              className={`rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors ${
                locBoQua === o.v ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
        <Badge tone={soBoQua ? 'warning' : 'success'}>Đang bỏ qua {fmtNum(soBoQua)}/{fmtNum(tongLuong.length)}</Badge>

        {suaDuoc && chon.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-control border border-primary/40 bg-primary/5 px-2 py-1">
            <span className="text-sm font-medium text-ink">Đã chọn {fmtNum(chon.size)}</span>
            <div className="w-44">
              <Select aria-label="Chuyển luồng các dòng đã chọn" value="" onChange={(e) => { if (e.target.value) doiNhieu({ luong: e.target.value }); }}>
                <option value="">Chuyển luồng…</option>
                {dsLuong.map((l) => <option key={l.ma} value={l.ma}>{l.ten}</option>)}
              </Select>
            </div>
            <Button variant="secondary" onClick={() => doiNhieu({ bo_qua: true })}>Bỏ qua</Button>
            <Button variant="secondary" onClick={() => doiNhieu({ bo_qua: false })}>Không bỏ qua</Button>
            <Button variant="ghost" onClick={() => setChon(new Set())}>Bỏ chọn</Button>
          </div>
        )}
      </div>

      <DataTable columns={columns} rows={hien} rowKey="ma_chuan" loading={loading} pageSize={0}
        emptyText="Không có tính chất in nào"
        rowClassName={(r) => (doiGoc(r, goc[r.ma_chuan]) ? 'bg-amber-50/70 dark:bg-amber-950/20' : '')} />

      <ConfirmDialog open={hoiLuu} onClose={() => setHoiLuu(false)} onConfirm={luu} loading={saving}
        title="Đổi tính chất bị bỏ qua khi đồng bộ ERP" variant="danger"
        confirmText={`Lưu ${fmtNum(dsDoi.length)} thay đổi`}
        message="Thay đổi này có hiệu lực từ lượt đồng bộ ERP kế tiếp.">
        <DanhSachTen tieuDe={`Không bỏ qua nữa (${fmtNum(dsMo.length)}): đợt mới vào MES, luồng riêng chưa làm thì đi luồng in thường`} ds={dsMo} />
        <DanhSachTen tieuDe={`Bắt đầu bỏ qua (${fmtNum(dsBoQuaMoi.length)}): đợt mới không vào MES, hàng đã có trong MES giữ nguyên`} ds={dsBoQuaMoi} />
      </ConfirmDialog>

      <ConfirmDialog open={!!xoa} onClose={() => setXoa(null)} onConfirm={luuXoa} loading={saving}
        title="Xóa tính chất in" variant="danger" confirmText="Xóa"
        message={xoa ? `Xóa "${xoa.ten}" khỏi danh mục?` : ''} />

      <Modal open={!!them} onClose={() => setThem(null)} title="Thêm tính chất in" size="sm"
        footer={(
          <>
            <Button variant="ghost" chiXemOk onClick={() => setThem(null)}>Hủy</Button>
            <Button onClick={luuThem} loading={saving} disabled={!them || !them.ten.trim()}>Thêm</Button>
          </>
        )}>
        {them && (
          <div className="space-y-3">
            <Field label="Tính chất in" required>
              <Input autoFocus maxLength={100} value={them.ten} onChange={(e) => setThem((s) => ({ ...s, ten: e.target.value }))} />
            </Field>
            <Field label="Luồng">
              <Select value={them.luong} onChange={(e) => setThem((s) => ({ ...s, luong: e.target.value }))}>
                {dsLuong.map((l) => <option key={l.ma} value={l.ma}>{l.ten}</option>)}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={them.bo_qua} onChange={(e) => setThem((s) => ({ ...s, bo_qua: e.target.checked }))} />
              Bỏ qua khi đồng bộ ERP
            </label>
            <Field label="Ghi chú">
              <Input maxLength={300} value={them.ghi_chu} onChange={(e) => setThem((s) => ({ ...s, ghi_chu: e.target.value }))} />
            </Field>
          </div>
        )}
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
