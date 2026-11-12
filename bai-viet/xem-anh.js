/* Xem ảnh toàn màn hình, vuốt trái phải (dùng cho các ảnh trong .gal) */
/* Bấm ảnh mục lục / đọc thử / bạn đọc: mở thư viện toàn màn hình, vuốt trái phải sang ảnh khác (như xem reel),
   chạm ảnh để phóng to rồi kéo xem, chạm lần nữa để thu nhỏ */
(function(){
  /* Trang Sách: gom tất cả ảnh trong trang thành một thư viện, vuốt xem hết từ đầu đến cuối */
  var anh = Array.prototype.slice.call(document.querySelectorAll('.gal img'));
  if(!anh.length) return;
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
    /* Gạt lên hoặc gạt xuống để thoát (như xem ảnh trên Facebook) */
    var sy = null, sx = 0, dy = 0;
    gl.addEventListener('touchstart', function(e){ if(gl.classList.contains('zoomed') || e.touches.length > 1) return; sy = e.touches[0].clientY; sx = e.touches[0].clientX; dy = 0; tr.style.transition = 'none'; }, { passive:true });
    gl.addEventListener('touchmove', function(e){ if(sy === null) return; var x = e.touches[0].clientX - sx; dy = e.touches[0].clientY - sy;
      if(Math.abs(dy) > Math.abs(x) && Math.abs(dy) > 10){ tr.style.transform = 'translateY(' + dy + 'px)'; gl.style.backgroundColor = 'rgba(10,12,30,' + Math.max(.2, .94 - Math.abs(dy) / 500) + ')'; } }, { passive:true });
    gl.addEventListener('touchend', function(){ if(sy === null) return; sy = null; tr.style.transition = 'transform .2s';
      if(Math.abs(dy) > 90){ tr.style.transform = 'translateY(' + (dy > 0 ? '100%' : '-100%') + ')'; setTimeout(dong, 180); }
      else { tr.style.transform = ''; gl.style.backgroundColor = ''; } });
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
