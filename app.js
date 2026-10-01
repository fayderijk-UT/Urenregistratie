// ============================================================================
// CONFIGURATIE
// ============================================================================
// PLAK HIER DE URL VAN JE GOOGLE APPS SCRIPT WEB APP TUSSEN DE AANHALINGSTEKENS
const SCRIPT_URL = "https://script.google.com/a/macros/unlimit-tec.com/s/AKfycbzNNmlRJsY3Gxi_5Y7qIulaRx6D4QroSJDTCPN6GjPGPWy-5DCZqqka5GejBrmjfonvyw/exec";
// ============================================================================

// State en Settings
let settings = { naam: "", begin: "08:30", eind: "17:00", km: 10, vergoeding: 0.23 };
let historyData = [];
let bypassDuplicateWarning = false;

// Initieel inladen
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadHistory();
    setupNavigation();
    setupFormListeners();
    setDefaultDate();
    updateCalculations();
    checkFirstVisit();
    updateHeaderNaam();
});

// PWA Service Worker registreren
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
}

// --- Eerste Bezoek Controle ---
function checkFirstVisit() {
    const saved = localStorage.getItem('uren_settings');
    if (!saved || !settings.naam || settings.naam.trim() === "") {
        switchTab('view-instellingen');
        const msg = document.getElementById('save-status');
        if (msg) {
            msg.innerText = "👋 Welkom! Vul hier eenmalig je naam en voorkeuren in.";
            msg.style.color = "var(--primary-color)";
            msg.classList.remove('hidden');
        }
    }
}

function updateHeaderNaam() {
    const displayEl = document.getElementById('display-header-naam');
    if (displayEl) {
        displayEl.innerText = settings.naam ? settings.naam : "";
    }
}

// --- Navigatie ---
function switchTab(targetId) {
    const tabs = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    tabs.forEach(t => t.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));
    
    const activeTab = document.querySelector(`[data-target="${targetId}"]`);
    if (activeTab) activeTab.classList.add('active');
    
    const targetView = document.getElementById(targetId);
    if (targetView) targetView.classList.add('active');

    if (targetId === 'view-historie') renderHistory();
}

function setupNavigation() {
    const tabs = document.querySelectorAll('.nav-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.target);
        });
    });
}

// --- Instellingen & Opslag ---
function loadSettings() {
    const saved = localStorage.getItem('uren_settings');
    if (saved) settings = { ...settings, ...JSON.parse(saved) };
    
    document.getElementById('s-naam').value = settings.naam || "";
    document.getElementById('s-begin').value = settings.begin || "08:30";
    document.getElementById('s-eind').value = settings.eind || "17:00";
    document.getElementById('s-km').value = settings.km ?? 10;
    document.getElementById('s-vergoeding').value = settings.vergoeding ?? 0.23;

    // Vul defaults in uren form
    document.getElementById('f-begintijd').value = settings.begin || "08:30";
    document.getElementById('f-eindtijd').value = settings.eind || "17:00";
}

document.getElementById('instellingen-form').addEventListener('submit', (e) => {
    e.preventDefault();
    settings = {
        naam: document.getElementById('s-naam').value.trim(),
        begin: document.getElementById('s-begin').value,
        eind: document.getElementById('s-eind').value,
        km: parseFloat(document.getElementById('s-km').value) || 0,
        vergoeding: parseFloat(document.getElementById('s-vergoeding').value) || 0
    };
    localStorage.setItem('uren_settings', JSON.stringify(settings));
    
    const msg = document.getElementById('save-status');
    msg.innerText = "✓ Instellingen opgeslagen!";
    msg.classList.remove('hidden');
    msg.style.color = 'var(--success-color)';
    setTimeout(() => msg.classList.add('hidden'), 2500);
    
    // Update main form defaults & header
    document.getElementById('f-begintijd').value = settings.begin;
    document.getElementById('f-eindtijd').value = settings.eind;
    updateCalculations();
    updateHeaderNaam();
});

// --- Uren Formulier Logica ---
function setDefaultDate() {
    document.getElementById('f-datum').valueAsDate = new Date();
}

function setupFormListeners() {
    const inputs = ['f-begintijd', 'f-eindtijd', 'f-pauze', 'f-pauze-custom', 'f-reis-type', 'f-reis-custom', 'f-datum'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                updateCalculations();
                resetDuplicateWarning();
            });
        }
    });

    document.getElementById('f-pauze').addEventListener('change', (e) => {
        document.getElementById('f-pauze-custom-group').classList.toggle('hidden', e.target.value !== 'anders');
    });
    document.getElementById('f-reis-type').addEventListener('change', (e) => {
        document.getElementById('f-reis-custom-group').classList.toggle('hidden', e.target.value !== 'anders');
    });
}

function resetDuplicateWarning() {
    bypassDuplicateWarning = false;
    const warnBox = document.getElementById('duplicate-warning');
    if (warnBox) warnBox.classList.add('hidden');
}

function getPauzeMinuten() {
    const val = document.getElementById('f-pauze').value;
    return val === 'anders' ? (parseInt(document.getElementById('f-pauze-custom').value) || 0) : parseInt(val);
}

function getAantalKM() {
    const val = document.getElementById('f-reis-type').value;
    if (val === 'geen') return 0;
    if (val === 'standaard') return settings.km;
    return parseFloat(document.getElementById('f-reis-custom').value) || 0;
}

function updateCalculations() {
    const start = document.getElementById('f-begintijd').value;
    const end = document.getElementById('f-eindtijd').value;
    
    if (start && end) {
        const [hStart, mStart] = start.split(':').map(Number);
        const [hEnd, mEnd] = end.split(':').map(Number);
        let startMin = hStart * 60 + mStart;
        let endMin = hEnd * 60 + mEnd;
        
        let gewerkt = endMin - startMin - getPauzeMinuten();
        if (gewerkt < 0) gewerkt = 0;

        const uren = Math.floor(gewerkt / 60);
        const min = gewerkt % 60;
        document.getElementById('display-tijd').innerText = `${uren} uur ${min} min`;
    }

    const km = getAantalKM();
    const geld = km * settings.vergoeding;
    document.getElementById('display-geld').innerText = `€${geld.toFixed(2).replace('.', ',')}`;
}

// --- Verzenden & Foutafhandeling ---
const REQUEST_TIMEOUT_MS = 20000;

class SendError extends Error {
    constructor(type, detail) {
        super(detail || type);
        this.type = type;
        this.detail = detail || '';
    }
}

async function sendToScript(record) {
    if (!SCRIPT_URL || SCRIPT_URL.includes("HIER_JOUW")) {
        throw new SendError('config', 'SCRIPT_URL is niet ingesteld in app.js');
    }
    if (!navigator.onLine) {
        throw new SendError('offline');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
        response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(record),
            headers: { 'Content-Type': 'text/plain' },
            signal: controller.signal
        });
    } catch (e) {
        if (e.name === 'AbortError') throw new SendError('timeout');
        if (!navigator.onLine) throw new SendError('offline');
        throw new SendError('access', e.message);
    } finally {
        clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
        throw new SendError('access', `HTTP ${response.status}`);
    }
    if (response.status === 404) {
        throw new SendError('notfound', 'HTTP 404');
    }
    if (!response.ok) {
        throw new SendError('server', `HTTP ${response.status}`);
    }

    const text = await response.text();
    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        const isLogin = /accounts\.google\.com|ServiceLogin|<html/i.test(text);
        throw new SendError(isLogin ? 'access' : 'invalid', 'Onverwacht antwoord van de server');
    }

    if (result.status !== 'success') {
        throw new SendError('script', result.message || 'Onbekende fout in het script');
    }
    return result;
}

function describeError(error) {
    const type = error instanceof SendError ? error.type : 'unknown';
    const detail = error instanceof SendError ? error.detail : (error && error.message) || '';
    const messages = {
        config: {
            title: 'App niet goed ingesteld',
            hint: 'De koppeling met Google Sheets ontbreekt. Neem contact op met de beheerder.'
        },
        offline: {
            title: 'Geen internetverbinding',
            hint: 'Je bent offline. Zodra je weer verbinding hebt, wordt het automatisch opnieuw geprobeerd.'
        },
        timeout: {
            title: 'De server reageert niet',
            hint: 'Het verzenden duurde te lang. Probeer het over een paar minuten opnieuw.'
        },
        access: {
            title: 'Geen toegang tot Google Sheets',
            hint: 'Google weigert het verzoek. De Apps Script web app moet gedeployed zijn met toegang "Iedereen". Neem contact op met de beheerder.'
        },
        notfound: {
            title: 'Script niet gevonden',
            hint: 'De Apps Script URL klopt niet of de deployment is verwijderd.'
        },
        server: {
            title: 'Serverfout bij Google',
            hint: 'Er ging iets mis aan de kant van Google. Probeer het later opnieuw.'
        },
        invalid: {
            title: 'Onverwacht antwoord',
            hint: 'De server gaf een onbekend antwoord.'
        },
        script: {
            title: 'Fout bij opslaan in Google Sheets',
            hint: 'Het script kon de gegevens niet wegschrijven.'
        },
        unknown: {
            title: 'Verzenden mislukt',
            hint: 'Er ging iets onverwachts mis. Probeer het opnieuw.'
        }
    };
    return { type, detail, ...messages[type] };
}

function showError(el, info, extra) {
    el.textContent = '';
    const title = document.createElement('strong');
    title.textContent = `⚠️ ${info.title}`;
    const hint = document.createElement('p');
    hint.textContent = extra ? `${info.hint} ${extra}` : info.hint;
    el.append(title, hint);
    if (info.detail) {
        const detail = document.createElement('small');
        detail.textContent = `Details: ${info.detail}`;
        el.append(detail);
    }
    el.classList.remove('hidden');
}

window.addEventListener('online', async () => {
    const failed = historyData.filter(r => r.status.includes('⚠') && (!r.lastError || ['offline', 'timeout', 'server'].includes(r.lastError.type)));
    for (const record of failed) {
        try {
            await sendToScript(record);
            updateHistoryStatus(record.submissionId, '✓ Verzonden');
        } catch (e) {
            updateHistoryStatus(record.submissionId, '⚠ Verzenden mislukt', describeError(e));
        }
    }
});

// --- Submit & Opslaan ---
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

document.getElementById('uren-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('error-message');
    const msg = document.getElementById('status-message');
    const warnBox = document.getElementById('duplicate-warning');
    
    err.classList.add('hidden');
    msg.classList.add('hidden');

    // Validatie
    if (!settings.naam) {
        err.innerText = "Vul eerst je naam in bij Instellingen!";
        err.classList.remove('hidden');
        switchTab('view-instellingen');
        return;
    }
    
    const selectedDate = document.getElementById('f-datum').value;
    const start = document.getElementById('f-begintijd').value;
    const end = document.getElementById('f-eindtijd').value;
    
    if (start >= end) {
        err.innerText = "Eindtijd moet na de begintijd liggen.";
        err.classList.remove('hidden');
        return;
    }

    // Check op dubbele inzending voor dezelfde persoon op dezelfde dag
    if (!bypassDuplicateWarning) {
        const existingEntry = historyData.find(item => item.datum === selectedDate && item.naam === settings.naam);
        if (existingEntry) {
            const uren = Math.floor(existingEntry.gewerkteMinuten / 60);
            const min = existingEntry.gewerkteMinuten % 60;
            
            document.getElementById('duplicate-details').innerHTML = `
                <p>• <strong>Medewerker:</strong> ${existingEntry.naam}</p>
                <p>• <strong>Tijd:</strong> ${existingEntry.begintijd} - ${existingEntry.eindtijd} (${uren}u ${min}m gewerkt)</p>
                <p>• <strong>Reiskosten:</strong> ${existingEntry.aantalKM} KM (€${existingEntry.berekendeVergoeding.replace('.', ',')})</p>
            `;
            warnBox.classList.remove('hidden');
            bypassDuplicateWarning = true;
            return;
        }
    }

    const [hStart, mStart] = start.split(':').map(Number);
    const [hEnd, mEnd] = end.split(':').map(Number);
    const pauze = getPauzeMinuten();
    const gewerkteMinuten = (hEnd * 60 + mEnd) - (hStart * 60 + mStart) - pauze;
    const km = getAantalKM();
    const vergoeding = km * settings.vergoeding;

    const data = {
        submissionId: generateId(),
        naam: settings.naam,
        datum: selectedDate,
        begintijd: start,
        eindtijd: end,
        pauzeMinuten: pauze,
        gewerkteMinuten: gewerkteMinuten,
        gewerkteUren: (gewerkteMinuten / 60).toFixed(2),
        reiskostenType: document.getElementById('f-reis-type').value,
        aantalKM: km,
        vergoedingPerKM: settings.vergoeding,
        berekendeVergoeding: vergoeding.toFixed(2),
        toelichting: document.getElementById('f-toelichting').value,
        timestamp: new Date().toISOString(),
        status: '⏳ Wacht op verzending'
    };

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.innerText = 'Verzenden...';

    // Opslaan in historie
    saveToHistory(data);
    resetDuplicateWarning();

    try {
        await sendToScript(data);
        updateHistoryStatus(data.submissionId, '✓ Verzonden');
        msg.innerText = "✓ Uren succesvol geregistreerd";
        msg.style.color = "var(--success-color)";
        msg.classList.remove('hidden');
        document.getElementById('uren-form').reset();
        setDefaultDate();
        loadSettings();
    } catch (error) {
        const info = describeError(error);
        updateHistoryStatus(data.submissionId, '⚠ Verzenden mislukt', info);
        showError(err, info, "De registratie is opgeslagen in Historie, zodat je het later opnieuw kunt proberen.");
    }

    btn.disabled = false;
    btn.innerText = 'Uren registreren';
});

// --- Historie ---
function loadHistory() {
    const saved = localStorage.getItem('uren_history');
    if (saved) historyData = JSON.parse(saved);
}

function saveToHistory(record) {
    historyData.unshift(record);
    if (historyData.length > 50) historyData.pop();
    localStorage.setItem('uren_history', JSON.stringify(historyData));
}

function updateHistoryStatus(id, newStatus, errorInfo) {
    const record = historyData.find(r => r.submissionId === id);
    if (record) {
        record.status = newStatus;
        if (errorInfo) record.lastError = { type: errorInfo.type, title: errorInfo.title, hint: errorInfo.hint, detail: errorInfo.detail };
        else if (!newStatus.includes('⚠')) delete record.lastError;
        localStorage.setItem('uren_history', JSON.stringify(historyData));
        if (document.getElementById('view-historie').classList.contains('active')) {
            renderHistory();
        }
    }
}

function renderHistory() {
    const container = document.getElementById('historie-lijst');
    container.innerHTML = '';
    
    if (historyData.length === 0) {
        container.innerHTML = '<div class="card empty-state"><strong>Nog geen registraties</strong>Je geregistreerde uren verschijnen hier.</div>';
        return;
    }

    historyData.forEach(item => {
        const uren = Math.floor(item.gewerkteMinuten / 60);
        const min = item.gewerkteMinuten % 60;
        
        let statusClass = 'status-pending';
        let cardClass = 'is-pending';
        if (item.status.includes('✓')) { statusClass = 'status-success'; cardClass = ''; }
        if (item.status.includes('⚠')) { statusClass = 'status-error'; cardClass = 'is-error'; }

        const retryBtn = item.status.includes('⚠') ? 
            `<button class="btn-secondary" onclick="retrySubmission('${item.submissionId}')">🔄 Opnieuw proberen</button>` : '';

        const [j, m, d] = item.datum.split('-').map(Number);
        const datumLabel = new Date(j, m - 1, d).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const card = document.createElement('div');
        card.className = `history-card ${cardClass}`;
        card.innerHTML = `
            <div class="history-head">
                <div>
                    <h3>${datumLabel}</h3>
                    <div class="history-name">👤 ${escapeHtml(item.naam || settings.naam || "Onbekend")}</div>
                    <p class="history-sub">${item.begintijd} – ${item.eindtijd} • ${item.pauzeMinuten} min pauze</p>
                </div>
                <div class="status-indicator ${statusClass}">${item.status}</div>
            </div>
            <div class="history-stats">
                <div class="history-stat"><span>Gewerkt</span><strong>${uren}u ${min}m</strong></div>
                <div class="history-stat"><span>Afstand</span><strong>${item.aantalKM} km</strong></div>
                <div class="history-stat"><span>Vergoeding</span><strong>€${item.berekendeVergoeding.replace('.',',')}</strong></div>
            </div>
            ${item.toelichting ? `<p class="history-note">${escapeHtml(item.toelichting)}</p>` : ''}
            ${item.status.includes('⚠') && item.lastError ? `<p class="history-error"><strong>${escapeHtml(item.lastError.title)}:</strong> ${escapeHtml(item.lastError.hint)}${item.lastError.detail ? `<br><small>Details: ${escapeHtml(item.lastError.detail)}</small>` : ''}</p>` : ''}
            ${retryBtn}
        `;
        container.appendChild(card);
    });
}

window.retrySubmission = async function(id) {
    const record = historyData.find(r => r.submissionId === id);
    if (!record) return;
    
    updateHistoryStatus(id, '⏳ Probeert opnieuw...');
    
    try {
        await sendToScript(record);
        updateHistoryStatus(id, '✓ Verzonden');
        alert('Gelukt! Uren zijn alsnog verzonden.');
    } catch (e) {
        const info = describeError(e);
        updateHistoryStatus(id, '⚠ Verzenden mislukt', info);
        alert(`Nog steeds mislukt.

${info.title}
${info.hint}${info.detail ? `

Details: ${info.detail}` : ''}`);
    }
};

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
