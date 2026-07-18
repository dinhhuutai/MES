import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import QrScanner from '../../../components/common/QrScanner';
import useToast from '../../../hooks/useToast';
import useSocketEvent from '../../../hooks/useSocketEvent';
import { fmtNum, fmtDateTime, baseMaTem } from '../../../utils/format';
import { listTinhTrangPhanIn, getTinhTrangGraph } from '../../../services/dashboardService';

const CL_LABEL = { KHUON: 'Khuôn', FILM: 'Film', MUC: 'Mực', QC_XAC_NHAN: 'QC' };
const TEM_TONE = {
  IN: 'default', DANG_PHOI: 'info', DA_KHO: 'info', CHO_SUA: 'warning',
  CHO_OQC: 'info', OQC_DAT: 'success', DA_GIAO: 'success', LOAI: 'danger', HUY: 'danger',
};
const HEAD_TONE = {
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  primary: 'bg-primary-wash text-primary',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  danger: 'bg-danger/10 text-danger',
};
const clock = (t) => (t ? new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
const mins = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000)) : null);
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

// ---- Nguyên thô SƠ ĐỒ CÂY ----
function Node({ title, tone = 'slate', w = 168, children }) {
  return (
    <div className="shrink-0 self-center overflow-hidden rounded-control border border-line bg-surface shadow-sm" style={{ width: w }}>
      <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${HEAD_TONE[tone]}`}>{title}</div>
      <div className="p-2">{children}</div>
    </div>
  );
}
// Mũi tên nối (đường + đầu nhọn) — cho bước tuần tự.
const Link = () => (
  <div className="flex shrink-0 items-center self-center">
    <span className="h-0.5 w-5 bg-primary/45" />
    <span className="h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-primary/45" />
  </div>
);
// Mũi tên TRẢ VỀ (đỏ, nét đứt, đầu nhọn chỉ NGƯỢC về trái) — nhánh này là do bị trả về / kiểm lại.
const RetLink = () => (
  <div className="flex shrink-0 items-center self-center" title="Bị trả về (kiểm lại)">
    <span className="h-0 w-0 border-y-[4px] border-r-[7px] border-y-transparent border-r-danger" />
    <span className="w-5 border-t-2 border-dashed border-danger" />
  </div>
);
// Mũi tên DỌC LÊN đỏ (nét đứt) — OQC (dưới) → ô Trả về (trên, cùng cột).
const UpArrow = () => (
  <span className="flex flex-col items-center" aria-hidden="true">
    <span className="h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-danger" />
    <span className="h-4 border-l-2 border-dashed border-danger" />
  </span>
);
// Chuẩn hóa item: cho phép { el, ret } (nhánh trả về) hoặc phần tử JSX thường.
const normItems = (items) => (items || [])
  .map((it) => (it && typeof it === 'object' && 'el' in it) ? it : { el: it, ret: false })
  .filter((it) => it.el);
// Nhánh CÂY: cha nằm GIỮA (đối xứng) → nhiều con, nối bằng đường gấp khúc + đầu mũi tên.
// Con nào có `ret` → connector đỏ nét đứt + đầu nhọn CHỈ NGƯỢC (mũi tên trả về ngay trên nhánh).
function Fork({ parent, items }) {
  const nodes = normItems(items);
  if (nodes.length === 0) return parent;
  if (nodes.length === 1) return <div className="flex items-center">{parent}{nodes[0].ret ? <RetLink /> : <Link />}{nodes[0].el}</div>;
  return (
    <div className="flex items-center">
      {parent}
      <span className="h-0.5 w-3 shrink-0 self-center bg-primary/45" />
      <div className="flex flex-col">
        {nodes.map((it, i) => (
          <div key={i} className="flex items-stretch">
            <div className="relative w-7 shrink-0">
              <span className={`absolute left-0 w-0.5 ${it.ret ? 'bg-danger' : 'bg-primary/45'} ${i === 0 ? 'top-1/2 bottom-0' : i === nodes.length - 1 ? 'top-0 bottom-1/2' : 'inset-y-0'}`} />
              {it.ret ? (
                <>
                  <span className="absolute left-0 top-1/2 w-6 -translate-y-1/2 border-t-2 border-dashed border-danger" />
                  <span className="absolute left-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[4px] border-r-[7px] border-y-transparent border-r-danger" />
                  <span className="absolute -top-1 left-1 text-[8px] font-bold text-danger">↩</span>
                </>
              ) : (
                <>
                  <span className="absolute left-0 top-1/2 h-0.5 w-6 -translate-y-1/2 bg-primary/45" />
                  <span className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[4px] border-l-[7px] border-y-transparent border-l-primary/45" />
                </>
              )}
            </div>
            <div className="min-w-0 py-2">{it.el}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
// Chuỗi nút tuần tự (Link giữa các nút có dữ liệu).
function Chain({ nodes }) {
  const arr = (nodes || []).filter(Boolean);
  if (arr.length === 0) return null;
  return <div className="flex items-center">{arr.map((n, i) => <div key={i} className="flex items-center">{i > 0 && <Link />}{n}</div>)}</div>;
}

const Q = ({ label, v, tone = 'text-ink' }) => (
  <div className="flex items-center justify-between gap-2 text-[11px]">
    <span className="text-ink-soft">{label}</span><b className={`tabular-nums ${tone}`}>{fmtNum(v)}</b>
  </div>
);
const Who = ({ nguoi, tg }) => (nguoi || tg) ? (
  <div className="mt-1 border-t border-line/60 pt-1 text-[10px] leading-tight text-ink-soft">
    {nguoi && <div className="truncate font-medium text-ink">{nguoi}</div>}
    {tg && <div className="tabular-nums">{fmtDateTime(tg)}</div>}
  </div>
) : null;

// Nơi trả về (checkpoint đã trả tem về) — nhãn hiển thị theo `loai` của qc_tra_ve.
const TRAVE_FROM = { OQC: 'OQC', OQC_SUA: 'OQC', READY: 'QC', TEST_RUN: 'QC' };

// Mũi tên QUAY VỀ (chỉ sang trái, nét đứt đỏ) — thể hiện tem bị TRẢ NGƯỢC về trạm trước.
const BackArrow = () => (
  <span className="inline-flex shrink-0 items-center" aria-hidden="true">
    <span className="h-0 w-0 border-y-[4px] border-r-[7px] border-y-transparent border-r-danger" />
    <span className="h-0 w-5 border-t border-dashed border-danger" />
  </span>
);

// Khối "TRẢ VỀ": đặt NGAY DƯỚI node KCS/Sửa — mũi tên quay về + "OQC trả về" + KẾT QUẢ OQC + lý do.
function ReturnBack({ items }) {
  const arr = items || [];
  if (!arr.length) return null;
  const from = TRAVE_FROM[arr[0].loai] || 'OQC';
  return (
    <div className="mt-1 rounded-control border border-dashed border-danger/60 bg-danger/5 px-1.5 py-1 text-[10px] leading-tight text-danger">
      <div className="flex items-center gap-1 font-bold uppercase">
        <BackArrow /> {from} trả về
      </div>
      {arr.map((r, i) => (
        <div key={i} className="mt-0.5 border-t border-danger/20 pt-0.5">
          <div><b>Kết quả OQC:</b> Không đạt</div>
          {r.ly_do && <div className="whitespace-normal">Lý do: {r.ly_do}</div>}
          {(r.nguoi || r.tg) && (
            <div className="text-[9px] text-danger/70">{[r.nguoi, r.tg ? fmtDateTime(r.tg) : ''].filter(Boolean).join(' · ')}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// Ô "TRẢ VỀ" ĐỨNG RIÊNG (1 lần OQC trả về) — 1 ô trong vòng khép kín.
function ReturnBox({ item }) {
  const r = item || {};
  const from = TRAVE_FROM[r.loai] || 'OQC';
  return (
    <Node title={`↩ ${from} trả về`} tone="danger" w={158}>
      <div className="text-[11px]"><b className="text-danger">Kết quả OQC:</b> Không đạt</div>
      {r.ly_do && <div className="text-[11px] text-danger">Lý do: {r.ly_do}</div>}
      <Who nguoi={r.nguoi} tg={r.tg} />
    </Node>
  );
}

// Nhánh OQC BỊ TRẢ VỀ: ô Trả về nằm PHÍA TRÊN ô OQC (cùng cột) + mũi tên dọc OQC→Trả về.
// Mũi tên Trả về→KCS tổng vẽ riêng bằng lớp SVG overlay (nối 2 ô khác nhánh — cần đo vị trí thật).
// `retRef` gắn ref lên ô Trả về để overlay biết toạ độ.
function OqcRejectedBranch({ oqc, ret, retRef }) {
  const PAD = 128; // chừa chỗ TRÊN cho ô Trả về + mũi tên; chừa DƯỚI bằng để OQC nằm GIỮA (khớp mũi tên từ KCS).
  return (
    <div className="flex flex-col items-center">
      {/* Vùng chừa TRÊN: ô Trả về + mũi tên OQC→Trả về, neo ở đáy vùng (ngay trên OQC, KHÔNG đè OQC) */}
      <div className="relative w-full" style={{ height: PAD }}>
        <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span ref={retRef} className="inline-flex">{ret}</span>
          <UpArrow />
        </div>
      </div>
      {oqc}
      {/* Vùng chừa DƯỚI (bằng vùng trên) → OQC ở CHÍNH GIỮA nhánh → mũi tên từ KCS chỉ đúng OQC */}
      <div style={{ height: PAD }} />
    </div>
  );
}

function ReadyNode({ checklists, lan = 0 }) {
  const byMa = Object.fromEntries((checklists || []).map((c) => [c.ma_checkpoint, c]));
  return (
    <Node title={`READY${lan ? ` · lần ${lan}` : ''} · Chuẩn bị KT`} tone="primary" w={190}>
      <div className="space-y-1">
        {['KHUON', 'FILM', 'MUC', 'QC_XAC_NHAN'].map((ma) => {
          const c = byMa[ma];
          return (
            <div key={ma} className="flex items-start gap-1.5 text-[11px]">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${c ? 'bg-emerald-500' : 'bg-line'}`} />
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-ink">{CL_LABEL[ma]}</span>
                {c ? <span className="ml-1 text-[10px] text-ink-soft">{c.nguoi || ''}{c.tg ? ` · ${fmtDateTime(c.tg)}` : ''}</span>
                  : <span className="ml-1 text-[10px] text-ink-soft">chưa XN</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Node>
  );
}

function lenhStages(l) {
  const tt = l.trang_thai;
  const daR2 = tt === 'RELEASE_2' || tt === 'SAN_XUAT';
  const test = (l.test_qa || l.test?.qa) ? { st: 'done', note: 'đạt' } : daR2 ? { st: 'skip', note: 'bỏ' } : { st: 'cur', note: 'chờ' };
  return [
    { key: 'R1', label: 'Release 1', st: 'done', who: l.r1 },
    { key: 'TEST', label: 'Test Run', st: test.st, note: test.note, who: l.test?.qa || l.test?.cnsp },
    { key: 'R2', label: 'Release 2', st: tt === 'SAN_XUAT' ? 'done' : tt === 'RELEASE_2' ? 'cur' : 'pending', who: l.r2 },
    { key: 'SX', label: 'Sản xuất', st: tt === 'SAN_XUAT' ? 'cur' : 'pending' },
  ];
}
const ST_DOT = { done: 'bg-emerald-500', cur: 'bg-primary', skip: 'bg-amber-400', pending: 'bg-line' };
const ST_TXT = { done: 'text-ink', cur: 'text-primary font-semibold', skip: 'text-amber-600', pending: 'text-ink-soft' };

function LenhNode({ lenh }) {
  return (
    <Node title={`Đợt SX · ${lenh.ma_lenh_san_xuat}`} tone="sky" w={186}>
      {lenh.feeds.map((f) => (
        <div key={f.dot_vai_ve_id} className="text-[11px]">
          <span className="text-ink-soft">Vải về </span><b>{fmtNum(f.so_luong_vai_ve)}</b>
          <span className="text-ink-soft"> · vào SX </span><b>{fmtNum(f.so_luong)}</b>
        </div>
      ))}
      <div className="my-1 flex flex-wrap gap-1">
        {lenh.feeds.length >= 2 && <Badge tone="info">Gộp {lenh.feeds.length} đợt</Badge>}
        {lenh.giai_doan === 'EP_UI' && <Badge tone="warning">Ép ủi</Badge>}
      </div>
      <Q label="SL release" v={lenh.so_luong_release} tone="text-primary" />
      <div className="mt-1.5 border-t border-line/60 pt-1">
        {lenhStages(lenh).map((s) => (
          <div key={s.key} className="py-px">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className={`h-1.5 w-1.5 rounded-full ${ST_DOT[s.st]}`} />
              <span className={ST_TXT[s.st]}>{s.label}</span>
              {s.note && <span className={`ml-auto ${s.st === 'skip' ? 'text-amber-600' : s.st === 'done' ? 'text-emerald-600' : 'text-ink-soft'}`}>{s.note}</span>}
            </div>
            {(s.who?.nguoi || s.who?.tg) && (
              <div className="pl-3 text-[9px] leading-tight text-ink-soft">
                {s.who.nguoi ? <span className="text-ink">{s.who.nguoi}</span> : null}
                {s.who.tg ? <span className="tabular-nums"> · {fmtDateTime(s.who.tg)}</span> : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </Node>
  );
}

// Nút "Sản xuất · Chờ khô" (kèm thời gian phơi).
function TemNode({ tem }) {
  const khoLabel = tem.trang_thai === 'DANG_PHOI' ? 'Đang phơi' : tem.trang_thai === 'IN' ? 'Mới in' : 'Đã khô';
  const dur = mins(tem.tg_bd_phoi, tem.tg_kt_phoi);
  return (
    <Node title="Sản xuất · Chờ khô" tone="amber" w={168}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="font-mono text-[11px] font-bold text-ink">{tem.ma_tem}</span>
        <Badge tone={TEM_TONE[tem.trang_thai] || 'default'}>{khoLabel}</Badge>
      </div>
      <Q label="SL in" v={tem.so_luong} />
      {tem.ten_chuyen && <div className="text-[10px] text-ink-soft">{tem.ten_chuyen}</div>}
      {tem.tg_bd_phoi && (
        <div className="mt-1 border-t border-line/60 pt-1 text-[10px] text-ink-soft">
          🕒 Phơi {clock(tem.tg_bd_phoi)}{tem.tg_kt_phoi ? `–${clock(tem.tg_kt_phoi)}` : ''}{dur != null ? ` (${dur}′)` : ''}
        </div>
      )}
    </Node>
  );
}
// KCS node — kèm khối "trả về" (nếu OQC đã trả tem về kiểm lại) đặt ngay dưới, có mũi tên quay về + kết quả OQC.
function KcsNode({ tem, label = 'KCS', traVe }) {
  const kiem = (tem.sl_kcs_dat || 0) + (tem.sl_kcs_sua || 0) + (tem.sl_kcs_huy || 0);
  return (
    <Node title={label} tone="sky" w={148}>
      {kiem > 0 ? (
        <>
          <Q label="Kiểm" v={kiem} />
          <Q label="Đạt" v={tem.sl_kcs_dat} tone="text-emerald-600" />
          {tem.sl_kcs_sua > 0 && <Q label="Sửa" v={tem.sl_kcs_sua} tone="text-amber-600" />}
          {tem.sl_kcs_huy > 0 && <Q label="Hủy" v={tem.sl_kcs_huy} tone="text-danger" />}
          <Who nguoi={tem.kcs_nguoi} tg={tem.kcs_tg} />
        </>
      ) : <span className="text-[11px] text-ink-soft">Chờ KCS</span>}
      <ReturnBack items={traVe} />
    </Node>
  );
}
// `rejected` = OQC lần này KHÔNG ĐẠT (sẽ trả về) → đổi nhãn SL + màu; ô "Trả về" nằm RIÊNG ở chuỗi.
function OqcNode({ nguon, qty, bocMau, bocMauDat, nguoi, tg, rejected }) {
  return (
    <Node title={`OQC (${nguon})`} tone={rejected ? 'danger' : 'violet'} w={150}>
      {rejected
        ? <Q label="OQC (không đạt)" v={qty} tone="text-danger" />
        : <Q label="Qua OQC" v={qty} tone="text-emerald-600" />}
      {bocMau > 0 && <Q label="Bốc mẫu" v={bocMau} />}
      {bocMauDat > 0 && <Q label="Mẫu đạt" v={bocMauDat} tone="text-emerald-600" />}
      <Who nguoi={nguoi} tg={tg} />
    </Node>
  );
}
function GiaoNode({ nguon, lan = 0, qty, nguoi, tg, phieu }) {
  return (
    <Node title={`Giao (${nguon})${lan ? ` · lần ${lan}` : ''}`} tone="emerald" w={150}>
      <Q label="Đã giao" v={qty} tone="text-emerald-600" />
      {phieu && <div className="text-[10px] text-ink-soft">Phiếu {phieu}</div>}
      <Who nguoi={nguoi} tg={tg} />
    </Node>
  );
}

// Đoạn OQC → các LẦN GIAO (giao trước/giao sau) của 1 nguồn: nhiều lần giao → rẽ nhánh từ OQC.
function oqcGiaoSeg(nguon, oqcProps, giaoRecs) {
  const oqcNode = <OqcNode nguon={nguon} {...oqcProps} />;
  if (!giaoRecs.length) return oqcNode;
  const giaoNodes = giaoRecs.map((g, i) => (
    <GiaoNode key={i} nguon={nguon} lan={giaoRecs.length > 1 ? i + 1 : 0}
      qty={g.so_luong_giao} nguoi={g.nguoi} tg={g.tg} phieu={g.ma_phieu_giao} />
  ));
  return <Fork parent={oqcNode} items={giaoNodes} />;
}

// Nhánh Sửa → OQC(Sửa) → các lần giao (dùng chung cho cả 2 chế độ).
function suaBranch(suaQty, suaDat, suaHuy, nguoi, tg, oqcSuaProps, giaoRecSua, traVeSua) {
  return (
    <Chain nodes={[
      <Node key="s" title="Sửa" tone="amber" w={140}>
        <Q label="SL sửa" v={suaQty} />
        {suaDat != null && <Q label="Sửa đạt" v={suaDat} tone="text-emerald-600" />}
        {suaHuy > 0 && <Q label="Sửa hủy" v={suaHuy} tone="text-danger" />}
        <Who nguoi={nguoi} tg={tg} />
        <ReturnBack items={traVeSua} />
      </Node>,
      oqcGiaoSeg('Sửa', oqcSuaProps, giaoRecSua),
    ]} />
  );
}

// Cây 1 tem. Nếu KIỂM 1 lần → KCS →(đạt) OQC→Giao / (lỗi) Sửa→OQC→Giao.
// Nếu KIỂM NHIỀU LẦN (kiểm trước để giao trước) → KCS TỔNG rẽ ra các KCS con (từng lần kiểm),
// mỗi con → đạt→OQC→Giao(lần đó) / lỗi→Sửa→OQC→Giao.
function TemTree({ tem, reg }) {
  if (!tem) return <Node title="Sản xuất" tone="slate" w={150}><span className="text-[11px] text-ink-soft">Chưa in tem</span></Node>;
  const R = reg || (() => undefined);
  const oqcKcs = (tem.sl_oqc_dat || 0) - (tem.sl_oqc_dat_sua || 0);
  const oqcSua = tem.sl_oqc_dat_sua || 0;
  const gr = tem.giao_records || [];
  const giaoRecKcs = gr.filter((g) => g.nguon !== 'SUA');
  const giaoRecSua = gr.filter((g) => g.nguon === 'SUA');
  const kcsRecs = tem.kcs_records || [];
  const trv = tem.tra_ve || [];
  const traVeKcs = trv.filter((r) => r.loai !== 'OQC_SUA'); // OQC trả về → kiểm KCS lại
  const traVeSua = trv.filter((r) => r.loai === 'OQC_SUA'); // OQC trả về → sửa lại

  if (kcsRecs.length >= 2) {
    // Gán các lần giao cho từng lần kiểm theo THỨ TỰ thời gian (kiểm trước ↔ giao trước).
    // Lần kiểm ĐÃ QUA OQC (KHÔNG bị trả về) mới thực sự có hàng đi GIAO → loại lần bị trả về khỏi map giao.
    const datRecs = kcsRecs.filter((r, idx) => (r.so_luong_dat || 0) > 0 && !traVeKcs[idx]);
    const suaRecs = kcsRecs.filter((r) => Math.max((r.so_luong_loi || 0) - (r.so_luong_huy || 0), 0) > 0);
    const giaoMap = new Map(); // record -> { kcs:[], sua:[] }
    kcsRecs.forEach((r) => giaoMap.set(r, { kcs: [], sua: [] }));
    giaoRecKcs.forEach((g, i) => { const r = datRecs[Math.min(i, datRecs.length - 1)]; if (r) giaoMap.get(r).kcs.push(g); });
    giaoRecSua.forEach((g, i) => { const r = suaRecs[Math.min(i, suaRecs.length - 1)]; if (r) giaoMap.get(r).sua.push(g); });

    const kcsBox = (r, i) => {
      const dat = r.so_luong_dat || 0;
      const sua = Math.max((r.so_luong_loi || 0) - (r.so_luong_huy || 0), 0);
      const huy = r.so_luong_huy || 0;
      const kiem = r.so_luong_kiem || (dat + (r.so_luong_loi || 0) + huy);
      return (
        <Node title={`KCS lần ${i + 1}`} tone="sky" w={150}>
          <Q label="Kiểm" v={kiem} />
          <Q label="Đạt" v={dat} tone="text-emerald-600" />
          {sua > 0 && <Q label="Sửa" v={sua} tone="text-amber-600" />}
          {huy > 0 && <Q label="Hủy" v={huy} tone="text-danger" />}
          <Who nguoi={r.nguoi} tg={r.tg} />
        </Node>
      );
    };
    // Rẽ nhánh song song: mỗi lần kiểm là 1 nhánh của KCS tổng.
    // Lần bị OQC TRẢ VỀ → OQC(không đạt) + thêm ĐÚNG 1 NHÁNH TRẢ VỀ (mũi tên đỏ) tới ô "Trả về".
    const kcsChildren = kcsRecs.map((r, i) => {
      const dat = r.so_luong_dat || 0;
      const sua = Math.max((r.so_luong_loi || 0) - (r.so_luong_huy || 0), 0);
      const gm = giaoMap.get(r) || { kcs: [], sua: [] };
      const rej = !!traVeKcs[i];
      const conNode = kcsBox(r, i);
      // Lần bị OQC TRẢ VỀ: OQC(không đạt) + ô Trả về PHÍA TRÊN; mũi tên Trả về→KCS tổng do SVG overlay vẽ.
      const dBranch = rej ? (
        <OqcRejectedBranch
          oqc={<OqcNode nguon="KCS" qty={dat} nguoi={tem.oqc_kcs_nguoi} tg={tem.oqc_kcs_tg} rejected />}
          ret={<ReturnBox item={traVeKcs[i]} />}
          retRef={R(`ret-${tem.tem_id}-${i}`)} />
      ) : (dat > 0 ? oqcGiaoSeg('KCS', { qty: dat, nguoi: tem.oqc_kcs_nguoi, tg: tem.oqc_kcs_tg }, gm.kcs) : null);
      const sBranch = sua > 0 ? suaBranch(sua, null, 0, tem.sua_nguoi, tem.sua_tg, { qty: sua, nguoi: tem.oqc_sua_nguoi, tg: tem.oqc_sua_tg }, gm.sua) : null;
      if (!dBranch && !sBranch) return conNode;
      return <Fork key={i} parent={conNode} items={[dBranch, sBranch]} />;
    });
    return (
      <div className="flex items-center">
        <TemNode tem={tem} />
        <Link />
        <Fork parent={<span ref={R(`kt-${tem.tem_id}`)} className="inline-flex">{<KcsNode tem={tem} label="KCS tổng" />}</span>} items={kcsChildren} />
      </div>
    );
  }

  // Kiểm 1 lần (mặc định)
  const branchKcs = tem.sl_kcs_dat > 0
    ? oqcGiaoSeg('KCS', { qty: oqcKcs, bocMau: tem.oqc_kcs_boc_mau, bocMauDat: tem.oqc_kcs_boc_mau_dat, nguoi: tem.oqc_kcs_nguoi, tg: tem.oqc_kcs_tg }, giaoRecKcs)
    : null;
  const branchSua = tem.sl_kcs_sua > 0
    ? suaBranch(tem.sl_kcs_sua, tem.sl_sua_dat, tem.sl_sua_huy, tem.sua_nguoi, tem.sua_tg,
      { qty: oqcSua, bocMau: tem.oqc_sua_boc_mau, bocMauDat: tem.oqc_sua_boc_mau_dat, nguoi: tem.oqc_sua_nguoi, tg: tem.oqc_sua_tg }, giaoRecSua, traVeSua)
    : null;

  return (
    <div className="flex items-center">
      <TemNode tem={tem} />
      <Link />
      <Fork parent={<KcsNode tem={tem} traVe={traVeKcs} />} items={[branchKcs, branchSua]} />
    </div>
  );
}

export default function TinhTrangTramPage() {
  const { toast, show } = useToast();
  const [list, setList] = useState([]);
  const [idx, setIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [graph, setGraph] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  // Overlay SVG: nối ô "Trả về" → ô "KCS tổng" (khác nhánh) theo vị trí DOM thật.
  const graphWrapRef = useRef(null);
  const boxRefs = useRef({});
  const [svg, setSvg] = useState({ w: 0, h: 0, lines: [] });
  const reg = useCallback((key) => (el) => {
    if (el) boxRefs.current[key] = el; else delete boxRefs.current[key];
  }, []);
  const recomputeArrows = useCallback(() => {
    const wrap = graphWrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const boxes = boxRefs.current;
    const lines = [];
    Object.keys(boxes).forEach((key) => {
      if (!key.startsWith('ret-')) return;
      const rest = key.slice(4); // "<temId>-<i>"
      const temId = rest.slice(0, rest.lastIndexOf('-'));
      const retEl = boxes[key]; const ktEl = boxes[`kt-${temId}`];
      if (!retEl || !ktEl) return;
      const rb = retEl.getBoundingClientRect(); const kb = ktEl.getBoundingClientRect();
      const retCx = rb.left - wr.left + rb.width / 2;
      const retTop = rb.top - wr.top;
      const ktCx = kb.left - wr.left + kb.width / 2;
      const ktTop = kb.top - wr.top;
      const topY = Math.max(2, Math.min(retTop, ktTop) - 14);
      // Trả về (đỉnh) → lên → sang trái → xuống VÀO KCS tổng (đầu mũi tên chỉ xuống).
      lines.push({ key, pts: `${retCx},${retTop} ${retCx},${topY} ${ktCx},${topY} ${ktCx},${ktTop}` });
    });
    const w = wrap.scrollWidth; const h = wrap.scrollHeight;
    setSvg((prev) => (JSON.stringify(prev) === JSON.stringify({ w, h, lines }) ? prev : { w, h, lines }));
  }, []);

  // Tìm rỗng → 1 phần in ĐANG Ở TRẠM GIAO mới nhất (fallback: mới nhất theo đợt vải);
  // có nhập → tối đa 30 khớp (KHÔNG tải hết vài ngàn phần in).
  const loadList = useCallback(async () => {
    try {
      const l = await listTinhTrangPhanIn({ search, limit: search.trim() ? 30 : 1 });
      setList(l.data.items);
      setIdx(0);
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); }
  }, [search, show]);

  useEffect(() => { const t = setTimeout(loadList, 300); return () => clearTimeout(t); }, [loadList]);
  useSocketEvent('dashboard:refresh', loadList);
  useSocketEvent('production:updated', loadList);

  const current = list[idx];

  useEffect(() => {
    if (!current) { setGraph(null); return undefined; }
    let alive = true;
    getTinhTrangGraph(current.id).then((r) => { if (alive) setGraph(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (delta) => setIdx((i) => (list.length ? (i + delta + list.length) % list.length : 0));
  // Quét QR code phần → điền ô tìm kiếm → ra phần in.
  const onScan = (code) => { setScanOpen(false); const c = baseMaTem((code || '').trim()); if (c) setSearch(c); };

  const allLenh = graph ? graph.ready_cycles.flatMap((c) => c.lenh) : [];
  const agg = graph ? allLenh.reduce((a, l) => {
    a.release += l.so_luong_release || 0;
    l.tems.forEach((t) => {
      a.in += t.so_luong || 0; a.kcs_dat += t.sl_kcs_dat || 0; a.sua += t.sl_kcs_sua || 0;
      a.sua_dat += t.sl_sua_dat || 0; a.oqc_dat += t.sl_oqc_dat || 0; a.giao += t.sl_da_giao || 0;
      a.huy += (t.sl_kcs_huy || 0) + (t.sl_sua_huy || 0);
      a.tra_ve += (t.tra_ve || []).length;
    });
    return a;
  }, { release: 0, in: 0, kcs_dat: 0, sua: 0, sua_dat: 0, oqc_dat: 0, giao: 0, huy: 0, tra_ve: 0 }) : null;

  // Sau khi vẽ cây (mọi lần render / resize) → tính lại toạ độ mũi tên overlay (guard chống lặp trong recompute).
  useLayoutEffect(() => {
    const id = requestAnimationFrame(recomputeArrows);
    return () => cancelAnimationFrame(id);
  });
  useEffect(() => {
    const on = () => recomputeArrows();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [recomputeArrows]);

  // 1 đợt SX → cây tem.
  const lenhTree = (l) => (
    <Fork key={l.id} parent={<LenhNode lenh={l} />}
      items={(l.tems.length ? l.tems : [null]).map((t, i) => <TemTree key={t ? t.tem_id : `x${i}`} tem={t} reg={reg} />)} />
  );
  // Mỗi CHU KỲ READY = 1 nhánh: ReadyNode → các đợt SX của chu kỳ đó (+ đợt vải chờ release).
  const cycleBranches = graph ? graph.ready_cycles.map((cy, ci) => (
    <Fork key={ci} parent={<ReadyNode checklists={cy.checklists} lan={graph.ready_cycles.length > 1 ? ci + 1 : 0} />}
      items={[
        ...cy.lenh.map(lenhTree),
        ...(cy.pending || []).map((d) => (
          <Node key={d.id} title="Đợt vải chờ release" tone="slate" w={170}>
            <Q label="Vải về" v={d.so_luong_vai_ve} />
            <div className="text-[11px] text-amber-600">Chờ release (READY)</div>
          </Node>
        )),
      ]} />
  )) : [];

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-ink">Sơ đồ phần in</h1>
        <p className="text-sm text-ink-soft">Nhập/quét QR code phần để xem sơ đồ cây: phần in → READY (theo từng lần) → đợt sản xuất → tem → KCS → (OQC-KCS / Sửa→OQC-Sửa) → Giao.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Nhập code phần / đơn / màu / kích vải / kích phim..."
            className="h-11 w-full rounded-input border border-line bg-surface pl-9 pr-3 text-sm" />
        </div>
        <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR code phần</Button>
        {list.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => go(-1)} className="rounded-control border border-line px-3 py-2 text-sm hover:bg-surface-muted"><Icon name="chevron-left" size={16} /></button>
            <span className="text-sm text-ink-soft tabular-nums">{idx + 1}/{list.length}</span>
            <button onClick={() => go(1)} className="rounded-control border border-line px-3 py-2 text-sm hover:bg-surface-muted"><Icon name="chevron-right" size={16} /></button>
          </div>
        )}
      </div>

      {!current ? (
        <div className="card p-12 text-center text-ink-soft">
          {search.trim() ? `Không tìm thấy phần in khớp "${search.trim()}".` : 'Nhập code phần hoặc quét QR để xem sơ đồ.'}
        </div>
      ) : !graph ? (
        <div className="card p-12 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-primary/30 bg-primary-wash px-4 py-3">
            <Icon name="package" size={20} className="text-primary" />
            <div>
              <div className="text-lg font-bold text-ink">{graph.phan_in.ma_phan}</div>
              <div className="text-sm text-ink-soft">{[graph.phan_in.ten_khach_hang, graph.phan_in.ma_don_hang, graph.phan_in.ma_hang].filter(Boolean).join(' · ')}</div>
              <div className="text-xs text-ink-soft">{[graph.phan_in.mau_vai, graph.phan_in.kich_vai, graph.phan_in.kich_phim].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {graph.phan_in.la_in_kieng && <Badge tone="warning">In kiếng</Badge>}
              <Badge tone="info">{graph.dot_vai.length} đợt vải</Badge>
              <Badge tone="default">{allLenh.length} đợt SX</Badge>
              {graph.ready_cycles.length > 1 && <Badge tone="warning">{graph.ready_cycles.length} lần READY</Badge>}
            </div>
          </div>

          {/* Tổng số lượng */}
          {agg && (agg.release > 0 || agg.in > 0) && (
            <div className="flex flex-wrap gap-2">
              {agg.release > 0 && <Badge tone="info">Release {fmtNum(agg.release)}</Badge>}
              {agg.in > 0 && <Badge tone="default">In {fmtNum(agg.in)} pcs</Badge>}
              {agg.kcs_dat > 0 && <Badge tone="success">KCS đạt {fmtNum(agg.kcs_dat)}</Badge>}
              {agg.sua > 0 && <Badge tone="warning">Qua sửa {fmtNum(agg.sua)}</Badge>}
              {agg.sua_dat > 0 && <Badge tone="success">Sửa đạt {fmtNum(agg.sua_dat)}</Badge>}
              {agg.huy > 0 && <Badge tone="danger">Tổng hủy {fmtNum(agg.huy)}</Badge>}
              {agg.tra_ve > 0 && <Badge tone="danger">↩ Bị trả về {fmtNum(agg.tra_ve)} lần</Badge>}
              {agg.oqc_dat > 0 && <Badge tone="success">OQC đạt {fmtNum(agg.oqc_dat)}</Badge>}
              {agg.giao > 0 && <Badge tone="success">Đã giao {fmtNum(agg.giao)}</Badge>}
              {agg.in > 0 && (agg.kcs_dat > 0 || agg.huy > 0) && <Badge tone="info">% sau kiểm {pct(agg.kcs_dat, agg.in)}%</Badge>}
              {agg.in > 0 && agg.sua_dat > 0 && <Badge tone="info">% sau sửa {pct(agg.kcs_dat + agg.sua_dat, agg.in)}%</Badge>}
            </div>
          )}

          {/* SƠ ĐỒ CÂY */}
          {cycleBranches.length === 0 ? (
            <div className="py-4 text-center text-sm text-ink-soft">Phần in chưa có đợt sản xuất.</div>
          ) : (
            <div className="overflow-x-auto pb-3">
              <div ref={graphWrapRef} className="relative flex items-center" style={{ minWidth: 'min-content' }}>
                {/* Lớp SVG vẽ mũi tên TRẢ VỀ → KCS tổng (nối 2 ô khác nhánh, theo vị trí DOM thật) */}
                <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={svg.w} height={svg.h} aria-hidden="true">
                  <defs>
                    <marker id="tt-arrow" markerWidth="9" markerHeight="9" refX="6" refY="3.2" orient="auto">
                      <path d="M0,0 L6,3.2 L0,6.4 Z" fill="#EF4444" />
                    </marker>
                  </defs>
                  {svg.lines.map((ln) => (
                    <polyline key={ln.key} points={ln.pts} fill="none" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#tt-arrow)" />
                  ))}
                </svg>
                <Fork
                  parent={(
                    <Node title="Phần in" tone="primary" w={150}>
                      <div className="text-[11px] font-bold text-ink">{graph.phan_in.ma_phan}</div>
                      <div className="text-[10px] text-ink-soft">{graph.phan_in.mau_vai || ''}</div>
                      <Q label="Đợt vải" v={graph.dot_vai.length} />
                      <Q label="Đợt SX" v={allLenh.length} />
                    </Node>
                  )}
                  items={cycleBranches}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={onScan} title="Quét QR code phần" />
      <Toast toast={toast} />
    </div>
  );
}
