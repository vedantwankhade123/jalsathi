// Chart Setup
const ctx = document.getElementById('telemetryChart').getContext('2d');
Chart.defaults.color = '#8b949e';
Chart.defaults.font.family = 'Outfit';

const telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Flow Rate (L/min)',
                data: [],
                borderColor: '#58a6ff',
                backgroundColor: 'rgba(88, 166, 255, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                yAxisID: 'y'
            },
            {
                label: 'Pressure (PSI)',
                data: [],
                borderColor: '#3fb950',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                yAxisID: 'y'
            },
            {
                label: 'Acoustic (dB)',
                data: [],
                borderColor: '#d29922',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                yAxisID: 'y1'
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            tooltip: { mode: 'index', intersect: false }
        },
        scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            y: { 
                type: 'linear', display: true, position: 'left',
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                title: { display: true, text: 'Flow & Pressure' }
            },
            y1: {
                type: 'linear', display: true, position: 'right',
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'Acoustic Signal' }
            }
        },
        animation: { duration: 400 }
    }
});

let totalAlerts = 0;

// Poll Data from Backend API
async function fetchStreamData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        
        updateChart(data);
        updateDashboard(data);
        
    } catch (error) {
        console.error("Error fetching telemetry:", error);
    }
}

function updateChart(data) {
    const time = data.timestamp;
    
    // Add new data
    telemetryChart.data.labels.push(time);
    telemetryChart.data.datasets[0].data.push(data.flow_rate);
    telemetryChart.data.datasets[1].data.push(data.pressure);
    telemetryChart.data.datasets[2].data.push(data.acoustic);
    
    // Keep sliding window of 15 points
    if (telemetryChart.data.labels.length > 15) {
        telemetryChart.data.labels.shift();
        telemetryChart.data.datasets[0].data.shift();
        telemetryChart.data.datasets[1].data.shift();
        telemetryChart.data.datasets[2].data.shift();
    }
    
    telemetryChart.update();
}

function updateDashboard(data) {
    const alertsList = document.getElementById('alerts-list');
    
    const alertItem = document.createElement('div');
    
    if (data.prediction === 1) {
        // Anomaly Detected
        totalAlerts++;
        document.getElementById('total-alerts').innerText = totalAlerts;
        
        const severityClass = data.severity > 7 ? 'critical' : 'warning';
        alertItem.className = `alert-item ${severityClass}`;
        
        alertItem.innerHTML = `
            <div class="alert-icon"></div>
            <div class="alert-details">
                <span class="alert-node">${data.node_id} - ${data.anomaly_type}</span>
                <span class="alert-time">${data.timestamp} | Severity: ${data.severity}/10</span>
            </div>
        `;
        
        // Update Severity Card focus
        document.getElementById('last-severity').innerText = `${data.severity} / 10`;
        const sevCard = document.getElementById('severity-card');
        sevCard.style.borderColor = severityClass === 'critical' ? 'var(--accent-red)' : 'var(--accent-yellow)';
        
        // Throw Toast
        showToast(`${data.anomaly_type} detected at ${data.node_id} (Severity: ${data.severity})`);
        
    } else {
        // Normal 
        // We only show a limited number of normal pings so we dont flood
        alertItem.className = 'alert-item normal';
        alertItem.innerHTML = `
            <div class="alert-icon"></div>
            <div class="alert-details">
                <span class="alert-node">${data.node_id} - Normal Operation</span>
                <span class="alert-time">${data.timestamp} | Ping OK</span>
            </div>
        `;
    }
    
    alertsList.prepend(alertItem);
    
    // Keep latest 10 items in feed
    if (alertsList.children.length > 10) {
        alertsList.removeChild(alertsList.lastChild);
    }
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div style="width:10px;height:10px;background:var(--accent-red);border-radius:50%;box-shadow:0 0 10px var(--accent-red);"></div>
        <strong>CRITICAL ALERT:</strong> ${message}
    `;
    
    container.appendChild(toast);
    
    // Remove element after animation
    setTimeout(() => {
        container.removeChild(toast);
    }, 5000);
}

// Start polling every 2 seconds
setInterval(fetchStreamData, 2000);
