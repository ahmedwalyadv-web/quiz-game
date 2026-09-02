// تصدير نتائج اللاعبين إلى ملف إكسل منظم وجاهز للفتح في Excel
const ExcelJS = require('exceljs');

async function buildResultsWorkbook(plays, campaignName) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Quiz Game';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('النتائج', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
  });

  sheet.columns = [
    { header: 'اسم اللاعب', key: 'player_name', width: 24 },
    { header: 'الإجابات الصحيحة', key: 'correct_count', width: 16 },
    { header: 'إجمالي الأسئلة', key: 'total', width: 14 },
    { header: 'النسبة %', key: 'percent', width: 12 },
    { header: 'النتيجة', key: 'outcome', width: 14 },
    { header: 'تاريخ ووقت اللعب', key: 'finished_at', width: 22 }
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C2D35' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
  });

  for (const p of plays) {
    const row = sheet.addRow({
      player_name: p.player_name || '(بدون اسم)',
      correct_count: p.correct_count,
      total: p.total,
      percent: p.percent,
      outcome: p.outcome === 'win' ? 'فوز' : p.outcome === 'lose' ? 'خسارة' : '',
      finished_at: p.finished_at ? new Date(p.finished_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }) : ''
    });
    row.alignment = { vertical: 'middle', horizontal: 'right' };
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

  const summary = workbook.addWorksheet('ملخص', { views: [{ rightToLeft: true }] });
  summary.columns = [
    { header: 'البند', key: 'k', width: 30 },
    { header: 'القيمة', key: 'v', width: 30 }
  ];
  summary.getRow(1).font = { bold: true };
  const total = plays.length;
  const wins = plays.filter((p) => p.outcome === 'win').length;
  const avgPercent = total ? Math.round(plays.reduce((s, p) => s + (p.percent || 0), 0) / total) : 0;
  summary.addRow({ k: 'اسم اللعبة', v: campaignName || '' });
  summary.addRow({ k: 'إجمالي عدد اللاعبين', v: total });
  summary.addRow({ k: 'عدد الفائزين', v: wins });
  summary.addRow({ k: 'متوسط نسبة الإجابات الصحيحة', v: avgPercent + '%' });
  summary.addRow({ k: 'تاريخ التصدير', v: new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }) });

  return workbook;
}

module.exports = { buildResultsWorkbook };
