import { useCallback, useEffect, useMemo, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useSocketReload from '../../../hooks/useSocketReload';
import { useSelector } from 'react-redux';
import { listPhien, dangXuatPhien, dangXuatMoiThietBi } from '../../../services/phienService';

// ─────────────────────────────────────────────────────────────────────────────
// PHIÊN ĐĂNG NHẬP THEO THIẾT BỊ (mig 081) — Hệ thống → Phiên đăng nhập.
//
// Việc cần làm được ở đây: thấy 1 tài khoản đang đăng nhập trên NHỮNG MÁY NÀO, rồi đăng xuất máy
// KHÔNG dùng nữa (máy để quên trạng thái đăng nhập thì ai cũng bấm xác nhận được).
//
// ⚠ Đăng xuất ở đây có hiệu lực THẬT: token của thiết bị đó bị chặn ở backend ⇒ request kế tiếp trả
//   401 và máy đó tự về màn đăng nhập, KỂ CẢ khi lúc bấm nó đang tắt/offline.
// ⚠ Nút "Đăng xuất mọi thiết bị" mạnh hơn: chặn cả token CŨ phát trước mig 081 (loại token không có
//   mã phiên nên không đăng xuất lẻ được).
// ─────────────────────────────────────────────────────────────────────────────

const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');

// Khoảng thời gian từ mốc tới bây giờ, dạng gọn: "3 ngày" / "2g 05p" / "12p" / "vừa xong".
function truoc(t) {
  if (!t) return '—';
  const ms = Date.now() - new Date(t).getTime();
  if (ms < 60 * 1000) return 'vừa xong';
  const p = Math.floor(ms / 60000);
  if (p < 60) return `${p} phút trước`;
  const g = Math.floor(p / 60);
  if (g < 24) return `${g}g ${String(p % 60).padStart(2, '0')}p trước`;
  return `${Math.floor(g / 24)} ngày trước`;
}

const TONE_TT = { HOAT_DONG: 'success', DA_DANG_XUAT: 'default', BUOC_DANG_XUAT: 'warning' };
const NHAN_TT = {
  HOAT_DONG: 'Đang đăng nhập',
  DA_DANG_XUAT: 'Đã tự đăng xuất',
  BUOC_DANG_XUAT: 'Bị đăng xuất từ xa',
};

export default function PhienDangNhapPage() {
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const coQuyen = can('PHIEN_MANAGE');
  const myId = useSelector((s) => s.auth?.user?.id);

  const [rows, setRows] = useState([]);
  const [coBang, setCoBang] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tatCa, setTatCa] = useState(false);        // hiện cả phiên đã đăng xuất
  const [chiNhieuMay, setChiNhieuMay] = useState(false); // chỉ tài khoản đăng nhập >1 máy
  const [xacNhan, setXacNhan] = useState(null);     // { kieu: 'MOT'|'TAT_CA', row }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await listPhien({ search, tatCa: tatCa ? 1 : undefined });
      setRows((res.data.items || []).map((r, i) => ({ ...r, _k: i })));
      setCoBang(res.data.co_bang !== false);
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải danh sách phiên', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, tatCa, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  // Ai đó đăng xuất thiết bị ở máy khác → danh sách tự cập nhật (tải NGẦM, không nháy bảng).
  useSocketReload(['phien:dang-xuat'], () => load(true));

  const viewRows = useMemo(
    () => (chiNhieuMay ? rows.filter((r) => Number(r.so_thiet_bi) > 1) : rows),
    [rows, chiNhieuMay]
  );
  const soHoatDong = rows.filter((r) => r.trang_thai === 'HOAT_DONG').length;
  const soNhieuMay = useMemo(() => {
    const m = new Map();
    rows.filter((r) => r.trang_thai === 'HOAT_DONG')
      .forEach((r) => m.set(r.nguoi_dung_id, (m.get(r.nguoi_dung_id) || 0) + 1));
    return Array.from(m.values()).filter((n) => n > 1).length;
  }, [rows]);

  const doDangXuat = async () => {
    if (!xacNhan) return;
    setBusy(true);
    try {
      const r = xacNhan.row;
      if (xacNhan.kieu === 'TAT_CA') {
        const res = await dangXuatMoiThietBi(r.nguoi_dung_id, 'Đăng xuất mọi thiết bị từ trang quản trị');
        show(`Đã đăng xuất ${res.data?.so_phien ?? 0} thiết bị của ${r.ho_ten || r.ten_dang_nhap}`);
      } else {
        await dangXuatPhien(r.id, 'Đăng xuất thiết bị từ trang quản trị');
        show(`Đã đăng xuất ${r.ho_ten || r.ten_dang_nhap} khỏi ${r.thiet_bi || 'thiết bị'}`);
      }
      setXacNhan(null);
      await load();
    } catch (e) {
      show(e.message || 'Đăng xuất thất bại', 'error');
    } finally { setBusy(false); }
  };

  const columns = [
    {
      key: 'nguoi', header: 'Tài khoản', render: (r) => (
        <div className="leading-tight">
          <div className="font-medium text-ink">
            {r.ho_ten || '—'}
            {r.nguoi_dung_id === myId && <Badge tone="info" className="ml-1.5">máy này / của tôi</Badge>}
          </div>
          <div className="text-xs text-ink-soft">@{r.ten_dang_nhap}{r.ten_phong_ban ? ` · ${r.ten_phong_ban}` : ''}</div>
        </div>
      ),
    },
    {
      key: 'thiet_bi', header: 'Thiết bị', render: (r) => (
        <div className="leading-tight">
          <div className="text-ink">{r.thiet_bi || 'Không rõ'}</div>
          <div className="text-xs text-ink-soft">{r.ip || '—'}</div>
        </div>
      ),
    },
    {
      key: 'so_thiet_bi', header: 'Số máy', className: 'text-center',
      render: (r) => (Number(r.so_thiet_bi) > 1
        ? <Badge tone="warning">{r.so_thiet_bi} máy</Badge>
        : <span className="text-ink-soft">1</span>),
    },
    { key: 'tg_dang_nhap', header: 'Đăng nhập lúc', className: 'whitespace-nowrap', render: (r) => fmtDt(r.tg_dang_nhap) },
    {
      key: 'tg_hoat_dong_cuoi', header: 'Hoạt động cuối', className: 'whitespace-nowrap',
      render: (r) => (
        <div className="leading-tight">
          <div className="text-ink">{truoc(r.tg_hoat_dong_cuoi)}</div>
          <div className="text-xs text-ink-soft">{fmtDt(r.tg_hoat_dong_cuoi)}</div>
        </div>
      ),
    },
    {
      key: 'trang_thai', header: 'Trạng thái', render: (r) => (
        <div className="leading-tight">
          <Badge tone={TONE_TT[r.trang_thai] || 'default'}>{NHAN_TT[r.trang_thai] || r.trang_thai}</Badge>
          {r.trang_thai !== 'HOAT_DONG' && (
            <div className="mt-0.5 text-xs text-ink-soft">
              {fmtDt(r.tg_ket_thuc)}{r.nguoi_ket_thuc ? ` · ${r.nguoi_ket_thuc}` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions', header: '', className: 'whitespace-nowrap text-right', render: (r) => {
        if (r.trang_thai !== 'HOAT_DONG') return null;
        // Tự đăng xuất thiết bị CỦA MÌNH thì không cần quyền `PHIEN_MANAGE` (backend cũng cho).
        const duocPhep = coQuyen || r.nguoi_dung_id === myId;
        if (!duocPhep) return <span className="text-xs text-ink-soft">Không có quyền</span>;
        return (
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" className="!px-2.5 !py-1 !text-xs"
              onClick={() => setXacNhan({ kieu: 'TAT_CA', row: r })}>Mọi thiết bị</Button>
            <Button variant="danger" icon="log-out" className="!px-2.5 !py-1 !text-xs"
              onClick={() => setXacNhan({ kieu: 'MOT', row: r })}>Đăng xuất</Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <Toolbar title="Phiên đăng nhập" subtitle="Tài khoản đang đăng nhập trên thiết bị nào — đăng xuất máy không dùng nữa"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm tên, tên đăng nhập, thiết bị, IP...">
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={chiNhieuMay} onChange={(e) => setChiNhieuMay(e.target.checked)} />
          Chỉ tài khoản nhiều máy
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={tatCa} onChange={(e) => setTatCa(e.target.checked)} />
          Hiện cả phiên đã đăng xuất
        </label>
        <Button variant="ghost" icon="history" onClick={() => load()}>Tải lại</Button>
        <Badge tone="success">{soHoatDong} phiên đang đăng nhập</Badge>
        {soNhieuMay > 0 && <Badge tone="warning">{soNhieuMay} tài khoản &gt; 1 máy</Badge>}
      </Toolbar>

      {!coBang && (
        <div className="mb-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <b>Chưa chạy migration 081</b> — bảng <code>phien_dang_nhap</code> chưa có nên chưa ghi được
          phiên đăng nhập. Chạy <code>database/migrations/081_phien_dang_nhap.sql</code> bằng user
          <code> postgres</code>, sau đó những người đăng nhập MỚI sẽ hiện ở đây.
        </div>
      )}
      {coBang && !loading && rows.length === 0 && (
        <div className="mb-3 rounded-card border border-line bg-surface-muted px-4 py-3 text-sm text-ink-soft">
          Chưa có phiên nào được ghi. Phiên chỉ được tạo từ lần <b>ĐĂNG NHẬP MỚI</b> sau khi chạy
          migration — người đang dùng token cũ sẽ không hiện ở đây cho tới khi họ đăng nhập lại.
        </div>
      )}

      <DataTable columns={columns} rows={viewRows} loading={loading} rowKey="_k" sttStart={0}
        emptyText="Không có phiên nào khớp điều kiện" />

      <ConfirmDialog
        open={!!xacNhan}
        onClose={() => setXacNhan(null)}
        onConfirm={doDangXuat}
        loading={busy}
        variant="danger"
        confirmText={xacNhan?.kieu === 'TAT_CA' ? 'Đăng xuất mọi thiết bị' : 'Đăng xuất thiết bị này'}
        title={xacNhan?.kieu === 'TAT_CA' ? 'Đăng xuất mọi thiết bị?' : 'Đăng xuất thiết bị này?'}
        message={xacNhan && (
          /* ⚠ `ConfirmDialog` bọc `message` trong <p> ⇒ dùng <span className="block">, KHÔNG dùng
             <div> (div lồng trong p là DOM không hợp lệ, React sẽ cảnh báo validateDOMNesting). */
          <span className="block space-y-2 text-sm">
            <span className="block text-ink">
              Tài khoản <b>{xacNhan.row.ho_ten || xacNhan.row.ten_dang_nhap}</b>
              {xacNhan.kieu === 'TAT_CA'
                ? <> sẽ bị đăng xuất khỏi <b>TẤT CẢ thiết bị</b> đang đăng nhập.</>
                : <> sẽ bị đăng xuất khỏi <b>{xacNhan.row.thiet_bi || 'thiết bị'}</b> ({xacNhan.row.ip || '—'}).</>}
            </span>
            <span className="block">
              Máy đó sẽ bị đưa về màn đăng nhập ở lần bấm kế tiếp (kể cả đang tắt máy). Người dùng
              đăng nhập lại là vào bình thường — thao tác này KHÔNG khóa tài khoản.
            </span>
            {xacNhan.kieu === 'TAT_CA' && xacNhan.row.nguoi_dung_id !== myId && (
              <span className="block rounded-control bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                <Icon name="alert-triangle" size={13} className="mr-1 inline" />
                Chặn cả những máy đăng nhập từ <b>trước khi có tính năng này</b> (loại phiên không hiện
                trong danh sách).
              </span>
            )}
          </span>
        )}
      />

      <Toast toast={toast} />
    </div>
  );
}
