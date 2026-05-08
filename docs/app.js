// Category tab filtering
(function() {
  var tabs = document.querySelectorAll('.tab');
  var sections = document.querySelectorAll('.category-section');

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var cat = this.dataset.cat;

      tabs.forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');

      sections.forEach(function(sec) {
        if (cat === '全部' || sec.dataset.cat === cat) {
          sec.classList.remove('hidden');
        } else {
          sec.classList.add('hidden');
        }
      });
    });
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function() {});
  }
})();
