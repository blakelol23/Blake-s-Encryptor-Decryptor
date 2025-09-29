// !MODIFICATIONS TO THIS FILE WILL RESULT IN YOU LOSING ACCESS TO THE TOOL IF CAUGHT!

// isPasswordRequired is defined in Main.html
const encoder = new TextEncoder();

async function decryptMessage() {
    const decryptBtn = document.getElementById('decryptBtn');
    const passwordInput = document.getElementById('password');
    
    try {
        // First validate the password if required
        if (!window.validatePasswordInput || typeof window.validatePasswordInput !== 'function') {
            console.error('Password validation function not found');
            showAlert('System error: Password validation failed', 'error');
            return false;
        }
        
        if (!window.validatePasswordInput()) {
            return false; // Validation will show error message
        }

        const password = document.getElementById('password').value;
        const inputText = document.getElementById('inputText').value;

        // Check for empty input
        if (!inputText) {
            showAlert('Please enter an encrypted message', 'error');
            return false;
        }
        if (!inputText) {
            showAlert('Please enter an encrypted message', 'error');
            return false;
        }

        if (inputText.startsWith('TEST_')) {
            showAlert(`Test ${inputText.split('_')[1]}: This is a ${inputText.split('_')[1].toLowerCase()} message.`, inputText.split('_')[1].toLowerCase());
            return false;
        }

        const decryptBtn = document.getElementById('decryptBtn');
        decryptBtn.disabled = true;
        decryptBtn.textContent = '🔄 Decrypting...';

        // Parse and validate the encrypted message
        let data;
        try {
            data = base64ToArrayBuffer(inputText);
            if (data.length < 65) { // 1 (version) + 4 (identifier) + 16 (salt) + 12 (iv) + 32 (hmac)
                throw new Error('Invalid encrypted message: Message too short');
            }
        } catch (e) {
            throw new Error('Invalid message format. Please check if the message is complete and correctly encoded.');
        }

        const version = data.slice(0, 1)[0];
        const identifier = new TextDecoder().decode(data.slice(1, 5));
        if (identifier !== 'BLKE') {
            console.error(`Invalid identifier: ${identifier}`);
            throw new Error('This message was not encrypted with this tool or is corrupted');
        }

        // Extract message components
        const salt = data.slice(5, 21);
        const iv = data.slice(21, 33);
        const hmacValue = data.slice(33, 65);
        const encryptedData = data.slice(65);

        // Verify HMAC first to detect tampering or wrong password
        const dataToVerify = concatArrays(data.slice(0, 33), encryptedData);
        const isHmacValid = await verifyHMAC(dataToVerify, hmacValue, 'blke256');
        if (!isHmacValid) {
            console.error('HMAC verification failed');
            throw new Error('Incorrect password or corrupted message');
        }

        // Derive the key
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        let key;
        try {
            key = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt']
            );
        } catch (e) {
            console.error('Key derivation failed:', e);
            throw new Error('Failed to process the password. The password might be incorrect.');
        }

        // Decrypt the message
        let decryptedData;
        try {
            decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encryptedData
            );

            const decodedData = new TextDecoder().decode(decryptedData);
            const parsedData = JSON.parse(decodedData);

            // Block locally if manually expired
            if (typeof isLocallyBlocked === 'function' && parsedData.id && isLocallyBlocked(parsedData.id)) {
                throw new Error('This message was manually expired and cannot be decrypted');
            }

            if (parsedData.expiryTime && parsedData.expiryTime < Date.now()) {
                throw new Error('This message has expired and cannot be decrypted');
            }

            document.getElementById('resultText').value = parsedData.message;
            recordDecryption(inputText);
            
            // Expose last decrypted id for button wrapper to call MessageService
            try { 
                window.lastDecryptedId = parsedData.id || null; 
            } catch(_) {}

            if (parsedData.expiryTime) {
                updateExpiryTimer(parsedData.expiryTime);
                showAlert('Self-destructing message decrypted successfully!', 'success');
            } else {
                if (window.currentExpiryTimer) {
                    clearInterval(window.currentExpiryTimer);
                    window.currentExpiryTimer = null;
                }
                const timeRemaining = document.getElementById('timeRemaining');
                if (timeRemaining) {
                    timeRemaining.textContent = '';
                }
                showAlert('Message decrypted successfully!', 'success');
            }
    } catch (error) {
        console.error('Decryption error:', error);
        
        // Track failed attempts for lockout
        if (window.incrementFailedAttempts && typeof window.incrementFailedAttempts === 'function') {
            window.incrementFailedAttempts();
        }
        
        // Show user-friendly error messages
        let errorMessage = 'Decryption failed. ';
        
        if (error.message.includes('password') || error.message.includes('incorrect')) {
            errorMessage = error.message;
        } else if (error.name === 'OperationError') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.name === 'SyntaxError') {
            errorMessage = 'Invalid message format. Please check if the message is complete and correctly encoded.';
        } else if (error.message.includes('corrupted')) {
            errorMessage = 'The message appears to be corrupted or was not encrypted with this tool.';
        } else {
            errorMessage = 'Failed to decrypt the message. The password might be incorrect or the message is corrupted.';
        }
        
        showAlert(errorMessage, 'error');
        
        // Focus password field on error
        if (passwordInput) {
            passwordInput.focus();
            passwordInput.select();
        }
    }
        
    return false;
    } finally {
        if (decryptBtn) {
            decryptBtn.disabled = false;
            decryptBtn.textContent = '🔓 Decrypt';
        }
    }
    return true;
}