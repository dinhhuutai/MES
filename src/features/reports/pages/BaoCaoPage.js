import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import { Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import { listReports, getReport } from '../../../services/dashboardService';

function exportCsv(report) {
  const head = report.columns.map((c) => `"${c.header}"`).join(',');
  const body = report.rows
    .map((r) => report.columns.map((c) => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.ma}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BaoCaoPage() {
  const { toast, show } = useToast();
  const [reports, setReports] = useState([]);
  const [ma, setMa] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listReports().then((r) => {
      setReports(r.data);
      if (r.data[0]) setMa(r.data[0].ma);
    }).catch((e) => show(e.message || 'Lỗi tải', 'error'));
  }, [show]);

  const load = useCallback(async () => {
    if (!ma) return;
    setLoading(true);
    try { setReport((await getReport(ma)).data); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
    finally { setLoading(false); }
  }, [ma, show]);

  useEffect(() => { load(); }, [load]);

  const columns = (report?.columns || []).map((c) => ({ key: c.key, header: c.header, render: (row) => row[c.key] ?? '—' }));

  return (
    <div>
      <Toolbar title="Báo cáo" subtitle="Báo cáo workflow — xuất CSV">
        <Button icon="file-bar-chart" variant="secondary" disabled={!report || report.rows.length === 0}
          onClick={() => exportCsv(report)}>Xuất CSV</Button>
      </Toolbar>

      <div className="mb-4 max-w-sm">
        <Select value={ma} onChange={(e) => setMa(e.target.value)}>
          {reports.map((r) => <option key={r.ma} value={r.ma}>{r.ten}</option>)}
        </Select>
      </div>

      <DataTable columns={columns} rows={(report?.rows || []).map((r, i) => ({ ...r, __idx: i }))}
        loading={loading} rowKey="__idx" emptyText="Báo cáo chưa có dữ liệu" />

      <Toast toast={toast} />
    </div>
  );
}
