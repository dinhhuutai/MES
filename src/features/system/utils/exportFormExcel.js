// Xuất 1 form ra file Excel (.xlsx) có ô gộp + viền để người dùng chỉnh sửa bố cục.
// Lazy import exceljs để không phình bundle chính (chỉ tải khi bấm Xuất Excel).

const THIN = { style: 'thin', color: { argb: 'FF000000' } };
const ALL_THIN = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const GRAY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1F1' } };

function writeGridSheet(ws, tem, sizeNote) {
  ws.columns = Array.from({ length: tem.cols }, () => ({ width: 15 }));
  const note = ws.addRow([sizeNote]);
  note.font = { italic: true, size: 9, color: { argb: 'FF666666' } };
  ws.mergeCells(note.number, 1, note.number, tem.cols);
  ws.addRow([]);

  tem.rows.forEach((cells) => {
    const values = [];
    let col = 1;
    const plan = [];
    cells.forEach((c) => {
      values[col - 1] = c.t;
      const cs = c.cs || 1;
      plan.push({ col, cs, k: c.k });
      col += cs;
    });
    const r = ws.addRow(values);
    r.height = 22;
    // Viền + căn giữa cho MỌI ô của hàng (kể cả ô sẽ bị gộp) → khung hiện đủ.
    for (let c = 1; c <= tem.cols; c += 1) {
      const cell = r.getCell(c);
      cell.border = ALL_THIN;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }
    // Gộp ô + style theo kiểu cell.
    plan.forEach((p) => {
      if (p.cs > 1) ws.mergeCells(r.number, p.col, r.number, p.col + p.cs - 1);
      const cell = r.getCell(p.col);
      if (p.k === 'lbl' || p.k === 'th') {
        cell.font = { bold: true, size: 10 };
        cell.fill = GRAY;
        if (p.k === 'lbl') cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else if (p.k === 'hd') {
        cell.font = { bold: true, size: 13 };
      } else if (p.k === 'val') {
        cell.font = { bold: true, size: 11 };
      }
    });
  });
}

export default async function exportFormExcel(form) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'THLA MES';
  wb.created = new Date();

  // Sheet Hướng dẫn.
  const hd = wb.addWorksheet('Hướng dẫn');
  hd.columns = [{ width: 40 }, { width: 75 }];
  const title = hd.addRow([form.ten]);
  title.font = { bold: true, size: 15 };
  hd.mergeCells(title.number, 1, title.number, 2);
  hd.addRow(['Mô tả', form.moTa]);
  hd.addRow([]);
  const kt = hd.addRow(['KÍCH THƯỚC THẬT (khi in)']);
  kt.font = { bold: true, size: 12 };
  form.kichThuoc.forEach((v) => hd.addRow(['', v]));
  hd.addRow([]);
  const hdr = hd.addRow(['HƯỚNG DẪN']);
  hdr.font = { bold: true, size: 12 };
  form.huongDan.forEach((h, i) => hd.addRow([`${i + 1}.`, h]));
  hd.addRow([]);
  const tr = hd.addRow(['TRƯỜNG DỮ LIỆU (placeholder → ý nghĩa)']);
  tr.font = { bold: true, size: 12 };
  form.truong.forEach(([k, v]) => {
    const row = hd.addRow([k, v]);
    row.getCell(1).font = { bold: true };
  });
  hd.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });

  // Mỗi tem 1 sheet lưới.
  const sizeNote = form.kichThuoc.slice(0, 2).join(' · ');
  form.tems.forEach((tem) => {
    const ws = wb.addWorksheet(tem.ten.slice(0, 31));
    writeGridSheet(ws, tem, sizeNote);
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `form-${form.id}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
