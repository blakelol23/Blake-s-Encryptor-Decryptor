// !MODIFICATIONS TO THIS FILE WILL RESULT IN YOU LOSING ACCESS TO THE TOOL IF CAUGHT!
const MAX_DAILY_REPORTS = 2;
let dailyReports = 0;
let lastReportDate = new Date().toDateString();

function reportBug() {
    document.getElementById('bugReportModal').style.display = 'block';
    document.getElementById('bugReportOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeBugReport() {
    document.getElementById('bugReportModal').style.display = 'none';
    document.getElementById('bugReportOverlay').style.display = 'none';
    document.body.style.overflow = null;
}

function submitBugReport(event) {
    event.preventDefault();

    // Check daily report limit
    const currentDate = new Date().toDateString();
    if (currentDate !== lastReportDate) {
        dailyReports = 0;
        lastReportDate = currentDate;
    }
    if (dailyReports >= MAX_DAILY_REPORTS) {
        showAlert(`Maximum ${MAX_DAILY_REPORTS} reports per day reached. Please try again tomorrow.`, 'error');
        return;
    }

    const bugReportForm = document.getElementById('bugReportForm');
    const formData = new FormData(bugReportForm);

    // Retrieve values from the form
    const title = formData.get('bugTitle') || '(no title provided)';
    const type = formData.get('bugType') || 'other';
    const details = formData.get('bugDescription') || '(no description provided)';

    console.log("Title:", title);
    console.log("Type:", type);
    console.log("Details:", details);

    const report = {
        username: window.location.pathname.split('/')[3],
        title: formData.get('bugTitle') || '(no title provided)',
        type: formData.get('bugType') || 'other',
        details: formData.get('bugDescription') || '(no description provided)',
        url: window.location.href,
        userAgent: navigator.userAgent,
    };

    console.log("Report Data:", report);

    fetch('https://script.google.com/macros/s/AKfycbxvK507OPwpEStBirusVQWhsshM1urfDheys1QvvrG_cs4ufpqLnSGo2W2ewt8Lyp1m/exec', {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(report),
        headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(() => {
        dailyReports++;
        showAlert('Report sent! Thank you for helping me improve.', 'success');
        closeBugReport();
    })
    .catch(error => {
        console.error('Error sending report:', error);
        showAlert('There was a problem sending the report. Please try again later.', 'error');
    });
}