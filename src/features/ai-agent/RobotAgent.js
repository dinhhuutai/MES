import { useMemo } from 'react';
import { ROBOT_DEFS, robotSvg } from './robot';
import './agent.css';

// Robot Agent MES THLA dùng chung (khung chat, robot nổi, chọn mẫu ở Thông tin cá nhân).
// Chuỗi SVG tự sinh trong code (không có dữ liệu người dùng) ⇒ chèn HTML an toàn.

/** Gradient / filter dùng chung — gắn ở nơi có robot (trùng id giống hệt nhau thì vô hại). */
export function RobotDefs() {
  return (
    <svg className="agt-defs" aria-hidden="true" focusable="false">
      {/* eslint-disable-next-line react/no-danger */}
      <defs dangerouslySetInnerHTML={{ __html: ROBOT_DEFS }} />
    </svg>
  );
}

export default function RobotAgent({ trangThai = 'chao', dau = false, mau, className = '' }) {
  const html = useMemo(() => robotSvg(trangThai, dau, mau), [trangThai, dau, mau]);
  // eslint-disable-next-line react/no-danger
  return <span className={`block ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
