import Icon from '../../components/common/Icon';

// Trang tạm cho các màn hình sẽ làm ở các phase sau.
export default function PlaceholderPage({ title, phase }) {
  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-ink">{title}</h1>
      <p className="mb-6 text-sm text-ink-soft">Màn hình này sẽ được xây dựng ở phase tiếp theo.</p>
      <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-card bg-surface-muted text-ink-soft">
          <Icon name="loader" size={26} />
        </div>
        <div className="text-base font-semibold text-ink">Đang phát triển</div>
        <div className="text-sm text-ink-soft">
          {phase ? `Dự kiến: ${phase}` : 'Khung màn hình đã sẵn sàng, nội dung sẽ bổ sung sau.'}
        </div>
      </div>
    </div>
  );
}
