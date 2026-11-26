import { useCallback, useEffect, useState } from 'react';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import DateRangePicker from '../../../components/common/DateRangePicker';
import HuyLyDoModal from '../../../components/common/HuyLyDoModal';
import { Input } from '../../../components/common/controls';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import { fmtNum, fmtDateTime, ngayLocalISO } from '../../../utils/format';
import { lichSuNhanSua, huyNhanSua, moLaiNhanSua } from '../../../services/qualityService';

// ─────────────────────────────────────────────────────────────────────────────
// BẢNG LƯỢT NHẬN SỬA dùng chung (26/11/2026) — backend `nhansua.service lichSuNhan / huyNhanSua / moLaiNhanSua`:
//   · `cheDo='ls'`  — Lịch sử nhận (trang Sửa › nút "Lịch sử nhận sửa", trang Chờ nhận sửa › tab Lịch sử): mọi lượt theo NGÀY
//     NHẬN; lượt còn hiệu lực có nút "Hủy lượt", lượt đã hủy có nút "Mở lại".
//   · `cheDo='huy'` — *Hủy lệnh xác nhận › Hủy nhận sửa*: lượt CHƯA hủy theo ngày nhận.
//   · `cheDo='mo'`  — *Hủy lệnh xác nhận › Mở lại nhận sửa*: lượt ĐÃ hủy theo NGÀY HỦY.
//   Ô tìm (mã tem / code phần / mã hàng / khách) ⇒ tìm MỌI NGÀY. `search` truyền từ ngoài thì ẩn ô tìm riêng.
// Hủy chỉ khi phần đó chưa sửa (đang sửa ≥ SL lượt); Mở lại chỉ khi tem còn chờ nhận ≥ SL lượt. Cả 2 lý do bắt buộc, quyền SUA;
//   ERP JH0 tự báo hủy / gửi lại.
// ─────────────────────────────────────────────────────────────────────────────
const TRANG_THAI = { ls: '', huy: 'SONG', mo: 'HUY' };

export default function LuotNhanSuaBang({ show, cheDo = 'ls', search: searchNgoai, onDoi }) {
  const { can } = usePermissions();
  const canSua = can('SUA');
  const homNay = ngayLocalISO(new Date());
  const [khoang, setKhoang] = useState({ from: homNay, to: homNay });
  const [searchRieng, setSearchRieng] = useState('');
  const search = (searchNgoai ?? searchRieng).trim();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [huy, setHuy] = useState(null);
  const [mo, setMo] = useState(null);
  const tu = khoang.from || homNay;
  const den = khoang.to || khoang.from || homNay;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await lichSuNhanSua({ tuNgay: tu, denNgay: den, search: search || undefined,
        trangThai: TRANG_THAI[cheDo] || undefined, moiNgay: search ? 1 : undefined });
      setRows(res.data?.items || []);
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải lượt nhận sửa', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tu, den, search, cheDo, show]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useSocketReload(['quality:updated'], () => load(true));

  const xong = (msg) => { show(msg); load(true); if (onDoi) onDoi(); };
  const xacNhanHuy = async (m, lyDo) => {
    try {
      await huyNhanSua(m.id, lyDo);
      setHuy(null);
      xong(`Đã hủy lượt nhận ${fmtNum(m.so_luong)} pcs của tem ${m.ma_tem} — về chờ nhận sửa`);
    } catch (e) { show(e.message || 'Hủy lượt nhận thất bại', 'error'); throw e; }
  };
  const xacNhanMo = async (m, lyDo) => {
    try {
      await moLaiNhanSua(m.id, lyDo);
      setMo(null);
      xong(`Đã mở lại lượt nhận ${fmtNum(m.so_luong)} pcs của tem ${m.ma_tem} — lên lại màn Sửa`);
    } catch (e) { show(e.message || 'Mở lại lượt nhận thất bại', 'error'); throw e; }
  };

  const cot = [
    { key: 'tg_nhan', header: 'Giờ nhận', className: 'whitespace-nowrap', render: (r) => fmtDateTime(r.tg_nhan) },
    { key: 'ma_tem', header: 'Tem', render: (r) => <Badge tone="warning">{r.ma_tem}</Badge> },
    { key: 'khach', header: 'Khách hàng · Mã hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_hang || '—'}</div>
      </div>
    ) },
    { key: 'phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_kich', header: 'Màu · Kích', render: (r) => [r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—' },
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ma_chuyen || '—' },
    { key: 'so_luong', header: 'SL nhận', className: 'text-right tabular-nums font-semibold', render: (r) => fmtNum(r.so_luong) },
    { key: 'nguoi', header: 'Người nhận', render: (r) => (r.loai === 'CU' ? <Badge tone="default">Dữ liệu cũ</Badge> : (r.nguoi_nhan || '—')) },
    { key: 'ghi_chu', header: 'Ghi chú', render: (r) => (r.loai === 'CU' ? '' : (r.ghi_chu || '')) },
    { key: 'thao_tac', header: '', className: 'text-right whitespace-nowrap', render: (r) => {
      if (r.da_huy) {
        return (
          <div className="flex items-start justify-end gap-2 text-right text-xs leading-tight">
            <div>
              <Badge tone="danger">Đã hủy</Badge>
              <div className="mt-0.5 text-ink-soft">{[r.nguoi_huy, r.tg_huy && fmtDateTime(r.tg_huy)].filter(Boolean).join(' · ')}</div>
              {r.ly_do_huy && <div className="text-ink-soft">{r.ly_do_huy}</div>}
            </div>
            {canSua && cheDo !== 'huy' && (r.mo_lai_duoc
              ? <Button variant="secondary" className="px-2.5 py-1 text-xs" icon="undo" onClick={() => setMo(r)}>Mở lại</Button>
              : <span className="text-ink-soft" title="Phần này đã được nhận lại bằng lượt khác / đã hủy tem sửa">Không mở lại được</span>)}
          </div>
        );
      }
      if (!canSua || cheDo === 'mo') return null;
      return r.huy_duoc
        ? <Button variant="ghost" className="px-2.5 py-1 text-xs" icon="x" onClick={() => setHuy(r)}>Hủy lượt</Button>
        : <span className="text-xs text-ink-soft" title="Đã sửa tới phần của lượt này">Đã sửa</span>;
    } },
  ];

  const tongNhan = rows.filter((r) => !r.da_huy).reduce((s, r) => s + (Number(r.so_luong) || 0), 0);
  const tongHuy = rows.filter((r) => r.da_huy).reduce((s, r) => s + (Number(r.so_luong) || 0), 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span>{cheDo === 'mo' ? 'Ngày hủy' : 'Ngày nhận'}</span>
          <div className={`w-64 ${search ? 'pointer-events-none opacity-50' : ''}`} title={search ? 'Đang tìm mọi ngày theo ô tìm' : undefined}>
            <DateRangePicker value={khoang} onChange={setKhoang} placeholder="Chọn khoảng ngày" />
          </div>
        </div>
        {searchNgoai === undefined && (
          <div className="w-72">
            <Input value={searchRieng} onChange={(e) => setSearchRieng(e.target.value)} placeholder="Tìm mã tem / code phần (mọi ngày)..." />
          </div>
        )}
        <span className="ml-auto text-xs text-ink-soft">
          {fmtNum(rows.length)} lượt
          {cheDo !== 'mo' && <> · đang hiệu lực <b className="text-ink">{fmtNum(tongNhan)}</b> pcs</>}
          {cheDo !== 'huy' && tongHuy > 0 && <> · đã hủy <b className="text-ink">{fmtNum(tongHuy)}</b> pcs</>}
        </span>
      </div>

      <DataTable columns={cot} rows={rows} loading={loading} rowKey="id"
        emptyText={search ? 'Không có lượt nhận sửa nào khớp ô tìm'
          : cheDo === 'mo' ? 'Không có lượt nhận sửa nào bị hủy trong khoảng ngày này' : 'Chưa có lượt nhận sửa nào trong khoảng ngày này'} />

      <HuyLyDoModal muc={huy} onClose={() => setHuy(null)} onXacNhan={xacNhanHuy} tieuDe="Hủy lượt nhận sửa"
        nhanNut="Hủy lượt nhận" ghiChuErp="Lượt đã gửi ERP (JH0) thì hệ thống tự báo ERP hủy."
        moTa={(m) => `Tem ${m.ma_tem} · nhận ${fmtNum(m.so_luong)} pcs lúc ${fmtDateTime(m.tg_nhan)}`}
        hauQua="Số này rời màn Sửa, quay về Chờ nhận sửa." goiY="Vì sao hủy (vd: nhập nhầm số lượng nhận)..." />
      <HuyLyDoModal muc={mo} onClose={() => setMo(null)} onXacNhan={xacNhanMo} tieuDe="Mở lại lượt nhận sửa"
        nhanNut="Mở lại" kieuNut="primary" nhanLyDo="Lý do mở lại" ghiChuErp="Hệ thống gửi lại ERP (JH0) cho lượt này."
        moTa={(m) => `Tem ${m.ma_tem} · nhận ${fmtNum(m.so_luong)} pcs lúc ${fmtDateTime(m.tg_nhan)} · đã hủy ${m.tg_huy ? fmtDateTime(m.tg_huy) : ''}${m.ly_do_huy ? ` — ${m.ly_do_huy}` : ''}`}
        hauQua="Số này lên lại màn Sửa (đang sửa), trừ khỏi Chờ nhận sửa." goiY="Vì sao mở lại (vd: hủy nhầm lượt)..." />
    </div>
  );
}
