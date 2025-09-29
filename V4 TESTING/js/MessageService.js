// toggle verbose logging (reads from global window.DEBUG_MODE if set)
const MS_DEBUG = (typeof window !== 'undefined' && typeof window.DEBUG_MODE === 'boolean') ? window.DEBUG_MODE : false;

const MessageService = (function() {
  function safeAlert(msg, type) {
    try { if (typeof showAlert === 'function') showAlert(msg, type); } catch (_) {}
  }
  //endpoint resolution order: window.__MS_ENDPOINT__ (from config.js) -> localStorage.messageServiceEndpoint -> ''
  const ENDPOINT_URL = (typeof window !== 'undefined' && window.__MS_ENDPOINT__) || localStorage.getItem('messageServiceEndpoint') || '';
  if (MS_DEBUG) {
    console.log('[MessageService] Endpoint configured:', ENDPOINT_URL);
    safeAlert(`[MessageService] Endpoint set to: ${ENDPOINT_URL}`, 'success');
  }

  function getUsernameFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const qp = params.get('path');
      if (qp) return qp;

      const hash = (window.location.hash || '').replace(/^#/, '');
      if (hash) return hash;

      const parts = (window.location && window.location.pathname || '').split(/[\\/]/).filter(Boolean);
      //prefer windows path pattern: .../Users/<username>/...
      const usersIdx = parts.findIndex(p => p.toLowerCase() === 'users');
      if (usersIdx >= 0 && parts[usersIdx + 1]) return parts[usersIdx + 1];

      //otherwise, take the last segment that isn't a common folder name
      const blacklist = new Set(['downloads', 'encr', 'newest', 'ver', 'v3', 'testing']);
      for (let i = parts.length - 1; i >= 0; i--) {
        const seg = parts[i].toLowerCase();
        if (!blacklist.has(seg)) return parts[i];
      }
    } catch (_) {}
    return 'Unknown';
  }

  function getEndpoint() {
    const url = ENDPOINT_URL || localStorage.getItem('messageServiceEndpoint');
    if (!url) {
      console.warn('MessageService endpoint not configured. Set localStorage.messageServiceEndpoint');
      safeAlert(`[MessageService] Endpoint not configured. Set localStorage.messageServiceEndpoint`, 'error');
      sentryLockMS('Missing Endpoint', {
        hint: 'Set localStorage.messageServiceEndpoint to your deployed Apps Script Web App URL',
        urlExample: 'https://script.google.com/macros/s/DEPLOY_ID/exec'
      });
    }
    if (MS_DEBUG) {
      console.log('[MessageService] getEndpoint -> returning', url);
    }
    return url;
  }

  async function probeEndpoint() {
    const url = getEndpoint();
    if (!url) return;
    const label = 'IS THE ENDPOINT WORKING AND FUNCTIONAL?';
    // Fire-and-forget no-cors probe to avoid preflight/CORS console errors
    try {
      const body = `payload=${encodeURIComponent(JSON.stringify({ action: 'ping', t: Date.now() }))}`;
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body
      });
      if (MS_DEBUG) console.log(`[MessageService] ${label}`, 'no-cors probe sent (response not readable due to CORS)');
    } catch (e) {
      console.error('[MessageService] Endpoint probe failed:', e);
      sentryLockMS('Endpoint Probe Failed', { error: e && e.message, url });
    }
  }

  async function createMessage({ id, encryptedText, expiryTime }) {
    const url = getEndpoint();
    if (!url) return;

    // Try to extract username from URL path (e.g., /.../{username}/...)
    const createdBy = getUsernameFromUrl();

    const payload = {
      action: 'createMessage',
      id,
      expiryTime: expiryTime || null,
      encryptedText,
      createdBy,
      decryptedCount: 0,
      createdAt: Date.now(),
    };

    try {
      if (MS_DEBUG) console.log('[MessageService] createMessage -> sending', { url, payload });
      const body = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      if (MS_DEBUG) console.log('[MessageService] createMessage -> sent');
    } catch (e) {
      console.error('MessageService.createMessage failed:', e);
      sentryLockMS('Create Message Failed', { error: e && e.message, id, hasUrl: !!url });
    }
  }

  async function incrementDecryptionCount(id) {
    const url = getEndpoint();
    if (!url || !id) return;

    try {
      if (MS_DEBUG) console.log('[MessageService] incrementDecryptionCount -> sending', { url, id });
      const body = `payload=${encodeURIComponent(JSON.stringify({ action: 'incrementDecryption', id }))}`;
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      if (MS_DEBUG) console.log('[MessageService] incrementDecryptionCount -> sent');
    } catch (e) {
      console.error('MessageService.incrementDecryptionCount failed:', e);
      sentryLockMS('Increment Decryption Failed', { error: e && e.message, id });
    }
  }

  async function purgeExpired() {
    const url = getEndpoint();
    if (!url) return;

    try {
      if (MS_DEBUG) console.log('[MessageService] purgeExpired -> sending', { url });
      const body = `payload=${encodeURIComponent(JSON.stringify({ action: 'purgeExpired' }))}`;
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      if (MS_DEBUG) console.log('[MessageService] purgeExpired -> sent');
    } catch (e) {
      console.error('MessageService.purgeExpired failed:', e);
      sentryLockMS('Purge Expired Failed', { error: e && e.message });
    }
  }

  async function markExpired(id) {
    const url = getEndpoint();
    if (!url || !id) return;

    try {
      if (MS_DEBUG) console.log('[MessageService] markExpired -> sending', { url, id });
      const body = `payload=${encodeURIComponent(JSON.stringify({ action: 'markExpired', id }))}`;
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      if (MS_DEBUG) console.log('[MessageService] markExpired -> sent');
    } catch (e) {
      console.error('MessageService.markExpired failed:', e);
      sentryLockMS('Mark Expired Failed', { error: e && e.message, id });
    }
  }

  // Kick off endpoint probe on load
  try { probeEndpoint(); } catch (_) {}

  const svc = { createMessage, incrementDecryptionCount, purgeExpired, markExpired, getEndpoint, probeEndpoint };
  try { window.MessageService = svc; } catch (_) {}
  return svc;
})();

// Custom MessageService tamper/safety lock
function sentryLockMS(title, details = {}) {
  try {
    // Prevent duplicate overlays
    if (document.getElementById('ms-lock-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ms-lock-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(10, 12, 16, 0.92)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const card = document.createElement('div');
    card.style.width = 'min(680px, 92vw)';
    card.style.maxHeight = '86vh';
    card.style.overflow = 'auto';
    card.style.background = 'linear-gradient(180deg, #0f172a, #111827)';
    card.style.border = '1px solid rgba(148,163,184,0.2)';
    card.style.borderRadius = '16px';
    card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    card.style.padding = '22px 24px';
    card.style.color = '#e5e7eb';
    card.style.fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

    const h = document.createElement('div');
    h.style.fontSize = '20px';
    h.style.fontWeight = '700';
    h.style.marginBottom = '8px';
    h.textContent = `MessageService Protection: ${title}`;

    const sub = document.createElement('div');
    sub.style.fontSize = '13px';
    sub.style.opacity = '0.8';
    sub.style.marginBottom = '12px';
    sub.textContent = 'We detected an issue with the secure message backend. For your safety, access is limited until this is resolved.';

    const list = document.createElement('div');
    list.style.background = 'rgba(30,41,59,0.7)';
    list.style.border = '1px solid rgba(148,163,184,0.15)';
    list.style.borderRadius = '12px';
    list.style.padding = '12px 14px';
    list.style.fontSize = '13px';
    list.style.lineHeight = '1.5';
    list.innerHTML = `
      <div style="margin-bottom:8px;color:#93c5fd">Diagnostics</div>
      <div>• Endpoint: <code style="color:#eab308">${(localStorage.getItem('messageServiceEndpoint')||'') || 'not set'}</code></div>
      ${details && details.url ? `<div>• Attempted URL: <code style="color:#f59e0b">${details.url}</code></div>` : ''}
      ${details && details.error ? `<div>• Error: <code style="color:#f87171">${details.error}</code></div>` : ''}
      ${details && details.hint ? `<div>• Hint: ${details.hint}</div>` : ''}
      ${details && details.urlExample ? `<div>• Example: <code>${details.urlExample}</code></div>` : ''}
    `;

    const actions = document.createElement('div');
    actions.style.marginTop = '14px';
    actions.style.display = 'flex';
    actions.style.gap = '10px';

    const btnCopy = document.createElement('button');
    btnCopy.textContent = 'Copy Diagnostics';
    btnCopy.style.padding = '8px 12px';
    btnCopy.style.background = '#334155';
    btnCopy.style.border = '1px solid rgba(148,163,184,0.3)';
    btnCopy.style.color = '#e5e7eb';
    btnCopy.style.borderRadius = '8px';
    btnCopy.onclick = () => {
      const diag = {
        title,
        endpoint: localStorage.getItem('messageServiceEndpoint') || '(not set)',
        triedUrl: details && details.url,
        error: details && details.error,
        time: new Date().toISOString(),
        userAgent: navigator.userAgent,
      };
      navigator.clipboard.writeText(JSON.stringify(diag, null, 2));
      showAlert('Diagnostics copied to clipboard', 'success');
    };

    const btnHelp = document.createElement('button');
    btnHelp.textContent = 'How to Fix';
    btnHelp.style.padding = '8px 12px';
    btnHelp.style.background = '#0ea5e9';
    btnHelp.style.border = 'none';
    btnHelp.style.color = '#0b1220';
    btnHelp.style.fontWeight = '700';
    btnHelp.style.borderRadius = '8px';
    btnHelp.onclick = () => {
      alert('Fix steps:\n1) Deploy Apps Script as Web App (Anyone access).\n2) Copy /macros/s/.../exec URL.\n3) In console: localStorage.messageServiceEndpoint = "<that URL>"; reload.');
    };

    actions.appendChild(btnCopy);
    actions.appendChild(btnHelp);

    const btnFix = document.createElement('button');
    btnFix.textContent = 'Copy Fixer Command (PS)';
    btnFix.style.padding = '8px 12px';
    btnFix.style.background = '#22c55e';
    btnFix.style.border = 'none';
    btnFix.style.color = '#0b1220';
    btnFix.style.fontWeight = '700';
    btnFix.style.borderRadius = '8px';
    btnFix.onclick = () => {
      const endpoint = localStorage.getItem('messageServiceEndpoint') || (window.__MS_ENDPOINT__ || '');
      const repo = (window.__MS_GITHUB_REPO__ || '').trim();
      const branch = (window.__MS_GITHUB_BRANCH__ || 'main').trim();
      const zipFromRepo = repo ? `https://github.com/${repo}/archive/refs/heads/${branch}.zip` : '';
      const zipUrl = (window.__MS_SOURCEZIP__ || '').trim() || zipFromRepo;

      // If config has zip/repo info, prefer -UseConfig for simplicity
      const useConfig = !!zipUrl || !!repo;
      const sourceArg = useConfig ? ' -UseConfig' : ' -SourceZipUrl "<PUT_YOUR_ZIP_URL_HERE>"';
      const endpointArg = endpoint ? ` -EndpointUrl "${endpoint}"` : '';
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "./Fix.ps1" -ProjectRoot "."${sourceArg}${endpointArg}`;
      navigator.clipboard.writeText(cmd);
      showAlert('Fixer command copied. Open PowerShell in this folder and paste it.', 'info');
    };
    actions.appendChild(btnFix);

    card.appendChild(h);
    card.appendChild(sub);
    card.appendChild(list);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Block app interaction
    document.body.style.overflow = 'hidden';
    const container = document.querySelector('.container');
    if (container) container.style.filter = 'blur(3px)';
  } catch (err) {
    console.error('Failed to display MessageService lock:', err);
  }
}
