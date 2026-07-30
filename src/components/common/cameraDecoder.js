// Giải mã CAMERA đa định dạng (QR + mã vạch 1D) bằng ZXing — lazy import để không phình bundle.
// Dùng chung cho QrScanner (1 lần) và ScanCollectModal (liên tục). Cần HTTPS (getUserMedia).

let modPromise = null;
function loadZxing() {
  if (!modPromise) modPromise = import('@zxing/library');
  return modPromise;
}

// ⚠⚠ KHÔNG dùng `reader.decodeFromConstraints()` — LỖI ĐÃ GẶP THẬT (iPhone, PWA "Thêm vào màn hình
// chính", 2026-07-30: camera lên hình nhưng quét mãi không ra gì). Trong @zxing/library 0.21.3:
//     decodeFromStream:  await attachStreamToVideo(...)   // chờ EVENT 'playing'
//                        await decodeContinuously(...)    // ⇒ CHỈ giải mã SAU khi có 'playing'
// mà `attachStreamToVideo` → `playVideoOnLoad` → `tryPlayVideo` gọi `video.play()` trong try/catch và
// chỉ `console.warn('It was not possible to play the video.')` khi bị chặn. iOS chặn autoplay khá dễ
// (chuỗi `await` import zxing + getUserMedia làm MẤT ngữ cảnh user-gesture, PWA standalone càng dễ)
// ⇒ 'playing' KHÔNG BAO GIỜ bắn ⇒ promise treo vĩnh viễn ⇒ `decodeContinuously` KHÔNG BAO GIỜ chạy.
// Triệu chứng: thấy hình (hoặc đen) mà không quét được mã nào, KHÔNG có lỗi nào hiện ra.
// ⇒ Ta TỰ xin stream, TỰ gắn vào <video>, TỰ play(), rồi gọi thẳng `decodeContinuously` — vòng lặp này
// độc lập (chỉ vẽ frame lên canvas rồi decode), không phụ thuộc event 'playing'.
// Nếu play() bị chặn: vẫn bắt đầu vòng giải mã + trả cờ để UI mời người dùng BẤM vào khung (bấm =
// user-gesture thật ⇒ iOS cho phát). Đừng quay lại dùng decodeFromConstraints.

// Gắn stream + phát video theo cách iOS chấp nhận (muted + playsinline + autoplay là bắt buộc).
async function attachAndPlay(videoEl, stream) {
  videoEl.setAttribute('autoplay', 'true');
  videoEl.setAttribute('muted', 'true');
  videoEl.setAttribute('playsinline', 'true');
  videoEl.muted = true;            // React đặt prop `muted` không luôn ra attribute → set thẳng
  videoEl.playsInline = true;
  videoEl.srcObject = stream;
  try {
    await videoEl.play();
    return true;
  } catch (_) {
    return false; // iOS chặn autoplay — cần người dùng bấm vào khung (xem playVideo bên dưới)
  }
}

// Độ dài tối thiểu của mã THẬT trong hệ (barcode HSKT 12 · barcode đợt vải 14 · code phần 16–24).
// Dùng 8 để còn dư biên nhưng vẫn chặn được rác 1D (thường 3–6 ký tự).
const MIN_CODE_LEN = 8;

// Cho UI gọi lại trong 1 cú BẤM thật (user-gesture) khi autoplay bị chặn.
export function playVideo(videoEl) {
  if (!videoEl) return Promise.resolve(false);
  videoEl.muted = true;
  return videoEl.play().then(() => true).catch(() => false);
}

// Bắt đầu quét liên tục trên 1 <video>; **onDecode(text, kieu)** mỗi lần đọc được —
// `kieu` = 'qr' (QR code → quy ước: CODE PHẦN) hoặc 'barcode' (mã vạch 1D → quy ước: BARCODE HSKT).
// Trả về hàm stop(); stop.autoplayBlocked = true nếu play() bị chặn (UI nên mời bấm vào khung).
// Ném lỗi khi không mở được camera (caller hiện thông báo qua cameraErrorMessage).
// `kind`: 'qr' = CHỈ quét QR · 'barcode' = CHỈ quét mã vạch 1D.
// ⚠⚠ TÁCH RIÊNG 2 CHẾ ĐỘ (chốt 2026-07-30) — trước đây quét CHUNG cả QR + 7 định dạng 1D trong cùng
// một vòng: mỗi frame ZXing phải dò lần lượt nhiều reader nên **QR rất khó "qua"**, thực tế trên iPhone
// quét mãi không ra QR (còn reader 1D thì đọc bừa ra rác từ đường kẻ bảng của phiếu). Chỉ để 1 reader
// cho mỗi chế độ ⇒ nhanh & chắc hơn nhiều. ĐỪNG gộp lại thành "đa định dạng" nữa.
export async function startCameraDecode(videoEl, onDecode, kind = 'qr') {
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
  const F = zx.BarcodeFormat;
  // ⚠ KHÔNG thêm **CODABAR**: nó là máy sinh mã RÁC trên giấy có kẻ bảng — lỗi đã gặp thật (2026-07-30,
  // quét phiếu ở QC READY ra `AB$B`: CODABAR dùng A–D làm start/stop và có `$` trong charset).
  const formats = kind === 'barcode'
    ? [F.CODE_128, F.CODE_39, F.ITF, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E] // HSKT 12 số · đợt vải 14
    : [F.QR_CODE];                                                        // code phần / mã tem
  const hints = new Map([
    [zx.DecodeHintType.POSSIBLE_FORMATS, formats],
    [zx.DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new zx.BrowserMultiFormatReader(hints);

  // ⚠ ĐỘ PHÂN GIẢI QUYẾT ĐỊNH việc đọc được QR: ZXing `drawFrameOnCanvas` decode ở ĐÚNG
  // `videoWidth × videoHeight`, mà mặc định iOS hay chỉ cho 640×480 ⇒ QR nhỏ trên phiếu dày chữ
  // (code phần ~20 ký tự) bị mờ, không đọc nổi. Xin 1920×1080 + lấy nét liên tục.
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      // focusMode chưa chuẩn hóa — bọc `advanced` để trình duyệt không hỗ trợ thì BỎ QUA, không lỗi.
      advanced: [{ focusMode: 'continuous' }],
    },
  });
  let playing = false;
  try {
    playing = await attachAndPlay(videoEl, stream);
    // Vòng lặp giải mã CHẠY NGAY, không chờ event 'playing' (xem ghi chú đầu file).
    reader.decodeContinuously(videoEl, (result) => {
      if (!result) return; // mỗi lần không thấy mã, ZXing trả NotFoundException — bỏ qua
      const text = String(result.getText() || '').trim();
      if (!text) return;
      // QR → code phần · còn lại (1D) → barcode HSKT. Caller dùng `kieu` để tra đúng cột.
      const kieu = result.getBarcodeFormat && result.getBarcodeFormat() === F.QR_CODE ? 'qr' : 'barcode';
      // LỌC MÃ RÁC — CHỈ áp cho 1D: reader 1D đọc bừa từ đường kẻ bảng thường ra 3–6 ký tự (vd `AB$B`)
      // ⇒ bỏ IM LẶNG, không log, để không spam "Không thấy ..." che mất kết quả thật.
      // QR có checksum mạnh, gần như không đọc sai ⇒ KHÔNG lọc theo độ dài (mã tem `TEM00001` chỉ 8).
      if (kieu === 'barcode' && text.length < MIN_CODE_LEN) return;
      onDecode(text, kieu);
    });
  } catch (e) {
    stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) { /* noop */ } });
    throw e;
  }

  const stop = () => {
    try { reader.stopContinuousDecode(); } catch (_) { /* noop */ }
    try { reader.reset(); } catch (_) { /* noop */ }
    stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) { /* noop */ } });
    try { videoEl.srcObject = null; } catch (_) { /* noop */ }
  };
  stop.autoplayBlocked = !playing;
  return stop;
}

export function cameraErrorMessage(e) {
  const name = e && e.name;
  if (name === 'NotAllowedError') return 'Bạn đã từ chối quyền camera — cho phép rồi thử lại.';
  if (name === 'NotFoundError') return 'Không tìm thấy camera trên thiết bị.';
  if (name === 'NoMediaError') return 'Trình duyệt không hỗ trợ camera (cần chạy trên HTTPS).';
  if (name === 'NoVideoElementError') return 'Chưa dựng được khung hình — đóng rồi mở lại giúp mình.';
  return `Không mở được camera: ${(e && (e.message || e.name)) || ''}`;
}
