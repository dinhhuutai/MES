import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Spinner from '../../../components/common/Spinner';
import { Field, Input, Select, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import useChiXem, { NHAC_CHI_XEM } from '../../../hooks/useChiXem';
import Toast from '../../../components/common/Toast';
import PhieuDesignerModal from '../components/PhieuDesignerModal';
import {
  danhMucPhieu, listMauPhieu, getMauPhieu, taoMauPhieu, nhanBanMauPhieu,
  suaMauPhieu, xoaMauPhieu, ganMauPhieu,
} from '../../../services/mauPhieuService';

// ─────────────────────────────────────────────────────────────────────────────
// HỆ THỐNG → THIẾT KẾ PHIẾU (mig 094)
// Gắn mẫu cho 2 nút in phiếu giao (CHI TIẾT / GỘP) + danh sách mẫu + trình thiết kế toàn màn hình.
// ⚠ Chưa gắn mẫu ⇒ nút In phiếu giao vẫn dùng BỐ CỤC CỨNG trong `printPhieuGiao.js` — module này
//   không bao giờ được phép chặn việc in phiếu.
// ─────────────────────────────────────────────────────────────────────────────

// Lưới trống cho mẫu tự tạo. Vùng lặp BẮT BUỘC 2 hàng (tiêu đề + mẫu dòng) — backend chặn nếu khác.
const khungTrong = (soHang, soCot) => ({
  so_cot: soCot,
  cot: Array.from({ length: soCot }, () => ({ rong_mm: null })),
  hang: Array.from({ length: soHang }, () => ({ cao_mm: 6 })),
  o: {},
});
const BO_CUC_TRONG = () => ({
  v: 1, kho: 'A4', huong: 'doc', le: { tren: 12, phai: 10, duoi: 12, trai: 10 },
  dau: khungTrong(5, 12), lap: khungTrong(2, 6), cuoi: khungTrong(4, 12),
});

export default function ThietKePhieuPage() {
  const { toast, show } = useToast();
  const chiXem = useChiXem();                  // tài khoản chỉ xem (mig 096)
  const [dm, setDm] = useState(null);            // danh mục: khổ giấy · hướng · vị trí in · 2 nhóm trường
  const [ds, setDs] = useState([]);              // danh sách mẫu
  const [dangTai, setDangTai] = useState(true);
  const [mau, setMau] = useState(null);          // mẫu đang mở trong trình thiết kế (đã tải chi tiết)
  const [moTao, setMoTao] = useState(false);
  const [xacNhanXoa, setXacNhanXoa] = useState(null);
  const [form, setForm] = useState({ ma_mau: '', ten_mau: '', mo_ta: '' });

  const tai = useCallback(async () => {
    setDangTai(true);
    try {
      const [a, b] = await Promise.all([danhMucPhieu(), listMauPhieu()]);
      setDm(a.data); setDs(b.data.items || []);
    } catch (e) { show(e.message || 'Không tải được danh sách mẫu phiếu', 'error'); }
    setDangTai(false);
    // ⚠ deps là `show` (ổn định), TUYỆT ĐỐI KHÔNG để cả object `useToast()` vào đây — object mới mỗi
    // render ⇒ `tai` đổi mỗi render ⇒ useEffect([tai]) chạy vô hạn (bẫy deps §9).
  }, [show]);

  useEffect(() => { tai(); }, [tai]);

  const moThietKe = async (id) => {
    try {
      const res = await getMauPhieu(id);
      setMau(res.data);
    } catch (e) { show(e.message || 'Không mở được mẫu', 'error'); }
  };

  // Trả true/false để modal biết có chốt mốc "đã lưu" hay không (lỗi thì giữ nguyên dấu "chưa lưu").
  const luuBoCuc = async (boCuc) => {
    if (!mau) return false;
    try {
      await suaMauPhieu(mau.id, { ten_mau: mau.ten_mau, mo_ta: mau.mo_ta, bo_cuc: boCuc });
      show('Đã lưu mẫu phiếu');
      await tai();
      return true;
    } catch (e) {
      // BE trả `details` = danh sách lỗi bố cục → hiện đúng chỗ sai thay vì "Lỗi hệ thống".
      show(e.message || 'Lưu mẫu thất bại', 'error');
      return false;
    }
  };

  const doGan = async (maViTri, mauPhieuId) => {
    try {
      await ganMauPhieu(maViTri, mauPhieuId);
      show(mauPhieuId ? 'Đã gắn mẫu vào nút in phiếu' : 'Đã gỡ — nút in dùng lại bố cục mặc định');
      await tai();
    } catch (e) { show(e.message || 'Gắn mẫu thất bại', 'error'); }
  };

  const doTao = async () => {
    try {
      const res = await taoMauPhieu({ ...form, bo_cuc: BO_CUC_TRONG() });
      setMoTao(false); setForm({ ma_mau: '', ten_mau: '', mo_ta: '' });
      await tai(); await moThietKe(res.data.id);
      show('Đã tạo mẫu mới — thiết kế rồi bấm Lưu');
    } catch (e) { show(e.message || 'Tạo mẫu thất bại', 'error'); }
  };

  const doNhanBan = async (m) => {
    try {
      const ma = `${m.ma_mau}_COPY${Math.floor(Math.random() * 900 + 100)}`;
      const res = await nhanBanMauPhieu(m.id, { ma_mau: ma, ten_mau: `${m.ten_mau} (bản sao)` });
      await tai(); await moThietKe(res.data.id);
      show('Đã nhân bản — sửa bản sao này không ảnh hưởng mẫu đang in');
    } catch (e) { show(e.message || 'Nhân bản thất bại', 'error'); }
  };

  const doXoa = async () => {
    try {
      await xoaMauPhieu(xacNhanXoa.id);
      setXacNhanXoa(null);
      if (mau && mau.id === xacNhanXoa.id) setMau(null);
      await tai(); show('Đã xóa mẫu phiếu');
    } catch (e) { setXacNhanXoa(null); show(e.message || 'Xóa thất bại', 'error'); }
  };

  const viTriList = useMemo(() => (dm?.vi_tri_in || []), [dm]);

  if (dangTai) return <div className="flex justify-center py-16"><Spinner size={28} /></div>;

  if (dm && dm.co_bang === false) {
    return (
      <div className="rounded-card border border-warning/40 bg-warning/5 p-6 text-sm text-ink">
        <div className="mb-1 font-semibold">Chưa chạy migration 094</div>
        Module Thiết kế phiếu cần bảng <code>mau_phieu</code> / <code>gan_mau_phieu</code>. Chạy
        {' '}<code>database/migrations/094_mau_phieu_thiet_ke.sql</code> bằng user <code>postgres</code> rồi
        tải lại trang. Trong lúc đó nút <b>In phiếu giao</b> vẫn chạy bình thường bằng bố cục mặc định.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── GẮN MẪU VÀO NÚT IN ─────────────────────────────────────────────── */}
      <div className="rounded-card border border-line bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="printer" size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-ink">Nút in phiếu trong hệ thống</h2>
          <span className="text-xs text-ink-soft">— chọn mẫu cho từng nút; để trống = dùng bố cục mặc định trong code</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2">Nút in</th>
                <th className="px-3 py-2">Màn hình</th>
                <th className="px-3 py-2">Kiểu</th>
                <th className="w-72 px-3 py-2">Mẫu đang dùng</th>
              </tr>
            </thead>
            <tbody>
              {viTriList.map((v) => (
                <tr key={v.ma} className="border-t border-line">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{v.ten}</div>
                    <div className="text-xs text-ink-soft">{v.mo_ta}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-soft">{v.man_hinh}</td>
                  <td className="px-3 py-2">
                    <Badge tone={v.kieu === 'GOP' ? 'warning' : 'info'}>
                      {v.kieu === 'GOP' ? 'Gộp theo code phần' : 'Chi tiết từng tem'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="w-64">
                      <Select value={v.mau_phieu_id || ''} onChange={(e) => doGan(v.ma, e.target.value)}>
                        <option value="">— Bố cục mặc định (code) —</option>
                        {ds.map((m) => <option key={m.id} value={m.id}>{m.ten_mau}</option>)}
                      </Select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DANH SÁCH MẪU ──────────────────────────────────────────────────── */}
      <div className="rounded-card border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="layout" size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-ink">Mẫu phiếu ({ds.length})</h2>
            <span className="text-xs text-ink-soft">— bấm “Thiết kế” để mở trình thiết kế toàn màn hình</span>
          </div>
          <Button icon="plus" onClick={() => setMoTao(true)}>Tạo mẫu mới</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ds.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 rounded-control border border-line p-3">
              <div>
                <div className="text-sm font-medium text-ink">{m.ten_mau}</div>
                <div className="text-xs text-ink-soft">
                  {m.ma_mau}
                  {m.bo_cuc_json?.kho ? ` · ${m.bo_cuc_json.kho} ${m.bo_cuc_json.huong === 'ngang' ? 'ngang' : 'dọc'}` : ''}
                </div>
                {m.mo_ta && <div className="mt-1 line-clamp-2 text-[11px] text-ink-soft">{m.mo_ta}</div>}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                {m.la_mac_dinh && <Badge tone="default">Mẫu gốc</Badge>}
                {m.vi_tri_list && <Badge tone="success">Đang dùng</Badge>}
                <div className="ml-auto flex items-center gap-1.5">
                  <Button chiXemOk variant="secondary" icon="pencil" onClick={() => moThietKe(m.id)}>Thiết kế</Button>
                  <button type="button" disabled={chiXem} title={chiXem ? NHAC_CHI_XEM : 'Nhân bản'} className="text-ink-soft hover:text-primary disabled:opacity-40"
                    onClick={() => doNhanBan(m)}><Icon name="copy" size={16} /></button>
                  {!m.la_mac_dinh && (
                    <button type="button" disabled={chiXem} title={chiXem ? NHAC_CHI_XEM : 'Xóa'} className="text-ink-soft hover:text-danger disabled:opacity-40"
                      onClick={() => setXacNhanXoa(m)}><Icon name="trash" size={16} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TRÌNH THIẾT KẾ (toàn màn hình) ─────────────────────────────────── */}
      <PhieuDesignerModal open={!!mau} mau={mau} dm={dm} onLuu={luuBoCuc} onClose={() => setMau(null)} />

      {/* Tạo mẫu mới */}
      <Modal open={moTao} onClose={() => setMoTao(false)} title="Tạo mẫu phiếu mới"
        footer={<><Button chiXemOk variant="ghost" onClick={() => setMoTao(false)}>Hủy</Button>
          <Button onClick={doTao} disabled={!form.ma_mau.trim() || !form.ten_mau.trim()}>Tạo</Button></>}>
        <Field label="Mã mẫu" required hint="Chữ HOA, số và gạch dưới — vd PHIEU_GIAO_A5">
          <Input value={form.ma_mau} onChange={(e) => setForm({ ...form, ma_mau: e.target.value })} />
        </Field>
        <Field label="Tên mẫu" required>
          <Input value={form.ten_mau} onChange={(e) => setForm({ ...form, ten_mau: e.target.value })} />
        </Field>
        <Field label="Mô tả">
          <Textarea rows={2} value={form.mo_ta} onChange={(e) => setForm({ ...form, mo_ta: e.target.value })} />
        </Field>
        <p className="text-xs text-ink-soft">
          Mẫu mới là phiếu A4 dọc trống với 3 khối: <b>Đầu phiếu</b> (5 hàng × 12 cột) ·
          <b> Vùng lặp dòng</b> (2 hàng × 6 cột — hàng 1 tiêu đề, hàng 2 mẫu dòng) · <b>Cuối phiếu</b>
          (4 hàng × 12 cột). Muốn có sẵn bố cục giống phiếu đang in thì bấm <b>Nhân bản</b> từ mẫu gốc.
        </p>
      </Modal>

      <Toast toast={toast} />

      <ConfirmDialog
        open={!!xacNhanXoa} onClose={() => setXacNhanXoa(null)} onConfirm={doXoa}
        title="Xóa mẫu phiếu?" variant="danger" confirmText="Xóa"
        message={xacNhanXoa ? `Xóa mẫu "${xacNhanXoa.ten_mau}"? Nút in nào đang dùng mẫu này sẽ quay về bố cục mặc định trong code.` : ''}
      />
    </div>
  );
}
