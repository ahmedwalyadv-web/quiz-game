const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { buildLayout, sanitizeQuestionForPlayer, findQuestion, checkAnswer, computeOutcome } = require('../utils/grading');

const router = express.Router();

function loadCampaign(slug) {
  return db.prepare('SELECT * FROM campaigns WHERE slug = ?').get(slug);
}

// جلب إعدادات كامبين عن طريق الرابط (slug) - بدون أي تسجيل دخول، ده اللي بتفتحه صفحة اللعبة لأي زائر
// الإجابات الصحيحة متشالة من الرد عشان محدش يقدر يشوفها من أدوات المطور في المتصفح
router.get('/campaigns/:slug', (req, res) => {
  const c = loadCampaign(req.params.slug);
  if (!c) return res.status(404).json({ error: 'الرابط غير صحيح' });
  if (!c.is_active) return res.status(403).json({ error: 'هذه اللعبة متوقفة حاليًا' });

  const config = JSON.parse(c.config);
  const sanitized = JSON.parse(JSON.stringify(config));
  sanitized.questions = sanitized.questions.map((q) => ({
    id: q.id,
    text: q.text,
    mediaType: q.mediaType,
    mediaUrl: q.mediaUrl,
    timeSec: q.timeSec,
    options: q.options.map((o) => ({ text: o.text }))
  }));

  res.json({ id: c.id, slug: c.slug, name: c.name, config: sanitized });
});

// بداية جولة لعب جديدة: السيرفر يختار الأسئلة وترتيبها (وترتيب الاختيارات) ويخزنه، عشان التصحيح يبقى موثوق فيه
router.post('/campaigns/:slug/start', (req, res) => {
  const c = loadCampaign(req.params.slug);
  if (!c) return res.status(404).json({ error: 'الرابط غير صحيح' });
  if (!c.is_active) return res.status(403).json({ error: 'هذه اللعبة متوقفة حاليًا' });

  const config = JSON.parse(c.config);
  if (!config.questions || !config.questions.length) {
    return res.status(400).json({ error: 'لا توجد أسئلة في هذه اللعبة بعد' });
  }
  const playerName = (req.body && req.body.playerName ? String(req.body.playerName) : '').trim().slice(0, 40);

  const layout = buildLayout(config);
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO plays (id, campaign_id, player_name, layout, current_index, correct_count, total, status, started_at)
     VALUES (?, ?, ?, ?, 0, 0, ?, 'in_progress', ?)`
  ).run(id, c.id, playerName || null, JSON.stringify(layout), layout.length, now);

  const questions = layout.map((item) => sanitizeQuestionForPlayer(findQuestion(config, item.questionId), item.optionOrder));

  res.json({
    playId: id,
    total: layout.length,
    questions,
    settings: {
      timeMode: config.settings.timeMode,
      defaultQuestionTime: config.settings.defaultQuestionTime,
      globalTotalTime: config.settings.globalTotalTime,
      feedbackDelayMs: config.settings.feedbackDelayMs
    }
  });
});

// تسجيل إجابة اللاعب على سؤال معين - السيرفر هو اللي بيحدد صح ولا غلط
router.post('/campaigns/:slug/plays/:playId/answer', (req, res) => {
  const c = loadCampaign(req.params.slug);
  if (!c) return res.status(404).json({ error: 'الرابط غير صحيح' });
  const play = db.prepare('SELECT * FROM plays WHERE id = ? AND campaign_id = ?').get(req.params.playId, c.id);
  if (!play) return res.status(404).json({ error: 'جولة اللعب غير موجودة' });
  if (play.status !== 'in_progress') return res.status(400).json({ error: 'انتهت هذه الجولة بالفعل' });

  const { atIndex, selectedPos } = req.body || {};
  const layout = JSON.parse(play.layout);
  const idx = Number.isInteger(atIndex) && atIndex >= 0 && atIndex < layout.length ? atIndex : play.current_index;
  const layoutItem = layout[idx];
  if (!layoutItem) return res.status(400).json({ error: 'سؤال غير صالح' });

  const config = JSON.parse(c.config);
  const result = checkAnswer(config, layoutItem, typeof selectedPos === 'number' ? selectedPos : -1);
  if (!result) return res.status(400).json({ error: 'تعذر تصحيح الإجابة' });

  const newCorrect = play.correct_count + (result.isCorrect ? 1 : 0);
  db.prepare('UPDATE plays SET correct_count = ?, current_index = ? WHERE id = ?').run(
    newCorrect,
    Math.max(play.current_index, idx + 1),
    play.id
  );

  res.json({ correct: result.isCorrect, correctPos: result.correctPos });
});

// إنهاء جولة اللعب - النتيجة والفوز/الخسارة بيتحسبوا في السيرفر
router.post('/campaigns/:slug/plays/:playId/finish', (req, res) => {
  const c = loadCampaign(req.params.slug);
  if (!c) return res.status(404).json({ error: 'الرابط غير صحيح' });
  const play = db.prepare('SELECT * FROM plays WHERE id = ? AND campaign_id = ?').get(req.params.playId, c.id);
  if (!play) return res.status(404).json({ error: 'جولة اللعب غير موجودة' });

  const config = JSON.parse(c.config);
  const { percent, outcome } = computeOutcome(config.settings, play.correct_count, play.total);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE plays SET status = 'finished', outcome = ?, percent = ?, finished_at = ? WHERE id = ?`
  ).run(outcome, percent, now, play.id);

  res.json({ correctCount: play.correct_count, total: play.total, percent, outcome });
});

module.exports = router;
