  (function(){
    var btn = document.querySelector('.menu-btn');
    var menu = document.getElementById('mobile-menu');
    if(!btn || !menu) return;
    btn.addEventListener('click', function(){
      var open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    });
    menu.addEventListener('click', function(e){
      if(e.target.tagName === 'A'){
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded','false');
        btn.setAttribute('aria-label','Mở menu');
      }
    });
  })();

  /* Hiệu ứng chiều sâu: hiện dần khi cuộn, đếm số, nghiêng bìa sách theo chuột.
     Tắt hết khi người dùng chọn giảm chuyển động. */
  (function(){
    var root = document.documentElement;
    var mm = window.matchMedia ? function(q){ return window.matchMedia(q).matches; } : function(){ return false; };
    if(mm('(prefers-reduced-motion: reduce)')) return;

    if('IntersectionObserver' in window){
      /* 1. Hiện dần, có so le (stagger) trong các lưới */
      var sel = '.section-head, .stat, .book-visual, .book-grid > div:last-child, .launch, .course-feature,' +
                ' .course-grid > .card, .sub-head, .how-steps > li, .combo, .combo-cta,' +
                ' .about-teaser, .contact-box, .quote-card, .reader-photos';
      var groups = '.stats, .course-grid, .how-steps, .combo-grid, .projects, .about, .quotes';
      var els = Array.prototype.slice.call(document.querySelectorAll(sel));
      els.forEach(function(el){
        var p = el.parentElement, i = 0;
        if(p && p.matches(groups)) i = Array.prototype.indexOf.call(p.children, el);
        el.style.setProperty('--d', (Math.min(i, 5) * 90) + 'ms');
        el.classList.add('rv');
      });
      root.classList.add('js-reveal');
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { rootMargin:'0px 0px -8% 0px', threshold:0 });
      els.forEach(function(el){ io.observe(el); });
      /* Dự phòng: khối nào đã cuộn tới hoặc cuộn qua thì hiện luôn (cuộn nhanh, bấm menu, nhảy cuối trang) */
      var pending = els.slice(), ticking = false;
      var sweep = function(){
        ticking = false;
        pending = pending.filter(function(el){
          if(el.getBoundingClientRect().top < window.innerHeight){ el.classList.add('in'); io.unobserve(el); return false; }
          return true;
        });
        if(!pending.length){ window.removeEventListener('scroll', onScroll); }
      };
      var onScroll = function(){ if(!ticking){ ticking = true; setTimeout(sweep, 150); } };
      window.addEventListener('scroll', onScroll, { passive:true });
      window.addEventListener('load', sweep);

      /* 2. Đếm tăng dần các con số thật (giữ nguyên chữ "khoảng", "gần", "năm") */
      var nums = Array.prototype.slice.call(document.querySelectorAll('.stat-num'));
      var fmt = function(n, dotted){
        var s = String(Math.round(n));
        return dotted ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : s;
      };
      var counters = [];
      nums.forEach(function(el){
        var t = el.firstChild;
        if(!t || t.nodeType !== 3) return;
        var raw = t.nodeValue.trim();
        if(!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(raw)) return;
        var target = parseInt(raw.replace(/\./g, ''), 10);
        var isYear = target >= 1900 && target <= 2100 && raw.indexOf('.') < 0;
        var c = { el:el, node:t, raw:raw, target:target, from:isYear ? target - 30 : 0, dotted:raw.indexOf('.') > -1 };
        t.nodeValue = fmt(c.from, c.dotted);
        counters.push(c);
      });
      var run = function(c){
        var start = null, dur = 1600;
        var step = function(ts){
          if(start === null) start = ts;
          var k = Math.min((ts - start) / dur, 1);
          var e = 1 - Math.pow(1 - k, 3);
          c.node.nodeValue = k < 1 ? fmt(c.from + (c.target - c.from) * e, c.dotted) : c.raw;
          if(k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      var cio = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(!en.isIntersecting) return;
          counters.forEach(function(c){ if(c.el === en.target) run(c); });
          cio.unobserve(en.target);
        });
      }, { threshold:0.5 });
      counters.forEach(function(c){ cio.observe(c.el); });
    }

    /* 3. Bìa sách ở hero nghiêng nhẹ theo chuột, chỉ trên máy có chuột */
    var hero = document.querySelector('.hero');
    var book = document.querySelector('.hero-art .book3d-inner');
    if(hero && book && mm('(pointer: fine)')){
      var raf = 0, mx = 0, my = 0;
      hero.addEventListener('pointermove', function(e){
        var r = hero.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5;
        my = (e.clientY - r.top) / r.height - 0.5;
        if(raf) return;
        raf = requestAnimationFrame(function(){
          raf = 0;
          book.style.setProperty('--ry', (-16 + mx * 16).toFixed(2) + 'deg');
          book.style.setProperty('--rx', (5 - my * 10).toFixed(2) + 'deg');
        });
      });
      hero.addEventListener('pointerleave', function(){
        book.style.removeProperty('--ry');
        book.style.removeProperty('--rx');
      });
    }
  })();

  /* Video: bấm ảnh bìa thì thay bằng trình phát YouTube và phát luôn */
  document.querySelectorAll('.yt[data-id]').forEach(function(box){
    box.querySelector('.yt-btn').addEventListener('click', function(e){
      e.preventDefault();
      var f=document.createElement('iframe');
      f.src='https://www.youtube-nocookie.com/embed/'+box.dataset.id+'?autoplay=1&rel=0&playsinline=1';
      f.title=this.getAttribute('aria-label');
      f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen=true;
      box.innerHTML=''; box.appendChild(f);
    });
  });

  /* Hai viên thuốc ở phần sách: bấm mở bảng tương ứng, bấm lại để đóng */
  document.querySelectorAll('.pill-toggle:not(.book-close)').forEach(function(b){
    b.addEventListener('click', function(){
      var open = b.getAttribute('aria-expanded') !== 'true';
      document.querySelectorAll('.pill-toggle:not(.book-close)').forEach(function(x){
        x.setAttribute('aria-expanded', 'false'); document.getElementById(x.getAttribute('aria-controls')).hidden = true;
      });
      if(open){ b.setAttribute('aria-expanded', 'true'); var pnl=document.getElementById(b.getAttribute('aria-controls')); pnl.hidden = false; pnl.scrollIntoView({ behavior:'smooth', block:'start' }); }
    });
  });

  /* Nút lên đầu trang: hiện khi đã cuộn xuống */
  (function(){
    var t = document.querySelector('.to-top'); if(!t) return;
    var f = function(){ t.classList.toggle('show', window.scrollY > 600); };
    window.addEventListener('scroll', f, { passive:true }); f();
    t.addEventListener('click', function(e){ e.preventDefault(); window.scrollTo({ top:0, behavior:'smooth' }); });
  })();

  /* Nút "Những nhận xét khác" trong ô nhận xét đầu tiên */
  (function(){
    var b=document.querySelector('.more-readers-btn'), d=document.getElementById('more-readers'); if(!b||!d) return;
    b.addEventListener('click', function(){
      d.open=!d.open; b.setAttribute('aria-expanded', d.open?'true':'false');
      b.firstChild.nodeValue = d.open ? 'Thu gọn ' : 'Những nhận xét khác từ bạn đọc ';
    });
  })();

  /* Nút Thu gọn ở cuối bảng ảnh sách */
  document.querySelectorAll('.book-close').forEach(function(b){
    b.addEventListener('click', function(){
      var pnl=document.getElementById('sach-muc-luc'); pnl.hidden=true;
      document.querySelectorAll('.pill-toggle[aria-controls="sach-muc-luc"]').forEach(function(x){ x.setAttribute('aria-expanded','false'); });
      var peek=document.querySelector('.book-peek'); if(peek) peek.scrollIntoView({ behavior:'smooth', block:'center' });
    });
  });

  /* Bấm vào bất kỳ chỗ nào trên thẻ khoá học (trừ video, nút) để sang trang chi tiết */
  document.querySelectorAll('.course').forEach(function(c){
    var d = c.querySelector('.price-detail'); if(!d) return;
    c.setAttribute('data-href', d.getAttribute('href'));
    c.addEventListener('click', function(e){
      if(e.target.closest('a, button, .yt, iframe')) return;
      location.href = c.getAttribute('data-href');
    });
  });

/* Bấm vào phần nội dung đã xổ ra thì tự thu gọn (trừ khi bấm vào link, nút, ảnh QR) */
document.addEventListener("click", function(e){
  var d = e.target.closest && e.target.closest("details[open]");
  if(!d || e.target.closest("summary, a, button, input, img")) return;
  if(window.getSelection && String(window.getSelection()).length) return;
  d.open = false;
  var r = d.getBoundingClientRect(); if(r.top < 70) d.scrollIntoView({ block:"start", behavior:"smooth" });
});

/* Trang con (Sách, Bảng giá): nút tròn quay lại ở góc dưới trái, đích = nút "Trang chủ" trên đầu */
(function(){
  if(!document.body.classList.contains('sub-page') || document.querySelector('.to-home')) return;
  var b = document.querySelector('.back');
  var h = document.createElement('a');
  h.className = 'to-home'; h.href = b ? b.getAttribute('href') : '../index.html';
  h.setAttribute('aria-label', 'Quay lại trang chủ');
  h.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
  document.body.appendChild(h);
})();

/* Bấm ảnh mục lục / đọc thử / bạn đọc: mở thư viện toàn màn hình, vuốt trái phải sang ảnh khác (như xem reel),
   chạm ảnh để phóng to rồi kéo xem, chạm lần nữa để thu nhỏ */
(function(){
  /* Trang Sách: gom tất cả ảnh trong trang thành một thư viện, vuốt xem hết từ đầu đến cuối */
  if(!document.querySelector('.toc-grid')) return;
  var anh = Array.prototype.slice.call(document.querySelectorAll('main img')).filter(function(im){
    return !im.closest('.avatar, .ico, .site-header, footer') && (im.getAttribute('width') || 0) > 200;
  });
  var links = anh.map(function(im){
    var a = im.closest('a'); var h = a && /\.(jpe?g|png|webp)$/i.test(a.getAttribute('href') || '') ? a.getAttribute('href') : im.getAttribute('src');
    return { href:h, alt:im.alt, el:(a || im) };
  });
  links.forEach(function(x, i){ x.el.style.cursor = 'zoom-in'; x.el.addEventListener('click', function(e){ e.preventDefault(); mo(links, i); }); });
  var CH = function(d){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>'; };
  function mo(links, dau){
    var gl = document.createElement('div'); gl.className = 'gl'; gl.setAttribute('role','dialog');
    gl.innerHTML = '<div class="gl-track">' + links.map(function(x){
        return '<div class="gl-slide"><img src="' + x.href + '" alt="' + (x.alt || '').replace(/"/g,'&quot;') + '" draggable="false"></div>'; }).join('') + '</div>' +
      '<button class="gl-x" type="button" aria-label="Đóng">×</button>' +
      (links.length > 1 ? '<button class="gl-nav gl-prev" type="button" aria-label="Ảnh trước">' + CH('M15 6l-6 6 6 6') + '</button><button class="gl-nav gl-next" type="button" aria-label="Ảnh sau">' + CH('M9 6l6 6-6 6') + '</button><span class="gl-n"></span>' : '');
    var tr = gl.querySelector('.gl-track'), n = gl.querySelector('.gl-n');
    function hienTai(){ return Math.round(tr.scrollLeft / tr.clientWidth); }
    function demSo(){ if(n) n.textContent = (hienTai() + 1) + ' / ' + links.length; }
    function toi(k){ k = Math.max(0, Math.min(links.length - 1, k)); tr.scrollTo({ left:k * tr.clientWidth, behavior:'smooth' }); }
    function dong(){ gl.remove(); document.documentElement.style.overflow = ''; document.removeEventListener('keydown', phim); }
    function phim(e){ if(e.key === 'Escape') dong(); else if(e.key === 'ArrowRight') toi(hienTai() + 1); else if(e.key === 'ArrowLeft') toi(hienTai() - 1); }
    tr.addEventListener('scroll', demSo, { passive:true });
    gl.querySelectorAll('.gl-slide').forEach(function(sl){
      var im = sl.querySelector('img');
      im.addEventListener('click', function(e){
        e.stopPropagation();
        var r = im.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        var z = !sl.classList.contains('z'); sl.classList.toggle('z', z); gl.classList.toggle('zoomed', z);
        if(z){ sl.scrollLeft = px * im.offsetWidth - sl.clientWidth / 2; sl.scrollTop = py * im.offsetHeight - sl.clientHeight / 2; }
      });
      sl.addEventListener('click', function(e){ if(e.target === sl && !sl.classList.contains('z')) dong(); });
    });
    gl.querySelector('.gl-x').addEventListener('click', dong);
    var p = gl.querySelector('.gl-prev'), q = gl.querySelector('.gl-next');
    if(p) p.addEventListener('click', function(){ toi(hienTai() - 1); });
    if(q) q.addEventListener('click', function(){ toi(hienTai() + 1); });
    document.addEventListener('keydown', phim);
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(gl);
    tr.scrollLeft = dau * tr.clientWidth; demSo();
  }
})();

/* Trang Sách: bấm vào icon tròn của bước cũng mở / đóng phần giải thích */
document.querySelectorAll('.timeline.has-ico .ico-tron').forEach(function(ic){
  ic.addEventListener('click', function(){ var d = ic.parentElement.querySelector('details'); if(d) d.open = !d.open; });
});
