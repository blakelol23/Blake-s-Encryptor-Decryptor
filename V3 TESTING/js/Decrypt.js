// !MODIFICATIONS TO THIS FILE WILL RESULT IN YOU LOSING ACCESS TO THE TOOL IF CAUGHT!

async function decryptMessage() {
    try {
        const password = document.getElementById('password').value;
        const inputText = document.getElementById('inputText').value;

        if (!password) {
            showAlert('Please enter a password', 'error');
            return;
        }
        if (!inputText) {
            showAlert('Please enter an encrypted message', 'error');
            return;
        }

        if (inputText.startsWith('TEST_')) {
            showAlert(`Test ${inputText.split('_')[1]}: This is a ${inputText.split('_')[1].toLowerCase()} message.`, inputText.split('_')[1].toLowerCase());
            return;
        }

        const decryptBtn = document.getElementById('decryptBtn');
        decryptBtn.disabled = true;
        decryptBtn.textContent = '🔄 Decrypting...';

        const data = base64ToArrayBuffer(inputText);
        if (data.length < 65) { // 1 (version) + 4 (identifier) + 16 (salt) + 12 (iv) + 32 (hmac)
            throw new Error('Invalid encrypted message length');
        }

        const version = data.slice(0, 1)[0];
        const identifier = new TextDecoder().decode(data.slice(1, 5));
        if (identifier !== 'BLKE') {
            console.error(`Invalid identifier: ${identifier}.`);
            throw new Error(' Message was flagged as NOT from Blake’s Encryptor');
        }

        const salt = data.slice(5, 21);
        const iv = data.slice(21, 33);
        const hmac = data.slice(33, 65);
        const encryptedData = data.slice(65);

        const dataToVerify = concatArrays(data.slice(0, 33), encryptedData); // version + identifier + salt + iv + ciphertext
        const isValid = await verifyHMAC(dataToVerify, hmac, 'blke256');
        if (!isValid) {
            console.error('HMAC verification failed');
            throw new Error('Invalid message integrity');
        }

        const key = await deriveKey(password, salt);
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            key,
            'AES-GCM',
            false,
            ['decrypt']
        );
        const decryptedData = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            cryptoKey,
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
        try { window.lastDecryptedId = parsedData.id || null; } catch(_) {}

        if (parsedData.expiryTime) {
            updateExpiryTimer(parsedData.expiryTime);
            showAlert('Self-destructing message decrypted successfully!', 'success');
        } else {
            if (currentExpiryTimer) {
                clearInterval(currentExpiryTimer);
                currentExpiryTimer = null;
            }
            document.getElementById('timeRemaining').textContent = '';
            showAlert('Message decrypted successfully!', 'success');
        }
    } catch (error) {
        console.error('Decryption error:', error);
        if (error.name === 'SyntaxError') {
            throw new Error('Invalid encrypted message format or wrong password');
        }
        showAlert(`Decryption failed: ${error.message}`, 'error');
    } finally {
        const decryptBtn = document.getElementById('decryptBtn');
        decryptBtn.disabled = false;
        decryptBtn.textContent = '🔓 Decrypt';
    }
}