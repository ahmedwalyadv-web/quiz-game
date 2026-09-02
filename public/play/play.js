(function(){
"use strict";

var $ = function(id){ return document.getElementById(id); };
var slug = location.pathname.replace(/^\/play\/?/, '').split('/')[0] || '';

var UI = {
  ar: {
    loading:'جارِ تحميل اللعبة...', start:'ابدأ اللعبة 🚀', namePlaceholder:'اكتب اسمك (اختياري)',
    question:'سؤال', of:'/', seconds:'ث', next:'التالي ←', playAgain:'العب مرة أخرى',
    correctAnswers:'نسبة الإجابات الصحيحة', notFound:'الرابط غير صحيح أو اللعبة غير متاحة الآن',
    outOf:' / '
  },
  en: {
    loading:'Loading game...', start:'Start Game 🚀', namePlaceholder:'Your name (optional)',
    question:'Question', of:'/', seconds:'s', next:'Next →', playAgain:'Play Again',
    correctAnswers:'Correct answers', notFound:'This link is invalid or the game is unavailable',
    outOf:' / '
  }
};

var FONT_PRESETS = {
  'cairo-tajawal': {display:"'Cairo',sans-serif", body:"'Tajawal',sans-serif"},
  'almarai': {display:"'Almarai',sans-serif", body:"'Almarai',sans-serif"},
  'changa-plex': {display:"'Changa',sans-serif", body:"'IBM Plex Sans Arabic',sans-serif"},
  'inter-poppins': {display:"'Poppins',sans-serif", body:"'Inter',sans-serif"}
};

var State = { config:null, lang:'ar', playId:null, questions:[], idx:0, correctCount:0, globalTimer:null, qTimer:null, qNumInterval:null };

function t(key){ return (UI[State.lang] || UI.ar)[key]; }
function bi(field){ if(!field) return ''; return field[State.lang] != null && field[State.lang] !== '' ? field[State.lang] : (field.ar || field.en || ''); }

function setLang(lang){
  State.lang = lang;
  var dir = lang === 'en' ? 'ltr' : 'rtl';
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  $('langToggle').textContent = lang === 'ar' ? 'EN' : 'AR';
  renderStartTexts();
}

function hexToRgba(hex,a){
  var h=hex.replace('#','');
  if(h.length===3) h=h.split('').map(function(c){return c+c;}).join('');
  var r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}
function pickInk(hex){
  var h=hex.replace('#',''); if(h.length===3) h=h.split('').map(function(c){return c+c;}).join('');
  var r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);
  return ((r*299+g*587+b*114)/1000) >= 150 ? '#1c2d35' : '#ffffff';
}

function patternDataUri(pattern){
  var c = encodeURIComponent(pattern.color || '#1c2d35');
  var o = pattern.opacity != null ? pattern.opacity : 0.06;
  var s = 120 * (pattern.scale || 1);
  var svg = '';
  if(pattern.type === 'dots'){
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'"><circle cx="'+s*0.2+'" cy="'+s*0.2+'" r="'+s*0.06+'" fill="'+c+'" fill-opacity="'+o+'"/><circle cx="'+s*0.7+'" cy="'+s*0.6+'" r="'+s*0.06+'" fill="'+c+'" fill-opacity="'+o+'"/></svg>';
  } else if(pattern.type === 'diagonal'){
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'"><path d="M0 '+s+' L'+s+' 0" stroke="'+c+'" stroke-opacity="'+o+'" stroke-width="'+(s*0.08)+'"/></svg>';
  } else if(pattern.type === 'grid'){
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'"><path d="M0 0H'+s+'M0 0V'+s+'" stroke="'+c+'" stroke-opacity="'+o+'" stroke-width="'+(s*0.02)+'"/></svg>';
  } else if(pattern.type === 'stars'){
    var star = 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7-5.4-4.7 7.1-.6z';
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'" viewBox="0 0 24 24"><g fill="'+c+'" fill-opacity="'+o+'"><path d="'+star+'" transform="translate(0,0) scale(0.9)"/><path d="'+star+'" transform="translate(14,12) scale(0.55)"/></g></svg>';
  } else if(pattern.type === 'arabesque'){
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'" viewBox="0 0 100 100"><g fill="none" stroke="'+c+'" stroke-opacity="'+o+'" stroke-width="2"><rect x="20" y="20" width="60" height="60" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="28"/></g></svg>';
  } else {
    return null;
  }
  return { url: 'data:image/svg+xml,' + svg.replace(/#/g,'%23'), size: Math.round(s)+'px '+Math.round(s)+'px' };
}

function applyTheme(config){
  var app = $('app');
  var colors = config.theme.colors;
  var f = FONT_PRESETS[config.theme.font] || FONT_PRESETS['cairo-tajawal'];
  var map = {'--bg':colors.bg,'--surface':colors.surface,'--ink':colors.ink,'--accent':colors.accent,'--win':colors.win,'--lose':colors.lose,'--font-d':f.display,'--font-b':f.body};
  Object.keys(map).forEach(function(k){ app.style.setProperty(k, map[k]); });
  app.style.setProperty('--ink-soft', hexToRgba(colors.ink,.6));
  app.style.setProperty('--accent-ink', pickInk(colors.accent));

  var pattern = config.theme.pattern || { type:'none' };
  app.classList.remove('has-pattern');
  if(pattern.type === 'custom' && pattern.customUrl){
    app.style.setProperty('--pattern-img', 'url("'+pattern.customUrl+'")');
    app.style.setProperty('--pattern-size', (140*(pattern.scale||1))+'px '+(140*(pattern.scale||1))+'px');
    app.classList.add('has-pattern');
  } else {
    var p = patternDataUri(pattern);
    if(p){
      app.style.setProperty('--pattern-img', 'url("'+p.url+'")');
      app.style.setProperty('--pattern-size', p.size);
      app.classList.add('has-pattern');
    }
  }
}

function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

function renderStartTexts(){
  if(!State.config) return;
  var b = State.config.brand;
  $('ps-title').textContent = bi(b.title);
  $('ps-subtitle').textContent = bi(b.subtitle);
  $('ps-name').placeholder = t('namePlaceholder');
  $('ps-startBtn').textContent = t('start');
  var s = State.config.settings;
  var n = Math.min(s.questionCount, State.config.questions.length);
  var timeInfo = s.timeMode==='global'
    ? (State.lang==='ar' ? (s.globalTotalTime+' ثانية للعبة كاملة') : (s.globalTotalTime+'s for the whole game'))
    : (State.lang==='ar' ? (s.defaultQuestionTime+' ثانية لكل سؤال') : (s.defaultQuestionTime+'s per question'));
  var qLabel = State.lang==='ar' ? (n+' سؤال') : (n+' question'+(n===1?'':'s'));
  $('ps-meta').innerHTML = '<span>'+qLabel+'</span><span>'+timeInfo+'</span>';
  $('ps-nameWrap').hidden = !s.collectPlayerName;
}

function showScreen(id){
  ['screen-loading','screen-error','screen-start','screen-question','screen-end'].forEach(function(s){ $(s).hidden = (s !== id); });
}

function loadGame(){
  fetch('/api/public/campaigns/'+encodeURIComponent(slug))
    .then(function(r){ if(!r.ok) throw new Error('not_found'); return r.json(); })
    .then(function(data){
      State.config = data.config;
      var lang = State.config.meta.language === 'both' ? State.config.meta.defaultLanguage : State.config.meta.language;
      $('langToggle').hidden = State.config.meta.language !== 'both';
      applyTheme(State.config);
      setLang(lang || 'ar');
      if(State.config.brand.logoUrl){ $('ps-logo').src = State.config.brand.logoUrl; $('ps-logo').hidden = false; }
      showScreen('screen-start');
    })
    .catch(function(){
      setLang('ar');
      $('errorText').textContent = t('notFound');
      showScreen('screen-error');
    });
}

$('langToggle').addEventListener('click', function(){ setLang(State.lang === 'ar' ? 'en' : 'ar'); });

$('ps-startBtn').addEventListener('click', function(){
  requestFS();
  beginGame();
});

function requestFS(){
  var el = document.documentElement;
  var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if(req){ try{ req.call(el); }catch(e){} }
}

function beginGame(){
  var playerName = $('ps-name').value.trim();
  fetch('/api/public/campaigns/'+encodeURIComponent(slug)+'/start', {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ playerName: playerName })
  }).then(function(r){ return r.json(); }).then(function(data){
    State.playId = data.playId;
    State.questions = data.questions;
    State.timeSettings = data.settings;
    State.idx = 0; State.correctCount = 0; State.answersLog = [];
    showScreen('screen-question');
    if(State.timeSettings.timeMode === 'global'){
      startGlobalTimer(State.timeSettings.globalTotalTime);
    } else {
      $('pq-timerBar').style.display = '';
    }
    showQuestion(0);
  });
}

function startGlobalTimer(totalSec){
  var start = Date.now(); var total = totalSec*1000;
  $('pq-timerFill').style.transition='none'; $('pq-timerFill').style.width='100%';
  clearInterval(State.globalTimer);
  State.globalTimer = setInterval(function(){
    var elapsed = Date.now()-start; var remain = Math.max(0, total-elapsed);
    $('pq-timerFill').style.width = ((remain/total)*100)+'%';
    $('pq-timerNum').textContent = Math.ceil(remain/1000)+t('seconds');
    if(remain<=0){ clearInterval(State.globalTimer); finishGame(); }
  }, 200);
}

function extractYouTubeId(url){
  var m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : '';
}

function showQuestion(i){
  clearTimeout(State.qTimer); clearInterval(State.qNumInterval);
  var q = State.questions[i];
  var qLabel = State.lang==='ar' ? ('سؤال '+(i+1)+' / '+State.questions.length) : ('Question '+(i+1)+' / '+State.questions.length);
  $('pq-count').textContent = qLabel;
  $('pq-text').textContent = bi(q.text);

  var mediaBox = $('pq-media'); mediaBox.innerHTML=''; mediaBox.hidden = q.mediaType==='none' || !q.mediaUrl;
  if(q.mediaType==='image' && q.mediaUrl){ var img=document.createElement('img'); img.src=q.mediaUrl; img.alt=''; mediaBox.appendChild(img); }
  if(q.mediaType==='video' && q.mediaUrl){
    if(/youtube\.com|youtu\.be/.test(q.mediaUrl)){
      var yid = extractYouTubeId(q.mediaUrl);
      var ifr = document.createElement('iframe'); ifr.src='https://www.youtube.com/embed/'+yid+'?rel=0'; ifr.allow='autoplay; encrypted-media'; ifr.allowFullscreen=true;
      mediaBox.appendChild(ifr);
    } else {
      var v=document.createElement('video'); v.src=q.mediaUrl; v.controls=true; v.playsInline=true; mediaBox.appendChild(v);
    }
  }

  var optBox = $('pq-options'); optBox.innerHTML='';
  q.options.forEach(function(opt, oi){
    var b = document.createElement('button'); b.className='opt-btn'; b.type='button';
    b.innerHTML = '<span>'+escapeHtml(bi(opt.text))+'</span><span class="opt-mark"></span>';
    b.addEventListener('click', function(){ onAnswer(oi); });
    optBox.appendChild(b);
  });

  $('pq-nextBtn').hidden = true; $('pq-nextBtn').textContent = t('next');
  $('pq-nextBtn').onclick = function(){ clearTimeout(State.qTimer); goNext(); };

  if(State.timeSettings.timeMode === 'perQuestion'){
    $('pq-timerBar').style.display='';
    var sec = q.timeSec && q.timeSec>0 ? q.timeSec : State.timeSettings.defaultQuestionTime;
    startQuestionTimer(sec);
  } else {
    $('pq-timerBar').style.display='none';
    $('pq-timerNum').textContent='';
  }
}

function startQuestionTimer(sec){
  var fill = $('pq-timerFill');
  fill.style.transition='none'; fill.style.width='100%';
  void fill.offsetWidth;
  fill.style.transition='width '+sec+'s linear';
  requestAnimationFrame(function(){ fill.style.width='0%'; });
  var start=Date.now(); var total=sec*1000;
  clearInterval(State.qNumInterval);
  State.qNumInterval = setInterval(function(){
    var remain = Math.max(0,total-(Date.now()-start));
    $('pq-timerNum').textContent = Math.ceil(remain/1000)+t('seconds');
    if(remain<=0) clearInterval(State.qNumInterval);
  }, 200);
  State.qTimer = setTimeout(function(){ onAnswer(-1); }, sec*1000);
}

function onAnswer(selectedPos){
  clearTimeout(State.qTimer); clearInterval(State.qNumInterval);
  var buttons = document.querySelectorAll('#pq-options .opt-btn');
  buttons.forEach(function(btn){ btn.classList.add('locked'); });

  fetch('/api/public/campaigns/'+encodeURIComponent(slug)+'/plays/'+State.playId+'/answer', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ atIndex: State.idx, selectedPos: selectedPos })
  }).then(function(r){ return r.json(); }).then(function(res){
    if(res.correct) State.correctCount++;
    State.answersLog.push(res.correct);
    buttons.forEach(function(btn, i){
      if(i===res.correctPos){ btn.classList.add('is-correct'); btn.querySelector('.opt-mark').textContent='✓'; }
      else if(i===selectedPos){ btn.classList.add('is-wrong'); btn.querySelector('.opt-mark').textContent='✗'; }
      else { btn.classList.add('dim'); }
    });
    $('pq-nextBtn').hidden = false;
    State.qTimer = setTimeout(goNext, State.timeSettings.feedbackDelayMs);
  });
}

function goNext(){
  clearTimeout(State.qTimer);
  State.idx++;
  if(State.idx >= State.questions.length){ finishGame(); }
  else { showQuestion(State.idx); }
}

function finishGame(){
  clearInterval(State.globalTimer); clearTimeout(State.qTimer); clearInterval(State.qNumInterval);
  fetch('/api/public/campaigns/'+encodeURIComponent(slug)+'/plays/'+State.playId+'/finish', { method:'POST' })
    .then(function(r){ return r.json(); }).then(function(res){
      showScreen('screen-end');
      var wash=$('pe-wash'), card=$('pe-card');
      wash.className='end-wash outcome-'+res.outcome;
      card.className='end-card outcome-'+res.outcome;
      $('pe-badge').textContent = res.outcome==='win' ? '🏆' : '💪';
      var msgs = State.config.messages;
      $('pe-title').textContent = bi(res.outcome==='win' ? msgs.winTitle : msgs.loseTitle);
      $('pe-subtitle').textContent = bi(res.outcome==='win' ? msgs.winSubtitle : msgs.loseSubtitle);
      $('pe-score').textContent = res.correctCount;
      $('pe-scoreTotal').textContent = t('outOf')+res.total;
      $('pe-percent').textContent = t('correctAnswers')+': '+res.percent+'%';
      var rev = $('pe-review'); rev.innerHTML='';
      State.answersLog.forEach(function(ok){
        var i=document.createElement('i'); i.className=ok?'ok':'no'; i.textContent=ok?'✓':'✗'; rev.appendChild(i);
      });
      $('pe-again').textContent = t('playAgain');
      $('pe-again').onclick = function(){ clearConfetti(); showScreen('screen-start'); };

      if(res.outcome==='win') fireConfetti();
    });
}

/* ============ احتفال الفوز (كونفيتي) - Canvas خفيف بدون مكتبات خارجية ============ */
var confettiParticles = [];
var confettiAnimId = null;

function fireConfetti(){
  var canvas = $('confetti-canvas'); if(!canvas) return;
  var ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  var colors = State.config && State.config.theme && State.config.theme.colors
    ? [State.config.theme.colors.accent, State.config.theme.colors.win, '#ffffff', State.config.theme.colors.lose]
    : ['#e75a3f', '#1f9d55', '#ffffff', '#b93a3a'];
  confettiParticles = [];
  for(var i=0;i<160;i++){
    confettiParticles.push({
      x: canvas.width/2 + (Math.random()-0.5)*140,
      y: canvas.height*0.3 + (Math.random()-0.5)*60,
      vx: (Math.random()-0.5)*14,
      vy: -Math.random()*15-5,
      size: Math.random()*7+4,
      color: colors[Math.floor(Math.random()*colors.length)],
      rotation: Math.random()*360,
      rotSpeed: (Math.random()-0.5)*12,
      shape: Math.random()>0.5 ? 'rect' : 'circle'
    });
  }
  var gravity = 0.35;
  var start = performance.now();
  function frame(now){
    var elapsed = now - start;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    var alive = false;
    confettiParticles.forEach(function(p){
      p.vy += gravity; p.x += p.vx; p.y += p.vy; p.rotation += p.rotSpeed;
      if(p.y < canvas.height+20) alive = true;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate((p.rotation*Math.PI)/180); ctx.fillStyle = p.color;
      if(p.shape==='rect') ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);
      else { ctx.beginPath(); ctx.arc(0,0,p.size/2,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    });
    if(alive && elapsed<6000) confettiAnimId = requestAnimationFrame(frame);
  }
  confettiAnimId = requestAnimationFrame(frame);
}

function clearConfetti(){
  if(confettiAnimId) cancelAnimationFrame(confettiAnimId);
  confettiAnimId = null;
  var canvas = $('confetti-canvas'); if(!canvas) return;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  confettiParticles = [];
}

window.addEventListener('resize', function(){
  var canvas = $('confetti-canvas'); if(!canvas) return;
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
});

loadGame();
})();
