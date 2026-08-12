import { useCallback, useEffect, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import Spinner from '../../../components/common/Spinner';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { Field, Input, Select, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import { fmtNum, fmtDate } from '../../../utils/format';
import {
  traCuuPhanIn, getQuanTriPhanIn, suaPhanIn, suaDotVai,
  datGiaiDoan, huyDotVaiQt, moDotVaiQt, huyMucReady,
} from '../../../services/quanTriPhanInService';

// ─────────────────────────────────────────────────────────────────────────────
// QUẢN TRỊ PHẦN IN — một chỗ gỡ rối mọi thứ của 1 phần in (mig 078, quyền `PHAN_IN_ADMIN`).
//
// ⚠⚠ GIAI ĐOẠN KHÔNG PHẢI MỘT CỘT trong DB — nó được SUY từ trạng thái runtime (lệnh/phiếu/tem/
//   xác nhận READY). Nút "Đặt lại giai đoạn" vì thế KHÔNG ghi trạm mà DỰNG LẠI trạng thái tương ứng
//   (hủy lệnh / hạ duyệt / hủy xác nhận), bằng chính các service chạy ngoài giao diện. Xem
//   CLAUDE.md §7 + DATABASE.md §11.5 trước khi đổi gì ở đây.
// ─────────────────────────────────────────────────────────────────────────────

const DICH_LIST = [
  { v: 'READY_KT', ten: 'READY (Kỹ thuật)', mo_ta: 'Hủy lệnh + hủy CẢ Khuôn/Film/Mực + QC — kỹ thuật làm lại từ đầu' },
  { v: 'READY_QA', ten: 'READY (QA)', mo_ta: 'Hủy lệnh + hủy QC, GIỮ 3 mục kỹ thuật — chỉ QC xác nhận lại' },
  { v: 'RELEASE_1', ten: 'Release 1', mo_ta: 'Hủy lệnh, GIỮ nguyên xác nhận READY — đợt vải về lại pool Release 1' },
  { v: 'TEST_RUN', ten: 'Test Run', mo_ta: 'Hạ lệnh Release 2 → Release 1 (giữ lệnh) — chỉ dùng khi lệnh đang ở Release 2' },
];

const TONE_GIAI_DOAN = (g) => {
  if (!g) return 'default';
  if (g.startsWith('READY')) return 'warning';
  if (g === 'DA_GIAO') return 'success';
  if (g === 'SAN_XUAT' || g === 'CHO_KHO') return 'info';
  return 'default';
};

// Ô sửa tại chỗ: gom các trường của 1 bản ghi, bấm Lưu mới gửi.
function KhoiSua({ tieuDe, truong, ban_dau, onLuu, dangLuu }) {
  const [v, setV] = useState(ban_dau);
  useEffect(() => { setV(ban_dau); }, [ban_dau]);
  const doi = JSON.stringify(v) !== JSON.stringify(ban_dau);
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{tieuDe}</h3>
        <Button disabled={!doi} loading={dangLuu} onClick={() => onLuu(v)}>Lưu</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {truong.map((t) => (
          <Field key={t.key} label={t.label} hint={t.hint}>
            {t.options ? (
              <Select value={v[t.key] ?? ''} onChange={(e) => setV({ ...v, [t.key]: e.target.value })}>
                <option value="">— Chọn —</option>
                {t.options.map((o) => <option key={o.id} value={o.id}>{o.ten}</option>)}
              </Select>
            ) : t.type === 'bool' ? (
              <Select value={v[t.key] ? '1' : '0'} onChange={(e) => setV({ ...v, [t.key]: e.target.value === '1' })}>
                <option value="0">Không</option><option value="1">Có</option>
              </Select>
            ) : (
              <Input type={t.type || 'text'} value={v[t.key] ?? ''}
                onChange={(e) => setV({ ...v, [t.key]: e.target.value })} />
            )}
          </Field>
        ))}
      </div>
    </div>
  );
}

export default function QuanTriPhanInPage() {
  const { toast, show } = useToast();
  const [q, setQ] = useState('');
  const [ds, setDs] = useState([]);
  const [dangTim, setDangTim] = useState(false);
  const [chon, setChon] = useState(null);      // phan_in_id
  const [data, setData] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);

  const [giaiDoanModal, setGiaiDoanModal] = useState(null); // { dot, dich, lyDo }
  const [huyModal, setHuyModal] = useState(null);           // { dot, lyDo }
  const [xacNhanMo, setXacNhanMo] = useState(null);         // dot

  const tim = useCallback(async () => {
    setDangTim(true);
    try { setDs((await traCuuPhanIn(q)).data || []); } catch (e) { show(e.message || 'Lỗi tra cứu', 'error'); } finally { setDangTim(false); }
  }, [q, show]);

  const tai = useCallback(async (id, ngam = false) => {
    if (!id) return;
    if (!ngam) setDangTai(true);
    try { setData((await getQuanTriPhanIn(id)).data); } catch (e) { show(e.message || 'Lỗi tải', 'error'); } finally { setDangTai(false); }
  }, [show]);

  useEffect(() => { const t = setTimeout(tim, 300); return () => clearTimeout(t); }, [tim]);
  useEffect(() => { tai(chon); }, [chon, tai]);

  const pin = data?.phan_in;

  const luuPhanIn = async (v) => {
    setDangLuu(true);
    try { await suaPhanIn(chon, v); show('Đã cập nhật phần in'); await tai(chon, true); }
    catch (e) { show(e.message || 'Lưu thất bại', 'error'); } finally { setDangLuu(false); }
  };
  const luuDotVai = async (id, v) => {
    setDangLuu(true);
    try { await suaDotVai(id, v); show('Đã cập nhật đợt vải'); await tai(chon, true); }
    catch (e) { show(e.message || 'Lưu thất bại', 'error'); } finally { setDangLuu(false); }
  };

  const doDatGiaiDoan = async () => {
    const { dot, dich, lyDo } = giaiDoanModal || {};
    if (!dich) { show('Chọn giai đoạn đích', 'error'); return; }
    if (!String(lyDo || '').trim()) { show('Nhập lý do', 'error'); return; }
    setDangLuu(true);
    try {
      const r = await datGiaiDoan(dot.id, { dich, lyDo });
      show(`Đã đưa đợt ${dot.ma_dot_vai} về ${r.data?.nhan || dich}`);
      setGiaiDoanModal(null); await tai(chon, true);
    } catch (e) { show(e.message || 'Đặt giai đoạn thất bại', 'error'); } finally { setDangLuu(false); }
  };

  const doHuyDot = async () => {
    const { dot, lyDo } = huyModal || {};
    if (!String(lyDo || '').trim()) { show('Nhập lý do hủy', 'error'); return; }
    setDangLuu(true);
    try {
      const r = await huyDotVaiQt([dot.id], lyDo);
      const loi = r.data?.loi?.[0];
      if (loi) show(`Không hủy được: ${loi.ly_do || loi}`, 'error');
      else show(`Đã hủy đợt vải ${dot.ma_dot_vai}`);
      setHuyModal(null); await tai(chon, true);
    } catch (e) { show(e.message || 'Hủy thất bại', 'error'); } finally { setDangLuu(false); }
  };

  const doMoDot = async () => {
    const dot = xacNhanMo;
    setDangLuu(true);
    try {
      const r = await moDotVaiQt([dot.id]);
      const loi = r.data?.loi?.[0];
      if (loi) show(`Không mở được: ${loi.ly_do || loi}`, 'error');
      else show(`Đã mở lại đợt vải ${dot.ma_dot_vai}`);
      setXacNhanMo(null); await tai(chon, true);
    } catch (e) { show(e.message || 'Mở lại thất bại', 'error'); } finally { setDangLuu(false); }
  };

  const doHuyMuc = async (ma) => {
    setDangLuu(true);
    try {
      const r = await huyMucReady(chon, [ma]);
      const huy = r.data?.muc_huy || [];
      show(huy.length ? `Đã hủy xác nhận: ${huy.join(', ')}` : 'Mục này chưa được xác nhận');
      await tai(chon, true);
    } catch (e) { show(e.message || 'Hủy thất bại', 'error'); } finally { setDangLuu(false); }
  };

  return (
    <div className="space-y-4">
      <Toolbar
        title="Quản trị phần in"
        subtitle="Xem toàn cảnh 1 phần in rồi sửa thông tin, đặt lại giai đoạn theo từng đợt vải, hủy/mở đợt vải"
      >
        <div className="flex items-center gap-2">
          <Input placeholder="Code phần · mã vạch · mã đợt vải · mã hàng · khách"
            value={q} onChange={(e) => setQ(e.target.value)} />
          {dangTim && <Spinner size={16} />}
        </div>
      </Toolbar>

      <div className="rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <b>Trang gỡ rối — thao tác ở đây ghi đè dữ liệu thật.</b> Mọi thay đổi đều được ghi nhật ký
        (ai · lúc nào · giá trị cũ → mới). Giai đoạn không phải một ô dữ liệu: đặt lại giai đoạn nghĩa là
        hệ thống <b>hủy lệnh / hạ duyệt / hủy xác nhận</b> cho đúng chặng đó.
      </div>

      {/* Kết quả tra cứu */}
      {!chon && (
        <div className="rounded-card border border-line bg-surface">
          {ds.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-soft">
              {q ? 'Không tìm thấy phần in nào' : 'Nhập từ khóa để tra cứu phần in'}
            </div>
          ) : ds.map((r) => (
            <button key={r.id} type="button" onClick={() => setChon(r.id)}
              className="flex w-full items-center justify-between border-b border-line/60 px-4 py-3 text-left last:border-0 hover:bg-surface-muted">
              <div>
                <div className="font-medium text-ink">
                  {r.ma_phan}
                  {!r.dang_hoat_dong && <Badge tone="danger" className="ml-2">Đã hủy</Badge>}
                </div>
                <div className="text-xs text-ink-soft">
                  {[r.ten_khach_hang, r.ma_don_hang, r.ma_hang, r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="text-xs text-ink-soft">{r.so_dot_vai} đợt vải</div>
            </button>
          ))}
        </div>
      )}

      {chon && (
        <div className="space-y-4">
          <button type="button" onClick={() => { setChon(null); setData(null); }}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <Icon name="chevron-left" size={16} /> Chọn phần in khác
          </button>

          {dangTai || !pin ? <div className="py-10 text-center"><Spinner size={22} /></div> : (
            <>
              <div className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-ink">{pin.ma_phan}</h2>
                  {!pin.dang_hoat_dong && <Badge tone="danger">Phần in đã hủy (xóa mềm)</Badge>}
                  {pin.barcode && <Badge tone="info">TDTHĐH {pin.barcode}</Badge>}
                  {pin.barcode_hskt && <Badge>HSKT {pin.barcode_hskt}</Badge>}
                </div>
                <div className="mt-1 text-sm text-ink-soft">
                  {[pin.ten_khach_hang, pin.ma_don_hang, pin.ma_hang].filter(Boolean).join(' · ')}
                </div>
              </div>

              {/* 4 mục READY */}
              <div className="rounded-card border border-line bg-surface p-4">
                <h3 className="mb-3 text-sm font-semibold text-ink">Xác nhận READY</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {(data.ready || []).map((m) => (
                    <div key={m.ma_checkpoint} className="rounded-control border border-line px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-ink">{m.ten_checkpoint || m.ma_checkpoint}</span>
                        {m.trang_thai === 'DAT'
                          ? <Badge tone="success">Đã xác nhận</Badge>
                          : <Badge tone="warning">Chưa</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-ink-soft">
                        {m.trang_thai === 'DAT' ? `${m.nguoi || '—'} · ${fmtDate(m.tg_xac_nhan)}` : '—'}
                      </div>
                      {m.trang_thai === 'DAT' && (
                        <button type="button" disabled={dangLuu} onClick={() => doHuyMuc(m.ma_checkpoint)}
                          className="mt-1 text-xs text-danger hover:underline">Hủy xác nhận</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <KhoiSua
                tieuDe="Thông tin phần in"
                dangLuu={dangLuu}
                onLuu={luuPhanIn}
                ban_dau={{
                  mau_vai: pin.mau_vai || '', kich_vai: pin.kich_vai || '', kich_phim: pin.kich_phim || '',
                  tinh_chat_in: pin.tinh_chat_in || '', barcode: pin.barcode || '',
                  so_luong_don_hang: pin.so_luong_don_hang ?? '',
                  thoi_gian_cho_kho_phut: pin.thoi_gian_cho_kho_phut ?? '',
                  la_in_kieng: !!pin.la_in_kieng, ghi_chu: pin.ghi_chu || '',
                }}
                truong={[
                  { key: 'mau_vai', label: 'Màu vải' },
                  { key: 'kich_vai', label: 'Kích vải' },
                  { key: 'kich_phim', label: 'Kích phim' },
                  { key: 'tinh_chat_in', label: 'Tính chất in' },
                  { key: 'barcode', label: 'Mã vạch TDTHĐH', hint: 'Mã vạch của CHÍNH phần in (ERP BarcodePTHDH)' },
                  { key: 'so_luong_don_hang', label: 'SL đơn hàng', type: 'number' },
                  { key: 'thoi_gian_cho_kho_phut', label: 'Thời gian chờ khô (phút)', type: 'number' },
                  { key: 'la_in_kieng', label: 'In kiếng', type: 'bool' },
                  { key: 'ghi_chu', label: 'Ghi chú' },
                ]}
              />

              {/* Đợt vải */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-ink">Đợt vải ({(data.dot_vai || []).length})</h3>
                {(data.dot_vai || []).map((d) => (
                  <div key={d.id} className={`rounded-card border bg-surface p-4 ${d.trang_thai === 'DA_HUY' ? 'border-danger/40 opacity-70' : 'border-line'}`}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{d.ma_dot_vai}</span>
                        <Badge tone={TONE_GIAI_DOAN(d.giai_doan)}>{d.giai_doan_ten || d.giai_doan || 'Chưa vào dòng chảy'}</Badge>
                        {d.trang_thai === 'DA_HUY' && <Badge tone="danger">Đã hủy</Badge>}
                        {d.ma_set && <Badge tone="info">Gom set {d.ma_set}</Badge>}
                        {d.can_lam_lai_ready && <Badge tone="warning">Phải làm lại READY</Badge>}
                        {d.ma_lenh_san_xuat && (
                          <span className="text-xs text-ink-soft">
                            {d.ma_lenh_san_xuat} · {d.lenh_trang_thai} · {d.ten_chuyen || 'chưa gán chuyền'}
                            {Number(d.so_phieu) > 0 ? ` · ${d.so_phieu} phiếu · ${d.so_tem} tem` : ''}
                            {Number(d.so_phan_in_trong_lenh) > 1 ? ` · lệnh gom ${d.so_phan_in_trong_lenh} phần in` : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {d.trang_thai === 'DA_HUY' ? (
                          <Button variant="secondary" onClick={() => setXacNhanMo(d)}>Mở lại đợt</Button>
                        ) : (
                          <>
                            <Button variant="secondary" onClick={() => setGiaiDoanModal({ dot: d, dich: '', lyDo: '' })}>
                              Đặt lại giai đoạn
                            </Button>
                            <Button variant="danger" onClick={() => setHuyModal({ dot: d, lyDo: '' })}>Hủy đợt</Button>
                          </>
                        )}
                      </div>
                    </div>

                    <KhoiSua
                      tieuDe={`Thông tin đợt vải — SL vải về ${fmtNum(d.so_luong_vai_ve)}`}
                      dangLuu={dangLuu}
                      onLuu={(v) => luuDotVai(d.id, v)}
                      ban_dau={{
                        so_luong_vai_ve: d.so_luong_vai_ve ?? '',
                        han_giao_hang: (d.han_giao_hang || '').slice(0, 10),
                        ngay_vai_ve: (d.ngay_vai_ve || '').slice(0, 10),
                        barcode: d.barcode || '',
                        nha_gia_cong: d.nha_gia_cong || '',
                        loai_dot_vai_id: d.loai_dot_vai_id || '',
                        can_lam_lai_ready: !!d.can_lam_lai_ready,
                        ghi_chu: d.ghi_chu || '',
                      }}
                      truong={[
                        { key: 'so_luong_vai_ve', label: 'SL vải về', type: 'number', hint: 'Không hạ dưới SL đã in tem' },
                        { key: 'han_giao_hang', label: 'Hạn giao', type: 'date' },
                        { key: 'ngay_vai_ve', label: 'Ngày vải về', type: 'date' },
                        { key: 'barcode', label: 'Barcode đợt vải', hint: 'Mã đợt READY từ ERP (IDDotReady)' },
                        { key: 'nha_gia_cong', label: 'Nhà gia công' },
                        { key: 'loai_dot_vai_id', label: 'Loại đợt vải', options: (data.loai_dot_vai || []).map((x) => ({ id: x.id, ten: x.ten_loai })) },
                        { key: 'can_lam_lai_ready', label: 'Phải làm lại READY', type: 'bool' },
                        { key: 'ghi_chu', label: 'Ghi chú' },
                      ]}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal đặt lại giai đoạn */}
      <Modal open={!!giaiDoanModal} onClose={() => setGiaiDoanModal(null)} size="md"
        title={`Đặt lại giai đoạn — ${giaiDoanModal?.dot?.ma_dot_vai || ''}`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setGiaiDoanModal(null)}>Đóng</Button>
            <Button variant="danger" loading={dangLuu} onClick={doDatGiaiDoan}>Xác nhận đặt lại</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <div className="rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
            Đang ở: <b className="text-ink">{giaiDoanModal?.dot?.giai_doan_ten || '—'}</b>
            {giaiDoanModal?.dot?.ma_lenh_san_xuat && <> · lệnh {giaiDoanModal.dot.ma_lenh_san_xuat} ({giaiDoanModal.dot.lenh_trang_thai})</>}
          </div>
          <Field label="Đưa về" required>
            <div className="space-y-2">
              {DICH_LIST.map((o) => (
                <label key={o.v} className="flex cursor-pointer items-start gap-2 rounded-control border border-line px-3 py-2 hover:bg-surface-muted">
                  <input type="radio" name="dich" className="mt-1" checked={giaiDoanModal?.dich === o.v}
                    onChange={() => setGiaiDoanModal({ ...giaiDoanModal, dich: o.v })} />
                  <span>
                    <span className="block text-sm font-medium text-ink">{o.ten}</span>
                    <span className="block text-xs text-ink-soft">{o.mo_ta}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Lý do" required hint="Bắt buộc — lưu vào nhật ký để truy vết">
            <Textarea rows={2} value={giaiDoanModal?.lyDo || ''}
              onChange={(e) => setGiaiDoanModal({ ...giaiDoanModal, lyDo: e.target.value })} />
          </Field>
          {Number(giaiDoanModal?.dot?.so_tem) > 0 && (
            <div className="rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              Lệnh này đã in {giaiDoanModal.dot.so_tem} tem — hệ thống sẽ CHẶN nếu tem đã qua KCS/Sửa/OQC/giao.
            </div>
          )}
        </div>
      </Modal>

      {/* Modal hủy đợt vải */}
      <Modal open={!!huyModal} onClose={() => setHuyModal(null)} size="sm"
        title={`Hủy đợt vải — ${huyModal?.dot?.ma_dot_vai || ''}`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setHuyModal(null)}>Đóng</Button>
            <Button variant="danger" loading={dangLuu} onClick={doHuyDot}>Hủy đợt vải</Button>
          </>
        )}
      >
        <p className="mb-3 text-sm text-ink-soft">
          Đợt vải sẽ bị ẩn khỏi hệ thống (xóa mềm). Đợt <b>đã release</b> sẽ bị chặn — hủy lệnh trước.
          Phần in và các đợt còn lại giữ nguyên; mở lại được ở chính trang này.
        </p>
        <Field label="Lý do" required>
          <Textarea rows={2} value={huyModal?.lyDo || ''} onChange={(e) => setHuyModal({ ...huyModal, lyDo: e.target.value })} />
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!xacNhanMo}
        title="Mở lại đợt vải"
        message={`Mở lại đợt ${xacNhanMo?.ma_dot_vai || ''}? Đợt sẽ quay lại dòng chảy ở trạng thái trước khi hủy.`}
        confirmText="Mở lại"
        onClose={() => setXacNhanMo(null)}
        onConfirm={doMoDot}
      />
      <Toast toast={toast} />
    </div>
  );
}
