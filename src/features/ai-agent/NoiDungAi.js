import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Lightbulb } from 'lucide-react';
import exportPanelExcel from '../../components/common/exportPanelExcel';

// ═════════════════════════════════════════════════════════════════════════════
// HIỂN THỊ CÂU TRẢ LỜI CỦA AGENT (Markdown rút gọn, 19/11/2026) — tự dựng phần tử React, KHÔNG chèn HTML thô
// (câu trả lời đến từ model ngoài ⇒ không tin). Hỗ trợ: tiêu đề #, **đậm**, *nghiêng*, `mã`, [link](/duong-dan),
// danh sách -, 1., bảng |…|, khối ```mã```. Link nội bộ (/…) mở màn MES; link ngoài mở tab mới.
// Mỗi bảng có nút "Xuất Excel". Đoạn bắt đầu "Gợi ý cải tiến" ⇒ khung vàng tới hết câu trả lời.
// ═════════════════════════════════════════════════════════════════════════════

const RE_INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g;

function Inline({ text, moLink }) {
  const phan = String(text || '').split(RE_INLINE).filter((x) => x !== '');
  return phan.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
      return <code key={i} className="rounded bg-surface-muted px-1 py-0.5 text-[0.85em]">{p.slice(1, -1)}</code>;
    }
    const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
    if (m) {
      const [, nhan, url] = m;
      if (url.startsWith('/') && !url.startsWith('//')) {
        return (
          <a key={i} href={url} onClick={(e) => { e.preventDefault(); moLink(url); }} className="font-medium text-primary underline-offset-2 hover:underline">
            {nhan}
          </a>
        );
      }
      if (/^https?:\/\//i.test(url)) {
        return <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{nhan}</a>;
      }
      return <Fragment key={i}>{nhan}</Fragment>;
    }
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

const tachO = (dong) => dong.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((x) => x.trim());
const boMarkdown = (s) => String(s || '').replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const soVN = (s) => {
  const t = boMarkdown(s).trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$|^-?\d+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  return t;
};

/** Cắt văn bản thành khối. */
function chiaKhoi(text) {
  const dong = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const khoi = [];
  let i = 0;
  while (i < dong.length) {
    const d = dong[i];
    if (/^```/.test(d.trim())) {
      const ma = [];
      i += 1;
      while (i < dong.length && !/^```/.test(dong[i].trim())) { ma.push(dong[i]); i += 1; }
      i += 1;
      khoi.push({ loai: 'ma', text: ma.join('\n') });
    } else if (/^\s*\|.*\|\s*$/.test(d) && i + 1 < dong.length && /^\s*\|?\s*:?-{2,}/.test(dong[i + 1])) {
      const dau = tachO(d);
      i += 2;
      const hang = [];
      while (i < dong.length && /^\s*\|.*\|\s*$/.test(dong[i])) { hang.push(tachO(dong[i])); i += 1; }
      khoi.push({ loai: 'bang', dau, hang });
    } else if (/^\s*#{1,4}\s+/.test(d)) {
      khoi.push({ loai: 'tieu_de', text: d.replace(/^\s*#{1,4}\s+/, '') });
      i += 1;
    } else if (/^\s*([-*•]|\d+[.)])\s+/.test(d)) {
      const coSo = /^\s*\d+[.)]\s+/.test(d);
      const muc = [];
      while (i < dong.length && /^\s*([-*•]|\d+[.)])\s+/.test(dong[i])) {
        muc.push(dong[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
        i += 1;
      }
      khoi.push({ loai: coSo ? 'ol' : 'ul', muc });
    } else if (!d.trim()) {
      i += 1;
    } else {
      const doan = [];
      while (i < dong.length && dong[i].trim() && !/^\s*(\||#{1,4}\s|```|([-*•]|\d+[.)])\s+)/.test(dong[i])) { doan.push(dong[i].trim()); i += 1; }
      if (!doan.length) { doan.push(d.trim()); i += 1; }
      khoi.push({ loai: 'doan', text: doan.join(' ') });
    }
  }
  return khoi;
}

function BangAi({ k, moLink }) {
  const xuat = () => exportPanelExcel({
    title: 'Agent MES THLA',
    fileName: 'agent-mes-thla',
    cols: k.dau.map((h, ci) => ({ header: boMarkdown(h), width: 18, value: (r) => soVN(r[ci]), num: false })),
    rows: k.hang,
  });
  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-control border border-line bg-surface">
        <table className="w-full border-collapse text-[12.5px] tabular-nums">
          <thead>
            <tr>{k.dau.map((h, i) => <th key={i} className="whitespace-nowrap border-b border-line px-2.5 py-1.5 text-left text-[11.5px] font-semibold text-ink-soft"><Inline text={h} moLink={moLink} /></th>)}</tr>
          </thead>
          <tbody>
            {k.hang.map((r, ri) => (
              <tr key={ri} className="border-b border-line last:border-0">
                {k.dau.map((_, ci) => <td key={ci} className="whitespace-nowrap px-2.5 py-1.5 text-ink"><Inline text={r[ci] || ''} moLink={moLink} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={xuat} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 text-[11.5px] font-medium text-primary hover:bg-primary-wash">
        <FileSpreadsheet size={13} /> Xuất Excel
      </button>
    </div>
  );
}

function Khoi({ k, moLink }) {
  if (k.loai === 'ma') return <pre className="overflow-x-auto rounded-control bg-surface-muted p-2 text-[12px]">{k.text}</pre>;
  if (k.loai === 'bang') return <BangAi k={k} moLink={moLink} />;
  if (k.loai === 'tieu_de') return <p className="font-semibold text-ink"><Inline text={k.text} moLink={moLink} /></p>;
  if (k.loai === 'ul' || k.loai === 'ol') {
    const The = k.loai;
    return (
      <The className={`${k.loai === 'ol' ? 'list-decimal' : 'list-disc'} space-y-1 pl-5`}>
        {k.muc.map((m, i) => <li key={i}><Inline text={m} moLink={moLink} /></li>)}
      </The>
    );
  }
  return <p><Inline text={k.text} moLink={moLink} /></p>;
}

export default function NoiDungAi({ text, onMoLink }) {
  const navigate = useNavigate();
  const moLink = (url) => { if (onMoLink) onMoLink(url); navigate(url); };
  const khoi = chiaKhoi(text);
  const viTriGoiY = khoi.findIndex((k) => k.loai === 'doan' && /^\**\s*gợi ý cải tiến/i.test(k.text));
  const truoc = viTriGoiY < 0 ? khoi : khoi.slice(0, viTriGoiY);
  const goiY = viTriGoiY < 0 ? [] : khoi.slice(viTriGoiY);
  return (
    <div className="space-y-2 break-words">
      {truoc.map((k, i) => <Khoi key={i} k={k} moLink={moLink} />)}
      {goiY.length > 0 && (
        <div className="space-y-1.5 rounded-control border border-amber-300 bg-amber-50 p-2.5 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            <Lightbulb size={14} /> Gợi ý cải tiến
          </div>
          {goiY.map((k, i) => (
            <Khoi key={i} k={i === 0 ? { ...k, text: k.text.replace(/^\**\s*gợi ý cải tiến\s*:?\s*\**\s*:?\s*/i, '') } : k} moLink={moLink} />
          ))}
        </div>
      )}
    </div>
  );
}
