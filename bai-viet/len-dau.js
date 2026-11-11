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
