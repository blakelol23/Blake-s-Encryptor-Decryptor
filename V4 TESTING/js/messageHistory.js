// !MODIFICATIONS TO THIS FILE WILL RESULT IN YOU LOSING ACCESS TO THE TOOL IF CAUGHT!

const MESSAGEHISTORYKEY = 'messageHistory';
const MANUAL_BLOCKLIST_KEY = 'manuallyExpiredIds';

function saveMessageHistory(history) {
    localStorage.setItem(MESSAGEHISTORYKEY, JSON.stringify(history));
}

function addToHistory(encryptedText, expiryTime = null, idFromEncrypt = null) {
    const history = getMessageHistory();
    const id = idFromEncrypt || (Date.now().toString() + Math.random().toString(36).substr(2, 5));
    const timestamp = Date.now();

    history.push({
        id,
        encryptedText,
        timestamp,
        expiryTime,
        isActive: expiryTime ? expiryTime > Date.now() : true,
        originalLength: encryptedText.length
    });

    saveMessageHistory(history);
    updateStatsUI();
}

function updateMessageStatus(id, isActive) {
    const history = getMessageHistory();
    const message = history.find(msg => msg.id === id);
    if (message) {
        message.isActive = isActive;
        saveMessageHistory(history);
        updateStatsUI();
    }
}

function removeFromHistory(id) {
    const history = getMessageHistory();
    const updatedHistory = history.filter(msg => msg.id !== id);
    saveMessageHistory(updatedHistory);
    // Also mark as expired in backend and locally block decrypts
    try {
        if (typeof MessageService !== 'undefined' && MessageService.markExpired) {
            MessageService.markExpired(id);
        }
    } catch (_) {}
    addToLocalBlocklist(id);
    updateStatsUI();
}

function getMessageHistory() {
    const history = localStorage.getItem(MESSAGEHISTORYKEY);
    return history ? JSON.parse(history) : [];
}

function clearHistory() {
    saveMessageHistory([]);
    updateStatsUI();
    showAlert('Message history cleared', 'success');
}

function openHistory() {
    const modal = document.getElementById('historyModal');
    const overlay = document.getElementById('historyOverlay');
    modal.style.display = 'block';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    updateHistoryUI();
}

function closeHistory() {
    document.getElementById('historyModal').style.display = 'none';
    document.getElementById('historyOverlay').style.display = 'none';
    document.body.style.overflow = null;
}

function updateHistoryUI() {
    const historyList = document.getElementById('historyList');
    const history = getMessageHistory();
    const now = Date.now();

    if (history.length === 0) {
        historyList.innerHTML = '<div class="settings-empty">No message history yet</div>';
        return;
    }

    historyList.innerHTML = history.map(msg => {
        const isExpired = msg.expiryTime && msg.expiryTime < now || !msg.isActive || isLocallyBlocked(msg.id);
        const date = new Date(msg.timestamp).toLocaleString();
        const expiry = msg.expiryTime ? new Date(msg.expiryTime).toLocaleString() : 'Never';
        const status = isExpired ? 'Expired' : 'Active';
        
        return `
            <div class="settings-item">
                <div class="settings-item-header">
                    <span class="settings-item-title">${date}</span>
                    <span class="settings-item-date">${status}</span>
                </div>
                <div class="settings-item-preview">${msg.encryptedText.substring(0, 50)}...</div>
                <div class="settings-item-meta">
                    <span>Length: ${msg.originalLength}</span>
                    <span>Expires: ${expiry}</span>
                </div>
                <div class="button-group" style="margin-top: 10px;">
                    ${!isExpired ? `<button class="btn" onclick="expireMessage('${msg.id}')">Mark as Expired</button>` : ''}
                    <button class="btn btn-danger" onclick="removeFromHistory('${msg.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function expireMessage(id) {
    updateMessageStatus(id, false);
    // Notify backend and add to local blocklist
    try {
        if (typeof MessageService !== 'undefined' && MessageService.markExpired) {
            MessageService.markExpired(id);
        }
    } catch (_) {}
    addToLocalBlocklist(id);
    updateHistoryUI();
}

function addToLocalBlocklist(id) {
    try {
        const raw = localStorage.getItem(MANUAL_BLOCKLIST_KEY);
        const set = new Set(raw ? JSON.parse(raw) : []);
        set.add(id);
        localStorage.setItem(MANUAL_BLOCKLIST_KEY, JSON.stringify(Array.from(set)));
    } catch (_) {}
}

function isLocallyBlocked(id) {
    try {
        const raw = localStorage.getItem(MANUAL_BLOCKLIST_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) && arr.includes(id);
    } catch (_) { return false; }
}