const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { defaultCampaignConfig } = require('../utils/defaultConfig');

const router = express.Router();
router.use(requireAuth);

function randomSlug() {
  return uuidv4().split('-')[0]; // 8 حروف/أرقام قصيرة وفريدة
}

function slugExists(slug) {
  return !!db.prepare('SELECT 1 FROM campaigns WHERE slug = ?').get(slug);
}

function sanitizeSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// قائمة كل الكامبينات + عدد اللاعبين لكل واحد
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.slug, c.name, c.is_active, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM plays p WHERE p.campaign_id = c.id AND p.status = 'finished') AS plays_count
       FROM campaigns c ORDER BY c.created_at DESC`
    )
    .all();
  res.json({ campaigns: rows });
});

// إنشاء كامبين جديد
router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'اسم الكامبين مطلوب' });

  let slug = randomSlug();
  while (slugExists(slug)) slug = randomSlug();

  const now = new Date().toISOString();
  const config = defaultCampaignConfig(name.trim());
  const id = uuidv4();

  db.prepare(
    `INSERT INTO campaigns (id, slug, name, is_active, config, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?, ?)`
  ).run(id, slug, name.trim(), JSON.stringify(config), now, now);

  res.json({ ok: true, id, slug });
});

// تفاصيل كامبين واحد (مع الإعدادات كاملة، بالإجابات الصحيحة - للأدمن بس)
router.get('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'الكامبين غير موجود' });
  res.json({
    id: c.id,
    slug: c.slug,
    name: c.name,
    isActive: !!c.is_active,
    config: JSON.parse(c.config),
    createdAt: c.created_at,
    updatedAt: c.updated_at
  });
});

// تحديث إعدادات الكامبين (بيانات + config كامل)
router.put('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'الكامبين غير موجود' });

  const { name, isActive, config, slug } = req.body || {};

  let newSlug = c.slug;
  if (slug && sanitizeSlug(slug) && sanitizeSlug(slug) !== c.slug) {
    const clean = sanitizeSlug(slug);
    if (slugExists(clean)) return res.status(400).json({ error: 'الرابط المخصص ده مستخدم بالفعل' });
    newSlug = clean;
  }

  if (config) {
    if (!Array.isArray(config.questions) || config.questions.length === 0) {
      return res.status(400).json({ error: 'أضف سؤالًا واحدًا على الأقل قبل الحفظ' });
    }
    const missingCorrect = config.questions.some((q) => !q.options.some((o) => o.correct));
    if (missingCorrect) {
      return res.status(400).json({ error: 'كل سؤال يجب أن يحتوي على اختيار صحيح واحد على الأقل' });
    }
  }

  db.prepare(
    `UPDATE campaigns SET name = ?, is_active = ?, config = ?, slug = ?, updated_at = ? WHERE id = ?`
  ).run(
    name && name.trim() ? name.trim() : c.name,
    typeof isActive === 'boolean' ? (isActive ? 1 : 0) : c.is_active,
    config ? JSON.stringify(config) : c.config,
    newSlug,
    new Date().toISOString(),
    c.id
  );

  res.json({ ok: true, slug: newSlug });
});

// حذف كامبين (وكل جولات اللعب المرتبطة بيه)
router.delete('/:id', (req, res) => {
  const c = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'الكامبين غير موجود' });
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(c.id);
  res.json({ ok: true });
});

// نسخ كامبين موجود عشان تعمل نسخة بمناسبة تانية (زي اليوم الوطني) بسرعة بنفس الأسئلة والتصميم
router.post('/:id/duplicate', (req, res) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'الكامبين غير موجود' });

  let slug = randomSlug();
  while (slugExists(slug)) slug = randomSlug();

  const now = new Date().toISOString();
  const id = uuidv4();
  const newName = `${c.name} (نسخة)`;

  db.prepare(
    `INSERT INTO campaigns (id, slug, name, is_active, config, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?, ?)`
  ).run(id, slug, newName, c.config, now, now);

  res.json({ ok: true, id, slug });
});

module.exports = router;
