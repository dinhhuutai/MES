// Giải mã CAMERA đa định dạng (QR + mã vạch 1D) bằng ZXing — lazy import để không phình bundle.
// Dùng chung cho QrScanner (1 lần) và ScanCollectModal (liên tục). Cần HTTPS (getUserMedia).

let modPromise = null;
function loadZxing() {
  if (!modPromise) modPromise = import('@zxing/library');
  return modPromise;
}

// Bắt đầu quét liên tục trên 1 <video>; **onDecode(text, kieu)** mỗi lần đọc được —
// `kieu` = 'qr' (QR code → quy ước: CODE PHẦN) hoặc 'barcode' (mã vạch 1D → quy ước: BARCODE HSKT).
// Trả về hàm stop(). Ném lỗi khi không mở được camera (caller hiện thông báo qua cameraErrorMessage).
export async function startCameraDecode(videoEl, onDecode) {
  // ⚠ BẮT BUỘC có thẻ <video> THẬT trong DOM. ZXing `prepareVideoElement(null)` sẽ âm thầm TỰ TẠO
  // một <video> KHÔNG gắn DOM rồi phát stream vào đó ⇒ camera bật nhưng khung trên màn hình ĐEN,
  // không lỗi, không cách nào biết (lỗi đã gặp thật: Modal Headless UI mount qua Portal nên lần
  // render đầu chưa có thẻ video → ref còn null). Chặn tại đây để lỗi hiện ra tường minh.
  if (!videoEl) {
    const e = new Error('no-video-el'); e.name = 'NoVideoElementError'; throw e;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const e = new Error('no-media'); e.name = 'NoMediaError'; throw e;
  }
  const zx = await loadZxing();
  // Giới hạn danh sách định dạng + TRY_HARDER: điện thoại đọc mã vạch 1D (HSKT) nhạy hơn hẳn so với
  // để ZXing dò TẤT CẢ định dạng (dò thừa vừa chậm vừa hay trượt vạch mảnh).
  const F = zx.BarcodeFormat;
  const hints = new Map([
    [zx.DecodeHintType.POSSIBLE_FORMATS, [
      F.QR_CODE,                                    // QR → code phần
      F.CODE_128, F.CODE_39, F.ITF, F.CODABAR,      // mã vạch 1D → barcode HSKT
      F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E,
    ]],
    [zx.DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new zx.BrowserMultiFormatReader(hints);
  await reader.decodeFromConstraints(
    { video: { facingMode: 'environment' } },
    videoEl,
    (result) => {
      if (!result) return;
      const t = result.getText();
      if (!t) return;
      // QR → code phần · còn lại (1D) → barcode HSKT. Caller dùng `kieu` để tra đúng cột.
      const kieu = result.getBarcodeFormat && result.getBarcodeFormat() === F.QR_CODE ? 'qr' : 'barcode';
      onDecode(String(t).trim(), kieu);
    },
  );
  return () => { try { reader.reset(); } catch (_) { /* noop */ } };
}

export function cameraErrorMessage(e) {
  const name = e && e.name;
  if (name === 'NotAllowedError') return 'Bạn đã từ chối quyền camera — cho phép rồi thử lại.';
  if (name === 'NotFoundError') return 'Không tìm thấy camera trên thiết bị.';
  if (name === 'NoMediaError') return 'Trình duyệt không hỗ trợ camera (cần chạy trên HTTPS).';
  if (name === 'NoVideoElementError') return 'Chưa dựng được khung hình — đóng rồi mở lại giúp mình.';
  return `Không mở được camera: ${(e && (e.message || e.name)) || ''}`;
}
