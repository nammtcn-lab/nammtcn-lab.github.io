/* Mở trang con luôn bắt đầu từ đầu trang (trình xem đôi khi giữ vị trí cuộn của trang trước) */
try{ if('scrollRestoration' in history) history.scrollRestoration = 'manual'; }catch(e){}
if(!location.hash){ window.scrollTo(0, 0); window.addEventListener('load', function(){ window.scrollTo(0, 0); }); }
if(!document.querySelector('.zalo-float')) document.body.classList.add('no-zalo');
/* Nút tròn lên đầu trang, nằm trên nút Zalo, hiện khi đã cuộn xuống */
(function(){
  var t = document.createElement('a');
  t.className = 'to-top'; t.href = '#'; t.setAttribute('aria-label', 'Lên đầu trang');
  t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(t);
  var f = function(){ t.classList.toggle('show', window.scrollY > 600); };
  window.addEventListener('scroll', f, { passive:true }); f();
  t.addEventListener('click', function(e){ e.preventDefault(); window.scrollTo({ top:0, behavior:'smooth' }); });
})();

/* Nút tròn về trang chủ, góc dưới bên trái (chỉ ở các trang con) */
(function(){
  var h = document.createElement('a');
  /* Quay lại 1 tầng: dùng đích của nút quay lại trên đầu trang (bài viết -> danh sách bài, khoá học -> phần khoá học...) */
  var b = document.querySelector('.back');
  h.className = 'to-home'; h.href = b ? b.getAttribute('href') : '../index.html';
  h.setAttribute('aria-label', b ? b.textContent.trim() : 'Về trang chủ');
  h.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
  document.body.appendChild(h);
})();
