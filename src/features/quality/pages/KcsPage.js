import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import OwnerHint from '../../../components/common/OwnerHint';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import TemJourneyPanel from '../../../components/common/TemJourneyPanel';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listKcsCandidates, recordKcs, kcsHistory, kcsDone, getTemHanhTrinh } from '../../../services/qualityService';
import { redryTem } from '../../../services/productionService';
import { fmtNum } from '../../../utils/format';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';

const empty = { soLuongDat: '', soLuongHu: '', soLuongSua: '', soLuongHuy: '', soLuongThieu: '', soLuongDu: '', soLuongMau: '' };

export default function KcsPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canKcs = can('KCS');
  const now = useNow(1000);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [redry, setRedry] = useState(null); // tem đang phơi lại
  const [redryMin, setRedryMin] = useState('30');
  const [redrying, setRedrying] = useState(false);
  const [onlyReturned, setOnlyReturned] = useState(false); // lọc tem bị OQC trả về
  const [journey, setJourney] = useState(null); // { temId, maTem } — panel hành trình

  const viewRows = onlyReturned ? rows.filter((r) => r.tra_ve_ly_do) : rows;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listKcsCandidates({ search });
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Prefill SL đạt = SL còn cần kiểm (con_kcs). Kiểm từng phần nhiều lần.
  const open = (row) => { setEditing(row); setForm({ ...empty, soLuongDat: String(row.con_kcs ?? row.so_luong ?? '') }); };

  const doRedry = async () => {
    setRedrying(true);
    try {
      await redryTem(redry.tem_id, Number(redryMin) || 0);
      show(`Đã đưa tem ${redry.ma_tem} phơi lại ${redryMin} phút — hết giờ tự quay lại KCS`);
      setRedry(null);
      load();
    } catch (e) {
      show(e.message || 'Phơi lại thất bại', 'error');
    } finally {
      setRedrying(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await recordKcs(editing.tem_id, form);
      const d = r.data;
      const conLai = Number(d.con_kcs) || 0;
      show(`KCS ${editing.ma_tem}: Đạt ${fmtNum(d.so_luong_dat)}→OQC · Sửa ${fmtNum(d.so_luong_sua)} · Hủy ${fmtNum(d.so_luong_huy)}`
        + (conLai > 0 ? ` · còn ${fmtNum(conLai)} chờ kiểm` : ' · đã kiểm hết'));
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'ma_tem', header: 'Tem', render: (r) => (
      <div>
        <Badge tone="info">{r.ma_tem}</Badge>
        {r.tra_ve_ly_do && <div className="mt-1"><Badge tone="danger" title={r.tra_ve_ly_do}>Bị OQC trả về</Badge></div>}
      </div>
    ) },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'con_kcs', header: 'Còn kiểm', className: 'text-right tabular-nums font-medium text-primary', render: (r) => fmtNum(r.con_kcs) },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canKcs && (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="px-3 py-1.5"
            onClick={(e) => { e.stopPropagation(); setJourney({ temId: r.tem_id, maTem: r.ma_tem }); }}>Hành trình</Button>
          <Button variant="ghost" className="px-3 py-1.5"
            onClick={(e) => { e.stopPropagation(); setRedry(r); setRedryMin('30'); }}>Phơi lại</Button>
          <Button className="px-3 py-1.5" onClick={() => open(r)}>Kiểm KCS</Button>
        </div>
      ) },
  ];

  const N = (k) => (
    <Field label={k.label} key={k.f}>
      <Input type="number" min="0" value={form[k.f]}
        onChange={k.onChange || ((e) => setForm((prev) => ({ ...prev, [k.f]: e.target.value })))} />
    </Field>
  );

  // Nhập "SL hư" → kế thừa sang "Quyết định sửa" (vẫn sửa lại được; không đổi ngược lại SL hư).
  const onChangeHu = (e) => {
    const v = e.target.value;
    setForm((prev) => ({ ...prev, soLuongHu: v, soLuongSua: v }));
  };

  return (
    <div>
      <Toolbar title="KCS — Kiểm tra chất lượng" subtitle="Kiểm theo tem (tem đã khô)"
        search={search} onSearch={setSearch} searchPlaceholder="Quét/nhập mã tem...">
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={onlyReturned} onChange={(e) => setOnlyReturned(e.target.checked)} />
          Chỉ hiện tem bị trả về
        </label>
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{rows.length} tem chờ kiểm</Badge>
      </Toolbar>

      <OwnerHint tram="KIEM" className="mb-3" />

      <DataTable columns={columns} rows={viewRows} loading={loading} rowKey="tem_id"
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có tem nào chờ KCS" />

      <SidePanel
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`KCS — ${editing?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving}>Xác nhận KCS</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {editing?.ma_lenh_san_xuat} · {editing?.phan_list} · SL in {fmtNum(editing?.so_luong)}
          <span className="ml-1 font-semibold text-primary">· còn cần kiểm {fmtNum(editing?.con_kcs)}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          {N({ f: 'soLuongDat', label: 'Số lượng đạt' })}
          {N({ f: 'soLuongHu', label: 'Số lượng hư', onChange: onChangeHu })}
          {N({ f: 'soLuongSua', label: 'Quyết định sửa (≤ hư)' })}
          {N({ f: 'soLuongHuy', label: 'Số lượng hủy' })}
          {N({ f: 'soLuongThieu', label: 'Số lượng thiếu' })}
          {N({ f: 'soLuongDu', label: 'Số lượng dư' })}
          {N({ f: 'soLuongMau', label: 'Số lượng mẫu (không tính)' })}
        </div>
        <p className="text-xs text-ink-soft">
          SL kiểm lần này = <b>đạt + hư + hủy</b> ≤ còn cần kiểm. <b>Quyết định sửa</b> (≤ hư, mặc định = hư) → phần hư không sửa sẽ <b>hủy</b>.
          <b>Dư (+) / thiếu (−)</b> điều chỉnh tổng cần kiểm; <b>mẫu không tính</b>. Đạt → chờ <b>OQC</b> · Sửa → <b>Sửa</b> (xong lại qua OQC) · (hư không sửa + hủy) → loại. Phần chưa kiểm giữ lại kiểm lần sau.
        </p>
      </SidePanel>

      <Modal
        open={!!redry}
        onClose={() => setRedry(null)}
        title={`Phơi lại — ${redry?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRedry(null)}>Hủy</Button>
            <Button onClick={doRedry} loading={redrying} disabled={!redryMin || Number(redryMin) <= 0}>Phơi lại</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-soft">
          Đưa tem về <b>đang phơi</b> với thời gian nhập vào. Hết giờ tem <b>tự động quay lại KCS</b>.
        </p>
        <Field label="Thời gian phơi lại (phút)" required>
          <Input type="number" min="1" value={redryMin} onChange={(e) => setRedryMin(e.target.value)} />
        </Field>
      </Modal>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử KCS" fetcher={kcsHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Tem đã KCS" maHeader="Tem" fetcher={kcsDone} />
      {journey && (
        <TemJourneyPanel temId={journey.temId} maTem={journey.maTem}
          fetcher={getTemHanhTrinh} onClose={() => setJourney(null)} />
      )}

      <Toast toast={toast} />
    </div>
  );
}
