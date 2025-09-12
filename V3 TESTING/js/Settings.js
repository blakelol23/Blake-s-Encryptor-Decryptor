// Settings.js - manages Settings panel tabs and wiring
(function() {
  function selectTab(tabName) {
    const tabs = document.querySelectorAll('.settings-tab');
    const sections = document.querySelectorAll('.settings-section');

    tabs.forEach(tab => {
      const isActive = tab.dataset.tab === tabName;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.classList.toggle('active', isActive);
      // Ensure tabs are reachable by keyboard
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    sections.forEach(section => {
      section.hidden = section.id !== `tab-${tabName}`;
    });

    try { localStorage.setItem('settings.activeTab', tabName); } catch (e) {}
  }

  function initTabs() {
    const tabButtons = document.querySelectorAll('.settings-tab');
    if (!tabButtons.length) return;

    // Restore last active tab
    let initial = 'general';
    try {
      const saved = localStorage.getItem('settings.activeTab');
      if (saved) initial = saved;
    } catch (e) {}

    selectTab(initial);

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => selectTab(btn.dataset.tab));
      btn.addEventListener('keydown', (e) => {
        // Arrow key navigation across tabs
        const list = Array.from(tabButtons);
        const currentIndex = list.indexOf(btn);
        if (e.key === 'ArrowRight') {
          const next = list[(currentIndex + 1) % list.length];
          next.focus();
          selectTab(next.dataset.tab);
          e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
          const prev = list[(currentIndex - 1 + list.length) % list.length];
          prev.focus();
          selectTab(prev.dataset.tab);
          e.preventDefault();
        }
      });
    });
  }

  // Initialize when the panel is opened each time, to ensure elements exist
  document.addEventListener('DOMContentLoaded', initTabs);

  // Also re-init when settings opens (if openSettings is defined, hook it)
  const observer = new MutationObserver(() => {
    const overlay = document.getElementById('settingsOverlay');
    if (overlay && overlay.style.display === 'block') {
      initTabs();
    }
  });

  window.addEventListener('load', () => {
    const overlay = document.getElementById('settingsOverlay');
    if (!overlay) return;
    observer.observe(overlay, { attributes: true, attributeFilter: ['style', 'aria-hidden'] });
  });
})();
