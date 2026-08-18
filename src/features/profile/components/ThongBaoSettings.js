import { useCallback, useEffect, useState } from 'react';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Spinner from '../../../components/common/Spinner';
import {
  layCaiDatCuaToi, luuCaiDatCuaToi, layKhoaPush, dangKyPush, huyPush,
} from '../../../services/thongBaoService';
import {
  quyenHienTai, xinQuyen, hoTroPush, dangKyThietBi, huyThietBi, dangDangKy,
} from '../../../utils/thongBaoThietBi';

// ─────────────────────────────────────────────────────────────────────────────
// THÔNG TIN CÁ NHÂN > THÔNG BÁO (mig 085).
//
// 2 tầng tách bạch, người dùng hay nhầm nên phải nói rõ trên giao diện:
//   · "Nhận loại nào"      → lưu trên MÁY CHỦ, theo tài khoản (áp cho mọi thiết bị).
//   · "Thiết bị này"       → quyền trình duyệt + đăng ký push, chỉ cho ĐÚNG máy/trình duyệt đang dùng.
//
// ⚠⚠ `Notification.requestPermission()` CHỈ được gọi trong handler của một NÚT BẤM. Gọi lúc tải
//   trang thì Chrome bỏ qua im lặng và người dùng không bao giờ bật được.
// ─────────────────────────────────────────────────────────────────────────────

function Gat({ bat, onChange, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={bat} disabled={disabled}
      onClick={() => onChange(!bat)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition
        ${bat ? 'bg-primary' : 'bg-line'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition
        ${bat ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function ThongBaoSettings({ onThongBao }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dangLuu, setDangLuu] = useState('');
  const [quyen, setQuyen] = useState(quyenHienTai());
  const [pushBat, setPushBat] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const tai = useCallback(async () => {
    setLoading(true);
    try {
      const r = await layCaiDatCuaToi();
      setData(r.data);
    } catch (e) { /* im lặng — khối này là phụ, không chặn trang cá nhân */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { tai(); }, [tai]);
  useEffect(() => { dangDangKy().then(setPushBat); }, []);

  const doiLoai = async (ma, bat) => {
    setDangLuu(ma);
    try {
      const r = await luuCaiDatCuaToi(ma, bat);
      setData(r.data);
      onThongBao?.(bat ? 'Đã bật nhận thông báo' : 'Đã tắt loại thông báo này');
    } catch (e) { onThongBao?.(e.message || 'Lưu thất bại', 'error'); }
    finally { setDangLuu(''); }
  };

  // Bật trên thiết bị này = xin quyền trình duyệt (+ đăng ký push nếu hệ thống cho phép).
  const batThietBi = async () => {
    setPushBusy(true);
    try {
      const q = await xinQuyen();
      setQuyen(q);
      if (q !== 'granted') {
        onThongBao?.(q === 'denied'
          ? 'Trình duyệt đang CHẶN thông báo — mở cài đặt trang web của trình duyệt để cho phép lại'
          : 'Bạn chưa cho phép hiện thông báo', 'error');
        return;
      }
      // Push nền chỉ đăng ký khi hệ thống bật `PUSH_NEN` — tắt thì popup lúc app mở là đủ.
      if (data?.push_nen_he_thong && hoTroPush()) {
        const k = await layKhoaPush();
        const kq = await dangKyThietBi(k.data.khoa);
        if (kq.ok) {
          await dangKyPush(kq.sub);
          setPushBat(true);
          onThongBao?.('Đã bật thông báo trên thiết bị này (cả khi đóng app)');
          return;
        }
        onThongBao?.(`Đã bật popup khi app đang mở. Thông báo nền chưa bật được: ${kq.loi}`, 'error');
        return;
      }
      onThongBao?.('Đã bật thông báo khi app đang mở');
    } finally { setPushBusy(false); }
  };

  const tatThietBi = async () => {
    setPushBusy(true);
    try {
      const endpoint = await huyThietBi();
      if (endpoint) await huyPush(endpoint);
      setPushBat(false);
      onThongBao?.('Đã tắt thông báo nền trên thiết bị này');
    } catch (e) { onThongBao?.(e.message || 'Thất bại', 'error'); }
    finally { setPushBusy(false); }
  };

  if (loading) {
    return <div className="card flex justify-center p-6"><Spinner size={22} /></div>;
  }
  // Không thuộc diện nhận (không có quyền kỹ thuật) → ẩn hẳn khối, đừng bày cấu hình vô nghĩa.
  if (!data || !data.co_quyen) return null;

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-ink">Thông báo</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Báo cho bạn khi có phần in bị trả về cho Kỹ thuật.
      </p>

      {/* Tầng 1 — theo TÀI KHOẢN */}
      <div className="mt-4 space-y-3">
        {data.loai.map((l) => (
          <div key={l.ma_loai} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium text-ink">{l.ten}</span>
                {/* ⚠ Nói THẲNG khi hệ thống đã tắt — nếu không, người dùng bật toggle rồi cứ thắc
                    mắc sao mãi không nhận được gì. */}
                {!l.he_thong_bat && <Badge tone="danger">Hệ thống đang tắt</Badge>}
              </div>
              <p className="text-xs text-ink-soft">{l.mo_ta}</p>
            </div>
            <div className="flex items-center gap-2">
              {dangLuu === l.ma_loai && <Spinner size={14} />}
              <Gat bat={l.bat} disabled={dangLuu === l.ma_loai || !l.he_thong_bat}
                onChange={(b) => doiLoai(l.ma_loai, b)} />
            </div>
          </div>
        ))}
      </div>

      {/* Tầng 2 — theo THIẾT BỊ */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-center gap-1.5">
          <Icon name="bell" size={15} className="text-ink-soft" />
          <span className="text-sm font-medium text-ink">Thiết bị này</span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          {data.push_nen_he_thong
            ? 'Hiện thông báo ngoài màn hình — nhận cả khi đã đóng app.'
            : 'Hiện thông báo ngoài màn hình khi app đang mở. (Quản trị đang tắt thông báo nền.)'}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {quyen === 'granted'
            ? <Badge tone="success">Trình duyệt đã cho phép</Badge>
            : <Badge tone={quyen === 'denied' ? 'danger' : 'warning'}>
              {quyen === 'denied' ? 'Trình duyệt đang chặn' : quyen === 'khong-ho-tro' ? 'Trình duyệt không hỗ trợ' : 'Chưa cho phép'}
            </Badge>}
          {data.push_nen_he_thong && pushBat && <Badge tone="success">Đã bật thông báo nền</Badge>}
        </div>

        {quyen !== 'khong-ho-tro' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(quyen !== 'granted' || (data.push_nen_he_thong && !pushBat)) && (
              <Button variant="secondary" loading={pushBusy} onClick={batThietBi}>
                Bật trên thiết bị này
              </Button>
            )}
            {pushBat && (
              <Button variant="ghost" loading={pushBusy} onClick={tatThietBi}>
                Tắt thông báo nền
              </Button>
            )}
          </div>
        )}

        {quyen === 'denied' && (
          <p className="mt-2 text-xs text-danger">
            Bạn đã chặn thông báo cho trang này. Phải mở cài đặt của trình duyệt (biểu tượng ổ khóa
            cạnh thanh địa chỉ → Thông báo → Cho phép) rồi tải lại trang.
          </p>
        )}
        {quyen === 'khong-ho-tro' && (
          <p className="mt-2 text-xs text-ink-soft">
            Trình duyệt này không hiện được thông báo ngoài màn hình. Trên iPhone cần
            &quot;Thêm vào màn hình chính&quot; rồi mở app từ biểu tượng đó. Chuông trong app vẫn chạy bình thường.
          </p>
        )}
      </div>
    </div>
  );
}
