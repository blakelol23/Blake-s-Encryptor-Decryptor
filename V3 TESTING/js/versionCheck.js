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
      if (__vcBannerShown) return;
      
      // Create banner container
      const banner = document.createElement('div');
      banner.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #f8d7da;
        color: #721c24;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        z-index: 10000;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideUp 0.3s ease-out;
      `;
      
      // Add Font Awesome for icons
      if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        fontAwesome.rel = 'stylesheet';
        document.head.appendChild(fontAwesome);
      }
      
      // Add keyframes for animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        
        /* Modal Overlay */
        .vc-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(3px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10001;
          opacity: 0;
          animation: fadeIn 0.3s ease-out forwards;
        }
        
        @keyframes fadeIn {
          to { opacity: 1; }
        }
        
        /* Modal Styling */
        .vc-modal {
          background: linear-gradient(145deg, #ffffff, #f0f2f5);
          padding: 30px;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(0, 0, 0, 0.1);
          transform: translateY(20px);
          opacity: 0;
          animation: modalAppear 0.4s ease-out 0.1s forwards;
          position: relative;
        }
        
        @keyframes modalAppear {
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        /* Modal Header */
        .vc-modal h2 {
          margin: 0 0 20px 0;
          color: #2c3e50;
          font-size: 24px;
          font-weight: 600;
          position: relative;
          padding-bottom: 10px;
        }
        
        .vc-modal h2::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 50px;
          height: 3px;
          background: #3498db;
          border-radius: 3px;
        }
        
        /* List Styling */
        .vc-modal ol {
          padding-left: 25px;
          margin: 0 0 20px 0;
        }
        
        .vc-modal li {
          margin-bottom: 12px;
          line-height: 1.6;
          color: #34495e;
          position: relative;
          padding-left: 10px;
        }
        
        .vc-modal li::before {
          content: '';
          position: absolute;
          left: -20px;
          top: 8px;
          width: 8px;
          height: 8px;
          background: #3498db;
          border-radius: 50%;
        }
        
        /* Note Styling */
        .vc-modal .note {
          background: #f8f9fa;
          border-left: 4px solid #3498db;
          padding: 12px 15px;
          margin: 15px 0;
          border-radius: 0 4px 4px 0;
          font-size: 0.9em;
          color: #5d6778;
        }
        
        /* Button Styling */
        .vc-modal .modal-btn {
          display: block;
          margin: 25px auto 0;
          padding: 10px 25px;
          background: linear-gradient(135deg, #3498db, #2980b9);
          color: white;
          border: none;
          border-radius: 25px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
          transition: all 0.3s ease;
        }
        
        .vc-modal .modal-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(52, 152, 219, 0.4);
        }
        
        .vc-modal .modal-btn:active {
          transform: translateY(0);
        }
        
        /* Responsive Design */
        @media (max-width: 480px) {
          .vc-modal {
            padding: 20px 15px;
            width: 95%;
          }
          
          .vc-modal h2 {
            font-size: 20px;
          }
        }
      `;
      document.head.appendChild(style);
      
      // Message element
      const messageEl = document.createElement('div');
      messageEl.textContent = message;
      messageEl.style.flex = '1';
      messageEl.style.marginRight = '15px';
      
      // Buttons container
      const buttonsContainer = document.createElement('div');
      buttonsContainer.style.display = 'flex';
      buttonsContainer.style.gap = '10px';
      buttonsContainer.style.alignItems = 'center';
      
      // How to Install button
      const installBtn = document.createElement('button');
      installBtn.textContent = 'How to Install';
      installBtn.style.cssText = `
        background: #0d6efd;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 14px;
      `;
      
      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 0 10px;
        color: inherit;
        line-height: 1;
      `;
      
      // Show installation instructions
      function showInstallInstructions() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'vc-modal-overlay';
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'vc-modal';
        modal.innerHTML = `
          <h2>How to Install the Update</h2>
          <ol>
            <li>Locate the <strong>update.hta</strong> file in your Downloads folder</li>
            <li>Double-click the file to run it
                <small style="display: block; margin-top: 5px; color: #7f8c8d; font-size: 0.9em;">
                  <i class="fas fa-shield-alt" style="margin-right: 5px;"></i>
                  If you see a security warning, click "Run" or "More info" and then "Run anyway"
                </small>
            </li>
            <li>Follow the on-screen instructions to complete the update</li>
            <li>Restart the application when prompted</li>
          </ol>
          <div class="note">
            <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
            The update process is automatic and will preserve your settings and messages.
          </div>
          <button class="modal-btn">
            <i class="fas fa-check-circle" style="margin-right: 8px;"></i>
            Got it!
          </button>
        `;
        
        // Close modal when clicking the button or outside the modal
        const closeModal = () => {
          document.body.removeChild(overlay);
        };
        
        modal.querySelector('button').onclick = closeModal;
        overlay.onclick = (e) => {
          if (e.target === overlay) closeModal();
        };
        
        modal.onclick = (e) => e.stopPropagation();
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
      }
      
      // Set up event listeners
      installBtn.onclick = showInstallInstructions;
      closeBtn.onclick = () => {
        document.body.removeChild(banner);
        __vcBannerShown = false;
      };
      
      // Append elements
      buttonsContainer.appendChild(installBtn);
      buttonsContainer.appendChild(closeBtn);
      banner.appendChild(messageEl);
      banner.appendChild(buttonsContainer);
      document.body.appendChild(banner);
      
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