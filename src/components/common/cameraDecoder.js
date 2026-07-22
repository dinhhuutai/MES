// Giải mã CAMERA đa định dạng (QR + mã vạch 1D) bằng ZXing — lazy import để không phình bundle.
// Dùng chung cho QrScanner (1 lần) và ScanCollectModal (liên tục). Cần HTTPS (getUserMedia).

let modPromise = null;
function loadZxing() {
  if (!modPromise) modPromise = import('@zxing/library');
  return modPromise;
}

// Bắt đầu quét liên tục trên 1 <video>; onDecode(text) mỗi lần đọc được (QR hoặc barcode).
// Trả về hàm stop(). Ném lỗi khi không mở được camera (caller hiện thông báo qua cameraErrorMessage).
export async function startCameraDecode(videoEl, onDecode) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const e = new Error('no-media'); e.name = 'NoMediaError'; throw e;
  }
  const zx = await loadZxing();
  const reader = new zx.BrowserMultiFormatReader();
  await reader.decodeFromConstraints(
    { video: { facingMode: 'environment' } },
    videoEl,
    (result) => { if (result) { const t = result.getText(); if (t) onDecode(String(t).trim()); } },
  );
  return () => { try { reader.reset(); } catch (_) { /* noop */ } };
}

export function cameraErrorMessage(e) {
  const name = e && e.name;
  if (name === 'NotAllowedError') return 'Bạn đã từ chối quyền camera — cho phép rồi thử lại.';
  if (name === 'NotFoundError') return 'Không tìm thấy camera trên thiết bị.';
  if (name === 'NoMediaError') return 'Trình duyệt không hỗ trợ camera (cần chạy trên HTTPS).';
  return `Không mở được camera: ${(e && (e.message || e.name)) || ''}`;
}
