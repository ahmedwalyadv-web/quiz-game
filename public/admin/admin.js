(function(){
"use strict";
var $ = function(id){ return document.getElementById(id); };

var FONT_PRESETS = {
  'cairo-tajawal': {label:'Cairo + Tajawal', sample:'أبجد هوز', display:"'Cairo',sans-serif", body:"'Tajawal',sans-serif"},
  'almarai': {label:'Almarai', sample:'أبجد هوز', display:"'Almarai',sans-serif", body:"'Almarai',sans-serif"},
  'changa-plex': {label:'Changa + Plex', sample:'أبجد هوز', display:"'Changa',sans-serif", body:"'IBM Plex Sans Arabic',sans-serif"},
  'inter-poppins': {label:'Poppins + Inter', sample:'Aa', display:"'Poppins',sans-serif", body:"'Inter',sans-serif"}
};
var PATTERNS = [
  {v:'none', label:'بدون نمط'}, {v:'dots', label:'نقاط'}, {v:'diagonal', label:'خطوط مائلة'},
  {v:'grid', label:'شبكة'}, {v:'stars', label:'نجوم'}, {v:'arabesque', label:'زخرفة هندسية'}, {v:'custom', label:'صورة مخصصة'}
];
var PRESETS = [
  { name:'ريما (افتراضي)', colors:{bg:'#e2f0ff',surface:'#ffffff',ink:'#1c2d35',accent:'#e75a3f',win:'#1f9d55',lose:'#b93a3a'}, pattern:{type:'none'} },
  { name:'اليوم الوطني 🇸🇦', colors:{bg:'#eafaf0',surface:'#ffffff',ink:'#03361f',accent:'#006c35',win:'#006c35',lose:'#b93a3a'}, pattern:{type:'stars', color:'#006c35', opacity:0.08} },
  { name:'ذهبي احتفالي', colors:{bg:'#fbf3e3',surface:'#ffffff',ink:'#332405',accent:'#b8860b',win:'#2f8f4e',lose:'#a63a2c'}, pattern:{type:'arabesque', color:'#b8860b', opacity:0.10} },
  { name:'ليلي داكن', colors:{bg:'#131b2b',surface:'#1c2740',ink:'#eef2fb',accent:'#5b8cff',win:'#2fbf71',lose:'#e5555c'}, pattern:{type:'grid', color:'#5b8cff', opacity:0.08} }
];

function api(method, url, body, isForm){
  var opts = { method: method, credentials:'same-origin' };
  if(body){
    if(isForm){ opts.body = body; }
    else { opts.headers = {'Content-Type':'application/json'}; opts.body = JSON.stringify(body); }
  }
  return fetch(url, opts).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(data){
      if(!r.ok) throw (data && data.error) ? data : { error: 'حدث خطأ غير متوقع' };
      return data;
    });
  });
}

function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function escapeAttr(s){ return escapeHtml(s); }
function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
function uid(){ return 'q'+Math.random().toString(36).slice(2,9); }
function clampNum(v,min,max,fallback){ v=Number(v); if(isNaN(v)) return fallback; if(min!=null&&v<min)v=min; if(max!=null&&v>max)v=max; return v; }
function playLink(slug){ return location.origin + '/play/' + slug; }

function copyToClipboard(text, btnEl){
  function done(ok){
    if(!btnEl) return;
    var original = btnEl.dataset.origLabel || btnEl.textContent;
    btnEl.dataset.origLabel = original;
    btnEl.textContent = ok ? 'تم النسخ ✓' : 'تعذر النسخ';
    setTimeout(function(){ btnEl.textContent = original; }, 1600);
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(false); });
  } else {
    try{
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      done(ok);
    } catch(e){ done(false); }
  }
}

function showView(name){
  ['login','list','editor'].forEach(function(v){ $('view-'+v).hidden = (v!==name); });
}
function showModal(html, mountFn){
  $('modal-box').innerHTML = html;
  $('modal-overlay').hidden = false;
  if(mountFn) mountFn($('modal-box'));
}
function hideModal(){ $('modal-overlay').hidden = true; $('modal-box').innerHTML=''; }
$('modal-overlay').addEventListener('click', function(e){ if(e.target === $('modal-overlay')) hideModal(); });

/* ---------------- auth / boot ---------------- */
function boot(){
  api('GET', '/api/auth/me').then(function(){ showView('list'); loadCampaignsList(); })
    .catch(function(){ showView('login'); });
}
$('loginBtn').addEventListener('click', doLogin);
$('login-pass').addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
function doLogin(){
  var u = $('login-user').value.trim(), p = $('login-pass').value;
  $('loginError').hidden = true;
  api('POST', '/api/auth/login', { username:u, password:p })
    .then(function(){ showView('list'); loadCampaignsList(); })
    .catch(function(err){ $('loginError').textContent = err.error || 'خطأ في تسجيل الدخول'; $('loginError').hidden = false; });
}
$('logoutBtn').addEventListener('click', function(){ api('POST','/api/auth/logout').then(function(){ location.reload(); }); });
$('changePassBtn').addEventListener('click', function(){
  showModal(
    '<h3>تغيير كلمة المرور</h3>'+
    '<div class="field"><label>كلمة المرور الحالية</label><input type="password" id="m-curPass"></div>'+
    '<div class="field"><label>كلمة المرور الجديدة (6 أحرف على الأقل)</label><input type="password" id="m-newPass"></div>'+
    '<p class="err-text" id="m-passErr" hidden></p>'+
    '<div class="modal-actions"><button class="btn btn-ghost btn-block" id="m-cancel">إلغاء</button><button class="btn btn-accent btn-block" id="m-save">حفظ</button></div>'
  , function(box){
    box.querySelector('#m-cancel').addEventListener('click', hideModal);
    box.querySelector('#m-save').addEventListener('click', function(){
      var cur = box.querySelector('#m-curPass').value, nw = box.querySelector('#m-newPass').value;
      api('POST','/api/auth/change-password', { currentPassword:cur, newPassword:nw })
        .then(function(){ hideModal(); })
        .catch(function(err){ var e=box.querySelector('#m-passErr'); e.textContent = err.error||'تعذر الحفظ'; e.hidden=false; });
    });
  });
});

/* ---------------- campaigns list ---------------- */
function loadCampaignsList(){
  api('GET','/api/campaigns').then(function(data){
    var wrap = $('campaignsList'); wrap.innerHTML='';
    if(!data.campaigns.length){
      wrap.innerHTML = '<div class="empty-state">لسه معملتش أي لعبة. دوس "+ كامبين جديد" عشان تبدأ.</div>';
      return;
    }
    data.campaigns.forEach(function(c){
      var card = document.createElement('div'); card.className='campaign-card';
      card.innerHTML =
        '<span class="badge '+(c.is_active?'':'off')+'">'+(c.is_active?'مفعّلة':'متوقفة')+'</span>'+
        '<h4>'+escapeHtml(c.name)+'</h4>'+
        '<div class="meta">'+(c.plays_count||0)+' لاعب أنهى اللعبة</div>'+
        '<div class="meta" style="word-break:break-all">'+escapeHtml(playLink(c.slug))+'</div>'+
        '<div class="row-btns">'+
          '<button class="btn btn-accent btn-sm" data-act="edit">تعديل</button>'+
          '<button class="btn btn-ghost btn-sm" data-act="copylink">نسخ الرابط</button>'+
          '<a class="btn btn-ghost btn-sm" href="'+escapeAttr(playLink(c.slug))+'" target="_blank" rel="noopener">معاينة</a>'+
          '<button class="btn btn-ghost btn-sm" data-act="dup">نسخ الكامبين</button>'+
          '<button class="btn btn-danger btn-sm" data-act="del">حذف</button>'+
        '</div>';
      card.querySelector('[data-act=edit]').addEventListener('click', function(){ openEditor(c.id); });
      card.querySelector('[data-act=copylink]').addEventListener('click', function(e){ copyToClipboard(playLink(c.slug), e.currentTarget); });
      card.querySelector('[data-act=dup]').addEventListener('click', function(){ api('POST','/api/campaigns/'+c.id+'/duplicate').then(loadCampaignsList); });
      card.querySelector('[data-act=del]').addEventListener('click', function(){
        showModal('<h3>حذف "'+escapeHtml(c.name)+'"؟</h3><p class="hint">هيتم حذف كل نتائجها كمان، ومينفعش يترجع.</p>'+
          '<div class="modal-actions"><button class="btn btn-ghost btn-block" id="m-cancel">إلغاء</button><button class="btn btn-danger btn-block" id="m-del">حذف نهائيًا</button></div>',
          function(box){
            box.querySelector('#m-cancel').addEventListener('click', hideModal);
            box.querySelector('#m-del').addEventListener('click', function(){ api('DELETE','/api/campaigns/'+c.id).then(function(){ hideModal(); loadCampaignsList(); }); });
          });
      });
      wrap.appendChild(card);
    });
  });
}
$('newCampaignBtn').addEventListener('click', function(){
  showModal('<h3>كامبين جديد</h3><div class="field"><label>اسم الكامبين (للتعرف عليه بس، مش هيظهر للاعب)</label><input type="text" id="m-name" placeholder="مثال: فعالية اليوم الوطني 2026"></div>'+
    '<div class="modal-actions"><button class="btn btn-ghost btn-block" id="m-cancel">إلغاء</button><button class="btn btn-accent btn-block" id="m-create">إنشاء</button></div>',
    function(box){
      box.querySelector('#m-cancel').addEventListener('click', hideModal);
      var input = box.querySelector('#m-name'); input.focus();
      function create(){
        var name = input.value.trim(); if(!name) return;
        api('POST','/api/campaigns', { name: name }).then(function(res){ hideModal(); openEditor(res.id); });
      }
      box.querySelector('#m-create').addEventListener('click', create);
      input.addEventListener('keydown', function(e){ if(e.key==='Enter') create(); });
    });
});
$('backToListBtn').addEventListener('click', function(){ showView('list'); loadCampaignsList(); });
$('copyLinkTopBtn').addEventListener('click', function(e){ copyToClipboard($('playLinkText').value, e.currentTarget); });

/* ---------------- editor ---------------- */
var Editor = { id:null, slug:null, draft:null, active:true };

function openEditor(id){
  api('GET','/api/campaigns/'+id).then(function(data){
    Editor.id = id; Editor.slug = data.slug; Editor.draft = data.config; Editor.active = data.isActive;
    $('editorCampaignName').textContent = data.name;
    $('playLinkTop').href = playLink(data.slug);
    $('playLinkText').value = playLink(data.slug);
    showView('editor');
    document.querySelectorAll('.tab-btn').forEach(function(b,i){ b.classList.toggle('active', i===0); });
    document.querySelectorAll('.tab-pane').forEach(function(p,i){ p.classList.toggle('active', i===0); });
    renderAll();
    loadResults();
  });
}

document.querySelectorAll('.tab-btn').forEach(function(btn){
  btn.addEventListener('click', function(){
    document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
    document.querySelectorAll('.tab-pane').forEach(function(p){ p.classList.remove('active'); });
    btn.classList.add('active');
    $('tab-'+btn.dataset.tab).classList.add('active');
  });
});

function renderAll(){
  renderIdentity();
  renderPresets();
  renderFontGrid();
  renderPatternGrid();
  updateLivePreview();
  renderQuestions();
  renderSettings();
}

/* -- identity tab -- */
function renderIdentity(){
  var d = Editor.draft;
  $('f-language').value = d.meta.language;
  $('f-defaultLanguage').value = d.meta.defaultLanguage;
  $('f-title-ar').value = d.brand.title.ar; $('f-title-en').value = d.brand.title.en;
  $('f-subtitle-ar').value = d.brand.subtitle.ar; $('f-subtitle-en').value = d.brand.subtitle.en;
  $('f-logo').value = d.theme.logoUrl || '';
  $('f-logoWidth').value = d.theme.logoWidth || 180;
  $('f-logoWidth-val').textContent = (d.theme.logoWidth || 180) + 'px';
  Object.keys(d.theme.colors).forEach(function(k){
    var el = $('c-'+k); if(el){ el.value = d.theme.colors[k]; $('cx-'+k).textContent = d.theme.colors[k]; }
  });
  $('p-opacity').value = d.theme.pattern.opacity != null ? d.theme.pattern.opacity : 0.06;
  $('p-scale').value = d.theme.pattern.scale || 1;
  $('p-customUrl').value = d.theme.pattern.customUrl || '';
}
['f-language','f-defaultLanguage'].forEach(function(id){
  $(id).addEventListener('change', function(){
    var key = id==='f-language' ? 'language' : 'defaultLanguage';
    Editor.draft.meta[key] = this.value;
  });
});
['title','subtitle'].forEach(function(field){
  ['ar','en'].forEach(function(lang){
    $('f-'+field+'-'+lang).addEventListener('input', function(){ Editor.draft.brand[field][lang] = this.value; updateLivePreview(); });
  });
});
$('f-logo').addEventListener('input', function(){ Editor.draft.theme.logoUrl = this.value; updateLivePreview(); });
$('f-logoWidth').addEventListener('input', function(){ Editor.draft.theme.logoWidth = parseInt(this.value,10); $('f-logoWidth-val').textContent = this.value+'px'; updateLivePreview(); });
$('f-logo-file').addEventListener('change', function(e){
  var file = e.target.files[0]; if(!file) return;
  uploadFile(file, $('logo-up-status')).then(function(url){ if(url){ Editor.draft.theme.logoUrl = url; $('f-logo').value = url; updateLivePreview(); } });
});
[['c-bg','bg'],['c-surface','surface'],['c-ink','ink'],['c-accent','accent'],['c-win','win'],['c-lose','lose']].forEach(function(pair){
  $(pair[0]).addEventListener('input', function(){
    Editor.draft.theme.colors[pair[1]] = this.value;
    $('cx-'+pair[1]).textContent = this.value;
    renderPresets();
    updateLivePreview();
  });
});
$('p-opacity').addEventListener('input', function(){ Editor.draft.theme.pattern.opacity = parseFloat(this.value); updateLivePreview(); });
$('p-scale').addEventListener('input', function(){ Editor.draft.theme.pattern.scale = parseFloat(this.value); updateLivePreview(); });
$('p-customUrl').addEventListener('input', function(){
  Editor.draft.theme.pattern.customUrl = this.value;
  if(this.value) Editor.draft.theme.pattern.type = 'custom';
  renderPatternGrid(); updateLivePreview();
});
$('p-customFile').addEventListener('change', function(e){
  var file = e.target.files[0]; if(!file) return;
  uploadFile(file, $('pattern-up-status')).then(function(url){
    if(url){ Editor.draft.theme.pattern.customUrl = url; Editor.draft.theme.pattern.type='custom'; $('p-customUrl').value=url; renderPatternGrid(); updateLivePreview(); }
  });
});

function isPresetActive(preset){
  var c = Editor.draft.theme.colors;
  return Object.keys(preset.colors).every(function(k){ return c[k] === preset.colors[k]; })
    && Editor.draft.theme.pattern.type === (preset.pattern.type || 'none');
}

function renderPresets(){
  var row = $('presetsRow'); row.innerHTML='';
  PRESETS.forEach(function(preset){
    var active = isPresetActive(preset);
    var el = document.createElement('div'); el.className='preset-swatch'+(active?' active':'');
    el.innerHTML = '<div class="sw-bar" style="background:linear-gradient(135deg,'+preset.colors.accent+','+preset.colors.win+')">'+(active?'<span class="sw-check">✓</span>':'')+'</div><span>'+preset.name+'</span>';
    el.addEventListener('click', function(){
      Object.assign(Editor.draft.theme.colors, preset.colors);
      Object.assign(Editor.draft.theme.pattern, { type:'none', color:Editor.draft.theme.colors.ink, opacity:0.06, scale:1, customUrl:'' }, preset.pattern);
      renderIdentity(); renderPresets(); renderPatternGrid(); updateLivePreview();
    });
    row.appendChild(el);
  });
}

function renderFontGrid(){
  var grid = $('fontGrid'); grid.innerHTML='';
  Object.keys(FONT_PRESETS).forEach(function(key){
    var f = FONT_PRESETS[key];
    var d = document.createElement('div');
    d.className = 'font-opt' + (Editor.draft.theme.font===key ? ' active':'');
    d.innerHTML = '<div class="fo-title" style="font-family:'+f.display+'">'+f.sample+'</div><div class="fo-name">'+f.label+'</div>';
    d.addEventListener('click', function(){
      Editor.draft.theme.font = key;
      grid.querySelectorAll('.font-opt').forEach(function(x){ x.classList.remove('active'); });
      d.classList.add('active');
      updateLivePreview();
    });
    grid.appendChild(d);
  });
}

function renderPatternGrid(){
  var grid = $('patternGrid'); grid.innerHTML='';
  var colors = Editor.draft.theme.colors;
  PATTERNS.forEach(function(p){
    var active = Editor.draft.theme.pattern.type===p.v;
    var el = document.createElement('div');
    el.className = 'pattern-opt' + (active ? ' active':'');
    var previewPattern = p.v === 'custom'
      ? { type: Editor.draft.theme.pattern.customUrl ? 'custom' : 'none', customUrl: Editor.draft.theme.pattern.customUrl, opacity: 0.35 }
      : { type: p.v, color: colors.ink, opacity: 0.35 };
    var bg = p.v === 'none' ? 'none' : patternCss(previewPattern, colors);
    el.innerHTML = '<div class="po-swatch" style="background-color:'+colors.surface+';background-image:'+bg+';background-size:40px">'+(active?'<span class="sw-check">✓</span>':'')+'</div><span>'+p.label+'</span>';
    el.addEventListener('click', function(){
      Editor.draft.theme.pattern.type = p.v;
      if(p.v !== 'none' && !Editor.draft.theme.pattern.color) Editor.draft.theme.pattern.color = Editor.draft.theme.colors.ink;
      renderPatternGrid(); renderPresets(); updateLivePreview();
    });
    grid.appendChild(el);
  });
}

function patternCss(pattern, colors){
  if(pattern.type === 'custom' && pattern.customUrl) return 'url("'+pattern.customUrl+'")';
  if(pattern.type === 'none') return 'none';
  var c = encodeURIComponent(pattern.color || colors.ink);
  var o = pattern.opacity != null ? pattern.opacity : 0.06;
  var s = 120;
  var svg = '';
  if(pattern.type==='dots') svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'"><circle cx="24" cy="24" r="7" fill="'+c+'" fill-opacity="'+o+'"/><circle cx="84" cy="72" r="7" fill="'+c+'" fill-opacity="'+o+'"/></svg>';
  else if(pattern.type==='diagonal') svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'"><path d="M0 '+s+' L'+s+' 0" stroke="'+c+'" stroke-opacity="'+o+'" stroke-width="10"/></svg>';
  else if(pattern.type==='grid') svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'"><path d="M0 0H'+s+'M0 0V'+s+'" stroke="'+c+'" stroke-opacity="'+o+'" stroke-width="2"/></svg>';
  else if(pattern.type==='stars') svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'" viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7-5.4-4.7 7.1-.6z" fill="'+c+'" fill-opacity="'+o+'"/></svg>';
  else if(pattern.type==='arabesque') svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'" viewBox="0 0 100 100"><g fill="none" stroke="'+c+'" stroke-opacity="'+o+'" stroke-width="2"><rect x="20" y="20" width="60" height="60" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="28"/></g></svg>';
  else return 'none';
  return 'url("data:image/svg+xml,'+svg.replace(/#/g,'%23')+'")';
}

function updateLivePreview(){
  var box = $('livePreview'); var d = Editor.draft;
  var f = FONT_PRESETS[d.theme.font] || FONT_PRESETS['cairo-tajawal'];
  box.style.background = d.theme.colors.bg;
  box.style.backgroundImage = patternCss(d.theme.pattern, d.theme.colors);
  box.style.backgroundSize = (120*(d.theme.pattern.scale||1))+'px';
  box.style.display='flex'; box.style.alignItems='center'; box.style.justifyContent='center'; box.style.flexDirection='column'; box.style.gap='10px'; box.style.padding='20px'; box.style.textAlign='center';
  var logoW = Math.min(d.theme.logoWidth || 180, 200);
  var logo = d.theme.logoUrl ? '<img src="'+escapeAttr(d.theme.logoUrl)+'" style="width:'+logoW+'px;max-width:70%;height:auto;max-height:110px;object-fit:contain;margin-bottom:6px">' : '';
  box.innerHTML = logo +
    '<div style="font-family:'+f.display+';font-weight:900;font-size:22px;color:'+d.theme.colors.ink+'">'+escapeHtml(d.brand.title.ar)+'</div>'+
    '<div style="font-family:'+f.body+';font-size:13px;color:'+d.theme.colors.ink+'">'+escapeHtml(d.brand.subtitle.ar)+'</div>'+
    '<button style="margin-top:10px;background:linear-gradient(135deg,'+d.theme.colors.accent+','+d.theme.colors.lose+');color:#fff;border:none;padding:10px 22px;border-radius:12px;font-weight:800;font-family:'+f.display+'">ابدأ اللعبة</button>';
}

function uploadFile(file, statusEl){
  if(statusEl) statusEl.textContent = 'جارِ الرفع...';
  var fd = new FormData(); fd.append('file', file);
  return api('POST','/api/upload', fd, true)
    .then(function(data){ if(statusEl) statusEl.textContent='تم الرفع ✓'; return data.url; })
    .catch(function(err){ if(statusEl) statusEl.textContent = err.error || 'فشل الرفع'; return null; });
}

/* -- questions tab -- */
$('addQuestionBtn').addEventListener('click', function(){
  Editor.draft.questions.push({ id: uid(), text:{ar:'',en:''}, mediaType:'none', mediaUrl:'', timeSec:null,
    options:[{text:{ar:'',en:''},correct:true},{text:{ar:'',en:''},correct:false}] });
  renderQuestions();
  var cards = document.querySelectorAll('.q-card');
  if(cards.length){ cards[cards.length-1].querySelector('.q-card-body').hidden=false; cards[cards.length-1].scrollIntoView({behavior:'smooth',block:'center'}); }
});

function renderQuestions(){
  var wrap = $('questionsList'); wrap.innerHTML='';
  Editor.draft.questions.forEach(function(q, idx){ wrap.appendChild(buildQuestionCard(q, idx)); });
  $('bankHint').textContent = 'إجمالي بنك الأسئلة الحالي: ' + Editor.draft.questions.length + ' سؤال.';
}

function buildQuestionCard(q, idx){
  var card = document.createElement('div'); card.className='q-card';
  var head = document.createElement('div'); head.className='q-card-head';
  head.innerHTML = '<span class="q-idx">'+(idx+1)+'</span>'+
    '<span class="q-title">'+(escapeHtml(q.text.ar||q.text.en)||'سؤال بدون نص بعد')+'</span>'+
    '<span class="q-meta">'+(q.mediaType!=='none' ? (q.mediaType==='image'?'🖼️':'🎬') : '')+'</span>';
  var orderBtns = document.createElement('div'); orderBtns.className='q-order-btns';
  orderBtns.innerHTML = '<button title="لأعلى">▲</button><button title="لأسفل">▼</button>';
  head.appendChild(orderBtns);

  var body = document.createElement('div'); body.className='q-card-body'; body.hidden = true;
  body.innerHTML = questionBodyHTML(q);

  head.addEventListener('click', function(e){ if(e.target.closest('.q-order-btns')) return; body.hidden = !body.hidden; });
  orderBtns.children[0].addEventListener('click', function(e){ e.stopPropagation(); moveQuestion(idx,-1); });
  orderBtns.children[1].addEventListener('click', function(e){ e.stopPropagation(); moveQuestion(idx,1); });

  card.appendChild(head); card.appendChild(body);
  wireQuestionBody(body, q, idx, head);
  return card;
}
function moveQuestion(idx, dir){
  var j = idx+dir; if(j<0 || j>=Editor.draft.questions.length) return;
  var arr = Editor.draft.questions; var t=arr[idx]; arr[idx]=arr[j]; arr[j]=t;
  renderQuestions();
}
function questionBodyHTML(q){
  var mediaShow = q.mediaType!=='none';
  var mediaPreview = '';
  if(q.mediaUrl && q.mediaType==='image') mediaPreview = '<img class="media-thumb" src="'+escapeAttr(q.mediaUrl)+'">';
  if(q.mediaUrl && q.mediaType==='video') mediaPreview = '<video class="media-thumb" src="'+escapeAttr(q.mediaUrl)+'" controls></video>';
  return ''+
    '<div class="bi-field"><label>نص السؤال</label>'+
      '<input type="text" data-f="text-ar" value="'+escapeAttr(q.text.ar)+'" placeholder="العربية" dir="rtl">'+
      '<input type="text" data-f="text-en" value="'+escapeAttr(q.text.en)+'" placeholder="English" dir="ltr">'+
    '</div>'+
    '<div class="row">'+
      '<div class="field"><label>نوع الوسائط</label><select data-f="mediaType">'+
        '<option value="none"'+(q.mediaType==='none'?' selected':'')+'>بدون وسائط</option>'+
        '<option value="image"'+(q.mediaType==='image'?' selected':'')+'>صورة</option>'+
        '<option value="video"'+(q.mediaType==='video'?' selected':'')+'>فيديو</option>'+
      '</select></div>'+
      '<div class="field"><label>وقت مخصص لهذا السؤال (ثانية، اختياري)</label><input type="number" min="3" data-f="timeSec" value="'+(q.timeSec||'')+'" placeholder="افتراضي"></div>'+
    '</div>'+
    '<div class="field" data-media-wrap style="'+(mediaShow?'':'display:none')+'">'+
      '<label>رابط الوسائط</label>'+
      '<div class="upload-row">'+
        '<input type="text" data-f="mediaUrl" value="'+escapeAttr(q.mediaUrl)+'" placeholder="https://...">'+
        '<span class="file-btn btn btn-ghost btn-sm">رفع<input type="file" data-media-file accept="image/*,video/*"></span>'+
        '<span class="up-status" data-up-status></span>'+
      '</div>'+
      '<div data-media-preview>'+mediaPreview+'</div>'+
      '<p class="hint">فيديو يوتيوب: الصق رابط المشاركة مباشرة.</p>'+
    '</div>'+
    '<div class="field"><label>الاختيارات (فعّل الدائرة بجانب الاختيار الصحيح)</label><div data-options></div>'+
      '<button class="btn btn-ghost btn-sm" data-add-opt style="margin-top:6px">+ إضافة اختيار</button>'+
    '</div>'+
    '<div class="q-card-foot"><button class="btn btn-danger btn-sm" data-del-q>حذف هذا السؤال</button></div>';
}
function wireQuestionBody(body, q, idx, headEl){
  body.querySelector('[data-f="text-ar"]').addEventListener('input', function(){ q.text.ar=this.value; headEl.querySelector('.q-title').textContent = q.text.ar||q.text.en||'سؤال بدون نص بعد'; });
  body.querySelector('[data-f="text-en"]').addEventListener('input', function(){ q.text.en=this.value; });
  var mediaTypeSel = body.querySelector('[data-f="mediaType"]');
  mediaTypeSel.addEventListener('change', function(){
    q.mediaType = this.value;
    body.querySelector('[data-media-wrap]').style.display = q.mediaType==='none' ? 'none':'';
    headEl.querySelector('.q-meta').textContent = q.mediaType!=='none' ? (q.mediaType==='image'?'🖼️':'🎬') : '';
  });
  body.querySelector('[data-f="timeSec"]').addEventListener('input', function(){ q.timeSec = this.value ? clampNum(this.value,3,600,20) : null; });
  var mediaUrlInput = body.querySelector('[data-f="mediaUrl"]');
  mediaUrlInput.addEventListener('input', function(){ q.mediaUrl = this.value; renderMediaPreview(body,q); });
  body.querySelector('[data-media-file]').addEventListener('change', function(e){
    var file=e.target.files[0]; if(!file) return;
    uploadFile(file, body.querySelector('[data-up-status]')).then(function(url){ if(url){ q.mediaUrl=url; mediaUrlInput.value=url; renderMediaPreview(body,q); } });
  });
  body.querySelector('[data-del-q]').addEventListener('click', function(){
    if(confirm('حذف هذا السؤال نهائيًا؟')){ Editor.draft.questions.splice(idx,1); renderQuestions(); }
  });
  body.querySelector('[data-add-opt]').addEventListener('click', function(){
    if(q.options.length>=6) return;
    q.options.push({text:{ar:'',en:''},correct:false});
    renderQuestions();
  });
  renderOptions(body, q);
}
function renderMediaPreview(body,q){
  var box = body.querySelector('[data-media-preview]'); box.innerHTML='';
  if(!q.mediaUrl) return;
  if(q.mediaType==='image'){ var img=document.createElement('img'); img.className='media-thumb'; img.src=q.mediaUrl; box.appendChild(img); }
  if(q.mediaType==='video'){ var v=document.createElement('video'); v.className='media-thumb'; v.src=q.mediaUrl; v.controls=true; box.appendChild(v); }
}
function renderOptions(body, q){
  var box = body.querySelector('[data-options]'); box.innerHTML='';
  var name = 'correct-'+q.id;
  q.options.forEach(function(opt, i){
    var row = document.createElement('div'); row.className='opt-row';
    row.innerHTML = '<input type="radio" name="'+name+'" '+(opt.correct?'checked':'')+' title="إجابة صحيحة">'+
      '<input type="text" value="'+escapeAttr(opt.text.ar)+'" placeholder="عربي" dir="rtl">'+
      '<input type="text" value="'+escapeAttr(opt.text.en)+'" placeholder="English" dir="ltr">'+
      (q.options.length>2 ? '<button title="حذف">✕</button>' : '<span></span>');
    row.children[0].addEventListener('change', function(){ q.options.forEach(function(o){o.correct=false;}); opt.correct=true; });
    row.children[1].addEventListener('input', function(){ opt.text.ar=this.value; });
    row.children[2].addEventListener('input', function(){ opt.text.en=this.value; });
    if(q.options.length>2){
      row.children[3].addEventListener('click', function(){
        q.options.splice(i,1);
        if(!q.options.some(function(o){return o.correct;})) q.options[0].correct=true;
        renderQuestions();
      });
    }
    box.appendChild(row);
  });
}

/* -- settings tab -- */
function renderSettings(){
  var s = Editor.draft.settings, m = Editor.draft.messages;
  $('s-count').value = s.questionCount;
  $('bankHint').textContent = 'إجمالي بنك الأسئلة الحالي: ' + Editor.draft.questions.length + ' سؤال.';
  $('s-shuffleQ').checked = s.randomizeQuestions;
  $('s-shuffleO').checked = s.randomizeOptions;
  $('s-collectName').checked = s.collectPlayerName;
  document.querySelectorAll('#timeModeSeg button').forEach(function(b){ b.classList.toggle('active', b.dataset.v===s.timeMode); });
  $('wrap-defaultTime').style.display = s.timeMode==='perQuestion' ? '' : 'none';
  $('wrap-globalTime').style.display = s.timeMode==='global' ? '' : 'none';
  $('s-defaultTime').value = s.defaultQuestionTime;
  $('s-globalTime').value = s.globalTotalTime;
  $('s-feedback').value = (s.feedbackDelayMs/1000).toFixed(1);
  $('s-winMode').value = s.winMode;
  $('wrap-passPercent').style.display = s.winMode==='auto' ? '' : 'none';
  $('s-passPercent').value = s.passPercent;
  $('s-active').checked = Editor.active;
  ['winTitle','winSubtitle','loseTitle','loseSubtitle'].forEach(function(k){
    $('m-'+k+'-ar').value = m[k].ar; $('m-'+k+'-en').value = m[k].en;
  });
}
$('s-count').addEventListener('input', function(){ Editor.draft.settings.questionCount = clampNum(this.value,1,999,5); });
$('s-shuffleQ').addEventListener('change', function(){ Editor.draft.settings.randomizeQuestions=this.checked; });
$('s-shuffleO').addEventListener('change', function(){ Editor.draft.settings.randomizeOptions=this.checked; });
$('s-collectName').addEventListener('change', function(){ Editor.draft.settings.collectPlayerName=this.checked; });
document.querySelectorAll('#timeModeSeg button').forEach(function(btn){
  btn.addEventListener('click', function(){ Editor.draft.settings.timeMode = btn.dataset.v; renderSettings(); });
});
$('s-defaultTime').addEventListener('input', function(){ Editor.draft.settings.defaultQuestionTime = clampNum(this.value,3,600,20); });
$('s-globalTime').addEventListener('input', function(){ Editor.draft.settings.globalTotalTime = clampNum(this.value,10,3600,120); });
$('s-feedback').addEventListener('input', function(){ Editor.draft.settings.feedbackDelayMs = Math.round(clampNum(this.value,0.5,6,1.6)*1000); });
$('s-winMode').addEventListener('change', function(){ Editor.draft.settings.winMode=this.value; renderSettings(); });
$('s-passPercent').addEventListener('input', function(){ Editor.draft.settings.passPercent = clampNum(this.value,0,100,60); });
$('s-active').addEventListener('change', function(){ Editor.active = this.checked; });
['winTitle','winSubtitle','loseTitle','loseSubtitle'].forEach(function(k){
  $('m-'+k+'-ar').addEventListener('input', function(){ Editor.draft.messages[k].ar = this.value; });
  $('m-'+k+'-en').addEventListener('input', function(){ Editor.draft.messages[k].en = this.value; });
});

/* -- save -- */
$('saveBtn').addEventListener('click', function(){
  var status = $('saveStatus');
  status.textContent = 'جارِ الحفظ...'; status.className = 'status-line busy';
  api('PUT', '/api/campaigns/'+Editor.id, { config: Editor.draft, isActive: Editor.active })
    .then(function(){ status.textContent='تم الحفظ ✓ — التحديث هيوصل لأي جهاز يفتح رابط اللاعبين'; status.className='status-line ok'; })
    .catch(function(err){ status.textContent = err.error || 'تعذر الحفظ'; status.className='status-line err'; });
});

/* -- results tab -- */
function loadResults(){
  api('GET','/api/campaigns/'+Editor.id+'/results').then(function(data){
    var body = $('resultsBody'); body.innerHTML='';
    $('noResults').hidden = data.results.length>0;
    data.results.forEach(function(r){
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>'+escapeHtml(r.player_name||'(بدون اسم)')+'</td>'+
        '<td>'+r.correct_count+' / '+r.total+'</td>'+
        '<td>'+r.percent+'%</td>'+
        '<td>'+(r.outcome==='win'?'فوز 🏆':'خسارة')+'</td>'+
        '<td>'+new Date(r.finished_at).toLocaleString('ar-EG')+'</td>';
      body.appendChild(tr);
    });
  });
  $('exportBtn').href = '/api/campaigns/'+Editor.id+'/results/export.xlsx';
}
$('clearResultsBtn').addEventListener('click', function(){
  showModal('<h3>تصفير كل النتائج؟</h3><p class="hint">هيتم حذف كل نتائج اللاعبين لهذا الكامبين، ومينفعش يترجع.</p>'+
    '<div class="modal-actions"><button class="btn btn-ghost btn-block" id="m-cancel">إلغاء</button><button class="btn btn-danger btn-block" id="m-clear">تصفير</button></div>',
    function(box){
      box.querySelector('#m-cancel').addEventListener('click', hideModal);
      box.querySelector('#m-clear').addEventListener('click', function(){ api('DELETE','/api/campaigns/'+Editor.id+'/results').then(function(){ hideModal(); loadResults(); }); });
    });
});

boot();
})();
