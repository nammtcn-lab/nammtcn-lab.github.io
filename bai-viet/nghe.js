/* Nghe bài viết: đọc to bằng giọng tiếng Việt có sẵn trong máy (Web Speech API).
   Đọc từng đoạn, tô sáng đoạn đang đọc, có tạm dừng, lùi/tới đoạn, đổi tốc độ.
   Máy không có giọng tiếng Việt thì nút không hiện. */
(function(){
  var synth = window.speechSynthesis;
  var nut = document.querySelector('.listen');
  if(!synth || !nut || typeof SpeechSynthesisUtterance === 'undefined') return;

  var doan = [document.querySelector('.article h1'), document.querySelector('.lede')]
    .concat(Array.prototype.slice.call(document.querySelectorAll('.prose p, .prose li')))
    .filter(function(el){ return el && el.textContent.trim(); });
  var giong = null, dsGiong = [], i = 0, dangDoc = false, tocDo = 1, phien = 0;
  var TOC = [1, 1.25, 1.5, 0.85];
  /* Độ cao giọng: mặc định hạ xuống cho bớt the thé; tốc độ gốc chậm hơn một chút */
  var CAO = [{ ten:'Trầm', v:0.85 }, { ten:'Vừa', v:1 }, { ten:'Trầm hơn', v:0.72 }];
  var TOC_GOC = 0.95;
  function nho(k, v){ try{ if(v === undefined) return localStorage.getItem('nghe-' + k); localStorage.setItem('nghe-' + k, v); }catch(e){ return null; } }
  var cao = CAO[Math.max(0, CAO.map(function(c){ return c.ten; }).indexOf(nho('cao')))] || CAO[0];

  /* Xếp hạng giọng: ưu tiên bản nâng cao / tự nhiên */
  function diem(v){
    var n = v.name || '';
    return (/enhanced|premium|nâng cao|natural|neural|online/i.test(n) ? 10 : 0) + (/google|microsoft/i.test(n) ? 3 : 0) + (/linh|an\b|hoaimy|namminh/i.test(n) ? 1 : 0);
  }
  function tenGon(v){ var n = v.name || ''; var g = n.replace(/\(.*?\)/g, '').replace(/tiếng việt|vietnamese|vietnam|online|natural/ig, '').replace(/[-–]\s*$/, '').replace(/\s+/g, ' ').trim(); return (g || 'Giọng ' + (dsGiong.indexOf(v) + 1)) + (/enhanced|premium|nâng cao|natural|neural/i.test(n) ? ' ✦' : ''); }
  function chonGiong(){
    var ds = synth.getVoices() || [];
    dsGiong = ds.filter(function(v){ return /^vi/i.test(v.lang); }).sort(function(a, b){ return diem(b) - diem(a); });
    var daChon = nho('giong');
    giong = dsGiong.filter(function(v){ return v.name === daChon; })[0] || dsGiong[0] || null;
    nut.hidden = !giong;
    if(window.capNhatNutGiong) window.capNhatNutGiong();
  }
  chonGiong();
  if(synth.addEventListener) synth.addEventListener('voiceschanged', chonGiong);
  else synth.onvoiceschanged = chonGiong;

  /* Thanh điều khiển nổi ở cuối màn hình */
  var thanh = document.createElement('div');
  thanh.className = 'player'; thanh.hidden = true;
  thanh.setAttribute('role', 'region'); thanh.setAttribute('aria-label', 'Trình nghe bài viết');
  thanh.innerHTML =
    '<button type="button" class="p-btn" data-act="lui" aria-label="Đoạn trước">‹‹</button>' +
    '<button type="button" class="p-btn p-main" data-act="choi" aria-label="Tạm dừng">❚❚</button>' +
    '<button type="button" class="p-btn" data-act="toi" aria-label="Đoạn sau">››</button>' +
    '<span class="p-info"><b>Đang đọc</b><span class="p-pos"></span></span>' +
    '<button type="button" class="p-btn p-speed p-voice" data-act="giong" aria-label="Đổi giọng đọc" hidden>Giọng</button>' +
    '<button type="button" class="p-btn p-speed p-pitch" data-act="cao" aria-label="Đổi độ cao giọng">' + cao.ten + '</button>' +
    '<button type="button" class="p-btn p-speed" data-act="toc" aria-label="Đổi tốc độ đọc">1×</button>' +
    '<button type="button" class="p-btn p-close" data-act="tat" aria-label="Tắt nghe">✕</button>';
  document.body.appendChild(thanh);
  var nutChoi = thanh.querySelector('[data-act="choi"]');
  var nutToc = thanh.querySelector('[data-act="toc"]');
  var viTri = thanh.querySelector('.p-pos');
  var nutGiong = thanh.querySelector('[data-act="giong"]');
  var nutCao = thanh.querySelector('[data-act="cao"]');
  window.capNhatNutGiong = function(){
    nutGiong.hidden = dsGiong.length < 2;
    if(giong) nutGiong.textContent = tenGon(giong);
  };
  window.capNhatNutGiong();

  function toSang(){
    doan.forEach(function(el, k){ el.classList.toggle('reading', k === i && dangDoc); });
    viTri.textContent = ' · đoạn ' + (i + 1) + '/' + doan.length;
    nutChoi.textContent = dangDoc ? '❚❚' : '▶';
    nutChoi.setAttribute('aria-label', dangDoc ? 'Tạm dừng' : 'Đọc tiếp');
    var el = doan[i];
    if(dangDoc && el){
      var r = el.getBoundingClientRect();
      if(r.top < 80 || r.bottom > window.innerHeight - 100) el.scrollIntoView({ behavior:'smooth', block:'center' });
    }
  }

  function doc(){
    synth.cancel();
    if(i >= doan.length){ dung(true); return; }
    var p = ++phien;
    var u = new SpeechSynthesisUtterance(doan[i].textContent.replace(/\s+/g, ' ').trim());
    u.voice = giong; u.lang = giong ? giong.lang : 'vi-VN'; u.rate = tocDo * TOC_GOC; u.pitch = cao.v;
    u.onend = function(){ if(p !== phien || !dangDoc) return; i++; toSang(); doc(); };
    u.onerror = function(){ if(p !== phien) return; dangDoc = false; toSang(); };
    dangDoc = true; toSang();
    synth.speak(u);
  }

  function dung(xong){
    phien++; synth.cancel(); dangDoc = false;
    if(xong){ i = 0; }
    toSang();
  }

  function batDau(){
    thanh.hidden = false; document.body.classList.add('is-listening');
    doc();
  }

  nut.addEventListener('click', function(){ if(dangDoc){ dung(); } else { batDau(); } });

  thanh.addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    var act = b.dataset.act;
    if(act === 'choi'){ if(dangDoc) dung(); else doc(); }
    else if(act === 'lui'){ i = Math.max(0, i - 1); if(dangDoc) doc(); else toSang(); }
    else if(act === 'toi'){ i = Math.min(doan.length - 1, i + 1); if(dangDoc) doc(); else toSang(); }
    else if(act === 'toc'){
      tocDo = TOC[(TOC.indexOf(tocDo) + 1) % TOC.length];
      nutToc.textContent = String(tocDo).replace('.', ',') + '×';
      if(dangDoc) doc();
    }
    else if(act === 'giong' && dsGiong.length > 1){
      giong = dsGiong[(dsGiong.indexOf(giong) + 1) % dsGiong.length]; nho('giong', giong.name);
      window.capNhatNutGiong(); if(dangDoc) doc();
    }
    else if(act === 'cao'){
      cao = CAO[(CAO.indexOf(cao) + 1) % CAO.length]; nho('cao', cao.ten);
      nutCao.textContent = cao.ten; if(dangDoc) doc();
    }
    else if(act === 'tat'){ dung(); thanh.hidden = true; document.body.classList.remove('is-listening'); doan.forEach(function(el){ el.classList.remove('reading'); }); }
  });

  /* Bấm vào một đoạn khi đang mở trình nghe thì đọc từ đoạn đó */
  doan.forEach(function(el, k){
    el.addEventListener('click', function(){ if(thanh.hidden) return; i = k; doc(); });
  });

  window.addEventListener('pagehide', function(){ synth.cancel(); });
})();
