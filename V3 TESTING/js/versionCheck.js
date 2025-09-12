// VersionCheck.js
// Reads your Apps Script Web App URL (script.google.com .../exec) to fetch
// the latest version from the "Version" sheet and shows a banner if mismatched.

(function (w) {
    const FALLBACK_CURRENT_VERSION = '4.0.0';
    const STORAGE_KEY = 'messageServiceEndpoint';
    let VC_DEBUG = !!(typeof window !== 'undefined' && window.VC_DEBUG);
    const log = (...a) => { if (VC_DEBUG) console.log('[VersionCheck]', ...a); };
    const warn = (...a) => console.warn('[VersionCheck]', ...a);

    function getEndpointFromScriptTag() {
      try {
        const s = document.currentScript || document.querySelector('script[src*="VersionCheck.js"]');
        const attr = s && s.getAttribute('data-endpoint');
        return attr && attr.trim() ? attr.trim() : null;
      } catch { return null; }
    }

    function getExpectedWord() {
      try {
        if (typeof window !== 'undefined' && typeof window.VC_EXPECTED === 'string') {
          return String(window.VC_EXPECTED).trim();
        }
      } catch {}
      return null;
    }

    function normalizeWord(s) {
      if (!s) return '';
      return String(s).trim().toUpperCase();
    }
  
    function getEndpoint(opt) {
      // Priority: explicit > window.VC_ENDPOINTURL > window.__VC_ENDPOINT__ > data-endpoint > localStorage > window.__MS_ENDPOINT__
      if (opt) return opt;
      if (w.VC_ENDPOINTURL) return w.VC_ENDPOINTURL;
      if (w.__VC_ENDPOINT__) return w.__VC_ENDPOINT__;
      const tag = getEndpointFromScriptTag(); if (tag) return tag;
      try { const ls = localStorage.getItem(STORAGE_KEY); if (ls) return ls; } catch {}
      return null;
    }

    // Note: No MS endpoint fallback is used here by design.
  
    function getCurrentVersionFromDOM() {
      // Priority: window.__APP_VERSION__ > meta[name="app-version"] > About tab text
      try {
        if (typeof window !== 'undefined' && window.__APP_VERSION__) {
          return String(window.__APP_VERSION__).trim();
        }
        const meta = document.querySelector('meta[name="app-version"]');
        if (meta && meta.content) return String(meta.content).trim();
      } catch {}
      const el = document.querySelector('#tab-about .setting-item span');
      if (el) {
        const m = el.textContent.match(/V(\d+\.\d+\.\d+)/i);
        if (m) return m[1];
      }
      return FALLBACK_CURRENT_VERSION;
    }
  
    async function fetchRemoteVersion(endpoint) {
      if (!endpoint) return { ok: false, error: 'No endpoint configured' };
      log('Using endpoint:', endpoint);
      // JSONP (CORS-free)
      try {
        const cb = `__vcb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}action=getVersion&callback=${cb}`;
        log('JSONP', url);
        const data = await new Promise((resolve) => {
          const s = document.createElement('script'); s.src = url; s.async = true;
          w[cb] = (payload) => {
            if (typeof payload === 'string') {
              const m = payload.match(/\b(\d+\.\d+\.\d+)\b/); resolve(m ? { ok: true, version: m[1] } : { ok: false });
            } else { resolve(payload || { ok: false }); }
            delete w[cb]; s.remove();
          };
          s.onerror = () => { resolve({ ok: false, error: 'JSONP failed' }); delete w[cb]; s.remove(); };
          document.head.appendChild(s);
        });
        if (data && data.ok && data.version) return data;
      } catch {}
      // Plain GET (best-effort; will fail under CORS, but ok if allowed or local server)
      try {
        const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}action=getVersion`;
        const resp = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
        const text = await resp.text();
        const m = text.match(/\b(\d+\.\d+\.\d+)\b/);
        if (m) return { ok: true, version: m[1] };
      } catch {}
      return { ok: false, error: 'No readable version' };
    }
  
    let __vcBannerShown = false;
    function showBanner(message, opts = {}) {
      if (__vcBannerShown) return; // avoid duplicates
      // Create container if missing
      let container = document.getElementById('versionBannerContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'versionBannerContainer';
        document.body.appendChild(container);
      }
      // Build banner
      const banner = document.createElement('div');
      banner.className = 'version-banner';
      banner.innerHTML = `
        <div class="vb-icon">⚠</div>
        <div class="vb-content">
          <div class="vb-title">Update available</div>
          <div class="vb-desc">${message}</div>
        </div>
        <div class="vb-actions">
          ${opts.primaryLabel ? `<button class="vb-btn primary" id="vb-primary">${opts.primaryLabel}</button>` : ''}
          <button class="vb-btn" id="vb-dismiss">Dismiss</button>
        </div>
        <button class="vb-close" id="vb-close" aria-label="Close">×</button>
      `;
      container.appendChild(banner);
      // Wire actions
      const dismiss = () => {
        banner.classList.add('hiding');
        banner.addEventListener('transitionend', () => banner.remove(), { once: true });
      };
      banner.querySelector('#vb-dismiss')?.addEventListener('click', dismiss);
      banner.querySelector('#vb-close')?.addEventListener('click', dismiss);
      if (opts.onPrimary) banner.querySelector('#vb-primary')?.addEventListener('click', () => {
        try { opts.onPrimary(); } catch {}
        dismiss();
      });
      // Animate in
      requestAnimationFrame(() => banner.classList.add('show'));
      __vcBannerShown = true;
    }

    async function compareAndNotify(opts = {}) {
      const endpoint = getEndpoint(opts.endpoint);
      if (!endpoint) { warn('No endpoint configured (window.VC_ENDPOINTURL or __VC_ENDPOINT__ expected)'); return; }

      const current = (opts.currentVersion || getCurrentVersionFromDOM()).trim();
      log('Current version:', current);
      let res = await fetchRemoteVersion(endpoint);
      if (res && res.ok && res.version) {
        const remote = String(res.version).trim();
        const expected = getExpectedWord();
        if (expected) {
          log('Remote word:', remote, '| Expected word:', expected);
          if (normalizeWord(remote) !== normalizeWord(expected)) {
            const msg = `An update is available. Please run the update.hta file. Expected: ${expected}. Server: ${remote}.`;
            showBanner(msg);
          }
          return;
        }
        log('Remote version:', remote);
        if (remote !== current) {
          const msg = `A new version is available. Your version: v${current}. Latest: v${remote}.`;
          showBanner(msg);
        }
      } else {
        warn('Unable to check for updates:', res && res.error);
      }
    }
  
    // Public API
    const VersionCheck = {
      compareAndNotify,
      getEndpoint,
      getEndpoints: () => ({ vc: getEndpoint() }),
      getCurrentVersionFromDOM,
      setDebug: (v) => { VC_DEBUG = !!v; },
      getDebug: () => VC_DEBUG,
      checkNow: () => compareAndNotify()
    };
  
    // Auto-run on DOM ready unless disabled by data-auto="false"
    function autoRunIfNeeded() {
      try {
        const thisScript = document.currentScript
          || document.querySelector('script[src*="VersionCheck.js"]');
        const autoAttr = thisScript && thisScript.getAttribute('data-auto');
        const auto = autoAttr ? autoAttr !== 'false' : true;
        if (!auto) return;
      } catch {}
  
      const run = () => { try { compareAndNotify(); } catch {} };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
      } else {
        run();
      }
    }
  
    w.VersionCheck = VersionCheck;
    autoRunIfNeeded();
  })(window);