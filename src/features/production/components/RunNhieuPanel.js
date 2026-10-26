import { useCallback, useEffect, useState } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import SearchableSelect from '../../../components/common/SearchableSelect';
import TimeSelect from '../../../components/common/TimeSelect';
import { Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import {
  getRun, printTemBatch, getTemLabel, savePhanCong, listToIn, listLyDoNgung, stopLine, resumeLine, addVaiHuy, finishRun,
  gopLenh, luuLyDoBoSungDotVai,
} from '../../../services/productionService';
import { listUserOptions } from '../../../services/userService';
import printTemLabel, { printTemLabelNhieu, moSanCuaSoIn, dongCuaSoIn } from '../utils/printTemLabel';
import { fmtNum } from '../../../utils/format';
import { TemMetaFields, PhanCongInline, META_MAC_DINH, metaGuiDi, gioHienTai, thieuNgayCaCt, CHUA_THO_IN, chuaPhanCongThoIn, useTaiNgamKhiLenhDoi } from './RunPanel';
import TraVeKeHoachModal from './TraVeKeHoachModal';
import {
  gomPhan, thuTuIn, conDuocIn, conDuocInNhom, tongNhom, daIn, slRelease, duHoanTatNhom, toiThieuHoanTatNhom,
} from '../utils/gomPhanSanXuat';

// ─────────────────────────────────────────────────────────────────────────────
// SẢN XUẤT NHIỀU LỆNH CÙNG LÚC (08/10/2026, người dùng chốt) — mở từ nút "Mở (N)" của bảng Đang chạy khi đã
// quét/tích ≥ 2 lệnh (1 lệnh ⇒ `RunPanel` như cũ). Mỗi lệnh vẫn là 1 phiếu riêng; panel làm 1 lần cho TẤT CẢ:
//   · IN TEM: modal danh sách phần in (Đơn hàng → Kích phim + ô Số lượng) ⇒ 1 nút in mọi dòng có số lượng
//     (dòng để trống bỏ qua), 1 dòng = 1 tem ⇒ `printTemBatch` từng phiếu (giữ trần 110% lệnh/đợt, xin mã ERP
//     trước transaction) ⇒ MỌI tem in trong 1 cửa sổ mở sẵn ngay trong cú bấm, mỗi tem 1 tờ cặp 15 | 16
//     (`printTemLabelNhieu` = bố cục SX). Lệnh gom set cũ (nhiều phần in / 1 lệnh) tách 1 dòng / đợt vải.
//     Phiếu lỗi không chặn phiếu khác: tem đã tạo vẫn in, dòng lỗi giữ số để sửa.
//     19/10/2026: thêm cột SL HỦY / SL THIẾU mỗi dòng (= 2 ô Vải hủy / Vải thiếu của RunPanel) — đi kèm
//     `printTemBatch` (BE ghi sổ vải + báo ERP cùng đúng tem của dòng); lệnh chỉ nhập hủy/thiếu ⇒ `addVaiHuy`
//     (21/10/2026: = LƯU SỐ CHỜ gắn vào tem in kế tiếp của lệnh). Số nhập ở bảng được ƯU TIÊN hơn số chờ của lệnh.
//   · CHẠY HOÀN TẤT (21/10/2026): nút xanh lá ở chân sidebar ⇒ hộp chọn lệnh đã in ≥ 90% ⇒ `finishRun` từng phiếu.
//   · PHÂN CÔNG: lưu 1 lần ⇒ `savePhanCong` mọi phiếu.
//   · NGỪNG CHUYỀN: ghi 1 lần ⇒ `stopLine` mọi phiếu chưa ngừng; "Hoạt động lại" ⇒ `resumeLine` mọi phiếu đang ngừng.
//   · Việc riêng từng lệnh (vải hủy/thiếu, bổ sung, tem đã in, đổi chuyền, trả về KT, chạy hoàn tất) ⇒ nút "Mở".
//   · 22/10/2026: lệnh CÙNG code phần + CÙNG chuyền gom thành 1 PHẦN (danh sách · In tem · Chạy hoàn tất —
//     `utils/gomPhanSanXuat.js`) + nút "Trả về Kế hoạch" (`TraVeKeHoachModal`) cho phần vải còn lại sang máy khác.
// ─────────────────────────────────────────────────────────────────────────────

const numCls = 'w-24 rounded-control border border-line bg-surface px-2 py-1.5 text-right text-base md:text-sm text-ink outline-none focus:border-primary';
const TH = 'whitespace-nowrap px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft';
const TD = 'whitespace-nowrap px-2.5 py-2 text-sm text-ink';
const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

const dangChay = (run) => run?.phieu?.trang_thai === 'DANG_CHAY';
const tenLenh = (run) => run?.lenh?.phan_list || run?.lenh?.ma_lenh_san_xuat || '';
const khoaPc = (pc) => [pc?.ca_truong_id || '', pc?.chuyen_truong || '', pc?.tho_in || '', pc?.to_in_id || ''].join('|');

// Dòng in tem: lệnh thường ⇒ 1 dòng (không gửi đợt vải, như ô "Số lượng in" của RunPanel); lệnh gom set cũ ⇒
// 1 dòng / đợt vải (gửi `dotVaiId`, như modal In tem gom set).
// 22/10/2026: nhiều lệnh CÙNG code phần + CÙNG chuyền ⇒ 1 DÒNG (`nhom` = các lệnh). 25/10/2026: lúc in, các lệnh của
//   dòng được GỘP THẬT thành 1 lệnh (`POST /production/gop-lenh`) rồi in 1 tem đủ số — không còn tách 2 tem.
function dongInTem(runs) {
  const out = [];
  gomPhan(runs).forEach((g) => {
    if (g.runs.length > 1) {
      const run0 = thuTuIn(g.runs)[0];
      out.push({ key: `g|${g.key}`, nhom: g.runs, run: run0, dotVaiId: null, info: (run0.dot_vai || [])[0] || {}, capDot: 0 });
      return;
    }
    const run = g.runs[0];
    const dots = run.dot_vai || [];
    if (run.co_gom_set) {
      dots.forEach((d) => out.push({ key: `${run.lenh.id}|${d.dot_vai_ve_id}`, run, dotVaiId: d.dot_vai_ve_id, info: d,
        capDot: Math.floor((Number(d.sl_vao_sx) || 0) * 1.1) }));
    } else {
      out.push({ key: run.lenh.id, run, dotVaiId: null, info: dots[0] || {}, capDot: 0 });
    }
  });
  return out;
}

// ⚠ MỨC MODULE (không lồng trong panel) — lồng là ô nhập mất focus khi đang gõ (luật §9).
// 19/10/2026: thêm cột SL HỦY + SL THIẾU (= 2 ô "Vải hủy / Vải thiếu" của RunPanel) ngay sau Số lượng — ghi sổ vải
//   theo đợt của dòng (lệnh thường ⇒ đợt đầu của lệnh); dòng có in tem thì số này đi ERP cùng ĐÚNG tem đó.
const soNguyen = (v) => Math.max(0, Math.trunc(Number(v) || 0));
// Dòng nhỏ "Chờ: 5" dưới ô SL hủy / thiếu — số đang chờ gắn tem của lệnh (mức module, luật §9).
const ChoVai = ({ v, k }) => (v && v[k] > 0 ? (
  <div className="mt-0.5 text-[11px] text-amber-700"
    title="Số đã lưu ở ô Vải hủy / thiếu của lệnh — nhập số ở bảng này sẽ thay số chờ">
    Chờ: {fmtNum(v[k])}
  </div>
) : null);
// Đợt BỔ SUNG của 1 dòng (đợt đầu thuộc loại BO_SUNG trong các lệnh của dòng) — ô SL bổ sung ghi vào đợt này.
const dotBoSungCuaDong = (d) => (d.nhom || [d.run]).flatMap((r) => r.dot_vai || [])
  .filter((x) => (!d.dotVaiId || x.dot_vai_ve_id === d.dotVaiId) && x.ma_loai_dot_vai === 'BO_SUNG')[0] || null;
const chuoiSo = (v) => (v == null ? '' : String(v));

function InTemNhieuModal({ open, onClose, runs, meta, setMeta, goiY, busy, onIn }) {
  // key dòng → { sl, huy, thieu, gc, btpTruoc, btpCuoi, bsCty, bsKhach } (chuỗi / bool)
  const [sl, setSl] = useState({});
  useEffect(() => { if (open) setSl({}); }, [open]);
  const dong = dongInTem(runs);
  const o = (k, f) => soNguyen((sl[k] || {})[f]);
  const so = (k) => o(k, 'sl');
  const giaTri = (k, f, macDinh = '') => ((sl[k] || {})[f] === undefined ? macDinh : sl[k][f]);
  const datO = (k, f, v) => setSl((s) => ({ ...s, [k]: { ...(s[k] || {}), [f]: v } }));
  const coVai = (k) => o(k, 'huy') > 0 || o(k, 'thieu') > 0;
  // SL bổ sung (đợt BO_SUNG, 25/10/2026): ô đổ sẵn số đã lưu; khác số đã lưu ⇒ ghi khi bấm In.
  const bsDoi = (d) => {
    const dot = dotBoSungCuaDong(d);
    if (!dot) return null;
    const cty = giaTri(d.key, 'bsCty', chuoiSo(dot.sl_bo_sung_cty));
    const khach = giaTri(d.key, 'bsKhach', chuoiSo(dot.sl_bo_sung_khach));
    if (cty === chuoiSo(dot.sl_bo_sung_cty) && khach === chuoiSo(dot.sl_bo_sung_khach)) return null;
    return { dotVaiId: dot.dot_vai_ve_id, slCty: cty === '' ? null : soNguyen(cty), slKhach: khach === '' ? null : soNguyen(khach),
      ghiChu: dot.ghi_chu_bo_sung || '' };
  };
  // Trần: Σ dòng của 1 lệnh ≤ còn in được của lệnh; dòng đợt vải ≤ 110% SL vào SX của đợt (backend chặn lại y vậy).
  //   Dòng nhóm (nhiều lệnh cùng code phần, sẽ GỘP thành 1 lệnh khi in) ≤ 110% TỔNG SL release − tổng đã in.
  const tongLenh = (lenhId) => dong.filter((d) => !d.nhom && d.run.lenh.id === lenhId).reduce((s, d) => s + so(d.key), 0);
  const conCuaDong = (d) => {
    if (!d.nhom) return conDuocIn(d.run);
    if (conDuocInNhom(d.nhom) == null) return null;
    return Math.max(0, Math.floor(tongNhom(d.nhom, slRelease) * 1.1) - tongNhom(d.nhom, daIn));
  };
  const vuot = (d) => {
    const con = conCuaDong(d);
    if (d.nhom) return con != null && so(d.key) > con;
    return (con != null && tongLenh(d.run.lenh.id) > con) || (d.capDot > 0 && so(d.key) > d.capDot);
  };
  // 1 dòng = 1 tem (25/10/2026): dòng nhóm KHÔNG còn tách tem theo lệnh — các lệnh của nhóm được gộp thành 1 lệnh
  //   ngay trước khi in (`doInNhieu` → `POST /production/gop-lenh`), rồi in 1 tem đủ số.
  const bung = (d) => [{
    ...d, soLuong: so(d.key), soLuongHuy: o(d.key, 'huy'), soLuongThieu: o(d.key, 'thieu'),
    gcMauVai: String(giaTri(d.key, 'gc', meta.gcMauVai || '')).trim(),
    btpTruoc: !!giaTri(d.key, 'btpTruoc', !!meta.btpTruoc), btpCuoi: !!giaTri(d.key, 'btpCuoi', !!meta.btpCuoi),
    boSung: bsDoi(d),
  }];
  // Số vải hủy / thiếu CHỜ gắn tem của lệnh (lưu ở sidebar 1 lệnh — 21/10/2026): hiện ở DÒNG ĐẦU của lệnh. Lệnh nào
  //   nhập hủy/thiếu ở bảng này ⇒ BE ưu tiên số ở bảng, bỏ số chờ; không nhập ⇒ số chờ gắn vào tem đầu của lệnh.
  const choCuaDong = (d) => (dong.find((x) => x.run === d.run) === d ? d.run.vai_cho_tem : null);
  const coSo = dong.filter((d) => so(d.key) > 0);
  const coNhap = dong.filter((d) => so(d.key) > 0 || coVai(d.key) || bsDoi(d));
  const coVuot = coSo.some(vuot);
  const chiLuu = coSo.length > 0 && coSo.every((d) => !!giaTri(d.key, 'btpTruoc', !!meta.btpTruoc));
  const chiVai = coNhap.length - coSo.length; // dòng chỉ ghi hủy/thiếu / bổ sung, không in tem
  const nhanNut = coSo.length
    ? `${chiLuu ? 'Lưu' : 'In'} ${fmtNum(coSo.length)} tem${chiVai ? ` + ghi ${fmtNum(chiVai)} dòng` : ''}`
    : `Ghi hư/thiếu/bổ sung (${fmtNum(chiVai)} dòng)`;
  const chk = 'h-4 w-4 rounded border-line text-primary focus:ring-primary/30';

  return (
    <Modal open={open} onClose={onClose} size="full" title={`In tem — ${fmtNum(dong.length)} phần in`}
      footer={<>
        <Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>
        <Button icon={coSo.length ? (chiLuu ? 'save' : 'printer') : 'save'} loading={busy} disabled={busy || !coNhap.length || coVuot}
          onClick={() => onIn(coNhap.flatMap(bung))}>
          {nhanNut}
        </Button>
      </>}>
      <div className="mb-3"><TemMetaFields meta={meta} setMeta={setMeta} goiY={goiY} anGcMauVai anBtp /></div>
      <div className="overflow-auto rounded-card border border-line">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              {['STT', 'Đơn hàng', 'Mã hàng', 'Code phần', 'Màu vải', 'Kích vải', 'Kích phim'].map((h) => <th key={h} className={TH}>{h}</th>)}
              <th className={`${TH} text-right`}>Còn in được</th>
              <th className={`${TH} text-right`}>Số lượng</th>
              <th className={`${TH} text-right`}>SL hư</th>
              <th className={`${TH} text-right`}>SL thiếu</th>
              <th className={TH}>GC màu vải</th>
              <th className={TH}>BTP</th>
              <th className={TH}>SL bổ sung (cty / khách)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {dong.map((d, i) => {
              const con = conCuaDong(d);
              const dotBs = dotBoSungCuaDong(d);
              return (
                <tr key={d.key}>
                  <td className={`${TD} text-center text-ink-soft`}>{i + 1}</td>
                  <td className={TD}>{d.info.ma_don_hang || '—'}</td>
                  <td className={TD}>{d.info.ma_hang || '—'}</td>
                  <td className={`${TD} font-medium`}>{d.info.ma_phan || tenLenh(d.run) || '—'}</td>
                  <td className={TD}>{d.info.mau_vai || '—'}</td>
                  <td className={TD}>{d.info.kich_vai || '—'}</td>
                  <td className={TD}>{d.info.kich_phim || '—'}</td>
                  <td className={`${TD} text-right tabular-nums text-ink-soft`}>{con == null ? '—' : fmtNum(con)}</td>
                  <td className={`${TD} text-right`}>
                    <input type="number" min="0" value={(sl[d.key] || {}).sl || ''} placeholder="0"
                      onChange={(e) => datO(d.key, 'sl', e.target.value)}
                      className={`${numCls} ${vuot(d) ? 'border-danger focus:border-danger' : ''}`} />
                    {vuot(d) && <div className="mt-0.5 text-[11px] text-danger">Vượt phần còn in được</div>}
                    {!vuot(d) && d.nhom && so(d.key) > 0 && (
                      <div className="mt-0.5 whitespace-normal text-[11px] text-ink-soft"
                        title="Các lệnh cùng code phần + cùng chuyền được gộp thành 1 lệnh trước khi in">
                        Gộp {d.nhom.length} lệnh thành 1 · in 1 tem
                      </div>
                    )}
                  </td>
                  <td className={`${TD} text-right`}>
                    <input type="number" min="0" value={(sl[d.key] || {}).huy || ''} placeholder="0" aria-label="SL hư"
                      onChange={(e) => datO(d.key, 'huy', e.target.value)} className={numCls} />
                    {choCuaDong(d) && <ChoVai v={choCuaDong(d)} k="huy" />}
                  </td>
                  <td className={`${TD} text-right`}>
                    <input type="number" min="0" value={(sl[d.key] || {}).thieu || ''} placeholder="0" aria-label="SL thiếu"
                      onChange={(e) => datO(d.key, 'thieu', e.target.value)} className={numCls} />
                    {choCuaDong(d) && <ChoVai v={choCuaDong(d)} k="thieu" />}
                  </td>
                  <td className={TD}>
                    <input value={giaTri(d.key, 'gc', meta.gcMauVai || '')} placeholder="GC màu vải" aria-label="GC màu vải"
                      onChange={(e) => datO(d.key, 'gc', e.target.value)}
                      className="w-32 rounded-control border border-line bg-surface px-2 py-1.5 text-base md:text-sm text-ink outline-none focus:border-primary" />
                  </td>
                  <td className={TD}>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                      <input type="checkbox" className={chk} checked={!!giaTri(d.key, 'btpTruoc', !!meta.btpTruoc)}
                        onChange={(e) => datO(d.key, 'btpTruoc', e.target.checked)} /> Trước
                    </label>
                    <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-xs">
                      <input type="checkbox" className={chk} checked={!!giaTri(d.key, 'btpCuoi', !!meta.btpCuoi)}
                        onChange={(e) => datO(d.key, 'btpCuoi', e.target.checked)} /> Cuối
                    </label>
                  </td>
                  <td className={TD}>
                    {dotBs ? (
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" aria-label="SL bổ sung do công ty" placeholder="Cty"
                          value={giaTri(d.key, 'bsCty', chuoiSo(dotBs.sl_bo_sung_cty))}
                          onChange={(e) => datO(d.key, 'bsCty', e.target.value)} className={`${numCls} !w-20`} />
                        <span className="text-ink-soft">/</span>
                        <input type="number" min="0" aria-label="SL bổ sung do khách" placeholder="Khách"
                          value={giaTri(d.key, 'bsKhach', chuoiSo(dotBs.sl_bo_sung_khach))}
                          onChange={(e) => datO(d.key, 'bsKhach', e.target.value)} className={`${numCls} !w-20`} />
                      </div>
                    ) : <span className="text-xs text-ink-soft">—</span>}
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

// HỘP "CHẠY HOÀN TẤT" NHIỀU LỆNH (21/10/2026, người dùng yêu cầu) — tích sẵn lệnh đã in ≥ 90%; lệnh chưa đủ thì khóa
//   (nêu còn thiếu bao nhiêu). Mức module (luật §9).
// 22/10/2026: 1 dòng / NHÓM (lệnh cùng code phần + cùng chuyền gom như 1 phần) — đủ 90% tính trên TỔNG cả nhóm (số in
//   được rót lần lượt vào từng lệnh nên lệnh cuối nhóm luôn thiếu); chọn dòng = chạy hoàn tất mọi lệnh của nhóm.
function HoanTatNhieuModal({ open, onClose, runs, busy, onXacNhan }) {
  const [chon, setChon] = useState(() => new Set());
  const nhom = gomPhan(runs);
  // ⚠ `runs` là mảng tạo mới mỗi lần panel vẽ lại ⇒ deps theo KHÓA CHUỖI, không theo mảng (vòng lặp vô hạn — §9).
  const khoaDu = nhom.filter((g) => duHoanTatNhom(g.runs)).map((g) => g.key).join(',');
  useEffect(() => { if (open) setChon(new Set(khoaDu ? khoaDu.split(',') : [])); }, [open, khoaDu]);
  const ds = nhom.filter((g) => chon.has(g.key)).flatMap((g) => g.runs);
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Chạy hoàn tất nhiều lệnh"
      footer={<>
        <Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>
        <Button variant="success" icon="check" loading={busy} disabled={busy || !ds.length} onClick={() => onXacNhan(ds)}>
          Chạy hoàn tất ({fmtNum(ds.length)} lệnh)
        </Button>
      </>}>
      <div className="overflow-auto rounded-card border border-line">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              <th className={TH} />
              <th className={TH}>Code phần · Lệnh</th>
              <th className={`${TH} text-right`}>Đã in / SL release</th>
              <th className={TH}>Tình trạng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {nhom.map((g) => {
              const r = g.runs[0];
              const du = duHoanTatNhom(g.runs);
              const thieu = toiThieuHoanTatNhom(g.runs) - tongNhom(g.runs, daIn);
              return (
                <tr key={g.key} className={du ? '' : 'opacity-60'}>
                  <td className={TD}>
                    <input type="checkbox" className="h-4 w-4 accent-primary" disabled={!du} checked={chon.has(g.key)}
                      aria-label="Chọn để chạy hoàn tất"
                      onChange={() => setChon((s) => { const x = new Set(s); if (x.has(g.key)) x.delete(g.key); else x.add(g.key); return x; })} />
                  </td>
                  <td className={TD}>
                    <div className="font-medium">{tenLenh(r) || '—'}</div>
                    <div className="text-xs text-ink-soft">
                      {[g.runs.map((x) => x.lenh.ma_lenh_san_xuat).join(', '), r.lenh.ma_chuyen].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtNum(tongNhom(g.runs, daIn))} / {fmtNum(tongNhom(g.runs, slRelease))}</td>
                  <td className={TD}>
                    {du ? <Badge tone="success">Đủ 90%</Badge>
                      : <span className="text-xs text-danger">Chưa đủ 90% — còn thiếu {fmtNum(thieu)}</span>}
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

// `truocXacNhan(lenhIds)` — Promise<bool>: trang hỏi LÝ DO NGHẼN trước khi chạy hoàn tất (như `RunPanel`).
export default function RunNhieuPanel({ lenhIds, onClose, onChanged, onMoLenh, truocXacNhan }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRun = can('PROD_RUN');
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [temMeta, setTemMeta] = useState(META_MAC_DINH());
  const [inOpen, setInOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [toInDs, setToInDs] = useState([]);
  const [lyDoNgungDs, setLyDoNgungDs] = useState([]);
  const [stop, setStop] = useState({ lyDoId: '', ghiChu: '', gioBd: '', gioKt: '' });
  const [gioHoatDongLai, setGioHoatDongLai] = useState('');
  const [hoanTatOpen, setHoanTatOpen] = useState(false);
  const [traVeOpen, setTraVeOpen] = useState(false);
  const [moRong, setMoRong] = useState(() => new Set()); // khóa nhóm đang bung danh sách lệnh
  const khoaLenh = (lenhIds || []).join(',');

  const load = useCallback(async () => {
    const ids = khoaLenh ? khoaLenh.split(',') : [];
    if (!ids.length) return;
    setLoading(true);
    try {
      const ds = await Promise.all(ids.map(async (id) => {
        try { return (await getRun(id)).data; } catch (e) { return { loi: e.message || 'Lỗi tải', lenh: { id } }; }
      }));
      setRuns(ds);
      // Ngày ca + Ngày chứng từ NHẬP ĐẦU CA (13/10/2026): BE nhớ theo lượt ca của TỪNG nhóm chuyền ⇒ chỉ điền lại
      // khi MỌI lệnh đang mở có cùng một giá trị đã nhớ; lệch nhau / chưa ai nhập ⇒ để trống, bắt nhập.
      const dsG = ds.filter(dangChay).map((r) => r.goi_y_tem).filter(Boolean);
      const g = dsG[0];
      const chung = (k) => (dsG.length && dsG.every((x) => (x[k] || '') === (g[k] || '')) ? (g[k] || '') : '');
      // Ngày chứng từ (26/10/2026): ô còn giá trị TỰ ĐIỀN (hôm nay) ⇒ thay bằng giá trị chung đã nhớ nếu có.
      if (g) {
        setTemMeta((m) => {
          const ct = (!m.ngayCt || m._ctTuDong) && chung('ngay_ct');
          return { ...m, ngayCa: m.ngayCa || chung('ngay_ca'), ...(ct ? { ngayCt: ct, _ctTuDong: false } : {}), gioBd: m.gioBd || g.gio_bd || '', gioKt: m.gioKt || g.gio_kt || '' };
        });
      }
    } finally {
      setLoading(false);
    }
  }, [khoaLenh]);
  useEffect(() => { load(); }, [load]);
  useTaiNgamKhiLenhDoi(lenhIds, load);
  useEffect(() => {
    const t = setInterval(() => setTemMeta((m) => (m._suaGioKt || m.gioKt === gioHienTai() ? m : metaGuiDi(m))), 20000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    listUserOptions({ limit: 500 }).then((r) => setUsers(r.data || [])).catch(() => {});
    listToIn().then((r) => setToInDs(r.data || [])).catch(() => setToInDs([]));
    listLyDoNgung().then((r) => setLyDoNgungDs(r.data || [])).catch(() => setLyDoNgungDs([]));
  }, []);

  const chay = runs.filter(dangChay);
  const dangNgung = chay.filter((r) => r.ngung_active);
  const chuaNgung = chay.filter((r) => !r.ngung_active);
  // Làm 1 việc cho nhiều phiếu, TUẦN TỰ; lỗi phiếu nào báo phiếu đó (phiếu khác vẫn làm). Trả số phiếu lỗi.
  const lamTungPhieu = async (ds, viec, nhanXong) => {
    setBusy(true);
    const loi = [];
    for (const r of ds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await viec(r);
      } catch (e) { loi.push(`${tenLenh(r)}: ${e.message || 'lỗi'}`); }
    }
    setBusy(false);
    if (loi.length) show(`${nhanXong} — lỗi ở ${loi.length}/${ds.length} lệnh: ${loi.join(' · ')}`, 'error');
    else show(`${nhanXong} cho ${fmtNum(ds.length)} lệnh`);
    await load();
    onChanged?.();
    return loi.length;
  };

  const doSavePhanCong = async (body) => (await lamTungPhieu(chay, (r) => savePhanCong(r.phieu.id, body), 'Đã lưu phân công')) === 0;

  const doStop = async () => {
    if (!stop.lyDoId && !stop.ghiChu.trim()) {
      show(lyDoNgungDs.length ? 'Chọn lý do ngừng chuyền' : 'Nhập lý do ngừng chuyền', 'error');
      return;
    }
    const n = await lamTungPhieu(chuaNgung,
      (r) => stopLine(r.phieu.id, stop.ghiChu.trim(), stop.gioBd || null, stop.lyDoId || null, stop.gioKt || null),
      stop.gioKt ? `Đã ghi ngừng chuyền ${stop.gioBd || 'bây giờ'} → ${stop.gioKt}` : 'Đã ngừng chuyền');
    if (!n) setStop({ lyDoId: '', ghiChu: '', gioBd: '', gioKt: '' });
  };
  // CHẠY HOÀN TẤT nhiều lệnh (21/10/2026) — tuần tự từng phiếu (`finishRun`), lỗi lệnh nào báo lệnh đó.
  const doHoanTat = async (ds) => {
    if (truocXacNhan && !(await truocXacNhan(ds.map((r) => r.lenh.id)))) return; // quá SLA ⇒ lý do nghẽn
    const n = await lamTungPhieu(ds, (r) => finishRun(r.phieu.id), 'Đã chạy hoàn tất');
    if (!n) setHoanTatOpen(false);
  };
  const nhomChay = gomPhan(chay);
  const soDuHoanTat = nhomChay.filter((g) => duHoanTatNhom(g.runs)).length;

  const doResume = async () => {
    const n = await lamTungPhieu(dangNgung, (r) => resumeLine(r.phieu.id, gioHoatDongLai || null), 'Chuyền hoạt động lại');
    if (!n) setGioHoatDongLai('');
  };

  // In nhãn mọi tem vào cửa sổ `w` mở sẵn. Lỗi in chỉ báo — tem đã tạo, in lại ở "Tem đã in" của từng lệnh.
  const inNhan = async (tems, w) => {
    if (!tems.length) { dongCuaSoIn(w); return; }
    try {
      const labels = await Promise.all(tems.map(async (t) => (await getTemLabel(t.tem_id, t.dot_vai_id || null)).data));
      if (labels.length === 1) await printTemLabel(labels[0], w);
      else await printTemLabelNhieu(labels, w);
    } catch (e) {
      dongCuaSoIn(w);
      show(`CHƯA in được nhãn tem: ${e.message || ''} — in lại ở "Tem đã in" của từng lệnh`, 'error');
    }
  };

  // `dong` = các dòng CÓ NHẬP của modal (số lượng in và/hoặc SL hủy / SL thiếu).
  // ⚠ Mở SẴN cửa sổ in TRƯỚC mọi await (xin mã ERP xong mới mở là bị chặn popup).
  const doInNhieu = async (dongVao) => {
    // Gom theo phiếu, giữ thứ tự dòng ⇒ phiếu CÓ in tem: 1 lượt `printTemBatch` (dòng chỉ có hủy/thiếu đi kèm với
    //   SL 0 — BE ghi sổ vải, không tạo tem); phiếu CHỈ ghi vải: `addVaiHuy` như 2 ô Vải hủy / thiếu của RunPanel.
    // 25/10/2026: GC màu vải + BTP trước/cuối RIÊNG từng dòng (BE `printTemBatch` nhận theo item); SL bổ sung ghi ở đợt.
    const gomTheoPhieu = (ds) => {
      const out = [];
      ds.forEach((d) => {
        let g = out.find((x) => x.run.lenh.id === d.run.lenh.id);
        if (!g) { g = { run: d.run, items: [], coTem: false }; out.push(g); }
        if (d.soLuong > 0) g.coTem = true;
        g.items.push({ ...(d.dotVaiId ? { dotVaiId: d.dotVaiId } : {}), soLuong: d.soLuong,
          soLuongHuy: d.soLuongHuy || 0, soLuongThieu: d.soLuongThieu || 0,
          gcMauVai: d.gcMauVai || null, btpTruoc: !!d.btpTruoc, btpCuoi: !!d.btpCuoi,
          dotVaiGhi: d.dotVaiId || d.info?.dot_vai_ve_id || null });
      });
      return out;
    };
    let dong = dongVao;
    let theoPhieu = gomTheoPhieu(dong);
    const inTem = theoPhieu.filter((g) => g.coTem);
    if (inTem.length) {
      const thieu = thieuNgayCaCt(temMeta);
      if (thieu) { show(thieu, 'error'); return; }
      // Lệnh chưa LƯU phân công có thợ in (hoặc ca này chuyền chưa phân công) ⇒ không in (gương BE `kiemThoInPhanCong`).
      const chuaTho = inTem.map((g) => g.run).filter((r) => chuaPhanCongThoIn(r?.phan_cong));
      if (chuaTho.length) {
        show(`${CHUA_THO_IN}: ${chuaTho.map(tenLenh).join(', ')}`, 'error');
        return;
      }
    }
    const coNhan = dong.some((d) => d.soLuong > 0 && !d.btpTruoc); // có tem phải in nhãn (BTP trước ⇒ chỉ lưu)
    let w = null;
    if (coNhan) {
      try { w = moSanCuaSoIn(); } catch (e) { show(e.message, 'error'); return; }
    }
    setBusy(true);
    const tems = [];
    const loi = [];
    let soVai = 0;
    let soBs = 0;
    const meta = metaGuiDi(temMeta);
    // ① GỘP LỆNH: dòng nhóm (nhiều lệnh cùng code phần + cùng chuyền) có in tem ⇒ gộp thành 1 lệnh rồi in 1 tem đủ số
    //   (25/10/2026, người dùng: "gộp số lượng lại thành 1 phần 1 dòng"). Gộp lỗi ⇒ bỏ dòng đó, báo lỗi.
    const sauGop = [];
    for (const d of dong) {
      if (!d.nhom || !(d.soLuong > 0)) { sauGop.push(d); continue; }
      try {
        // eslint-disable-next-line no-await-in-loop
        const g = await gopLenh(d.nhom.map((r) => r.lenh.id));
        // eslint-disable-next-line no-await-in-loop
        const run = (await getRun(g.data.lenh_id)).data;
        sauGop.push({ ...d, run, info: (run.dot_vai || [])[0] || d.info, nhom: null });
      } catch (e) {
        loi.push(`${tenLenh(d.run)}: chưa gộp được lệnh — ${e.message || 'lỗi'}`);
      }
    }
    dong = sauGop;
    theoPhieu = gomTheoPhieu(dong);
    for (const g of theoPhieu) {
      try {
        if (g.coTem) {
          // `khoaCa` theo TỪNG lệnh (mỗi nhóm chuyền một lượt ca riêng) — BE chặn khi đã sang ca mới.
          // eslint-disable-next-line no-await-in-loop
          const res = await printTemBatch(g.run.phieu.id, g.items.map(({ dotVaiGhi, ...it }) => it),
            { ...meta, khoaCa: g.run.goi_y_tem?.khoa_ca || '' });
          tems.push(...(res.data?.tems_in || []));
          soVai += g.items.filter((it) => it.soLuongHuy || it.soLuongThieu).length;
        } else {
          for (const it of g.items) {
            for (const [loai, sl] of [['HUY', it.soLuongHuy], ['THIEU', it.soLuongThieu]]) {
              if (!(sl > 0)) continue;
              // eslint-disable-next-line no-await-in-loop
              await addVaiHuy(g.run.phieu.id, { dotVaiId: it.dotVaiGhi, soLuong: sl, lyDo: 'Ghi khi in tem', loai });
            }
            soVai += 1;
          }
        }
      } catch (e) {
        loi.push(`${tenLenh(g.run)}: ${e.message || 'lỗi'}`);
      }
    }
    // ② SL BỔ SUNG (đợt BO_SUNG) — ghi vào đợt vải như khối "Số lượng bổ sung" của RunPanel.
    for (const d of dong) {
      if (!d.boSung) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        await luuLyDoBoSungDotVai(d.boSung.dotVaiId, { slCty: d.boSung.slCty, slKhach: d.boSung.slKhach, ghiChu: d.boSung.ghiChu });
        soBs += 1;
      } catch (e) { loi.push(`${tenLenh(d.run)}: chưa lưu SL bổ sung — ${e.message || 'lỗi'}`); }
    }
    try {
      const temNhan = tems.filter((t) => !t.btp_truoc);
      if (w) await inNhan(temNhan, w);
      const soBtp = tems.length - temNhan.length;
      const phan = [
        tems.length ? `Đã tạo ${fmtNum(tems.length)} tem${soBtp ? ` (${fmtNum(soBtp)} tem BTP trước — không in nhãn)` : ''} — tự vào xe phơi` : null,
        soVai ? `đã ghi hư/thiếu ${fmtNum(soVai)} dòng (lệnh không in tem: lưu chờ gắn tem in kế tiếp)` : null,
        soBs ? `đã lưu SL bổ sung ${fmtNum(soBs)} đợt` : null,
      ].filter(Boolean).join(' · ');
      if (phan) show(`${phan}${loi.length ? ` · LỖI: ${loi.join(' · ')}` : ''}`, loi.length ? 'error' : 'success');
      else show(`Chưa ghi được gì — ${loi.join(' · ')}`, 'error');
      if (!loi.length) { setInOpen(false); setTemMeta(META_MAC_DINH()); }
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const pcDau = chay[0]?.phan_cong || null;
  const pcKhac = new Set(chay.map((r) => khoaPc(r.phan_cong))).size > 1;
  const dsChuyen = [...new Set(runs.map((r) => r?.lenh?.ma_chuyen).filter(Boolean))].join(', ') || '—';
  const tongTarget = runs.reduce((s, r) => s + (Number(r?.lenh?.so_luong_release) || 0), 0);
  const tongIn = runs.reduce((s, r) => s + (Number(r?.printed) || 0), 0);
  // 22/10/2026: lệnh cùng code phần + cùng chuyền = 1 phần ⇒ tiêu đề / danh sách theo PHẦN, không theo lệnh.
  const nhomTatCa = gomPhan(runs);
  const tieuDe = nhomTatCa.length === 1 && runs.length
    ? `Sản xuất — ${tenLenh(nhomTatCa[0].runs[0]) || `${fmtNum(runs.length)} lệnh`}`
    : `Sản xuất — ${fmtNum(nhomTatCa.length || (lenhIds || []).length)} phần in`;
  const batMoRong = (k) => setMoRong((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });

  return (
    <SidePanel open={!!(lenhIds && lenhIds.length)} onClose={onClose}
      title={tieuDe}
      subtitle={`Chuyền ${dsChuyen} · đã in ${fmtNum(tongIn)} / ${fmtNum(tongTarget)}`}
      footer={canRun && chay.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" icon="undo" onClick={() => setTraVeOpen(true)} disabled={busy}>
            Trả về Kế hoạch
          </Button>
          <Button variant="success" icon="check" onClick={() => setHoanTatOpen(true)} disabled={busy || !soDuHoanTat}
            title={soDuHoanTat ? undefined : 'Chưa phần nào in đủ 90% SL release'}>
            Chạy hoàn tất ({fmtNum(soDuHoanTat)}/{fmtNum(nhomChay.length)})
          </Button>
        </div>
      )}>
      {loading && !runs.length ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          <section>
            <div className="overflow-hidden rounded-control border border-line">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line bg-surface-muted">
                    <th className={TH}>Code phần</th>
                    <th className={`${TH} text-right`}>Đã in / SL</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {nhomTatCa.map((g) => {
                    // Dòng NHÓM (nhiều lệnh cùng code phần + cùng chuyền) hiện như 1 phần: 1 code phần, 1 số tổng;
                    //   bấm mũi tên bung danh sách lệnh để "Mở" từng lệnh (vải hủy, tem đã in, đổi chuyền…).
                    if (g.runs.length > 1) {
                      const r0 = g.runs[0];
                      const mo = moRong.has(g.key);
                      return [
                        <tr key={g.key}>
                          <td className="px-2.5 py-2 text-sm text-ink">
                            <button type="button" className="flex items-center gap-1 text-left font-medium" onClick={() => batMoRong(g.key)}
                              aria-expanded={mo} title={mo ? 'Thu gọn' : 'Xem từng lệnh'}>
                              <span className="text-xs text-ink-soft">{mo ? '▾' : '▸'}</span>{tenLenh(r0) || '—'}
                            </button>
                            <div className="text-xs text-ink-soft">{r0.lenh.ma_chuyen || ''}</div>
                            {g.runs.some((x) => x.ngung_active) && <Badge tone="danger">Đang ngừng</Badge>}
                          </td>
                          <td className="px-2.5 py-2 text-right text-sm tabular-nums text-ink">
                            {fmtNum(tongNhom(g.runs, daIn))} / {fmtNum(tongNhom(g.runs, slRelease))}
                          </td>
                          <td />
                        </tr>,
                        ...(mo ? g.runs.map((r) => (
                          <tr key={r.lenh.id} className="bg-surface-muted/50">
                            <td className="py-1.5 pl-7 pr-2.5 text-xs text-ink-soft">
                              {[r.lenh.ma_lenh_san_xuat, r.phieu?.ma_phieu_san_xuat].filter(Boolean).join(' · ')}
                              {r.phieu && !dangChay(r) && <span className="text-emerald-700"> · đã hoàn tất</span>}
                            </td>
                            <td className="px-2.5 py-1.5 text-right text-xs tabular-nums text-ink-soft">{fmtNum(r.printed)} / {fmtNum(r.lenh.so_luong_release)}</td>
                            <td className="px-2.5 py-1.5 text-right">
                              <Button chiXemOk variant="ghost" className="px-2 py-0.5 text-xs" onClick={() => onMoLenh?.(r.lenh.id)}>Mở</Button>
                            </td>
                          </tr>
                        )) : []),
                      ];
                    }
                    const r = g.runs[0];
                    return (
                      <tr key={r.lenh.id}>
                        <td className="px-2.5 py-2 text-sm text-ink">
                          <div className="font-medium">{tenLenh(r) || '—'}</div>
                          <div className="text-xs text-ink-soft">
                            {[r.lenh.ma_lenh_san_xuat, r.phieu?.ma_phieu_san_xuat, r.lenh.ma_chuyen].filter(Boolean).join(' · ')}
                            {r.loi && <span className="text-danger"> · {r.loi}</span>}
                          </div>
                          {r.phieu && !dangChay(r) && <Badge tone="success">Đã hoàn tất</Badge>}
                          {r.ngung_active && <Badge tone="danger">Đang ngừng</Badge>}
                        </td>
                        <td className="px-2.5 py-2 text-right text-sm tabular-nums text-ink">{fmtNum(r.printed)} / {fmtNum(r.lenh.so_luong_release)}</td>
                        <td className="px-2.5 py-2 text-right">
                          <Button chiXemOk variant="ghost" className="px-2 py-1 text-xs" onClick={() => onMoLenh?.(r.lenh.id)}>Mở</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {canRun && chay.length > 0 && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">In tem</h3>
              <Button className="w-full" icon="printer" onClick={() => setInOpen(true)} disabled={busy}>
                Nhập số lượng &amp; in tem ({fmtNum(dongInTem(chay).length)} phần in)…
              </Button>
            </section>
          )}

          {chay.length > 0 && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Phân công ({fmtNum(chay.length)} lệnh)</h3>
              {pcKhac && <p className="mb-2 text-xs text-amber-600">Các lệnh đang có phân công khác nhau — lưu ở đây sẽ áp chung cho tất cả.</p>}
              <PhanCongInline pc={pcDau} users={users} toIns={toInDs} onSave={doSavePhanCong} busy={busy} canRun={canRun}
                thoInKh={chay[0]?.lenh?.tho_in_kh || ''} />
            </section>
          )}

          {chay.length > 0 && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Ngừng chuyền</h3>
              {dangNgung.length > 0 && (
                <div className="mb-3 rounded-control border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm dark:border-rose-900/60 dark:bg-rose-950/30">
                  <div className="font-semibold text-rose-700 dark:text-rose-300">⏸ {fmtNum(dangNgung.length)}/{fmtNum(chay.length)} lệnh đang ngừng</div>
                  {dangNgung.map((r) => (
                    <div key={r.lenh.id} className="mt-0.5 text-xs text-ink-soft">
                      {tenLenh(r)} · từ {fmtDt(r.ngung_active.tg_bd_ngung)}{r.ngung_active.ly_do ? ` · ${r.ngung_active.ly_do}` : ''}
                    </div>
                  ))}
                  {canRun && (
                    <div className="mt-2 space-y-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-ink-soft">Giờ hoạt động lại (bỏ trống = bây giờ)</span>
                        <TimeSelect value={gioHoatDongLai} onChange={setGioHoatDongLai} minuteStep={1} />
                      </label>
                      <Button className="w-full" onClick={doResume} loading={busy}>Hoạt động lại ({fmtNum(dangNgung.length)} lệnh)</Button>
                    </div>
                  )}
                </div>
              )}
              {canRun && chuaNgung.length > 0 && (
                <div className="space-y-2">
                  {lyDoNgungDs.length > 0 && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-ink-soft">Lý do ngừng</span>
                      <SearchableSelect moNgay value={stop.lyDoId} onChange={(v) => setStop((s) => ({ ...s, lyDoId: v }))}
                        options={lyDoNgungDs} getValue={(l) => l.id} getLabel={(l) => l.ten_ly_do || ''}
                        getSearch={(l) => `${l.ten_ly_do || ''} ${l.ma_ly_do || ''}`}
                        placeholder="Bấm để xem danh sách, hoặc gõ để tìm..." emptyLabel="— Chọn lý do —" />
                    </label>
                  )}
                  <Textarea rows={2} value={stop.ghiChu} onChange={(e) => setStop((s) => ({ ...s, ghiChu: e.target.value }))}
                    placeholder={lyDoNgungDs.length ? 'Ghi chú thêm (tùy chọn)' : 'Lý do ngừng chuyền (vd: hết mực, kẹt vải, đổi khuôn...)'} />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-ink-soft">Giờ bắt đầu (trống = bây giờ)</span>
                      <TimeSelect value={stop.gioBd} onChange={(v) => setStop((s) => ({ ...s, gioBd: v }))} minuteStep={1} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-ink-soft">Giờ kết thúc (trống = chưa xong)</span>
                      <TimeSelect value={stop.gioKt} onChange={(v) => setStop((s) => ({ ...s, gioKt: v }))} minuteStep={1} />
                    </label>
                  </div>
                  <Button variant="danger" className="w-full" onClick={doStop} loading={busy}
                    disabled={lyDoNgungDs.length ? !stop.lyDoId : !stop.ghiChu.trim()}>
                    {stop.gioKt ? 'Ghi lần ngừng (đã kết thúc)' : 'Ngừng chuyền'} ({fmtNum(chuaNgung.length)} lệnh)
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
      <InTemNhieuModal open={inOpen} onClose={() => setInOpen(false)} runs={chay} meta={temMeta} setMeta={setTemMeta}
        goiY={chay[0]?.goi_y_tem} busy={busy} onIn={doInNhieu} />
      <HoanTatNhieuModal open={hoanTatOpen} onClose={() => setHoanTatOpen(false)} runs={chay} busy={busy} onXacNhan={doHoanTat} />
      <TraVeKeHoachModal open={traVeOpen} onClose={() => setTraVeOpen(false)} runs={chay}
        onXong={async ({ thongBao }) => { setTraVeOpen(false); show(thongBao); await load(); onChanged?.(); }} />
      <Toast toast={toast} />
    </SidePanel>
  );
}
