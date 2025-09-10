// AppsScript.gs
// Google Apps Script backend for message metadata storage and expiry handling.
// Deploy as a Web App (doPost) with access: Anyone with the link.
// Set the Web App URL in the front-end via localStorage.messageServiceEndpoint.
// Note: Google Apps Script has limited support for setting CORS headers. Frontend
// should use 'mode: "no-cors"' if encountering CORS issues, similar to BugReport.js.


const SPREADSHEET_ID = "1ANgjQixBAW7SzhiUjFRCiKl8r4JdflL7djAqf1UpgyI";  
const SHEET_NAME = "Messages";
const LOG_SHEET_NAME = "Logs";

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Columns:
    // 0 id, 1 encryptedText, 2 expiryTime (ms), 3 decryptedCount, 4 Created By (username), 5 updatedAt (pretty), 6 Manually Expired (Yes/No)
    sheet.appendRow(['id', 'encryptedText', 'expiryTime', 'decryptedCount', 'Created By', 'updatedAt', 'Manually Expired']);
  } else {
    // Lightweight migration if a legacy header exists
    const firstRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    // If old header used 'createdAt' in the 5th column, rename it
    if (firstRow[4] && String(firstRow[4]).toLowerCase() === 'createdat') {
      sheet.getRange(1, 5).setValue('Created By');
    }
    // Add Manually Expired column if missing
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!headers.includes('Manually Expired')) {
      sheet.insertColumnAfter(headers.length);
      sheet.getRange(1, headers.length + 1).setValue('Manually Expired');
    }
  }
  return sheet;
}

function getLogSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.appendRow(["time", "message", "dataJson"]);
  }
  return sheet;
}

function log_(message, data) {
  try {
    const sheet = getLogSheet_();
    sheet.appendRow([new Date().toLocaleString(), String(message), data ? JSON.stringify(data) : ""]);
  } catch (err) {
    // ignore logging errors
  }
}


function doPost(e) {
  try {
    let data = {};
    // Support both JSON and x-www-form-urlencoded (payload=...)
    if (e && e.parameter && e.parameter.payload) {
      data = JSON.parse(e.parameter.payload);
    } else if (e && e.postData && e.postData.contents) {
      // Try parse raw contents directly (JSON) or payload=...
      const raw = e.postData.contents;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        const match = raw.match(/payload=([^&]+)/);
        if (match) {
          data = JSON.parse(decodeURIComponent(match[1]));
        }
      }
    } else if (e && e.parameter && e.parameter.action) {
      // Fallback: direct form fields
      data = {
        action: e.parameter.action,
        id: e.parameter.id,
        encryptedText: e.parameter.encryptedText,
        expiryTime: e.parameter.expiryTime,
        createdBy: e.parameter.createdBy,
      };
    }
    log_("doPost received", { hasParameter: !!(e && e.parameter), hasPostData: !!(e && e.postData), parsed: data });
    const action = data.action;

    if (!action) return respond_({ ok: false, error: 'Missing action' });

    switch (action) {
      case 'createMessage':
        log_("createMessage", data);
        return respond_(createMessage_(data));
      case 'incrementDecryption':
        log_("incrementDecryption", data);
        return respond_(incrementDecryption_(data));
      case 'purgeExpired':
        log_("purgeExpired", {});
        return respond_(purgeExpired_());
      case 'markExpired':
        log_("markExpired", data);
        return respond_(markExpired_(data));
      case 'ping':
        log_("ping", {});
        return respond_({ ok: true, message: 'pong', t: Date.now() });
      default:
        return respond_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    log_("doPost error", { error: err && err.message });
    return respond_({ ok: false, error: err.message || String(err) });
  }
}

function prettyNow_() {
  return new Date().toLocaleString();
}

function createMessage_(data) {
  const sheet = getSheet_();
  const id = data.id;
  const encryptedText = data.encryptedText || '';
  const expiryTime = data.expiryTime || '';
  const decryptedCount = 0;
  const createdBy = data.createdBy || 'Unknown';

  if (!id) return { ok: false, error: 'Missing id' };

  // Columns: id, encryptedText, expiryTime(ms), decryptedCount, Created By, updatedAt(pretty)
  sheet.appendRow([id, encryptedText, expiryTime, decryptedCount, createdBy, prettyNow_(), 'No']);
  return { ok: true };
}

function incrementDecryption_(data) {
  const sheet = getSheet_();
  const id = data.id;
  if (!id) return { ok: false, error: 'Missing id' };

  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0]) === String(id)) {
      const rowIndex = r + 2; // +2 because values start at row 2
      // If manually expired, block increments (and effectively block decrypts if client checks)
      const manualExpired = String(values[r][6] || '').toLowerCase() === 'yes';
      if (manualExpired) {
        return { ok: false, error: 'Message is manually expired' };
      }
      const count = Number(values[r][3]) || 0;

      // Update just the needed cells
      sheet.getRange(rowIndex, 4).setValue(count + 1);   // decryptedCount (col D)
      sheet.getRange(rowIndex, 6).setValue(prettyNow_()); // updatedAt (col F)

      return { ok: true, decryptedCount: count + 1 };
    }
  }

  return { ok: false, error: 'ID not found' };
}

function markExpired_(data) {
  const sheet = getSheet_();
  const id = data.id;
  if (!id) return { ok: false, error: 'Missing id' };
  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0]) === String(id)) {
      const rowIndex = r + 2;
      sheet.getRange(rowIndex, 7).setValue('Yes'); // Manually Expired (col G)
      sheet.getRange(rowIndex, 6).setValue(prettyNow_()); // updatedAt
      return { ok: true };
    }
  }
  return { ok: false, error: 'ID not found' };
}


function purgeExpired_() {
  const sheet = getSheet_();
  const range = sheet.getDataRange();
  const values = range.getValues();
  const now = Date.now();

  // Collect rows to delete where expiryTime is set and past
  const rowsToDelete = [];
  for (let r = 1; r < values.length; r++) {
    const expiry = Number(values[r][2]);
    if (expiry && !isNaN(expiry) && expiry < now) {
      rowsToDelete.push(r + 1); // 1-based index in sheet
    }
  }

  // Delete from bottom to top to avoid index shift
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    sheet.deleteRow(rowsToDelete[i]);
  }

  return { ok: true, deleted: rowsToDelete.length };
}

function respond_(obj) {
  // Best-effort JSON response. GAS cannot set custom CORS headers via ContentService.
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
