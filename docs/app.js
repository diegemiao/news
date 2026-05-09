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

// Modal logic
(function() {
  var overlay = document.getElementById('modalOverlay');
  var closeBtn = document.getElementById('modalClose');
  var modalTitle = document.getElementById('modalTitle');
  var modalBody = document.getElementById('modalBody');
  var modalSource = document.getElementById('modalSource');
  var modalTime = document.getElementById('modalTime');
  var modalBtnSource = document.getElementById('modalBtnSource');
  var modalBtnFull = document.getElementById('modalBtnFull');

  var data = window.newsData || [];
  var fullText = '';
  var shortText = '';
  var isExpanded = false;

  function openModal(n) {
    var d = data[n];
    if (!d) return;

    modalSource.textContent = d.s || '';
    modalTime.textContent = d.ti || '';
    modalTitle.textContent = d.t || '';
    modalBtnSource.href = d.u || '#';
    fullText = d.f || '';
    isExpanded = false;

    var paras = fullText.split('</p>').filter(function(p) { return p.trim(); });
    if (paras.length > 3) {
      shortText = paras.slice(0, 3).join('</p>') + '</p><p class="modal-truncate-hint">…</p>';
      modalBody.innerHTML = shortText;
      modalBtnFull.style.display = '';
      modalBtnFull.innerHTML = '查看全部 &#9660;';
    } else {
      modalBody.innerHTML = fullText || '';
      modalBtnFull.style.display = 'none';
    }

    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  modalBtnFull.addEventListener('click', function() {
    if (isExpanded) {
      modalBody.innerHTML = shortText;
      modalBtnFull.innerHTML = '查看全部 &#9660;';
    } else {
      modalBody.innerHTML = fullText || '';
      modalBtnFull.innerHTML = '收起 &#9650;';
    }
    isExpanded = !isExpanded;
  });

  window.openNewsModal = openModal;
  window.closeNewsModal = closeModal;

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('show')) {
      closeModal();
    }
  });
})();
