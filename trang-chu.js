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

/* Bấm ảnh mục lục / trang đọc thử: mở toàn màn hình, chạm 2 lần hoặc bấm để phóng to, vuốt để xem */
(function(){
  var links = document.querySelectorAll('.toc-grid a, .sample-track a, .reader-grid a');
  if(!links.length) return;
  function mo(src, alt){
    var lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role','dialog');
    lb.innerHTML = '<img alt=""><button class="lb-x" type="button" aria-label="Đóng">×</button><span class="lb-tip">Chạm ảnh để phóng to · thu nhỏ</span>';
    var im = lb.querySelector('img'); im.src = src; im.alt = alt || '';
    function dong(){ lb.remove(); document.documentElement.style.overflow = ''; document.removeEventListener('keydown', phim); }
    function phim(e){ if(e.key === 'Escape') dong(); }
    im.addEventListener('click', function(e){
      e.stopPropagation();
      var r = im.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      lb.classList.toggle('zoom');
      if(lb.classList.contains('zoom')){ lb.scrollLeft = px * im.offsetWidth - innerWidth / 2; lb.scrollTop = py * im.offsetHeight - innerHeight / 2; }
    });
    lb.addEventListener('click', function(e){ if(e.target === lb) dong(); });
    lb.querySelector('.lb-x').addEventListener('click', dong);
    document.addEventListener('keydown', phim);
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(lb);
  }
  links.forEach(function(a){
    a.addEventListener('click', function(e){ e.preventDefault(); var i = a.querySelector('img'); mo(a.getAttribute('href'), i && i.alt); });
  });
})();
