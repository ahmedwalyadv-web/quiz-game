// الإعدادات الافتراضية لأي كامبين (لعبة أسئلة) جديد - كل حاجة فيها قابلة للتعديل من الداشبورد
// كل نص في اللعبة ثنائي اللغة: { ar: '...', en: '...' }

function bi(ar, en) {
  return { ar, en };
}

function defaultCampaignConfig(name) {
  return {
    meta: {
      name: name || 'كامبين جديد',
      language: 'both', // 'ar' | 'en' | 'both' -> both يظهر زرار تبديل لغة للاعب
      defaultLanguage: 'ar'
    },
    theme: {
      colors: {
        bg: '#e2f0ff',
        surface: '#ffffff',
        ink: '#1c2d35',
        accent: '#e75a3f',
        win: '#1f9d55',
        lose: '#b93a3a'
      },
      font: 'cairo-tajawal',
      logoUrl: '',
      logoWidth: 180,
      pattern: {
        type: 'none', // none | dots | diagonal | grid | arabesque | stars
        color: '#1c2d35',
        opacity: 0.06,
        scale: 1,
        customUrl: ''
      }
    },
    brand: {
      title: bi('لعبة أسئلة ريما', 'Reema Quiz Game'),
      subtitle: bi(
        'اختبر معلوماتك مع ريما للدعاية والإعلان، وشوف تفوز ولا لأ!',
        'Test your knowledge with Reema Advertising, and see if you win!'
      )
    },
    messages: {
      winTitle: bi('🎉 مبروك، فزت!', '🎉 Congrats, you won!'),
      winSubtitle: bi('أداء رائع! تقدر تجرب تاني وتحسن نتيجتك.', 'Great job! Try again to beat your score.'),
      loseTitle: bi('حظ أوفر المرة الجاية!', 'Better luck next time!'),
      loseSubtitle: bi('قربت توصل، جرّب تاني وشوف نتيجتك الجديدة.', 'So close — give it another shot!')
    },
    settings: {
      questionCount: 5,
      randomizeQuestions: true,
      randomizeOptions: false,
      timeMode: 'perQuestion', // 'perQuestion' | 'global'
      defaultQuestionTime: 20,
      globalTotalTime: 120,
      winMode: 'auto', // 'auto' | 'forceWin' | 'forceLose'
      passPercent: 60,
      feedbackDelayMs: 1600,
      collectPlayerName: true
    },
    questions: [
      q(
        bi('ما عاصمة المملكة العربية السعودية؟', 'What is the capital of Saudi Arabia?'),
        'none', '', null,
        [
          bi('الرياض', 'Riyadh'), bi('جدة', 'Jeddah'), bi('الدمام', 'Dammam'), bi('مكة المكرمة', 'Makkah')
        ], 0
      ),
      q(
        bi('كم عدد ألوان قوس قزح؟', 'How many colors does a rainbow have?'),
        'none', '', null,
        [bi('5', '5'), bi('6', '6'), bi('7', '7'), bi('9', '9')], 2
      ),
      q(
        bi('أي من هذه المدن تُلقّب بـ«عروس البحر الأحمر»؟', 'Which city is known as the "Bride of the Red Sea"?'),
        'image', 'https://picsum.photos/seed/reema-quiz/900/500', 25,
        [bi('جدة', 'Jeddah'), bi('أبها', 'Abha'), bi('تبوك', 'Tabuk'), bi('حائل', 'Hail')], 0
      ),
      q(
        bi('ما هو الكوكب الأقرب إلى الشمس؟', 'Which planet is closest to the sun?'),
        'none', '', null,
        [bi('الزهرة', 'Venus'), bi('عطارد', 'Mercury'), bi('الأرض', 'Earth'), bi('المريخ', 'Mars')], 1
      ),
      q(
        bi('وكالة ريما للدعاية والإعلان معروفة بشكل خاص بـ...', 'Reema Advertising Agency is especially known for...'),
        'none', '', null,
        [
          bi('الهولوجرام والتجارب التفاعلية', 'Hologram & interactive experiences'),
          bi('بيع الأثاث المنزلي', 'Selling home furniture'),
          bi('الزراعة العضوية', 'Organic farming'),
          bi('صيد الأسماك', 'Fishing')
        ], 0
      )
    ]
  };
}

function q(text, mediaType, mediaUrl, timeSec, optionTexts, correctIndex) {
  return {
    id: 'q' + Math.random().toString(36).slice(2, 9),
    text,
    mediaType,
    mediaUrl,
    timeSec,
    options: optionTexts.map((t, i) => ({ text: t, correct: i === correctIndex }))
  };
}

module.exports = { defaultCampaignConfig, bi };
