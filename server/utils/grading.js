// محرك اللعب والتصحيح - النتيجة الصحيحة بتتحدد وتتخزن في السيرفر دايمًا (مش في المتصفح) عشان تكون عادلة
// ومينفعش أي زائر يفتح أدوات المطور ويشوف الإجابة الصح قبل ما يجاوب

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// يبني "ترتيب اللعبة" لجولة لعب واحدة: أي أسئلة هتظهر وبأي ترتيب، وترتيب الاختيارات جوه كل سؤال
// بيتخزن في عمود layout في جدول plays عشان التصحيح لاحقًا يكون متسق مع اللي شافه اللاعب بالظبط
function buildLayout(config) {
  const settings = config.settings || {};
  let pool = config.questions.slice();
  if (settings.randomizeQuestions) pool = shuffle(pool);
  const n = Math.max(1, Math.min(settings.questionCount || pool.length, pool.length));
  const chosen = pool.slice(0, n);

  return chosen.map((question) => {
    const optionOrder = question.options.map((_, idx) => idx);
    const finalOrder = settings.randomizeOptions ? shuffle(optionOrder) : optionOrder;
    return { questionId: question.id, optionOrder: finalOrder };
  });
}

// نسخة من الإعدادات بدون كشف الإجابة الصحيحة - دي اللي بتوصل لصفحة اللعبة
function sanitizeQuestionForPlayer(question, optionOrder) {
  return {
    id: question.id,
    text: question.text,
    mediaType: question.mediaType,
    mediaUrl: question.mediaUrl,
    timeSec: question.timeSec,
    options: optionOrder.map((idx) => ({ text: question.options[idx].text }))
  };
}

function findQuestion(config, questionId) {
  return config.questions.find((q) => q.id === questionId);
}

// يتحقق من إجابة اللاعب على سؤال معين، ويرجع هل هي صح ولا لأ + مكان الاختيار الصحيح في نفس الترتيب اللي شافه اللاعب
function checkAnswer(config, layoutItem, selectedPos) {
  const question = findQuestion(config, layoutItem.questionId);
  if (!question) return null;
  const realCorrectIdx = question.options.findIndex((o) => o.correct);
  const correctPos = layoutItem.optionOrder.indexOf(realCorrectIdx);
  const realSelectedIdx = layoutItem.optionOrder[selectedPos];
  const isCorrect = realSelectedIdx === realCorrectIdx;
  return { isCorrect, correctPos };
}

function computeOutcome(settings, correctCount, total) {
  const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  let outcome;
  if (settings.winMode === 'forceWin') outcome = 'win';
  else if (settings.winMode === 'forceLose') outcome = 'lose';
  else outcome = percent >= (settings.passPercent != null ? settings.passPercent : 60) ? 'win' : 'lose';
  return { percent, outcome };
}

module.exports = { shuffle, buildLayout, sanitizeQuestionForPlayer, findQuestion, checkAnswer, computeOutcome };
