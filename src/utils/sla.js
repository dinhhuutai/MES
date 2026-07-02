// Tiện ích SLA dùng chung cho các màn trạm + dashboard + kiosk.
// Tính trạng thái SLA từ thời điểm vào trạm (tg_vao) so với SLA + ngưỡng cảnh báo trước.

// evalSla(tgVao, slaPhut, canhBaoPhut, now) → { phut, status }
//   status: 'OK' (đúng hạn) | 'SAP_NGHEN' (sắp hết) | 'NGHEN' (đã quá SLA)
//   now: mili-giây (Date.now()); tgVao: chuỗi ISO/timestamp.
export function evalSla(tgVao, slaPhut, canhBaoPhut, now = Date.now()) {
  const phut = tgVao ? Math.floor((now - new Date(tgVao).getTime()) / 60000) : 0;
  const sla = Number(slaPhut) || 0;
  const cb = Number(canhBaoPhut) || 0;
  let status = 'OK';
  if (sla > 0) {
    if (phut > sla) status = 'NGHEN';
    else if (phut >= sla - cb) status = 'SAP_NGHEN';
  }
  return { phut, status };
}

// Class nền cho 1 hàng bảng theo trạng thái SLA (dùng với DataTable rowClassName).
export function slaRowClass(status) {
  if (status === 'NGHEN') return 'bg-rose-50 dark:bg-rose-950/30';
  if (status === 'SAP_NGHEN') return 'bg-amber-50 dark:bg-amber-950/30';
  return '';
}

// Nhãn + tone badge theo trạng thái SLA.
export const SLA_BADGE = {
  NGHEN: { tone: 'danger', label: 'Nghẽn' },
  SAP_NGHEN: { tone: 'warning', label: 'Sắp nghẽn' },
  OK: { tone: 'success', label: 'Đúng hạn' },
};

// Định dạng khoảng thời gian (phút) → "45′" hoặc "2h05′".
export function fmtDur(m) {
  if (m == null) return '—';
  if (m < 60) return `${m}′`;
  const h = Math.floor(m / 60);
  return `${h}h${String(m % 60).padStart(2, '0')}′`;
}
