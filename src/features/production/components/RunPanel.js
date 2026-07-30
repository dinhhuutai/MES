import { useEffect, useState, useCallback, useMemo } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import SearchableSelect from '../../../components/common/SearchableSelect';
import { Field, Input, Textarea, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { getRun, printTem, printTemBatch, reprintTem, getTemLabel, getTemLogs, finishRun, stopLine, resumeLine, addVaiHuy, savePhanCong, pauseLenhChay, listProductionCandidates, startProduction, vuotSanXuat } from '../../../services/productionService';
import { listUserOptions } from '../../../services/userService';
import printTemLabel from '../utils/printTemLabel';
import { fmtNum, fmtDate } from '../../../utils/format';

const TEM_TONE = { IN: 'warning', DANG_PHOI: 'info', DA_KHO: 'success', HUY: 'danger' };
const TEM_LABEL = { IN: 'Chờ phơi', DANG_PHOI: 'Đang phơi', DA_KHO: 'Đã khô', HUY: 'Đã hủy' };
const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

// Ô nhập số trong bảng modal (gọn, canh phải). `text-base md:text-sm`: iOS phóng to trang khi focus
// input có font < 16px và không tự thu lại (xem ghi chú ở `components/common/controls.js`).
const numCls = 'w-24 rounded-control border border-line bg-surface px-2 py-1.5 text-right text-base md:text-sm text-ink outline-none focus:border-primary';
const TH = 'whitespace-nowrap px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft';
const TD = 'whitespace-nowrap px-2.5 py-2 text-sm text-ink';

// Các cột chung "Khách hàng → Loại đợt vải" của 2 modal In tem gom set / Phân công.
// ⚠ Component đặt ở MỨC MODULE (không lồng trong RunPanel) để React giữ nguyên identity giữa các lần
// render — nếu lồng, mỗi lần cha render sẽ remount ⇒ ô input trong bảng mất focus khi đang gõ.
function PhanInInfoCells({ r, stt }) {
  return (
    <>
      <td className={`${TD} text-center text-ink-soft`}>{stt}</td>
      <td className={`${TD} font-medium`}>{r.ten_khach_hang || '—'}</td>
      <td className={TD}>{r.ma_don_hang || '—'}</td>
      <td className={TD}>{r.ma_hang || '—'}</td>
      <td className={TD}>{r.ma_phan || '—'}</td>
      <td className={TD}>{r.mau_vai || '—'}</td>
      <td className={TD}>{r.kich_vai || '—'}</td>
      <td className={TD}>{r.kich_phim || '—'}</td>
      <td className={TD}>{r.ten_loai_dot_vai || '—'}</td>
    </>
  );
}

const INFO_HEADERS = ['STT', 'Khách hàng', 'Đơn hàng', 'Mã hàng', 'Code phần', 'Màu vải', 'Kích vải', 'Kích phim', 'Loại đợt vải'];

// ─── Modal IN TEM cho lệnh GOM SET ────────────────────────────────────────────
// Nhập SL in cho TỪNG phần in rồi bấm In tem 1 lần: BE tạo N tem trong 1 transaction, FE in nhãn
// LIÊN TIẾP (xong phần in 1 → phần in 2 → …).
function PrintSetModal({ open, onClose, rows, onPrint, busy }) {
  const [qty, setQty] = useState({});
  useEffect(() => { if (open) setQty({}); }, [open]);

  const items = useMemo(
    () => rows.map((r) => ({ dotVaiId: r.dot_vai_ve_id, soLuong: Number(qty[r.dot_vai_ve_id]) || 0 }))
      .filter((x) => x.soLuong > 0),
    [rows, qty]
  );
  const tong = items.reduce((s, x) => s + x.soLuong, 0);
  const capOf = (r) => Math.floor((Number(r.sl_vao_sx) || 0) * 1.1);
  const overRow = (r) => {
    const n = Number(qty[r.dot_vai_ve_id]) || 0;
    const cap = capOf(r);
    return cap > 0 && n > cap;
  };
  const hasOver = rows.some(overRow);

  return (
    <Modal open={open} onClose={onClose} title="In tem — đợt sản xuất gom set" size="xl"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button onClick={() => onPrint(items)} loading={busy} disabled={items.length === 0 || hasOver} icon="printer">
            In tem ({items.length} phần in · {fmtNum(tong)})
          </Button>
        </>
      )}
    >
      <p className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-soft">
        Nhập <b>số lượng in</b> cho từng phần in rồi bấm <b>In tem</b> một lần — máy in ra tem phần in 1,
        rồi in liên tiếp phần in 2… (phần in để trống thì không in). Trần mỗi phần in = <b>110% SL vào sản xuất</b> của đợt đó.
      </p>
      <div className="overflow-auto rounded-card border border-line">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              {INFO_HEADERS.map((h) => <th key={h} className={TH}>{h}</th>)}
              <th className={`${TH} text-right`}>SL vào SX</th>
              <th className={`${TH} text-right`}>Số lượng in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={r.dot_vai_ve_id}>
                <PhanInInfoCells r={r} stt={i + 1} />
                <td className={`${TD} text-right tabular-nums text-ink-soft`}>{fmtNum(r.sl_vao_sx)}</td>
                <td className={`${TD} text-right`}>
                  <input type="number" min="0" max={capOf(r) || undefined} value={qty[r.dot_vai_ve_id] || ''}
                    onChange={(e) => setQty((q) => ({ ...q, [r.dot_vai_ve_id]: e.target.value }))}
                    placeholder="0"
                    className={`${numCls} ${overRow(r) ? 'border-danger focus:border-danger' : ''}`} />
                  {overRow(r) && <div className="mt-0.5 text-[11px] text-danger">Tối đa {fmtNum(capOf(r))}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ─── Modal PHÂN CÔNG SẢN XUẤT ─────────────────────────────────────────────────
// Ca trưởng (chọn từ tài khoản) + Chuyền trưởng (nhập chữ) nằm TRÊN bảng; trong bảng mỗi phần in
// nhập SL vải hủy · SL vải thiếu · thợ in.
function PhanCongModal({ open, onClose, rows, users, initial, onSave, busy }) {
  const [caTruongId, setCaTruongId] = useState('');
  const [chuyenTruong, setChuyenTruong] = useState('');
  const [form, setForm] = useState({}); // dotVaiId → { huy, thieu, thoIn }

  useEffect(() => {
    if (!open) return;
    setCaTruongId(initial?.ca_truong_id || '');
    setChuyenTruong(initial?.chuyen_truong || '');
    const byDot = {};
    (initial?.items || []).forEach((it) => { byDot[it.dot_vai_ve_id] = { huy: '', thieu: '', thoIn: it.tho_in || '' }; });
    setForm(byDot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setCell = (id, key, v) => setForm((f) => ({ ...f, [id]: { ...(f[id] || {}), [key]: v } }));
  const items = rows.map((r) => {
    const f = form[r.dot_vai_ve_id] || {};
    return {
      dotVaiId: r.dot_vai_ve_id,
      thoIn: f.thoIn || '',
      soLuongHuy: Number(f.huy) || 0,
      soLuongThieu: Number(f.thieu) || 0,
    };
  });
  const coThayDoi = items.some((x) => x.thoIn || x.soLuongHuy > 0 || x.soLuongThieu > 0) || caTruongId || chuyenTruong.trim();

  return (
    <Modal open={open} onClose={onClose} title="Phân công sản xuất" size="xl"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button onClick={() => onSave({ caTruongId: caTruongId || null, chuyenTruong, items })}
            loading={busy} disabled={!coThayDoi} icon="check">Lưu phân công</Button>
        </>
      )}
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Ca trưởng">
          <SearchableSelect
            value={caTruongId}
            onChange={setCaTruongId}
            options={users}
            getValue={(u) => u.id}
            getLabel={(u) => u.ho_ten || u.ten_dang_nhap || ''}
            getSearch={(u) => `${u.ho_ten || ''} ${u.ten_dang_nhap || ''}`}
            placeholder="Gõ tên hoặc tên đăng nhập để tìm..."
          />
        </Field>
        <Field label="Chuyền trưởng">
          <Input value={chuyenTruong} onChange={(e) => setChuyenTruong(e.target.value)} placeholder="Nhập tên chuyền trưởng" />
        </Field>
      </div>

      <p className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-soft">
        <b>Thợ in</b> lưu theo từng phần in (ghi đè lần lưu trước). <b>SL vải hủy</b> (= vải hư) và
        <b> SL vải thiếu</b> nhập &gt; 0 sẽ được ghi THÊM vào sổ vải hủy/thiếu của đợt đó — để trống nếu không phát sinh.
      </p>
      <div className="overflow-auto rounded-card border border-line">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              {INFO_HEADERS.map((h) => <th key={h} className={TH}>{h}</th>)}
              <th className={`${TH} text-right`}>SL vải hủy</th>
              <th className={`${TH} text-right`}>SL vải thiếu</th>
              <th className={TH}>Thợ in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => {
              const f = form[r.dot_vai_ve_id] || {};
              return (
                <tr key={r.dot_vai_ve_id}>
                  <PhanInInfoCells r={r} stt={i + 1} />
                  <td className={`${TD} text-right`}>
                    <input type="number" min="0" value={f.huy || ''} placeholder="0" className={numCls}
                      onChange={(e) => setCell(r.dot_vai_ve_id, 'huy', e.target.value)} />
                  </td>
                  <td className={`${TD} text-right`}>
                    <input type="number" min="0" value={f.thieu || ''} placeholder="0" className={numCls}
                      onChange={(e) => setCell(r.dot_vai_ve_id, 'thieu', e.target.value)} />
                  </td>
                  <td className={TD}>
                    <input value={f.thoIn || ''} placeholder="Tên thợ in"
                      onChange={(e) => setCell(r.dot_vai_ve_id, 'thoIn', e.target.value)}
                      className="w-40 rounded-control border border-line bg-surface px-2 py-1.5 text-base md:text-sm text-ink outline-none focus:border-primary" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export default function RunPanel({ lenhId, onClose, onChanged }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRun = can('PROD_RUN');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [soLuong, setSoLuong] = useState('');
  const [stopReason, setStopReason] = useState('');
  const [reprint, setReprint] = useState(null); // tem đang in lại
  const [reprintReason, setReprintReason] = useState('');
  const [logsOpen, setLogsOpen] = useState(false);
  const [temLogs, setTemLogs] = useState([]);
  const [vhForm, setVhForm] = useState({ dotVaiId: '', soLuong: '', lyDo: '', loai: 'HUY' });
  const [pauseOpen, setPauseOpen] = useState(false);   // modal ngừng lệnh chạy (in hàng gấp)
  const [swapList, setSwapList] = useState([]);        // phần in đang chờ sản xuất để hoán đổi
  const [swapLoading, setSwapLoading] = useState(false);
  const [vuot, setVuot] = useState('');                // SL vượt sản xuất
  const [printSetOpen, setPrintSetOpen] = useState(false); // modal in tem gom set
  const [phanCongOpen, setPhanCongOpen] = useState(false); // modal phân công
  const [users, setUsers] = useState([]);              // tài khoản để chọn ca trưởng

  const phieu = data?.phieu;
  const running = phieu?.trang_thai === 'DANG_CHAY';
  const ngungActive = data?.ngung_active || null;
  const ngungList = data?.ngung_list || [];
  const dotVaiList = data?.dot_vai || [];
  const vaiHuyList = data?.vai_huy || [];
  // GOM SET = lệnh có NHIỀU PHẦN IN in chung 1 chuyền ⇒ in tem & ghi vải hủy/thiếu làm theo BẢNG
  // (modal In tem / Phân công), nên ẩn 2 khối nhập lẻ "Vải hủy/Vải thiếu" ở sidebar.
  const coGomSet = !!data?.co_gom_set;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRun(lenhId);
      setData(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [lenhId, show]);

  useEffect(() => { load(); }, [load]);
  // Tài khoản cho ô "Ca trưởng" (dùng /users/options — chỉ cần đăng nhập, không đòi USER_VIEW).
  useEffect(() => {
    listUserOptions({ limit: 500 })
      .then((r) => setUsers(r.data || []))
      .catch(() => { /* không chặn màn sản xuất; ô ca trưởng sẽ rỗng */ });
  }, []);

  // Lấy dữ liệu nhãn tem rồi mở cửa sổ in (barcode Code128 = mã tem).
  // `dotVaiId` (gom set) → nhãn lấy đúng khách/đơn/mã hàng/màu/kích của phần in đó.
  const printLabelFor = async (temId, dotVaiId = null) => {
    if (!temId) return;
    try { const res = await getTemLabel(temId, dotVaiId); await printTemLabel(res.data); }
    catch (e) { show(e.message || 'Không lấy được dữ liệu tem để in', 'error'); }
  };

  const doPrint = async () => {
    setBusy(true);
    try {
      const res = await printTem(phieu.id, Number(soLuong));
      show(`Đã in tem ${fmtNum(soLuong)} — tự đưa vào xe phơi, đang đếm ngược`);
      setSoLuong('');
      await printLabelFor(res.data?.new_tem_id);
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'In tem thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  // GOM SET: in nhiều phần in 1 lượt → BE tạo N tem, FE in nhãn LIÊN TIẾP theo thứ tự phần in.
  const doPrintSet = async (items) => {
    setBusy(true);
    try {
      const res = await printTemBatch(phieu.id, items);
      const list = res.data?.tems_in || [];
      show(`Đã in ${list.length} tem (${fmtNum(list.reduce((s, x) => s + Number(x.so_luong || 0), 0))}) — tự vào xe phơi, đang đếm ngược`);
      setPrintSetOpen(false);
      // In tuần tự (await từng nhãn) để cửa sổ in không chồng lên nhau.
      for (const t of list) await printLabelFor(t.tem_id, t.dot_vai_id);
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'In tem thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doSavePhanCong = async (body) => {
    setBusy(true);
    try {
      await savePhanCong(phieu.id, body);
      show('Đã lưu phân công sản xuất');
      setPhanCongOpen(false);
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Lưu phân công thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doFinish = async () => {
    setBusy(true);
    try {
      await finishRun(phieu.id);
      show('Đã hoàn tất chạy');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doStop = async () => {
    if (!stopReason.trim()) { show('Nhập lý do ngừng chuyền', 'error'); return; }
    setBusy(true);
    try {
      await stopLine(phieu.id, stopReason.trim());
      show('Đã ngừng chuyền');
      setStopReason('');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally { setBusy(false); }
  };

  const openLogs = async () => {
    setLogsOpen(true);
    try { const res = await getTemLogs(phieu.id); setTemLogs(res.data); }
    catch (e) { show(e.message || 'Lỗi tải lịch sử', 'error'); }
  };

  // Ngừng lệnh chạy để in hàng gấp: mở modal + nạp danh sách phần in đang chờ sản xuất (để hoán đổi).
  const openPause = async () => {
    setPauseOpen(true);
    setSwapLoading(true);
    try {
      const res = await listProductionCandidates({ limit: 50 });
      setSwapList((res.data.items || []).filter((r) => r.id !== lenhId)); // trừ chính lệnh đang mở
    } catch (e) {
      show(e.message || 'Lỗi tải danh sách chờ sản xuất', 'error');
    } finally { setSwapLoading(false); }
  };

  // Chỉ ngừng lệnh chạy (không hoán đổi) → lệnh về chờ chạy.
  const doPauseOnly = async () => {
    setBusy(true);
    try {
      await pauseLenhChay(phieu.id);
      show('Đã ngừng lệnh chạy — lệnh về chờ chạy để lập lại kế hoạch (giữ nguyên số lượng đã in)');
      setPauseOpen(false);
      onChanged?.();
      onClose?.();
    } catch (e) {
      show(e.message || 'Ngừng lệnh chạy thất bại', 'error');
    } finally { setBusy(false); }
  };

  // Hoán đổi: ngừng lệnh hiện tại rồi bắt đầu chạy phần in gấp hơn TRÊN CÙNG CHUYỀN.
  const doSwap = async (cand) => {
    setBusy(true);
    try {
      await pauseLenhChay(phieu.id);
      await startProduction(cand.id, data?.lenh?.chuyen_id || null);
      show(`Đã ngừng ${data?.lenh?.ma_lenh_san_xuat || ''} & chạy ${cand.ma_lenh_san_xuat} thay thế`);
      setPauseOpen(false);
      onChanged?.();
      onClose?.();
    } catch (e) {
      show(e.message || 'Hoán đổi thất bại', 'error');
    } finally { setBusy(false); }
  };

  // Ghi vải hủy (= vải hư) / vải THIẾU theo phần in. Lệnh chỉ 1 phần in → tự chọn; nhiều phần in → phải chọn.
  const doVaiHuy = async () => {
    const thieu = vhForm.loai === 'THIEU';
    const nhan = thieu ? 'vải thiếu' : 'vải hủy';
    const qty = Number(vhForm.soLuong);
    if (!qty || qty <= 0) { show(`Nhập số lượng ${nhan}`, 'error'); return; }
    if (dotVaiList.length > 1 && !vhForm.dotVaiId) { show(`Chọn phần in cần ghi ${nhan}`, 'error'); return; }
    setBusy(true);
    try {
      await addVaiHuy(phieu.id, {
        dotVaiId: vhForm.dotVaiId || (dotVaiList.length === 1 ? dotVaiList[0].dot_vai_ve_id : null),
        soLuong: qty,
        lyDo: vhForm.lyDo.trim() || null,
        loai: thieu ? 'THIEU' : 'HUY',
      });
      show(`Đã ghi ${nhan}`);
      setVhForm({ dotVaiId: '', soLuong: '', lyDo: '', loai: vhForm.loai });
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || `Ghi ${nhan} thất bại`, 'error');
    } finally { setBusy(false); }
  };

  // Vượt sản xuất: cộng SL vượt vào release + trừ đợt vải chưa release cùng phần in.
  const doVuot = async () => {
    const qty = Number(vuot);
    if (!(qty > 0)) { show('Nhập số lượng vượt', 'error'); return; }
    setBusy(true);
    try {
      const res = await vuotSanXuat(phieu.id, qty);
      const tru = res?.data?.so_luong_da_tru ?? 0;
      show(`Đã vượt ${fmtNum(qty)} → release ${fmtNum(res?.data?.release_sau)}`
        + (tru > 0 ? ` · trừ ${fmtNum(tru)} ở đợt chưa release` : ' · không có đợt chưa release để trừ'),
        tru < qty ? 'warning' : 'success');
      setVuot('');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Ghi nhận vượt sản xuất thất bại', 'error');
    } finally { setBusy(false); }
  };

  const doReprint = async () => {
    if (!reprintReason.trim()) { show('Nhập lý do in lại', 'error'); return; }
    setBusy(true);
    try {
      const res = await reprintTem(reprint.id, reprintReason.trim());
      show(`Đã in lại tem ${reprint.ma_tem} (giữ nguyên mã)`);
      setReprint(null); setReprintReason('');
      await printLabelFor(res.data?.new_tem_id);
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'In lại thất bại', 'error');
    } finally { setBusy(false); }
  };

  const doResume = async () => {
    setBusy(true);
    try {
      await resumeLine(phieu.id);
      show('Chuyền hoạt động lại');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally { setBusy(false); }
  };

  const target = Number(data?.lenh?.so_luong_release) || 0;
  const printed = Number(data?.printed) || 0;
  const pct = target ? Math.min(100, Math.round((printed / target) * 100)) : 0;
  const maxTotal = target ? Math.floor(target * 1.1) : 0;       // trần 110% SL release
  const minFinish = target ? Math.ceil(target * 0.9) : 0;       // tối thiểu 90% SL release (cho -10%) mới hoàn tất được
  const remain = target ? Math.max(0, maxTotal - printed) : null; // còn được in
  const overMax = target > 0 && Number(soLuong) > remain;

  return (
    <SidePanel
      open={!!lenhId}
      onClose={onClose}
      title={data?.lenh ? `Sản xuất — ${data.lenh.ma_lenh_san_xuat}` : 'Sản xuất'}
      subtitle={data?.lenh ? `Chuyền ${data.lenh.ma_chuyen || '—'} · Phần ${data.lenh.phan_list || '—'}` : ''}
      footer={
        running && canRun && (
          <Button variant="danger" onClick={doFinish} loading={busy} disabled={printed < minFinish}>
            Chạy hoàn tất
          </Button>
        )
      }
    >
      {loading || !data ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          <section>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-soft">Đã in</span>
              <span className="font-semibold text-ink">{fmtNum(printed)} / {fmtNum(target)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-soft">
              <span>Phiếu {phieu?.ma_phieu_san_xuat}</span>
              <Badge tone={running ? 'info' : 'success'}>{running ? 'Đang chạy' : 'Hoàn tất'}</Badge>
            </div>
            {running && canRun && printed < minFinish && (
              <p className="mt-2 text-xs text-amber-600">
                Cần in tối thiểu 90% SL release ({fmtNum(minFinish)}) mới hoàn tất được — còn thiếu <b>{fmtNum(minFinish - printed)}</b>.
              </p>
            )}
          </section>

          {running && canRun && (
            <section className="border-t border-line pt-4">
              {coGomSet ? (
                /* GOM SET: nhập SL cho TỪNG phần in trong bảng rồi in 1 lượt ra nhiều tem liên tiếp. */
                <>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">In tem (gom set)</h3>
                  <p className="mb-2 text-xs text-ink-soft">
                    Đợt SX này gom <b>{data.so_phan_in} phần in</b> in chung chuyền. Bấm bên dưới để nhập
                    <b> số lượng in của từng phần in</b> rồi in một lượt — tem ra liên tiếp theo thứ tự phần in.
                  </p>
                  <Button className="w-full" icon="printer" onClick={() => setPrintSetOpen(true)} disabled={busy || remain === 0}>
                    Nhập số lượng &amp; in tem…
                  </Button>
                </>
              ) : (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-ink">Số lượng in (1 tem)</label>
                    <Input type="number" max={remain || undefined} value={soLuong}
                      onChange={(e) => setSoLuong(e.target.value)} placeholder="vd: 200"
                      className={overMax ? 'border-danger focus:border-danger focus:ring-danger/10' : ''} />
                  </div>
                  <Button onClick={doPrint} loading={busy}
                    disabled={!soLuong || Number(soLuong) <= 0 || overMax || remain === 0}>In tem</Button>
                </div>
              )}
              {target > 0 && (
                <p className={`mt-1.5 text-xs ${overMax ? 'text-danger' : 'text-ink-soft'}`}>
                  Trần 110% SL release: tối đa {fmtNum(maxTotal)} · còn được in <b>{fmtNum(remain)}</b>
                  {overMax ? ' — vượt giới hạn!' : ''}
                </p>
              )}
            </section>
          )}

          {/* PHÂN CÔNG: thợ in theo phần in + ca trưởng/chuyền trưởng + SL vải hủy/thiếu (1 bảng) */}
          {canRun && phieu && dotVaiList.length > 0 && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Phân công</h3>
              <p className="mb-2 text-xs text-ink-soft">
                Ghi <b>thợ in</b> từng phần in, <b>ca trưởng</b> (chọn từ tài khoản) &amp; <b>chuyền trưởng</b>,
                kèm <b>SL vải hủy / vải thiếu</b> nếu có.
              </p>
              {(data.phan_cong?.ca_truong_ten || data.phan_cong?.chuyen_truong) && (
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-soft">
                  {data.phan_cong?.ca_truong_ten && <span>Ca trưởng: <b className="text-ink">{data.phan_cong.ca_truong_ten}</b></span>}
                  {data.phan_cong?.chuyen_truong && <span>Chuyền trưởng: <b className="text-ink">{data.phan_cong.chuyen_truong}</b></span>}
                </div>
              )}
              <Button variant="secondary" className="w-full" icon="users" onClick={() => setPhanCongOpen(true)} disabled={busy}>
                Phân công…
              </Button>
            </section>
          )}

          {/* Ngừng chuyền (downtime) */}
          {running && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Ngừng chuyền</h3>
              {ngungActive ? (
                <div className="rounded-control border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm">
                  <div className="font-semibold text-rose-700">⏸ Chuyền đang ngừng</div>
                  <div className="mt-0.5 text-xs text-ink-soft">Từ {fmtDt(ngungActive.tg_bd_ngung)}</div>
                  {ngungActive.ly_do && <div className="mt-0.5 text-xs text-ink">Lý do: {ngungActive.ly_do}</div>}
                  {canRun && (
                    <Button className="mt-2 w-full" onClick={doResume} loading={busy}>Chuyền hoạt động lại</Button>
                  )}
                </div>
              ) : canRun ? (
                <div className="space-y-2">
                  <Textarea rows={2} value={stopReason} onChange={(e) => setStopReason(e.target.value)}
                    placeholder="Lý do ngừng chuyền (vd: hết mực, kẹt vải, đổi khuôn...)" />
                  <Button variant="danger" className="w-full" onClick={doStop} loading={busy} disabled={!stopReason.trim()}>
                    Ngừng chuyền
                  </Button>
                </div>
              ) : null}

              {ngungList.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-medium text-ink-soft">Lịch ngừng ({ngungList.length})</div>
                  <div className="space-y-1.5">
                    {ngungList.map((n) => (
                      <div key={n.id} className="rounded-control border border-line px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-ink">{fmtDt(n.tg_bd_ngung)}{n.tg_kt_ngung ? ` → ${fmtDt(n.tg_kt_ngung)}` : ''}</span>
                          {n.trang_thai === 'DANG_NGUNG'
                            ? <Badge tone="danger">Đang ngừng</Badge>
                            : <Badge tone="default">{fmtNum(n.so_phut)} phút</Badge>}
                        </div>
                        {n.ly_do && <div className="mt-0.5 text-xs text-ink-soft">Lý do: {n.ly_do}{n.nguoi ? ` · ${n.nguoi}` : ''}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Ngừng lệnh chạy để in hàng gấp hơn (khác với "Ngừng chuyền" downtime) */}
          {running && canRun && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Ngừng lệnh chạy (in hàng gấp)</h3>
              <p className="mb-2 text-xs text-ink-soft">
                Ngừng phần in này để chạy phần in cần giao gấp hơn. Tem đã in <b>giữ nguyên</b>; lệnh quay về
                <b> chờ chạy</b> để lập lại kế hoạch (không cần test lại). Có thể <b>hoán đổi</b> ngay phần in đang chờ.
              </p>
              <Button variant="secondary" className="w-full" onClick={openPause} disabled={busy}>
                Ngừng lệnh chạy…
              </Button>
            </section>
          )}

          {/* Vải hủy (= vải hư) / vải thiếu trong sản xuất, theo phần in.
              GOM SET → ẨN ô nhập lẻ (nhập trong modal Phân công theo bảng); vẫn hiện sổ "Đã ghi". */}
          <section className="border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
              Vải hủy / vải thiếu (theo phần in)
            </h3>
            {canRun && phieu && !coGomSet && (
              <div className="space-y-2">
                {dotVaiList.length > 1 && (
                  <Select value={vhForm.dotVaiId} onChange={(e) => setVhForm({ ...vhForm, dotVaiId: e.target.value })}>
                    <option value="">— Chọn phần in —</option>
                    {dotVaiList.map((d) => (
                      <option key={d.dot_vai_ve_id} value={d.dot_vai_ve_id}>
                        {d.ma_phan} · {d.mau_vai} · {d.kich_vai}/{d.kich_phim}
                      </option>
                    ))}
                  </Select>
                )}
                {dotVaiList.length === 1 && (
                  <div className="rounded-control bg-surface-muted px-3 py-1.5 text-xs text-ink-soft">
                    Phần in: <b className="text-ink">{dotVaiList[0].ma_phan}</b> · {dotVaiList[0].mau_vai}
                  </div>
                )}
                {/* Chọn loại ghi nhận: vải hủy (hư) hoặc vải thiếu */}
                <div className="flex gap-2">
                  {[{ v: 'HUY', label: 'Vải hủy (hư)' }, { v: 'THIEU', label: 'Vải thiếu' }].map((o) => (
                    <button key={o.v} type="button" onClick={() => setVhForm({ ...vhForm, loai: o.v })}
                      className={`flex-1 rounded-control border px-3 py-1.5 text-sm font-medium transition-colors ${
                        vhForm.loai === o.v ? 'border-primary bg-primary-wash/50 text-primary' : 'border-line text-ink-soft hover:text-ink'
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-ink">
                      Số lượng {vhForm.loai === 'THIEU' ? 'vải thiếu' : 'vải hủy'}
                    </label>
                    <Input type="number" min="1" value={vhForm.soLuong}
                      onChange={(e) => setVhForm({ ...vhForm, soLuong: e.target.value })} placeholder="vd: 5" />
                  </div>
                  <Button variant="danger" onClick={doVaiHuy} loading={busy}
                    disabled={!vhForm.soLuong || Number(vhForm.soLuong) <= 0}>
                    Ghi {vhForm.loai === 'THIEU' ? 'vải thiếu' : 'vải hủy'}
                  </Button>
                </div>
                <Textarea rows={2} value={vhForm.lyDo} onChange={(e) => setVhForm({ ...vhForm, lyDo: e.target.value })}
                  placeholder={vhForm.loai === 'THIEU'
                    ? 'Lý do vải thiếu (vd: giao thiếu, hụt khổ...)'
                    : 'Lý do vải hủy (vd: lỗi vải, in hỏng, rách...)'} />
              </div>
            )}
            {canRun && phieu && coGomSet && (
              <p className="rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30">
                Đợt SX gom set nhiều phần in — nhập <b>SL vải hủy / vải thiếu</b> theo từng phần in ở nút
                <b> Phân công</b> phía trên.
              </p>
            )}
            {vaiHuyList.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-xs font-medium text-ink-soft">Đã ghi ({vaiHuyList.length})</div>
                {vaiHuyList.map((v) => (
                  <div key={v.id} className="rounded-control border border-line px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{v.ma_phan || '—'}{v.mau_vai ? ` · ${v.mau_vai}` : ''}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={v.loai === 'THIEU' ? 'warning' : 'danger'}>
                          {v.loai === 'THIEU' ? 'Thiếu' : 'Hủy'}
                        </Badge>
                        <Badge tone={v.loai === 'THIEU' ? 'warning' : 'danger'}>{fmtNum(v.so_luong)}</Badge>
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-soft">
                      {v.nguoi ? `${v.nguoi} · ` : ''}{fmtDt(v.created_date)}{v.ly_do ? ` · ${v.ly_do}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Tem đã in ({data.tems.length})</h3>
              {data.tems.length > 0 && (
                <button onClick={openLogs} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Icon name="history" size={13} /> Lịch sử in
                </button>
              )}
            </div>
            {data.tems.length ? (
              <div className="space-y-1.5">
                {data.tems.map((t) => {
                  const huy = t.trang_thai === 'HUY';
                  return (
                    <div key={t.id}
                      className={`flex items-center justify-between gap-2 rounded-control border px-3 py-2 text-sm ${huy ? 'border-line/60 bg-surface-muted/40 opacity-70' : 'border-line'}`}>
                      <span className={`flex items-center gap-1.5 font-medium ${huy ? 'text-ink-soft line-through' : 'text-ink'}`}>
                        {t.ma_tem}
                      </span>
                      <span className="text-ink-soft">{fmtNum(t.so_luong)}</span>
                      <div className="flex items-center gap-2">
                        <Badge tone={TEM_TONE[t.trang_thai] || 'default'}>{TEM_LABEL[t.trang_thai] || t.trang_thai}</Badge>
                        {canRun && !huy && (
                          <>
                            <button onClick={() => printLabelFor(t.id)} title="In lại tờ tem (giữ mã)"
                              className="text-ink-soft hover:text-primary"><Icon name="printer" size={15} /></button>
                            <button onClick={() => { setReprint(t); setReprintReason(''); }}
                              className="text-xs font-medium text-primary hover:underline">In lại</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Chưa in tem nào.</p>
            )}
          </section>

          {/* Vượt sản xuất — cộng SL vượt vào release + trừ đợt vải chưa release cùng phần in */}
          {canRun && phieu && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Vượt sản xuất</h3>
              <p className="mb-2 text-xs text-ink-soft">
                Ghi nhận SL đã sản xuất <b>vượt kế hoạch</b>: tự <b>cộng vào SL release</b> của lệnh và
                <b> trừ dần ở đợt vải chưa release</b> của cùng phần in (đợt về 0 sẽ ẩn).
              </p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-ink">SL sản xuất vượt kế hoạch</label>
                  <Input type="number" min="1" value={vuot}
                    onChange={(e) => setVuot(e.target.value)} placeholder="vd: 50" />
                </div>
                <Button onClick={doVuot} loading={busy} disabled={!(Number(vuot) > 0)}>Vượt kế hoạch</Button>
              </div>
            </section>
          )}
        </div>
      )}
      {/* GOM SET: nhập SL in từng phần in → in nhiều tem liên tiếp */}
      <PrintSetModal open={printSetOpen} onClose={() => setPrintSetOpen(false)} rows={dotVaiList}
        onPrint={doPrintSet} busy={busy} />

      {/* Phân công: thợ in / ca trưởng / chuyền trưởng + SL vải hủy, vải thiếu */}
      <PhanCongModal open={phanCongOpen} onClose={() => setPhanCongOpen(false)} rows={dotVaiList}
        users={users} initial={data?.phan_cong} onSave={doSavePhanCong} busy={busy} />

      {/* Ngừng lệnh chạy + hoán đổi phần in gấp hơn */}
      <Modal open={pauseOpen} onClose={() => setPauseOpen(false)} title="Ngừng lệnh chạy — in hàng gấp" size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPauseOpen(false)}>Đóng</Button>
            <Button variant="danger" onClick={doPauseOnly} loading={busy}>Chỉ ngừng lệnh chạy</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30">
          Ngừng lệnh <b>{data?.lenh?.ma_lenh_san_xuat}</b> (đã in <b>{fmtNum(printed)}</b>/{fmtNum(target)}).
          Tem đã in đi tiếp <b>Chờ khô/kiểm</b> — số lượng giữ nguyên. Lệnh về <b>chờ chạy</b> để lập lại kế hoạch
          (không cần test lại). Chọn một phần in bên dưới để <b>hoán đổi</b> chạy ngay trên cùng chuyền.
        </div>
        <div className="mb-1 text-xs font-medium text-ink-soft">Đang chờ sản xuất — bấm để hoán đổi ({swapList.length})</div>
        {swapLoading ? (
          <div className="py-6 text-center text-sm text-ink-soft">Đang tải...</div>
        ) : swapList.length === 0 ? (
          <p className="py-4 text-sm text-ink-soft">Không có phần in nào đang chờ sản xuất để hoán đổi.</p>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {swapList.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge tone="info">{r.ma_lenh_san_xuat}</Badge>
                    <span className="truncate font-medium text-ink">{r.ten_khach_hang || '—'}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-soft">
                    {[r.ma_hang, r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ')}
                    {r.han_giao_hang ? ` · Hạn giao ${fmtDate(r.han_giao_hang)}` : ''}
                    {` · SL ${fmtNum(r.so_luong_release)}`}
                  </div>
                </div>
                <Button className="shrink-0 px-2.5 py-1 text-xs" onClick={() => doSwap(r)} loading={busy}>Hoán đổi</Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!reprint} onClose={() => setReprint(null)}
        title={reprint ? `In lại tem ${reprint.ma_tem}` : 'In lại tem'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReprint(null)}>Hủy</Button>
            <Button onClick={doReprint} loading={busy} disabled={!reprintReason.trim()}>In lại tem</Button>
          </>
        }
      >
        <div className="mb-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30">
          In lại nhãn của tem <b>{reprint?.ma_tem}</b> — <b>giữ nguyên mã tem</b>, không đổi số lượng/sổ cái
          (dùng khi tem giấy bị <b>mất/rách</b>). Lần in lại được lưu vào lịch sử in tem.
        </div>
        <Textarea rows={3} value={reprintReason} onChange={(e) => setReprintReason(e.target.value)}
          placeholder="Lý do in lại (vd: tem rách, mất tem, in mờ...)" />
      </Modal>

      <Modal open={logsOpen} onClose={() => setLogsOpen(false)} title="Lịch sử in tem" size="lg"
        footer={<Button variant="ghost" onClick={() => setLogsOpen(false)}>Đóng</Button>}
      >
        {temLogs.length === 0 ? (
          <p className="text-sm text-ink-soft">Chưa có lượt in nào.</p>
        ) : (
          <div className="space-y-1.5">
            {temLogs.map((l) => {
              const huy = l.tem_trang_thai === 'HUY';
              return (
                <div key={l.id} className={`flex items-center justify-between rounded-control border px-3 py-2 text-sm ${huy ? 'border-danger/30 bg-danger/5' : 'border-line'}`}>
                  <span className={`flex items-center gap-2 font-medium ${huy ? 'text-ink-soft line-through' : 'text-ink'}`}>
                    {l.ma_tem}
                    {l.so_lan_in > 1 ? <Badge tone="warning">In lại lần {l.so_lan_in}</Badge> : <Badge tone="info">In lần đầu</Badge>}
                    {huy && <Badge tone="danger">Đã hủy</Badge>}
                  </span>
                  <div className="text-right text-xs text-ink-soft">
                    <div>{l.nguoi || '—'} · {fmtDt(l.tg_in)}</div>
                    {l.ly_do_in_lai && <div className="text-danger">Lý do in lại: {l.ly_do_in_lai}</div>}
                    {huy && (l.tg_huy || l.nguoi_huy || l.ly_do_huy) && (
                      <div className="mt-0.5 text-danger">
                        Hủy in tem{l.nguoi_huy ? ` · ${l.nguoi_huy}` : ''}{l.tg_huy ? ` · ${fmtDt(l.tg_huy)}` : ''}
                        {l.ly_do_huy ? <div>Lý do hủy: {l.ly_do_huy}</div> : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Toast toast={toast} />
    </SidePanel>
  );
}
