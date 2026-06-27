// Hiển thị toast (dùng với hook useToast).
const TONE = {
  success: 'bg-emerald-600',
  error: 'bg-rose-600',
  info: 'bg-primary',
};

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      <div className={`rounded-control px-4 py-3 text-sm font-medium text-white shadow-card-hover ${TONE[toast.type] || TONE.info}`}>
        {toast.message}
      </div>
    </div>
  );
}
