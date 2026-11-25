import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import { fmtDateTime, fmtNum } from '../../../utils/format';
import { dsHangDoi, boHangDoi, LOAI_HANG_DOI } from '../../../services/hangDoiService';

// ─────────────────────────────────────────────────────────────────────────────
// HỆ THỐNG › HÀNG ĐỢI TÍCH TEM (19/11/2026, người dùng: "ở hệ thống có trang để quản lý những hàng đợi này, để kiểm tra tem nào
//   còn trong hàng đợi để chuẩn bị chạy"). Bảng Tích tem (KCS · Phân loại lỗi · Nhận sửa · Sửa) lưu quá 5 giây ⇒ tem còn lại
//   vào hàng đợi, máy chủ chạy từng tem (BE `modules/hangdoi/hangDoi.js`).
//   · Chip loại + chip trạng thái (Đang chờ · Lỗi · Đã xong · Đã bỏ — mục xong / bỏ giữ 3 ngày), tìm mã tem, `?lo=` = 1 lần xếp
//     (link từ thông báo chuông). Tải lại theo socket `hang-doi:cap-nhat`.
//   · Mục LỖI không tự chạy lại (lỗi do số liệu): làm lại tem đó ở màn của nó rồi bấm Bỏ. Bỏ mục đang chờ = không chạy nữa.
//     Người xếp bỏ được mục của mình, quản trị bỏ được mọi mục (BE chặn).
// ─────────────────────────────────────────────────────────────────────────────
const TT = {
  CHO: ['Đang chờ', 'warning'], LOI: ['Lỗi', 'danger'], XONG: ['Đã xong', 'success'], BO: ['Đã bỏ', 'default'],
};
const CHIP_TT = [['', 'Tất cả'], ['CHO', 'Đang chờ'], ['LOI', 'Lỗi'], ['XONG', 'Đã xong'], ['BO', 'Đã bỏ']];

function Chip({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${on ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink hover:border-primary/40'}`}>
      {children}
    </button>
  );
}

export default function HangDoiTichTemPage() {
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const [sp, setSp] = useSearchParams();
  const loai = sp.get('loai') || '';
  const lo = sp.get('lo') || '';
  const [trangThai, setTrangThai] = useState('');
  const [tim, setTim] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dangBo, setDangBo] = useState('');

  const datSp = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };

  const load = useCallback(async (im = false) => {
    if (!im) setLoading(true);
    try {
      const r = await dsHangDoi({ loai: loai || undefined, lo: lo || undefined, tim: tim || undefined, soGio: 72 });
      setData(r.data || null);
    } catch (e) { if (!im) show(e.message || 'Lỗi tải hàng đợi', 'error'); } finally { if (!im) setLoading(false); }
  }, [loai, lo, tim, show]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useSocketReload(['hang-doi:cap-nhat'], () => load(true), 800);

  const ds = useMemo(() => data?.ds || [], [data]);
  const dem = useMemo(() => {
    const d = { '': ds.length, CHO: 0, LOI: 0, XONG: 0, BO: 0 };
    ds.forEach((m) => { d[m.trang_thai] += 1; });
    return d;
  }, [ds]);
  const rows = useMemo(() => {
    const thuTu = { LOI: 0, CHO: 1, XONG: 2, BO: 3 };
    return (trangThai ? ds.filter((m) => m.trang_thai === trangThai) : ds)
      .slice().sort((a, b) => (thuTu[a.trang_thai] - thuTu[b.trang_thai]) || (new Date(a.tg_xep) - new Date(b.tg_xep)));
  }, [ds, trangThai]);
  const coBo = can('KCS') || can('PHAN_LOAI_LOI') || can('SUA');

  const bo = async (m) => {
    setDangBo(m.id);
    try { await boHangDoi(m.id); show(`Đã bỏ tem ${m.ma_tem} khỏi hàng đợi`); load(true); } catch (e) {
      show(e.message || 'Bỏ thất bại', 'error');
    } finally { setDangBo(''); }
  };

  const columns = [
    { key: 'ma_tem', header: 'Tem', render: (m) => <span className="font-mono text-xs font-semibold text-primary">{m.ma_tem}</span> },
    { key: 'loai', header: 'Màn', render: (m) => m.ten_loai },
    { key: 'tt', header: 'Trạng thái', render: (m) => {
      const [nhan, tone] = TT[m.trang_thai] || TT.CHO;
      return (
        <div className="flex items-center gap-1.5">
          <Badge tone={tone}>{nhan}</Badge>
          {data?.dang_lam === m.id && <span className="text-xs text-primary">đang chạy…</span>}
        </div>
      );
    } },
    { key: 'tom_tat', header: 'Nội dung', render: (m) => (
      <div className="leading-tight">
        <span className="text-sm">{m.tom_tat}</span>
        {/* Xích theo tem (25/11/2026): mục chỉ chạy sau khi bước trước của chính tem đó xong. */}
        {m.sau_ten && <div className="text-xs text-ink-soft">Chạy sau: {m.sau_ten} của tem này</div>}
      </div>
    ) },
    { key: 'xep', header: 'Xếp lúc · người xếp', render: (m) => (
      <div className="leading-tight">
        <div className="whitespace-nowrap text-xs tabular-nums">{fmtDateTime(m.tg_xep)}</div>
        <div className="text-xs text-ink-soft">{m.nguoi_xep || '—'}</div>
      </div>
    ) },
    { key: 'kq', header: 'Kết quả', render: (m) => (
      <div className="max-w-md text-xs leading-snug">
        {m.trang_thai === 'LOI' && <span className="text-danger">{m.loi}</span>}
        {m.trang_thai === 'XONG' && (
          <span className="text-success">
            Đã lưu{m.ket_qua?.ma_tem_17 ? ` · tem 17 ${m.ket_qua.ma_tem_17}` : ''} · {fmtDateTime(m.tg_xong)}
          </span>
        )}
        {m.trang_thai === 'BO' && <span className="text-ink-soft">Bỏ bởi {m.nguoi_bo || '—'}{m.ly_do_bo ? ` — ${m.ly_do_bo}` : ''} · {fmtDateTime(m.tg_xong)}</span>}
      </div>
    ) },
    { key: 'act', header: '', className: 'text-right', render: (m) => (coBo && (m.trang_thai === 'LOI' || m.trang_thai === 'CHO')
      ? <Button variant="ghost" className="px-2 py-1 text-xs" loading={dangBo === m.id} onClick={() => bo(m)}>Bỏ</Button> : null) },
  ];

  return (
    <div>
      <Toolbar title="Hàng đợi tích tem" subtitle="Tem lưu quá 5 giây ở bảng Tích tem — máy chủ chạy từng tem"
        search={tim} onSearch={setTim} searchPlaceholder="Tìm mã tem…">
        <Badge tone={data?.cho ? 'warning' : 'default'}>{fmtNum(data?.cho || 0)} đang chờ</Badge>
        {data?.loi > 0 && <Badge tone="danger">{fmtNum(data.loi)} lỗi</Badge>}
        {data && (
          <span className="text-xs text-ink-soft">
            {data.dang_chay ? 'Máy chủ đang chạy…' : 'Máy chủ rảnh'}
            {data.chay_tren_may === false ? ' (máy này không chạy hàng đợi — máy chủ thật sẽ chạy)' : ''}
          </span>
        )}
      </Toolbar>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip on={!loai} onClick={() => datSp('loai', '')}>Mọi màn</Chip>
        {Object.entries(LOAI_HANG_DOI).map(([ma, ten]) => {
          const t = data?.theo_loai?.[ma] || {};
          return (
            <Chip key={ma} on={loai === ma} onClick={() => datSp('loai', ma)}>
              {ten}{t.CHO ? ` · ${t.CHO} chờ` : ''}{t.LOI ? ` · ${t.LOI} lỗi` : ''}
            </Chip>
          );
        })}
        <span className="mx-1 h-5 w-px bg-line" />
        {CHIP_TT.map(([ma, ten]) => (
          <Chip key={ma || 'all'} on={trangThai === ma} onClick={() => setTrangThai(ma)}>{ten} ({fmtNum(dem[ma] || 0)})</Chip>
        ))}
        {lo && (
          <Chip on onClick={() => datSp('lo', '')}>Đang xem 1 lần xếp ✕</Chip>
        )}
      </div>
      <p className="mb-3 text-xs text-ink-soft">
        Tem <b>Lỗi</b> không tự chạy lại — làm lại tem đó ở màn của nó rồi bấm <b>Bỏ</b>. Mục đã xong / đã bỏ giữ 3 ngày.
      </p>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="id" emptyText="Hàng đợi trống." />
      <Toast toast={toast} />
    </div>
  );
}
