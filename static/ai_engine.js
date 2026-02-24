// Standalone AI Engine Command Center Logic
let charts = {};
let lastActionTimestamp = null;
let knownInferences = new Set();
let statsInterval = null;
let logInterval = null;
let telemetryInterval = null;

const UI = {
    inferences: document.getElementById('kpi-inferences'),
    anomalies: document.getElementById('kpi-anomalies'),
    recoveries: document.getElementById('kpi-recoveries'),
    inferenceTable: document.getElementById('inference-feed'),
    actionsFeed: document.getElementById('actions-feed'),
    toastContainer: document.getElementById('toast-container')
};

// ---- INITIALIZATION ----
document.addEventListener('DOMContentLoaded', () => {
    console.log("AI Engine Command Center Initializing...");
    initCharts();
    startMonitoring();
    console.log("Monitoring started.");
});

function initCharts() {
    const ctxDecision = document.getElementById('chartDecision').getContext('2d');
    const ctxFeatures = document.getElementById('chartFeatures').getContext('2d');

    charts.decision = new Chart(ctxDecision, {
        type: 'doughnut',
        data: {
            labels: ['Normal', 'Anomalies Prev.'],
            datasets: [{
                data: [95, 5],
                backgroundColor: ['rgba(16, 185, 129, 0.1)', 'rgba(239, 68, 68, 0.1)'],
                borderColor: ['#10b981', '#ef4444'],
                borderWidth: 2
            }]
        },
        options: {
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#64748b', font: { size: 11, weight: '500' }, usePointStyle: true, padding: 15 }
                }
            }
        }
    });

    charts.features = new Chart(ctxFeatures, {
        type: 'bar',
        data: {
            labels: ['Flow', 'Pressure', 'Acoustic'],
            datasets: [{
                label: 'Weight',
                data: [0.35, 0.30, 0.35],
                backgroundColor: 'rgba(15, 98, 254, 0.1)',
                borderColor: '#0f62fe',
                borderWidth: 2,
                borderRadius: 12
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10, weight: '600' } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ---- MONITORING ENGINE ----
function startMonitoring() {
    fetchStats();
    fetchLogs();
    fetchLiveTelemetry(); // Monitor the general telemetry for new inferences

    statsInterval = setInterval(fetchStats, 5000);
    logInterval = setInterval(fetchLogs, 4000);
    telemetryInterval = setInterval(fetchLiveTelemetry, 3000);
}

async function fetchStats() {
    try {
        const r = await fetch('/api/ai/status');
        const data = await r.json();

        UI.inferences.innerText = data.stats.total_inferences.toLocaleString();
        UI.anomalies.innerText = data.stats.anomalies_detected.toLocaleString();
        UI.recoveries.innerText = data.stats.auto_recoveries.toLocaleString();

        // Update charts
        charts.decision.data.datasets[0].data = [data.stats.normal_predictions, data.stats.anomalies_detected];
        charts.decision.update();

        charts.features.data.datasets[0].data = [
            data.feature_importance.flow_rate,
            data.feature_importance.pressure,
            data.feature_importance.acoustic
        ];
        charts.features.update();
    } catch (e) { console.error("Stats fail:", e); }
}

async function fetchLogs() {
    try {
        const r = await fetch('/api/ai/log');
        const data = await r.json();
        const logs = data.log || [];

        if (logs.length > 0) {
            UI.actionsFeed.innerHTML = '';
            logs.forEach(log => {
                const item = document.createElement('div');
                item.className = 'action-item';

                let iconClas = 'icon-shutoff';
                let iconFa = 'fa-power-off';

                if (log.action === 'AUTO-RECOVERY') { iconClas = 'icon-recover'; iconFa = 'fa-rotate-right'; }
                else if (log.action === 'THEFT-BLOCK') { iconClas = 'icon-theft'; iconFa = 'fa-user-secret'; }
                else if (log.action === 'PRESSURE-REGULATE') { iconClas = 'icon-theft'; iconFa = 'fa-gauge-simple-high'; }

                item.innerHTML = `
                    <div class="action-icon ${iconClas}"><i class="fa-solid ${iconFa}"></i></div>
                    <div class="action-info">
                        <h4>${log.action} @ ${log.node_id}</h4>
                        <p>${log.details}</p>
                    </div>
                    <div class="action-time">${log.timestamp}</div>
                `;
                UI.actionsFeed.appendChild(item);

                // Trigger toast for NEW high severity actions
                if (!lastActionTimestamp || log.timestamp > lastActionTimestamp) {
                    if (log.severity >= 5) {
                        showToast(log.node_id, log.action, log.anomaly_type);
                    }
                }
            });
            lastActionTimestamp = logs[0].timestamp;
        }
    } catch (e) { console.error("Logs fail:", e); }
}

async function fetchLiveTelemetry() {
    try {
        const r = await fetch('/api/admin/data/telemetry');
        const d = await r.json();
        const t = d.telemetry;

        if (t) {
            // Only add if not duplicates (simple time check for this demo)
            const rowId = `${t.node_id}-${t.timestamp}`;
            if (!knownInferences.has(rowId)) {
                knownInferences.add(rowId);
                const tr = document.createElement('tr');
                const isAnomaly = t.prediction === 1;
                tr.innerHTML = `
                    <td>${t.timestamp}</td>
                    <td><strong>${t.node_id}</strong></td>
                    <td>${t.flow_rate}, ${t.pressure}, ${t.acoustic}</td>
                    <td><span class="badge ${isAnomaly ? 'badge-anomaly' : 'badge-normal'}">${isAnomaly ? 'ANOMALY' : 'NORMAL'}</span></td>
                    <td>${(t.confidence * 100).toFixed(1)}%</td>
                    <td><small style="color:${isAnomaly ? '#f43f5e' : '#10b981'}">${t.ai_action || 'None'}</small></td>
                `;
                UI.inferenceTable.insertBefore(tr, UI.inferenceTable.firstChild);

                // Trim table
                if (UI.inferenceTable.rows.length > 20) {
                    UI.inferenceTable.deleteRow(UI.inferenceTable.rows.length - 1);
                }
            }
        }
    } catch (e) { }
}

function showToast(nodeId, action, type) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="action-icon icon-shutoff"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div>
            <div style="font-weight:700; font-size: 0.9rem;">AI INTERVENTION: ${nodeId}</div>
            <div style="font-size: 0.75rem; color: #94a3b8;">${action} — ${type}</div>
        </div>
        <div class="toast-progress"></div>
    `;
    UI.toastContainer.appendChild(toast);

    // Play subtle alert sound if possible or visual pulse
    document.querySelector('.pulse').style.backgroundColor = '#f43f5e';
    setTimeout(() => {
        document.querySelector('.pulse').style.backgroundColor = '#10b981';
    }, 1000);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}
