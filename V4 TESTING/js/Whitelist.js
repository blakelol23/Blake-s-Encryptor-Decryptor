// !MODIFICATIONS TO THIS FILE (ESPECIALLY THIS ONE) WILL RESULT IN YOU LOSING ACCESS TO THE TOOL!

async function fetchWhitelistData() {
    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbySAbN6K9a8qCYl687DwTeR2Fe83VyIn31W9Gywi8W06CfXf83CzND_w-DrlKj7yjmOYQ/exec', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        const text = await response.text();

        if (!text.trim()) throw new Error("Empty response from server.");

        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            throw new Error("Invalid JSON response: " + text);
        }

        if (!data.users || !Array.isArray(data.users)) {
            throw new Error("Invalid whitelist format.");
        }

        // Store users data
        window.whitelistUsers = data.users;

        checkUserAccess();

    } catch (error) {
        console.clear();
        console.error("Error fetching whitelist:", error.message);
        
        // Log the error details securely
        const errorDetails = {
            timestamp: new Date().toISOString(),
            error: error.message,
            path: window.location.pathname,
            userAgent: navigator.userAgent
        };
        
        sessionStorage.setItem('lastWhitelistError', JSON.stringify(errorDetails));
        SentryLock();
        window.whitelistUsers = [];
        delete window.lastWhitelistUpdate;
    }
}

function blockAccess(reason = 'Access Denied') {
    // Update the block message with the reason if provided
    const blockMessage = document.createElement('div');
    blockMessage.className = 'access-denied';
    blockMessage.innerHTML = `
        <div class="blocked-overlay">
            <div class="blocked-content">
                <h2>Access Denied</h2>
                <p>${reason}</p>
                <p>If you believe this is a mistake, please contact support.</p>
                <p>Reference: ${Date.now()}</p>
            </div>
        </div>
    `;
    
    // Clear the page content
    document.body.innerHTML = '';
    document.body.appendChild(blockMessage);
    
    // Add some basic styling if not already present
    const style = document.createElement('style');
    style.textContent = `
        .access-denied {
            font-family: Arial, sans-serif;
            color: #721c24;
            background-color: #f8d7da;
            padding: 20px;
            border: 1px solid #f5c6cb;
            border-radius: 4px;
            margin: 20px;
        }
        .blocked-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        .blocked-content {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            max-width: 500px;
            text-align: center;
        }
    `;
    document.head.appendChild(style);
}

function testblockAccess(username) {
    const testBlockInput = document.getElementById('special-access-denied');
    testBlockInput.style.display = 'block';
    const now = new Date();
    const testPath = window.location.pathname.split('/')[3];

    testBlockInput.innerHTML = `
        <div class="blocked-overlay">
            <div class="blocked-content">
                <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">SentryLock Security Test</h2>
                <p style="margin-top: 1.5rem;">This is a test of the security system's access control measures.</p>
                <p style="margin-top: 1rem;">The username used to access this tool is <strong>${testPath}</strong>.</p>
                <p style="margin-top: 1rem;">The current time is <strong>${now.toLocaleTimeString()} on ${now.toLocaleDateString()}</strong>.</p>
                <div class="blocked-warning" style="margin-top: 2rem; text-align: center;">
                    <span style="font-size: 1.4rem; font-weight: bold;">This is a test and is not logged.</span>
                </div>
            </div>
        </div>
    `;
}

function checkForSuspiciousAccess() {
    // Check for OneDrive/SharePoint access in the URL
    const isOneDriveInUrl = window.location.href.includes('onedrive.') || 
                          window.location.href.includes('sharepoint.');
    
    // Check for OneDrive/SharePoint in referrer (but only if there is a referrer)
    const referrer = document.referrer || '';
    const isOneDriveInReferrer = referrer && (
        referrer.includes('onedrive.') || 
        referrer.includes('sharepoint.')
    );
    
    if (isOneDriveInUrl || isOneDriveInReferrer) {
        console.warn('Suspicious access attempt detected - OneDrive/SharePoint URL');
        logSuspiciousAccess('OneDrive/SharePoint Access Attempt');
        blockAccess('Access through OneDrive/SharePoint is not allowed. Please access this tool directly.');
        return true;
    }
    
    return false;
}

async function logSuspiciousAccess(reason) {
    try {
        await fetch('https://script.google.com/macros/s/AKfycbySAbN6K9a8qCYl687DwTeR2Fe83VyIn31W9Gywi8W06CfXf83CzND_w-DrlKj7yjmOYQ/exec', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'SUSPICIOUS_ACCESS',
                reason: reason,
                url: window.location.href,
                referrer: document.referrer,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                ip: window.location.hostname
            })
        });
    } catch (error) {
        console.error('Error logging suspicious access:', error);
    }
}

function checkUserAccess() {
    // First check for suspicious access patterns
    if (checkForSuspiciousAccess()) {
        return; // Access already blocked
    }
    
    let pathname = window.location.pathname.split('/')[3];

    if (!pathname) {
        console.warn("No username found in file path.");
        blockAccess();
        return;
    }

    pathname = pathname.toLowerCase().trim();

    console.log("Checking access for username:", pathname);

    const user = window.whitelistUsers.find(u => u.username === pathname);
    if (!user) {
        console.warn("Access denied for:", pathname);
        blockAccess();
    } else {
        console.log("Access granted for:", pathname);
        const displayName = user.displayName || user.username || 'User';
        showAlert(`Welcome, ${displayName}!`, 'success', null, 'alert-welcome');
        
        // Update the settings username display if it exists
        const settingsUsername = document.getElementById('settingsUsername');
        if (settingsUsername) {
            settingsUsername.textContent = displayName;
            settingsUsername.classList.remove('username-loading');
        }
    }
}

async function logUnauthorizedAccess(username) {
    const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Laptop/PC';
    const usernameFromPath = window.location.pathname.split('/')[3];

    const data = {
        timestamp: new Date().toISOString(),
        username: usernameFromPath,
        deviceType: deviceType,
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer || 'Direct Access'
    };

    fetch('https://script.google.com/macros/s/AKfycbySAbN6K9a8qCYl687DwTeR2Fe83VyIn31W9Gywi8W06CfXf83CzND_w-DrlKj7yjmOYQ/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: data.username,
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            IpAddress: window.location.hostname,
            deviceType: /Mobi/.test(navigator.userAgent) ? "Mobile" : (navigator.userAgent.indexOf('Windows') > -1 ? 'Laptop/PC (Windows)' : 'Laptop/PC (Mac/Linux)'),
            referrer: document.referrer || "Direct Access"
        })
    });
}

// Perform code checks for modification
function checkCodeIntegrity() {
    const originalCode = ``;
    const currentCode = document.documentElement.innerHTML;

    if (currentCode !== originalCode) {
        console.warn("Code integrity check failed. Possible modification detected.");
        logUnauthorizedAccess('Code Integrity Check');
        blockAccess();
    } else {
        console.log("Code integrity check passed.");
    }
}

window.addEventListener("DOMContentLoaded", fetchWhitelistData, { once: true, capture: true });