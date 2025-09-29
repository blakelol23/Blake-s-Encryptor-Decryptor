// Settings.js - manages Settings panel tabs and wiring
(function() {
  // Cache DOM elements
  let tabButtons = [];
  let tabs = [];
  let sections = [];
  let currentTab = 'general';
  let isInitialized = false;
  let isTransitioning = false;

  // Enhanced Password Protection System
  const PASSWORD_SETTINGS_KEY = 'passwordSettings';
  const PASSWORD_ATTEMPTS_KEY = 'passwordAttempts';
  const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

  // Password protection state
  let passwordSettings = {
    isEnabled: false,
    autoLock: true,
    failedAttempts: 0,
    lastUnlock: null,
    passwordHash: null,
    passwordSalt: null,
    iterations: 100000,
    keyLength: 32,
    hash: 'SHA-256'
  };

  let inactivityTimer = null;
  let isLocked = false;

  // Initialize password protection
  function initPasswordProtection() {
    try {
      const savedSettings = localStorage.getItem(PASSWORD_SETTINGS_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        passwordSettings = { ...passwordSettings, ...parsed };
        isLocked = passwordSettings.isEnabled;
        updatePasswordUI();
        
        if (passwordSettings.isEnabled && passwordSettings.autoLock) {
          startInactivityTimer();
        }
      }
    } catch (error) {
      console.error('Error initializing password protection:', error);
      showAlert('Error initializing password protection', 'error');
    }
  }

  // Generate a random salt
  async function generateSalt(length = 16) {
    const salt = new Uint8Array(length);
    window.crypto.getRandomValues(salt);
    return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Hash password using PBKDF2
  async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: passwordSettings.iterations,
        hash: passwordSettings.hash
      },
      keyMaterial,
      passwordSettings.keyLength * 8
    );
    
    return Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Check password strength
  function checkPasswordStrength(password) {
    let strength = 0;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSymbols = /[^A-Za-z0-9]/.test(password);
    
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (hasLower && hasUpper) strength++;
    if (hasNumbers) strength++;
    if (hasSymbols) strength++;
    
    return Math.min(strength, 5);
  }

  // Save password settings
  function savePasswordSettings() {
    try {
      localStorage.setItem(PASSWORD_SETTINGS_KEY, JSON.stringify(passwordSettings));
    } catch (error) {
      console.error('Error saving password settings:', error);
      showAlert('Error saving password settings', 'error');
    }
  }

  // Toggle password protection
  async function togglePasswordProtection() {
    const enable = document.getElementById('enablePasswordProtection').checked;
    
    if (enable && !passwordSettings.passwordHash) {
      showPasswordSetupModal();
    } else {
      passwordSettings.isEnabled = enable;
      savePasswordSettings();
      updatePasswordUI();
      showAlert(enable ? 'Password protection enabled' : 'Password protection disabled', 'success');
    }
  }

  // Show modal dialog
function showModal(title, content) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-header">
        <h3 id="modalTitle">${title}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-content">
        ${content}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

// Close modal
function closeModal() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) modal.remove();
}

// Show password setup modal
function showPasswordSetupModal() {
    const modalContent = `
      <div class="modal-content">
        <h3>Set Up Password Protection</h3>
        <div class="form-group">
          <label for="newPassword">New Password</label>
          <input type="password" id="newPassword" placeholder="Enter a strong password" autofocus>
          <div class="password-strength">
            <div class="strength-meter">
              <div class="strength-bar" id="passwordStrength"></div>
            </div>
            <small id="passwordStrengthText">Password strength: Weak</small>
          </div>
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input type="password" id="confirmPassword" placeholder="Confirm your password">
        </div>
        <div class="form-actions">
          <button class="btn" onclick="saveNewPassword()">Save Password</button>
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
      </div>
    `;
    
    showModal('Password Setup', modalContent);
    
    // Add password strength indicator
    document.getElementById('newPassword').addEventListener('input', (e) => {
      const strength = checkPasswordStrength(e.target.value);
      updatePasswordStrengthMeter(strength);
    });
  }

  // Update password strength meter
  function updatePasswordStrengthMeter(strength) {
    const strengthMeter = document.getElementById('passwordStrength');
    const strengthText = document.getElementById('passwordStrengthText');
    const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['#ff4444', '#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#2ecc71'];
    
    strengthMeter.style.width = `${(strength / 5) * 100}%`;
    strengthMeter.style.backgroundColor = colors[strength];
    strengthText.textContent = `Password strength: ${strengthLabels[strength]}`;
  }

  // Save new password
  async function saveNewPassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
      showAlert('Passwords do not match', 'error');
      return;
    }
    
    if (newPassword.length < 8) {
      showAlert('Password must be at least 8 characters long', 'error');
      return;
    }
    
    try {
      const salt = await generateSalt();
      const hash = await hashPassword(newPassword, salt);
      
      passwordSettings.passwordHash = hash;
      passwordSettings.passwordSalt = salt;
      passwordSettings.isEnabled = true;
      passwordSettings.failedAttempts = 0;
      passwordSettings.lastUnlock = Date.now();
      
      savePasswordSettings();
      updatePasswordUI();
      closeModal();
      showAlert('Password protection enabled successfully', 'success');
    } catch (error) {
      console.error('Error saving password:', error);
      showAlert('Error saving password', 'error');
    }
  }

  // Inactivity timer functions
  function startInactivityTimer() {
    resetInactivityTimer();
    
    // Add event listeners for user activity
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
      document.addEventListener(event, resetInactivityTimer);
    });
  }

  function resetInactivityTimer() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    
    if (passwordSettings.isEnabled && passwordSettings.autoLock) {
      inactivityTimer = setTimeout(() => {
        if (!isLocked) {
          lockApp();
        }
      }, INACTIVITY_TIMEOUT);
    }
  }

  // Lock the application
  function lockApp() {
    isLocked = true;
    document.body.classList.add('locked');
    showModal('Session Locked', `
      <div class="locked-message">
        <p>This session has been locked due to inactivity.</p>
        <div class="form-group">
          <label for="unlockPassword">Password</label>
          <input type="password" id="unlockPassword" placeholder="Enter your password" autofocus>
        </div>
        <button class="btn" onclick="unlockApp()">Unlock</button>
      </div>
    `);
  }

  // Unlock the application
  async function unlockApp() {
    const password = document.getElementById('unlockPassword').value;
    const isValid = await verifyPassword(password);
    
    if (isValid) {
      closeModal();
      document.body.classList.remove('locked');
      resetInactivityTimer();
    }
  }

  // Verify password
  async function verifyPassword(password) {
    if (!passwordSettings.isEnabled) return true;
    
    try {
      // Rate limiting
      const attempts = JSON.parse(localStorage.getItem(PASSWORD_ATTEMPTS_KEY) || '[]');
      const recentAttempts = attempts.filter(t => t > Date.now() - 15 * 60 * 1000);
      
      if (recentAttempts.length >= 5) {
        const waitTime = Math.ceil((recentAttempts[0] + 15 * 60 * 1000 - Date.now()) / 1000 / 60);
        showAlert(`Too many failed attempts. Please try again in ${waitTime} minutes.`, 'error');
        return false;
      }
      
      const hash = await hashPassword(password, passwordSettings.passwordSalt);
      const isValid = hash === passwordSettings.passwordHash;
      
      if (isValid) {
        passwordSettings.failedAttempts = 0;
        passwordSettings.lastUnlock = Date.now();
        savePasswordSettings();
        isLocked = false;
        
        if (passwordSettings.autoLock) {
          resetInactivityTimer();
        }
        
        return true;
      } else {
        // Record failed attempt
        recentAttempts.push(Date.now());
        localStorage.setItem(PASSWORD_ATTEMPTS_KEY, JSON.stringify(recentAttempts));
        
        const attemptsLeft = 5 - recentAttempts.length;
        if (attemptsLeft > 0) {
          showAlert(`Incorrect password. ${attemptsLeft} attempts remaining.`, 'error');
        } else {
          showAlert('Too many failed attempts. Please try again later.', 'error');
        }
        
        return false;
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  // Update UI based on password protection state
  function updatePasswordUI() {
    const passwordToggle = document.getElementById('enablePasswordProtection');
    const passwordSettingsEl = document.getElementById('passwordSettings');
    
    if (passwordToggle && passwordSettingsEl) {
      passwordToggle.checked = passwordSettings.isEnabled;
      passwordSettingsEl.style.display = passwordSettings.isEnabled ? 'block' : 'none';
    }
  }

  // Initialize password protection on page load
document.addEventListener('DOMContentLoaded', () => {
  // Expose functions to global scope
  window.togglePasswordProtection = togglePasswordProtection;
  window.saveNewPassword = saveNewPassword;
  window.closeModal = closeModal;
  window.unlockApp = unlockApp;
  
  initPasswordProtection();
    
    // Add event listeners for password protection
    const passwordToggle = document.getElementById('enablePasswordProtection');
    if (passwordToggle) {
      passwordToggle.addEventListener('change', togglePasswordProtection);
    }
    
    // Auto-lock toggle
    const autoLockToggle = document.getElementById('autoLock');
    if (autoLockToggle) {
      autoLockToggle.checked = passwordSettings.autoLock;
      autoLockToggle.addEventListener('change', (e) => {
        passwordSettings.autoLock = e.target.checked;
        savePasswordSettings();
        
        if (passwordSettings.autoLock) {
          startInactivityTimer();
        } else if (inactivityTimer) {
          clearTimeout(inactivityTimer);
        }
      });
    }
  });

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
