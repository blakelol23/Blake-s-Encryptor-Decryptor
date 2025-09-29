// !MODIFICATIONS TO THIS FILE WILL RESULT IN YOU LOSING ACCESS TO THE TOOL IF CAUGHT!

async function encryptMessage() {
    try {
        // First validate the password if required
        if (!window.validatePasswordInput || typeof window.validatePasswordInput !== 'function') {
            console.error('Password validation function not found');
            showAlert('System error: Password validation failed', 'error');
            return false;
        }
        
        if (!window.validatePasswordInput()) {
            return false;
        }
        if (!validateInput()) {
            return false;
        }

        const password = document.getElementById('password').value;
        const message = document.getElementById('inputText').value;
        let selfDestructTime = document.getElementById('selfDestructTime').value;
        if (!message) {
            showAlert('Please enter a message to encrypt', 'error');
            return;
        }

        const autoEnabled = localStorage.getItem('autoSelfDestructEnabled') === 'true';
        if (autoEnabled && !selfDestructTime) {
            setAutoSelfDestructTime();
            selfDestructTime = document.getElementById('selfDestructTime').value;
        }

        const encryptBtn = document.getElementById('encryptBtn');
        encryptBtn.disabled = true;
        encryptBtn.textContent = '🔄 Encrypting...';

        const encoder = new TextEncoder();
        const id = typeof generateId === 'function' ? generateId() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(password, salt); // Ensure this returns Uint8Array

        const messageData = {
            id,
            message: message,
            expiryTime: selfDestructTime ? new Date(selfDestructTime).getTime() : null
        };
        const encodedMessage = encoder.encode(JSON.stringify(messageData));

        // Import the key for AES-GCM encryption
        const cryptoKey = await crypto.subtle.importKey(
            'raw',              // Format of the key
            key,                // Must be ArrayBuffer or TypedArray (e.g., Uint8Array)
            { name: 'AES-GCM' }, // Algorithm
            false,              // Not extractable
            ['encrypt']         // Usage
        );

        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            cryptoKey,
            encodedMessage
        );

        const version = new Uint8Array([1]);
        const identifier = encoder.encode('BLKE');
        const dataToHash = concatArrays(version, identifier, salt, iv, new Uint8Array(encryptedData));
        const hmac = await computeHMAC(dataToHash, 'blke256');

        const resultArray = concatArrays(version, identifier, salt, iv, hmac, new Uint8Array(encryptedData));
        const base64Result = arrayBufferToBase64(resultArray);

        // Check for a specific byte pattern that would indicate an old version
        const oldVersionSignature = new TextEncoder().encode('blake-secret-hmac-2025');
        let isOldVersion = false;
        if (hmac.length >= oldVersionSignature.length) {
            isOldVersion = oldVersionSignature.every((val, i) => hmac[i] === val);
        }
        
        if (isOldVersion) {
            showAlert('This message was encrypted with a deprecated version of the algorithm. Please update your tool.', 'warning');
        }

        document.getElementById('resultText').value = base64Result;
        addToHistory(base64Result, messageData.expiryTime, id);
        recordEncryption(base64Result, messageData.expiryTime);
        // Expose last encryption metadata for button handler to call MessageService
        try { window.lastMessageMeta = { id, encryptedText: base64Result, expiryTime: messageData.expiryTime }; } catch(_) {}

        // MessageService call is handled by button wrapper (onEncryptClick)

        showAlert('Message encrypted successfully!' + (selfDestructTime ? ' (Self-destructing)' : ''), 'success');
        if (document.getElementById('autoCopy').checked) {
            copyResult(true);
        }
    } catch (error) {
        console.error('Encryption error:', error);
        showAlert(`Encryption failed: ${error.message}`, 'error');
        return false;
    } finally {
        const encryptBtn = document.getElementById('encryptBtn');
        encryptBtn.disabled = false;
        encryptBtn.textContent = '🔒 Encrypt';
    }
    return true;
}

async function computeHMAC(data, key) {
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return new Uint8Array(signature);
}

async function verifyHMAC(data, hmac, key) {
    const computedHmac = await computeHMAC(data, key);
    return timingSafeEqual(computedHmac, hmac);
}

function timingSafeEqual(a, b) {
    if (a.byteLength !== b.byteLength) return false;
    const aBytes = new Uint8Array(a);
    const bBytes = new Uint8Array(b);
    let result = 0;
    for (let i = 0; i < aBytes.length; i++) {
        result |= aBytes[i] ^ bBytes[i];
    }
    return result === 0;
}

function concatArrays(...arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}