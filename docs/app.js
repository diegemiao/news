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
  var modalLink = document.getElementById('modalLink');
  var modalLinkWrap = document.getElementById('modalLinkWrap');
  var modalBtnSource = document.getElementById('modalBtnSource');
  var modalBtnFull = document.getElementById('modalBtnFull');

  var data = window.newsData || [];
  var fullText = '';
  var isExpanded = false;

  function formatText(text) {
    var parts = text.split(/(?<=[。！？])\s*/);
    if (parts.length <= 2) parts = text.split(/\n+/);
    return parts.filter(function(p) { return p.trim().length > 0; })
      .map(function(p) { return '<p>' + p.trim() + '</p>'; }).join('');
  }

  function openModal(n) {
    var d = data[n];
    if (!d) return;

    modalSource.textContent = d.s || '';
    modalTime.textContent = d.ti || '';
    modalTitle.textContent = d.t || '';
    modalLink.href = d.u || '#';
    fullText = d.f || '';
    isExpanded = false;

    // Show truncated first ~400 chars
    if (fullText && fullText.length > 400) {
      modalBody.innerHTML = formatText(fullText.substring(0, 400)) + '<p class="modal-truncate-hint">…</p>';
      modalBtnFull.style.display = '';
      modalBtnFull.innerHTML = '查看全部 &#9660;';
    } else {
      modalBody.innerHTML = formatText(fullText);
      modalBtnFull.style.display = 'none';
    }

    // Reset link button state
    modalLinkWrap.classList.remove('show');

    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  // Toggle full text
  modalBtnFull.addEventListener('click', function() {
    if (isExpanded) {
      modalBody.innerHTML = formatText(fullText.substring(0, 400)) + '<p class="modal-truncate-hint">…</p>';
      modalBtnFull.innerHTML = '查看全部 &#9660;';
    } else {
      modalBody.innerHTML = formatText(fullText);
      modalBtnFull.innerHTML = '收起 &#9650;';
    }
    isExpanded = !isExpanded;
  });

  // Toggle source link
  modalBtnSource.addEventListener('click', function() {
    if (modalLinkWrap.classList.contains('show')) {
      modalLinkWrap.classList.remove('show');
    } else {
      modalLinkWrap.classList.add('show');
    }
  });

  window.openNewsModal = openModal;
  window.closeNewsModal = closeModal;

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  // Click overlay backdrop to close
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal();
  });

  // ESC to close
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('show')) {
      closeModal();
    }
  });
})();
