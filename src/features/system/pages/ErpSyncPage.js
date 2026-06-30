import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { syncPhieuNhanVai, syncHistory, syncRaw } from '../../../services/erpService';
import { fmtNum } from '../../../utils/format';

const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');
const TONE = { THANH_CONG: 'success', DANG_CHAY: 'warning', LOI: 'danger' };
const LABEL = { THANH_CONG: 'Thành công', DANG_CHAY: 'Đang chạy', LOI: 'Lỗi' };

function downloadText(text, name) {
  const blob = new Blob([text || ''], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function ErpSyncPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canSync = can('ERP_SYNC');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Panel dữ liệu gốc (chuỗi response nguyên văn)
  const [raw, setRaw] = useState(null); // { log, text, loading }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await syncHistory(50);
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const doSync = async () => {
    setBusy(true);
    try {
      const res = await syncPhieuNhanVai();
      const d = res.data;
      show(`Đồng bộ xong: ${d.soMoi} mới · ${d.soCapNhat} cập nhật · ${d.soBoQua || 0} bỏ qua · ${d.soLoi} lỗi (tổng ${d.tong})`,
        d.soLoi && d.tong === 0 ? 'error' : 'success');
      load();
    } catch (e) {
      show(e.message || 'Đồng bộ thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openRaw = async (log) => {
    setRaw({ log, text: '', loading: true });
    try {
      const res = await syncRaw(log.id);
      setRaw({ log, text: res.data?.chuoi_tho || '', loading: false });
    } catch (e) {
      show(e.message || 'Lỗi tải dữ liệu gốc', 'error');
      setRaw(null);
    }
  };

  const columns = [
    { key: 'tg_bd', header: 'Bắt đầu', render: (r) => fmtDt(r.tg_bd) },
    { key: 'tg_kt', header: 'Kết thúc', render: (r) => fmtDt(r.tg_kt) },
    { key: 'tu_dong', header: 'Kiểu', render: (r) => r.tu_dong ? <Badge tone="info">Tự động</Badge> : <Badge tone="default">Thủ công</Badge> },
    { key: 'tong_ban_ghi', header: 'Tổng', className: 'text-right tabular-nums', render: (r) => fmtNum(r.tong_ban_ghi) },
    { key: 'so_moi', header: 'Mới', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_moi) },
    { key: 'so_cap_nhat', header: 'Cập nhật', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_cap_nhat) },
    { key: 'so_loi', header: 'Lỗi', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_loi) },
    { key: 'trang_thai', header: 'Trạng thái', render: (r) => <Badge tone={TONE[r.trang_thai] || 'default'}>{LABEL[r.trang_thai] || r.trang_thai}</Badge> },
    { key: 'nguoi', header: 'Người', render: (r) => r.tu_dong ? 'Hệ thống' : (r.nguoi || '—') },
  ];

  return (
    <div>
      <Toolbar title="Đồng bộ ERP" subtitle="Lấy phiếu nhận vải từ ERP (tự động mỗi giờ) — bấm 1 phiên để xem dữ liệu gốc">
        {canSync && <Button icon="loader" loading={busy} onClick={doSync}>Đồng bộ ngay</Button>}
        <Badge tone="info">{rows.length} lần</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={openRaw}
        emptyText="Chưa có lần đồng bộ nào" />

      <SidePanel
        open={!!raw}
        onClose={() => setRaw(null)}
        title="Dữ liệu gốc ERP (nguyên văn, chưa xử lý)"
        subtitle={raw?.log ? `Lần đồng bộ ${fmtDt(raw.log.tg_bd)} · ${fmtNum((raw.text || '').length)} ký tự` : ''}
        width="max-w-5xl"
      >
        {!raw || raw.loading ? (
          <div className="py-10 text-center text-ink-soft">Đang tải...</div>
        ) : !raw.text ? (
          <div className="py-10 text-center text-ink-soft">Lần này không lưu chuỗi gốc (đồng bộ trước khi bật tính năng).</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-soft">Nguyên văn chuỗi API ERP trả về, chưa parse/xử lý.</p>
              <Button variant="secondary" icon="history" className="px-3 py-1.5"
                onClick={() => downloadText(raw.text, `erp-raw-${raw.log?.id}.json`)}>
                Tải file
              </Button>
            </div>
            <pre className="max-h-[70vh] overflow-auto rounded-control border border-line bg-surface-muted p-3 text-xs leading-relaxed text-ink whitespace-pre-wrap break-all">
              {raw.text}
            </pre>
          </div>
        )}
      </SidePanel>

      <Toast toast={toast} />
    </div>
  );
}
