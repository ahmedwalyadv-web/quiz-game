const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { buildResultsWorkbook } = require('../utils/excel');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

function loadCampaign(id) {
  return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
}

router.get('/', (req, res) => {
  const c = loadCampaign(req.params.campaignId);
  if (!c) return res.status(404).json({ error: 'الكامبين غير موجود' });
  const rows = db
    .prepare(`SELECT * FROM plays WHERE campaign_id = ? AND status = 'finished' ORDER BY finished_at DESC LIMIT 500`)
    .all(c.id);
  res.json({ results: rows });
});

router.get('/export.xlsx', async (req, res) => {
  const c = loadCampaign(req.params.campaignId);
  if (!c) return res.status(404).json({ error: 'الكامبين غير موجود' });
  const rows = db
    .prepare(`SELECT * FROM plays WHERE campaign_id = ? AND status = 'finished' ORDER BY finished_at DESC`)
    .all(c.id);
  const workbook = await buildResultsWorkbook(rows, c.name);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="results-${c.slug}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

router.delete('/', (req, res) => {
  const c = loadCampaign(req.params.campaignId);
  if (!c) return res.status(404).json({ error: 'الكامبين غير موجود' });
  db.prepare(`DELETE FROM plays WHERE campaign_id = ?`).run(c.id);
  res.json({ ok: true });
});

module.exports = router;
