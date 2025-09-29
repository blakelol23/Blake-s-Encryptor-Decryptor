// !MODIFICATIONS TO THIS FILE WILL RESULT IN YOU LOSING ACCESS TO THE TOOL IF CAUGHT! 
let MAX_DAILY_REPORTS = 5;
const REPORT_LIMIT_KEY = 'bugReport.daily';
let lastFocusedEl = null;

// Debug mode (for development only):
// - Enable via: localStorage.setItem('bugReport.debug', 'true') or window.DEBUG_BUGREPORT = true
// - Disable via: localStorage.removeItem('bugReport.debug') or window.DEBUG_BUGREPORT = false
let debugMode = false;
try {
  debugMode = (localStorage.getItem('bugReport.debug') === 'true') ||
              (typeof window !== 'undefined' && window.DEBUG_BUGREPORT === true);
} catch (_) { /* ignore */ }

function isDebug() { return debugMode === true; }
function getEffectiveMaxReports() { return isDebug() ? 9999999 : MAX_DAILY_REPORTS; }
function debugLog(msg) { if (isDebug()) { try { console.log('[BugReport][DEBUG]', msg); } catch(_){} } }

// Optional helpers to toggle from console
try {
  window.enableBugReportDebug = function() {
    debugMode = true; try { localStorage.setItem('bugReport.debug', 'true'); } catch(_){}
    console.info('[BugReport] Debug ENABLED: daily limit bypassed.');
  };
  window.disableBugReportDebug = function() {
    debugMode = false; try { localStorage.removeItem('bugReport.debug'); } catch(_){}
    console.info('[BugReport] Debug DISABLED: daily limit restored.');
  };
} catch (_) { /* no window */ }

function readDaily() {
  try {
    const raw = localStorage.getItem(REPORT_LIMIT_KEY);
    if (!raw) return { date: new Date().toDateString(), count: 0 };
    const obj = JSON.parse(raw);
    const today = new Date().toDateString();
    if (obj.date !== today) return { date: today, count: 0 };
    return obj;
  } catch (_) {
    return { date: new Date().toDateString(), count: 0 };
  }
}

function writeDaily(obj) {
  try { localStorage.setItem(REPORT_LIMIT_KEY, JSON.stringify(obj)); } catch (_) {}
}

function getOverlay() { return document.getElementById('bugReportOverlay'); }
function getModal() { return document.getElementById('bugReportModal'); }

function trapFocus(e) {
  const modal = getModal();
  if (!modal || e.key !== 'Tab') return;
  const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function reportBug() {
  const overlay = getOverlay();
  const modal = getModal();
  if (!overlay || !modal) return;

  // Daily limit check up front (respects debug mode)
  const lim = readDaily();
  const max = getEffectiveMaxReports();
  if (lim.count >= max) {
    showAlert(`Max ${MAX_DAILY_REPORTS} reports today. Please try again tomorrow.`, 'error');
    return;
  }

  lastFocusedEl = document.activeElement;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const titleEl = modal.querySelector('#bugTitle');
    if (titleEl) titleEl.focus();
    // Initialize custom dropdown once overlay opens
    try { initBugTypeDropdown(); } catch (_) {}
    // Initialize guidance (counters + template)
    try { initBugReportGuidance(); } catch (_) {}
  }, 50);

  // Close on overlay click (outside modal)
  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) closeBugReport();
  }, { once: true });

  // Esc to close
  window.addEventListener('keydown', handleEscapeClose);
  window.addEventListener('keydown', trapFocus);
}

function handleEscapeClose(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeBugReport();
  }
}

function closeBugReport() {
  const overlay = getOverlay();
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  window.removeEventListener('keydown', handleEscapeClose);
  window.removeEventListener('keydown', trapFocus);
  if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
    setTimeout(() => lastFocusedEl.focus(), 50);
  }
}

async function submitBugReport(event) {
  event.preventDefault();

  const overlay = getOverlay();
  const form = document.getElementById('bugReportForm');
  if (!form) return;

  // Validate
  const title = form.querySelector('#bugTitle')?.value?.trim() || '';
  const type = form.querySelector('#bugType')?.value || 'other';
  const details = form.querySelector('#bugDescription')?.value?.trim() || '';

  if (title.length < 5) { showAlert('Please enter a descriptive title (min 5 chars).', 'warning'); return; }
  if (details.length < 10) { showAlert('Please describe the issue (min 10 chars).', 'warning'); return; }

  // Rate limit (respects debug mode)
  const lim = readDaily();
  const max = getEffectiveMaxReports();
  if (lim.count >= max) {
    showAlert(`Max ${MAX_DAILY_REPORTS} reports today. Please try again tomorrow.`, 'error');
    return;
  }

  // Client-side template guard to avoid empty template submissions
  if (isTemplateClient(details)) {
    showAlert('Please replace the template with real details before submitting.', 'warning');
    return;
  }

  // Loading state
  const submitBtn = form.querySelector('button[type="submit"]');
  const cancelBtn = form.querySelector('button[type="button"]');
  submitBtn.disabled = true; cancelBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Sending…';

  // Build payload
  const uname = getUsernameForReport();
  const report = {
    title, type, details,
    url: window.location.href,
    userAgent: navigator.userAgent,
    time: new Date().toISOString(),
    createdBy: uname,
    username: uname,
  };

  try {
    console.log('[BugReport] Submitting', report);
    await fetch('https://script.google.com/macros/s/AKfycbwokqoGWdue_0ST4Ptg0TuSYHeRfiMVxkH3AlGJLG-3U4zHPPfdXbFLDkuAMGelyPio/exec', {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(report),
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('[BugReport] Submission request dispatched');
    // Persist daily usage
    writeDaily({ date: new Date().toDateString(), count: lim.count + 1 });
    showAlert('Report sent! Thank you for helping improve the app.', 'success');
    closeBugReport();
  } catch (error) {
    console.error('Error sending report:', error);
    showAlert('There was a problem sending the report. Please try again later.', 'error');
  } finally {
    if (overlay && overlay.classList.contains('open')) {
      submitBtn.disabled = false; cancelBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

// -------------------------------
// Helpers and UI enhancements
// -------------------------------

// Derive a username to attach to bug report (URL params, hash, Windows path heuristic)
function getUsernameForReport() {
  try {
    const params = new URLSearchParams(window.location.search);
    const qp = params.get('path');
    if (qp) return qp;

    const hash = (window.location.hash || '').replace(/^#/, '');
    if (hash) return hash;

    const parts = (window.location && window.location.pathname || '')
      .split(/[\\\/]/)
      .filter(Boolean);

    const usersIdx = parts.findIndex(p => p.toLowerCase() === 'users');
    if (usersIdx >= 0 && parts[usersIdx + 1]) return parts[usersIdx + 1];

    const blacklist = new Set(['downloads','encr','newest','ver','v3','v4','testing','v4 testing']);
    for (let i = parts.length - 1; i >= 0; i--) {
      const seg = parts[i].toLowerCase();
      if (!blacklist.has(seg)) return parts[i];
    }
  } catch (_) {}
  return 'Unknown';
}

// Initialize and handle a custom dropdown for bug type
function initBugTypeDropdown() {
  const hidden = document.getElementById('bugType');
  const btn = document.getElementById('bugTypeButton');
  const menu = document.getElementById('bugTypeMenu');
  if (!hidden || !btn || !menu) return;

  // Default selection if none
  if (!hidden.value) {
    setBugType('ui', 'UI');
  }

  // Toggle menu open/close
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const open = menu.getAttribute('data-open') === 'true';
    menu.setAttribute('data-open', String(!open));
    btn.setAttribute('aria-expanded', String(!open));
  });

  // Option selection
  menu.querySelectorAll('[data-value]').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.preventDefault();
      const val = opt.getAttribute('data-value');
      const label = opt.textContent.trim();
      setBugType(val, label);
      menu.setAttribute('data-open', 'false');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    });
  });

  // Close on outside click
  function onDocClick(evt) {
    const modal = getModal();
    if (!modal) return;
    if (!modal.contains(evt.target)) {
      menu.setAttribute('data-open', 'false');
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', onDocClick);
    }
  }
  document.addEventListener('click', onDocClick);
}

function setBugType(value, label) {
  const hidden = document.getElementById('bugType');
  const btn = document.getElementById('bugTypeButton');
  if (hidden) hidden.value = value || 'other';
  if (btn && label) {
    const span = btn.querySelector('.label');
    if (span) span.textContent = label;
  }
}

// Heuristic to detect if the description is still the untouched template
function isTemplateClient(text) {
  if (!text) return true;
  try {
    const t = String(text).trim().toLowerCase();
    const hasSections = t.includes('steps to reproduce:') && t.includes('expected result:') && t.includes('actual result:');
    const manyEllipses = (t.match(/\.\.\./g) || []).length >= 3;
    return hasSections && manyEllipses;
  } catch (_) {
    return false;
  }
}

// Tips: live counters + template insertion
function initBugReportGuidance() {
  const title = document.getElementById('bugTitle');
  const titleCount = document.getElementById('bugTitleCount');
  const desc = document.getElementById('bugDescription');
  const descCount = document.getElementById('bugDescriptionCount');
  const tmplBtn = document.getElementById('bugTemplateBtn');

  const TITLE_MAX = 80;
  const DESC_MAX = 1000;

  function updateTitleCount() {
    if (!title || !titleCount) return;
    const len = (title.value || '').length;
    titleCount.textContent = `${len}/${TITLE_MAX}`;
    titleCount.style.opacity = len > TITLE_MAX ? '1' : '';
    if (len > TITLE_MAX) title.value = title.value.slice(0, TITLE_MAX);
  }

  function updateDescCount() {
    if (!desc || !descCount) return;
    const len = (desc.value || '').length;
    descCount.textContent = `${len}/${DESC_MAX}`;
    descCount.style.opacity = len > DESC_MAX ? '1' : '';
    if (len > DESC_MAX) desc.value = desc.value.slice(0, DESC_MAX);
  }

  if (title) {
    title.addEventListener('input', updateTitleCount);
    updateTitleCount();
  }
  if (desc) {
    desc.addEventListener('input', updateDescCount);
    updateDescCount();
  }

  if (tmplBtn && desc) {
    tmplBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const template = `Steps to Reproduce:\n1) ...\n2) ...\n3) ...\n\nExpected Result:\n- ...\n\nActual Result:\n- ...\n\nAdditional Info:\n- Errors / screenshots / context`;
      if (!desc.value || desc.value.trim().length < 5) {
        desc.value = template;
      } else {
        desc.value = `${desc.value}\n\n${template}`;
      }
      desc.focus();
      desc.setSelectionRange(desc.value.length, desc.value.length);
      updateDescCount();
    });
  }
}

// Expose globally
window.reportBug = reportBug;
window.closeBugReport = closeBugReport;
window.submitBugReport = submitBugReport;