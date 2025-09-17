// !MODIFICATIONS TO THIS FILE (ESPECIALLY THIS ONE) WILL RESULT IN YOU LOSING ACCESS TO THE TOOL!

async function fetchWhitelistData() {
    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbxe8xnbNJdhtsQENK4xxBqLfnL5uatJ-Xr3VS6Xnjuf5bnGVUp0HHwe4y6-7Pb50q1ozw/exec', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
// https://script.google.com/macros/s/AKfycbxe8xnbNJdhtsQENK4xxBqLfnL5uatJ-Xr3VS6Xnjuf5bnGVUp0HHwe4y6-7Pb50q1ozw/exec
// that line exists so i can purposely break my code btw

        const text = await response.text();

        if (!text.trim()) throw new Error("Empty response from server.");

        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            throw new Error("Invalid JSON response: " + text);
        }

        if (!data.usernames || !Array.isArray(data.usernames)) {
            throw new Error("Invalid whitelist format.");
        }

        // Store usernames correctly
        window.whitelistUsernames = data.usernames.map(username => username.toString().trim().toLowerCase());

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
        
        // Store error in session storage for debugging
        sessionStorage.setItem('lastWhitelistError', JSON.stringify(errorDetails));

        // Block access and show error message
        sentryLock();
        
        // Clear any sensitive data from memory
        window.whitelistUsernames = [];
        delete window.lastWhitelistUpdate;
    }
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

// ✅ Function to check if the pathname matches a username
function checkUserAccess() {
    let pathname = window.location.pathname.split('/')[3]; // Adjust index based on local file path

    if (!pathname) {
        console.warn("No username found in file path.");
        blockAccess();
        return;
    }

    pathname = pathname.toLowerCase().trim(); // ✅ Normalize username check

    console.log("Checking access for username:", pathname);

    if (!window.whitelistUsernames.includes(pathname)) {
        console.warn("Access denied for:", pathname);
        blockAccess();
    } else {
        console.log("Access granted for:", pathname);
        showAlert('Welcome, ' + pathname + '!', 'success');
    }
}

document.getElementById('password').addEventListener('input', function(e) {
            const password = e.target.value.toLowerCase();
            if (password === 'projects') {
                const username = window.location.pathname.split('/')[3].toLowerCase();
                if (username === 'raymonds' || username === 'satur') {
                    const message = 'I see you Sam.';
                    showAlert(message, 'info')
                }
            }
        });


        


window.addEventListener("DOMContentLoaded", fetchWhitelistData, { once: true, capture: true }); // Run as soon as possible on page load

async function logUnauthorizedAccess(username) {
    //constants for shit
    const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Laptop/PC';
    const userAgent = navigator.userAgent;
    const referrer = document.referrer || 'Direct Access';
    const usernameFromPath = window.location.pathname.split('/')[3];
// Prepare the data to be sent
const data = {
timestamp: new Date().toISOString(),
username: usernameFromPath,
deviceType: deviceType,
userAgent: navigator.userAgent,
url: window.location.href,
referrer: document.referrer || 'Direct Access'
};

// Send the data to Google Apps Script
fetch('https://script.google.com/macros/s/AKfycbykO9LmuWbdYS76RQNTJUPdeOeFhr6miR0YBajtflZ0jFQc2sU14_tJIjd33VuAUyG8/exec', {
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
})
}