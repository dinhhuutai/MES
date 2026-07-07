import { useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import { FORM_TEMPLATES } from '../formTemplates';
import exportFormExcel from '../utils/exportFormExcel';

export default function FormTemplatesPage() {
  const { toast, show } = useToast();
  const [busy, setBusy] = useState(null); // id form đang xuất

  const doExport = async (form) => {
    setBusy(form.id);
    try {
      await exportFormExcel(form);
      show(`Đã tải Excel mẫu "${form.ten}"`);
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Toolbar title="Mẫu form (tem / phiếu)"
        subtitle="Lưu bố cục các form in. Bấm Xuất Excel để tải mẫu — gửi cho người cần chỉnh, sửa xong đưa lại để thiết kế theo." />

      <div className="grid gap-4 md:grid-cols-2">
        {FORM_TEMPLATES.map((form) => (
          <div key={form.id} className="card flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink">{form.ten}</h3>
                <p className="mt-1 text-sm text-ink-soft">{form.moTa}</p>
              </div>
              <Icon name="file-spreadsheet" size={22} className="shrink-0 text-emerald-600" />
            </div>

            <div className="rounded-control border border-line bg-surface-muted/50 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Kích thước thật</div>
              <ul className="space-y-0.5 text-xs text-ink">
                {form.kichThuoc.map((k) => <li key={k}>• {k}</li>)}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{form.tems.length} tem</Badge>
              {form.tems.map((t) => <Badge key={t.ten} tone="default">{t.ten}</Badge>)}
            </div>

            <div className="mt-auto flex justify-end">
              <Button icon="download" onClick={() => doExport(form)} loading={busy === form.id}>
                Xuất Excel
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Toast toast={toast} />
    </div>
  );
}
