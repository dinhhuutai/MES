import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Spinner from '../../../components/common/Spinner';
import { Field, Input, Select, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import Toast from '../../../components/common/Toast';
import TemDesignerModal from '../components/TemDesignerModal';
import {
  layDanhMucMauTem, listMauTem, getMauTem, taoMauTem, nhanBanMauTem,
  suaMauTem, xoaMauTem, ganMauTem,
} from '../../../services/mauTemService';
import { khungRong, HANG_MAC_DINH, COT_MAC_DINH } from '../utils/temLuoi';

// Dữ liệu MẪU để xem trước (không gọi API tem thật — màn thiết kế phải mở được cả khi chưa in tem nào).
const DATA_XEM_TRUOC = {
  ma_tem: '152608057689', ma_lenh_san_xuat: 'LSX0450', trang_thai: 'IN',
  ten_khach_hang: 'SL-GLOVIS', ma_don_hang: 'SG26-SPG-006', ma_hang: 'A01-F01',
  ma_phan: 'GL-2606-005-A01-F01-C01', so_luong_don_hang: 1200,
  mau_vai: 'ĐEN', kich_vai: '1.5 x 2.0', kich_phim: '40 x 60', gc_mau_vai: 'GC ĐEN',
  so_luong: 504, ma_chuyen: 'M4A-4B', ten_chuyen: 'Chuyền M4A-4B', ca: 'Ca 1',
  ma_ngay_ca: '260808C1', nguoi_in: 'Nguyễn Văn A', nha_gia_cong: 'KK',
  created_date: new Date().toISOString(), tg_bd_in: new Date().toISOString(),
  tg_bd_phoi: new Date().toISOString(), tg_kt_phoi: new Date(Date.now() + 36e5).toISOString(),
  gio_sx_bd: '07:30', gio_sx_kt: '11:45', ngay_ca: new Date().toISOString(),
};

export default function ThietKeTemPage() {
  const { toast, show } = useToast();
  const [dm, setDm] = useState(null);            // danh mục: khổ tem · vị trí in · trường · định dạng ngày
  const [ds, setDs] = useState([]);              // danh sách mẫu
  const [dangTai, setDangTai] = useState(true);
  const [mau, setMau] = useState(null);          // mẫu đang mở trong trình thiết kế (đã tải chi tiết)
  const [moTao, setMoTao] = useState(false);
  const [xacNhanXoa, setXacNhanXoa] = useState(null);
  const [form, setForm] = useState({ ma_mau: '', ten_mau: '', mo_ta: '' });

  const tai = useCallback(async () => {
    setDangTai(true);
    try {
      const [a, b] = await Promise.all([layDanhMucMauTem(), listMauTem()]);
      setDm(a.data); setDs(b.data.items || []);
    } catch (e) { show(e.message || 'Không tải được danh sách mẫu tem', 'error'); }
    setDangTai(false);
    // ⚠ deps là `show` (ổn định — useCallback([]) trong useToast), TUYỆT ĐỐI KHÔNG để cả object
    // `useToast()` vào đây: nó là object MỚI mỗi lần render ⇒ `tai` đổi mỗi render ⇒ useEffect([tai])
    // chạy lại vô hạn ⇒ bắn request không ngừng, trình duyệt trả ERR_INSUFFICIENT_RESOURCES.
  }, [show]);

  useEffect(() => { tai(); }, [tai]);

  const moThietKe = async (id) => {
    try {
      const res = await getMauTem(id);
      setMau(res.data);
    } catch (e) { show(e.message || 'Không mở được mẫu', 'error'); }
  };

  // Trả true/false để modal biết có chốt mốc "đã lưu" hay không (lỗi thì giữ nguyên dấu "chưa lưu").
  const luuBoCuc = async (boCuc) => {
    if (!mau) return false;
    try {
      await suaMauTem(mau.id, { ten_mau: mau.ten_mau, mo_ta: mau.mo_ta, bo_cuc: boCuc });
      show('Đã lưu mẫu tem');
      await tai();
      return true;
    } catch (e) {
      // BE trả `details` = danh sách lỗi bố cục → hiện đúng chỗ sai thay vì "Lỗi hệ thống".
      show(e.message || 'Lưu mẫu thất bại', 'error');
      return false;
    }
  };

  const doGan = async (maViTri, mauTemId) => {
    try {
      await ganMauTem(maViTri, mauTemId);
      show(mauTemId ? 'Đã gắn mẫu vào nút in' : 'Đã gỡ — nút in dùng lại bố cục mặc định');
      await tai();
    } catch (e) { show(e.message || 'Gắn mẫu thất bại', 'error'); }
  };

  const doTao = async () => {
    try {
      const body = { ...form, bo_cuc: { v: 1, trai: khungRong(), phai: null } };
      const res = await taoMauTem(body);
      setMoTao(false); setForm({ ma_mau: '', ten_mau: '', mo_ta: '' });
      await tai(); await moThietKe(res.data.id);
      show('Đã tạo mẫu mới — thiết kế rồi bấm Lưu');
    } catch (e) { show(e.message || 'Tạo mẫu thất bại', 'error'); }
  };

  const doNhanBan = async (m) => {
    try {
      const ma = `${m.ma_mau}_COPY${Math.floor(Math.random() * 900 + 100)}`;
      const res = await nhanBanMauTem(m.id, { ma_mau: ma, ten_mau: `${m.ten_mau} (bản sao)` });
      await tai(); await moThietKe(res.data.id);
      show('Đã nhân bản — sửa bản sao này không ảnh hưởng mẫu đang in');
    } catch (e) { show(e.message || 'Nhân bản thất bại', 'error'); }
  };

  const doXoa = async () => {
    try {
      await xoaMauTem(xacNhanXoa.id);
      setXacNhanXoa(null);
      if (mau && mau.id === xacNhanXoa.id) setMau(null);
      await tai(); show('Đã xóa mẫu tem');
    } catch (e) { setXacNhanXoa(null); show(e.message || 'Xóa thất bại', 'error'); }
  };

  const viTriList = useMemo(() => (dm?.vi_tri_in || []), [dm]);

  if (dangTai) return <div className="flex justify-center py-16"><Spinner size={28} /></div>;

  if (dm && dm.co_bang === false) {
    return (
      <div className="rounded-card border border-warning/40 bg-warning/5 p-6 text-sm text-ink">
        <div className="mb-1 font-semibold">Chưa chạy migration 073</div>
        Module Thiết kế tem cần bảng <code>mau_tem</code> / <code>gan_mau_tem</code>. Chạy
        {' '}<code>database/migrations/073_mau_tem_thiet_ke.sql</code> bằng user <code>postgres</code> rồi tải lại trang.
        Trong lúc đó các nút in tem vẫn chạy bình thường bằng bố cục mặc định.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── GẮN MẪU VÀO NÚT IN ─────────────────────────────────────────────── */}
      <div className="rounded-card border border-line bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="printer" size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-ink">Nút in tem trong hệ thống</h2>
          <span className="text-xs text-ink-soft">— chọn mẫu cho từng nút; để trống = dùng bố cục mặc định trong code</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2">Nút in</th>
                <th className="px-3 py-2">Màn hình</th>
                <th className="px-3 py-2">Kiểu</th>
                <th className="px-3 py-2 w-72">Mẫu đang dùng</th>
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
                    <Badge tone={v.hai_khung_khac_nhau ? 'info' : 'default'}>
                      {v.hai_khung_khac_nhau ? '2 nhãn khác nhau' : '2 nhãn giống nhau'}
                    </Badge>
                    <div className="mt-0.5 text-[11px] text-ink-soft">tiền tố {v.tien_to.trai}{v.tien_to.phai !== v.tien_to.trai ? ` / ${v.tien_to.phai}` : ''}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="w-64">
                      <Select value={v.mau_tem_id || ''} onChange={(e) => doGan(v.ma, e.target.value)}>
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
            <h2 className="text-sm font-semibold text-ink">Mẫu tem ({ds.length})</h2>
            <span className="text-xs text-ink-soft">— bấm “Thiết kế” để mở trình thiết kế toàn màn hình</span>
          </div>
          <Button icon="plus" onClick={() => setMoTao(true)}>Tạo mẫu mới</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ds.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 rounded-control border border-line p-3">
              <div>
                <div className="text-sm font-medium text-ink">{m.ten_mau}</div>
                <div className="text-xs text-ink-soft">{m.ma_mau}</div>
                {m.mo_ta && <div className="mt-1 line-clamp-2 text-[11px] text-ink-soft">{m.mo_ta}</div>}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                {m.la_mac_dinh && <Badge tone="default">Mẫu gốc</Badge>}
                {m.vi_tri_list && <Badge tone="success">Đang dùng</Badge>}
                <div className="ml-auto flex items-center gap-1.5">
                  <Button variant="secondary" icon="pencil" onClick={() => moThietKe(m.id)}>Thiết kế</Button>
                  <button type="button" title="Nhân bản" className="text-ink-soft hover:text-primary"
                    onClick={() => doNhanBan(m)}><Icon name="copy" size={16} /></button>
                  {!m.la_mac_dinh && (
                    <button type="button" title="Xóa" className="text-ink-soft hover:text-danger"
                      onClick={() => setXacNhanXoa(m)}><Icon name="trash" size={16} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TRÌNH THIẾT KẾ (toàn màn hình) ─────────────────────────────────── */}
      <TemDesignerModal
        open={!!mau} mau={mau} dm={dm} dataXemTruoc={DATA_XEM_TRUOC}
        onLuu={luuBoCuc} onClose={() => setMau(null)}
      />

      {/* Tạo mẫu mới */}
      <Modal open={moTao} onClose={() => setMoTao(false)} title="Tạo mẫu tem mới"
        footer={<><Button variant="ghost" onClick={() => setMoTao(false)}>Hủy</Button>
          <Button onClick={doTao} disabled={!form.ma_mau.trim() || !form.ten_mau.trim()}>Tạo</Button></>}>
        <Field label="Mã mẫu" required hint="Chữ HOA, số và gạch dưới — vd TEM_SX_MOI">
          <Input value={form.ma_mau} onChange={(e) => setForm({ ...form, ma_mau: e.target.value })} />
        </Field>
        <Field label="Tên mẫu" required>
          <Input value={form.ten_mau} onChange={(e) => setForm({ ...form, ten_mau: e.target.value })} />
        </Field>
        <Field label="Mô tả">
          <Textarea rows={2} value={form.mo_ta} onChange={(e) => setForm({ ...form, mo_ta: e.target.value })} />
        </Field>
        <p className="text-xs text-ink-soft">
          Mẫu mới là lưới trống {HANG_MAC_DINH} hàng × {COT_MAC_DINH} cột
          (ô rộng ~{(49 / COT_MAC_DINH).toFixed(1)} × cao ~{(78 / HANG_MAC_DINH).toFixed(1)}mm) — đổi số hàng/cột bất cứ lúc nào
          bằng ô “Lưới … × …” trên thanh công cụ, xong nhớ gắn vào nút in.
        </p>
      </Modal>

      <Toast toast={toast} />

      <ConfirmDialog
        open={!!xacNhanXoa} onClose={() => setXacNhanXoa(null)} onConfirm={doXoa}
        title="Xóa mẫu tem?" variant="danger" confirmText="Xóa"
        message={xacNhanXoa ? `Xóa mẫu "${xacNhanXoa.ten_mau}"? Nút in nào đang dùng mẫu này sẽ quay về bố cục mặc định trong code.` : ''}
      />
    </div>
  );
}
