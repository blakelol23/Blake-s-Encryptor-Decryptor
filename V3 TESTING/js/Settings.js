// Settings.js - manages Settings panel tabs and wiring
(function() {
  // Cache DOM elements
  let tabButtons = [];
  let tabs = [];
  let sections = [];
  let currentTab = 'general';
  let isInitialized = false;
  let isTransitioning = false;

  // Debounce function to limit rapid tab switches
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function cacheElements() {
    tabButtons = Array.from(document.querySelectorAll('.settings-tab'));
    tabs = tabButtons;
    sections = Array.from(document.querySelectorAll('.settings-section'));
  }

  function selectTab(tabName) {
    if (isTransitioning || currentTab === tabName) return;
    
    isTransitioning = true;
    currentTab = tabName;
    
    // Update tab states
    tabs.forEach(tab => {
      const isActive = tab.dataset.tab === tabName;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.classList.toggle('active', isActive);
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    // Update section visibility with animation
    const previousSection = document.querySelector(`.settings-section:not([hidden])`);
    const nextSection = document.getElementById(`tab-${tabName}`);
    
    if (previousSection && nextSection) {
      previousSection.style.opacity = '0';
      nextSection.hidden = false;
      nextSection.style.opacity = '0';
      
      requestAnimationFrame(() => {
        nextSection.style.transition = 'opacity 150ms ease-in-out';
        nextSection.style.opacity = '1';
        
        setTimeout(() => {
          previousSection.hidden = true;
          previousSection.style.transition = '';
          nextSection.style.transition = '';
          isTransitioning = false;
        }, 150);
      });
    } else {
      // Fallback without animation
      sections.forEach(section => {
        section.hidden = section.id !== `tab-${tabName}`;
      });
      isTransitioning = false;
    }

    try { 
      localStorage.setItem('settings.activeTab', tabName); 
    } catch (e) {}
  }

  function handleKeydown(e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    
    e.preventDefault();
    const currentIndex = tabButtons.findIndex(btn => btn.dataset.tab === currentTab);
    if (currentIndex === -1) return;

    const nextIndex = e.key === 'ArrowRight' 
      ? (currentIndex + 1) % tabButtons.length 
      : (currentIndex - 1 + tabButtons.length) % tabButtons.length;
      
    const nextTab = tabButtons[nextIndex];
    nextTab.focus();
    selectTab(nextTab.dataset.tab);
  }

  function initTabs() {
    if (isInitialized) return;
    
    cacheElements();
    if (!tabButtons.length) return;

    // Restore last active tab
    try {
      const saved = localStorage.getItem('settings.activeTab');
      if (saved) currentTab = saved;
    } catch (e) {}

    // Debounce tab selection to prevent rapid switching
    const debouncedSelectTab = debounce(selectTab, 100);

    // Add event listeners
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => debouncedSelectTab(btn.dataset.tab));
      btn.addEventListener('keydown', handleKeydown);
    });

    // Set initial tab
    selectTab(currentTab);
    isInitialized = true;
  }

  // Initialize when settings panel is opened
  function handleSettingsOpen() {
    const overlay = document.getElementById('settingsOverlay');
    if (overlay && overlay.getAttribute('aria-hidden') === 'false') {
      initTabs();
    }
  }

  // Use a single mutation observer for better performance
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'aria-hidden') {
        handleSettingsOpen();
        break;
      }
    }
  });

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('settingsOverlay');
    if (overlay) {
      observer.observe(overlay, { 
        attributes: true, 
        attributeFilter: ['aria-hidden'] 
      });
    }
  });
})();
