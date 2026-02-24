import { db, doc, getDoc, onSnapshot } from './firebase-config.js';

const CITY_DATA = {
    Pune: { lat: 18.5204, lng: 73.8567, source: "Khadakwasla Dam", srcLat: 18.4410, srcLng: 73.7700 },
    Mumbai: { lat: 19.0760, lng: 72.8777, source: "Bhatsa Dam", srcLat: 19.4000, srcLng: 73.4500 },
    Amravati: { lat: 20.9374, lng: 77.7796, source: "Upper Wardha Dam", srcLat: 21.2721, srcLng: 78.0667 },
};

const userEmail = localStorage.getItem('user_email');
const userRole = localStorage.getItem('user_role');

console.log("Citizen Dashboard Module Initializing...");
if (!userEmail || userRole !== 'citizen') {
    console.warn("Unauthorized access or missing session - Redirecting to login");
    window.location.href = '/login';
}

let currentMeterId = null;
let telemetryTimer = null;
let charts = { usage: null, pressure: null, category: null };
let networkMap = null;
let meterMarker = null;
let pipeLine = null;
let hubMarker = null;

async function initDashboard() {
    console.log("initDashboard starting for:", userEmail);
    try {
        const userRef = doc(db, 'users', userEmail);
        console.log("Fetching user document...");
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            currentMeterId = userData.meter_id;

            const name = userData.name || "Citizen";
            document.getElementById('greeting').innerText = `Namaste, ${name.split(' ')[0]}`;

            // Populate Settings
            const setNames = document.getElementById('setting-name');
            if (setNames) setNames.value = userData.name || "";
            const setEmail = document.getElementById('setting-email');
            if (setEmail) setEmail.value = userEmail || "";
            const setMeter = document.getElementById('setting-meter-id');
            if (setMeter) setMeter.innerText = currentMeterId || "--";

            // Setup Navigation & Charts
            setupNavigation();
            initCharts();
            initMap(userData);

            // Start Telemetry Polling
            startTelemetry();

            // setupModalListeners is moved here to ensure links work
            setupModalListeners();
            console.log("Dashboard initialization complete.");
        } else {
            console.error("User record not found in Firestore for email:", userEmail);
            showToast("No account data found for this user.");
        }
    } catch (err) {
        console.error("CRITICAL Dashboard Error:", err);
    }
}

async function startTelemetry() {
    if (telemetryTimer) clearInterval(telemetryTimer);

    // Poll every 3 seconds
    fetchTelemetry();
    telemetryTimer = setInterval(fetchTelemetry, 3000);
}

async function fetchTelemetry() {
    if (!currentMeterId) return;

    try {
        const r = await fetch(`/api/citizen/data/${currentMeterId}`);
        const data = await r.json();

        const overlay = document.getElementById('suspension-overlay');

        if (data.status === 'suspended') {
            // Only show if user hasn't explicitly closed it for THIS session
            if (!sessionStorage.getItem('suspension_modal_closed')) {
                overlay.style.display = 'flex';
            }
            updateUIWithData({ flow_rate: 0, pressure: 0, acoustic: 0, ph: 7.0 });
        } else {
            overlay.style.display = 'none';
            updateUIWithData(data);
            updateMapWithTelemetry(data);
        }
    } catch (e) {
        console.warn("Telemetry fetch failed", e);
    }
}

function updateUIWithData(data) {
    document.getElementById('current-flow').innerHTML = `${data.flow_rate} <small>L/min</small>`;
    document.getElementById('current-pressure').innerHTML = `${data.pressure} <small>PSI</small>`;
    document.getElementById('current-acoustic').innerHTML = `${data.acoustic} <small>dB</small>`;
    document.getElementById('current-ph').innerHTML = `${data.ph || '--'} <small>pH</small>`;

    // Dynamic usage bar (just a simple mapping for demo)
    const usagePercent = Math.min(100, (data.flow_rate / 150) * 100);
    document.getElementById('usage-progress-bar').style.width = usagePercent + '%';
    document.getElementById('current-usage-val').innerText = `${Math.floor(data.flow_rate * 6)}L/Day`;

    // Dynamic Insights
    const insightText = document.getElementById('ai-insight-text');
    const alertBox = document.getElementById('eco-alert-box');
    const alertText = document.getElementById('eco-alert-text');

    if (data.flow_rate > 0) {
        insightText.innerHTML = `Your current consumption is <strong style="color:var(--primary)">Stable</strong>.`;
        alertBox.style.display = 'flex';

        if (data.flow_rate > 70) {
            alertBox.style.background = '#fee2e2';
            alertText.innerText = "High consumption detected. AI suggesting review of outlet valves.";
            alertText.style.color = '#b91c1c';
        } else {
            alertBox.style.background = '#f0fdf4';
            alertText.innerText = "Optimal flow maintained. No leaks detected.";
            alertText.style.color = '#15803d';
        }
    }
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');

            // UI Update
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            document.querySelectorAll('.dashboard-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(`section-${sectionId}`).classList.add('active');

            if (sectionId === 'billing') {
                fetchBillingHistory();
            }

            if (sectionId === 'analytics') {
                setTimeout(() => {
                    Object.values(charts).forEach(c => c && c.resize());
                    updateAnalyticsWithMockData();
                }, 100);
            }
        });
    });
}

function updateAnalyticsWithMockData() {
    if (charts.usage) {
        charts.usage.data.datasets[0].data = [45, 52, 38, 65, 48, 55, 42];
        charts.usage.update();
    }
    if (charts.pressure) {
        charts.pressure.data.datasets[0].data = [58, 60, 55, 62, 59, 61];
        charts.pressure.update();
    }
}

async function fetchBillingHistory() {
    if (!currentMeterId) return;
    try {
        const r = await fetch(`/api/citizen/billing/${currentMeterId}`);
        const data = await r.json();

        // Update Balance on Home
        document.getElementById('outstanding-balance').innerText = `₹${data.current_amount.toFixed(2)}`;

        // Populate Table
        const body = document.getElementById('billing-history-body');
        body.innerHTML = '';

        // Add Current Row (Simulated live)
        const currentTR = document.createElement('tr');
        currentTR.innerHTML = `
            <td>${data.current_period} (Current)</td>
            <td>${data.total_liters.toFixed(2)} L</td>
            <td>₹${data.current_amount.toFixed(2)}</td>
            <td>Jan 10, 2027</td>
            <td><span class="badge badge-warning">Current</span></td>
            <td><button class="btn-text" onclick="sendBillEmail()">Pay Balance</button></td>
        `;
        body.appendChild(currentTR);

        // Add的历史
        data.history.forEach(h => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${h.period}</td>
                <td>${h.liters} L</td>
                <td>₹${h.amount.toFixed(2)}</td>
                <td>-</td>
                <td><span class="badge badge-success">${h.status}</span></td>
                <td><button class="btn-text" onclick="sendBillEmail()">Invoice</button></td>
            `;
            body.appendChild(tr);
        });

        // Update Progress Bar based on usage limit (demo 500L)
        const usageLimit = 500;
        const usagePercent = Math.min(100, (data.total_liters / usageLimit) * 100);
        document.getElementById('usage-progress-bar').style.width = usagePercent + '%';
        document.getElementById('current-usage-val').innerText = `${data.total_liters.toFixed(2)} L Used`;

    } catch (e) {
        console.error("Billing fetch error:", e);
    }
}

async function payBill() {
    if (!currentMeterId) return;

    try {
        const r = await fetch('/api/citizen/pay-bill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ node_id: currentMeterId })
        });
        const data = await r.json();

        if (data.status === 'ok') {
            showToast("Success! Your bill is paid and service is resumed.", "success");

            // UI Updates
            sessionStorage.removeItem('suspension_modal_closed');
            document.getElementById('suspension-overlay').style.display = 'none';

            // Refresh Data
            fetchBillingHistory();
            fetchTelemetry();
        } else {
            showToast("Payment failed: " + data.error);
        }
    } catch (e) {
        console.error("Payment error:", e);
        showToast("An error occurred during payment.");
    }
}

function setupModalListeners() {
    const btnModalPay = document.getElementById('btn-pay-balance-modal');
    const btnMainPay = document.getElementById('btn-pay-balance-main');
    const btnClose = document.getElementById('close-suspension-modal');

    if (btnModalPay) btnModalPay.onclick = payBill;
    if (btnMainPay) btnMainPay.onclick = payBill;
    if (btnClose) {
        btnClose.onclick = () => {
            document.getElementById('suspension-overlay').style.display = 'none';
            // Suppress modal for this session
            sessionStorage.setItem('suspension_modal_closed', 'true');
        };
    }

    // Logout Modal
    const logoutBtn = document.getElementById('btn-logout');
    const logoutModal = document.getElementById('logout-modal');
    const confirmLogout = document.getElementById('btn-confirm-logout');
    const cancelLogout = document.getElementById('btn-cancel-logout');

    if (logoutBtn) {
        logoutBtn.onclick = (e) => {
            e.preventDefault();
            logoutModal.style.display = 'flex';
        };
    }

    if (cancelLogout) {
        cancelLogout.onclick = () => {
            logoutModal.style.display = 'none';
        };
    }

    if (confirmLogout) {
        confirmLogout.onclick = () => {
            localStorage.clear();
            window.location.href = '/login';
        };
    }
}

function showToast(msg, type = "error") {
    const t = document.createElement('div');
    t.className = 'toast';
    const bg = type === "success" ? "#10b981" : "#ef4444";
    t.style.cssText = `position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:${bg}; color:white; padding:1rem 2rem; border-radius:12px; z-index:10000; box-shadow: 0 4px 12px rgba(0,0,0,0.1); font-weight: 500; min-width: 300px; text-align: center;`;
    t.innerHTML = msg;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transition = 'opacity 0.5s ease';
        setTimeout(() => t.remove(), 500);
    }, 3000);
}

function initCharts() {
    const ctxUsage = document.getElementById('usageChart').getContext('2d');
    charts.usage = new Chart(ctxUsage, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Water Consumption (L)',
                data: [0, 0, 0, 0, 0, 0, 0], // Start empty
                borderColor: '#0f62fe',
                backgroundColor: 'rgba(15, 98, 254, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const ctxPres = document.getElementById('pressureChart').getContext('2d');
    charts.pressure = new Chart(ctxPres, {
        type: 'line',
        data: {
            labels: ['12am', '4am', '8am', '12pm', '4pm', '8pm'],
            datasets: [{
                label: 'System Pressure (PSI)',
                data: [0, 0, 0, 0, 0, 0], // Start empty
                borderColor: '#10b981',
                tension: 0.2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    charts.category = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: ['Hygiene', 'Kitchen', 'Cleaning', 'Other'],
            datasets: [{
                data: [65, 25, 7, 3],
                backgroundColor: ['#0f62fe', '#10b981', '#f59e0b', '#cbd5e1']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

/* Removed duplicate showToast */

function initMap(userData) {
    const mapContainer = document.getElementById('network-health-map');
    if (!mapContainer) return;

    const meterId = userData.meter_id || 'MTR-NOT-LINKED';

    onSnapshot(doc(db, 'meters', meterId), (snap) => {
        const city = userData.city || 'Amravati';
        const c = CITY_DATA[city] || CITY_DATA['Amravati'];

        let lat = c.lat, lng = c.lng;

        if (snap.exists()) {
            const meter = snap.data();
            lat = meter.lat || lat;
            lng = meter.lng || lng;
        } else {
            console.warn(`Home meter document missing for ${meterId}, falling back to city center.`);
        }

        if (!networkMap) {
            networkMap = L.map('network-health-map', { zoomControl: false }).setView([lat, lng], 14);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(networkMap);
        }

        // Add WTP and Source markers for the city
        if (!hubMarker) {
            L.marker([c.srcLat, c.srcLng], {
                icon: L.divIcon({
                    className: '',
                    html: `<div style="background:#1e3a5f;color:#93c5fd;padding:2px 6px;border-radius:4px;font-size:7px;font-weight:700;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,.3)"><i class="fa-solid fa-mountain" style="margin-right:2px"></i>${c.source}</div>`,
                    iconSize: [80, 20],
                    iconAnchor: [40, 10]
                })
            }).addTo(networkMap);

            L.marker([c.lat, c.lng], {
                icon: L.divIcon({
                    className: '',
                    html: `<div style="background:#991b1b;color:#fecaca;padding:2px 6px;border-radius:4px;font-size:7px;font-weight:700;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,.3)"><i class="fa-solid fa-industry" style="margin-right:2px"></i>WTP ${city}</div>`,
                    iconSize: [80, 20],
                    iconAnchor: [40, 10]
                })
            }).addTo(networkMap);

            // Assign dummy marker to hubMarker to prevent re-drawing these city assets
            hubMarker = L.marker([c.lat, c.lng], { opacity: 0 }).addTo(networkMap);

            L.polyline([[c.srcLat, c.srcLng], [c.lat, c.lng]], { color: '#1e3a5f', weight: 2, opacity: 0.4 }).addTo(networkMap);
        }

        if (!meterMarker) {
            meterMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: '',
                    html: `<div class="meter-icon real-active"><i class="fa-solid fa-house-chimney"></i></div>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                })
            }).addTo(networkMap);
            meterMarker.bindPopup(`<strong>Your Home</strong><br>Node ID: ${userData.meter_id}`);

            pipeLine = L.polyline([[c.lat, c.lng], [lat, lng]], {
                color: '#0f62fe',
                weight: 3,
                opacity: 0.8,
                dashArray: '10, 10',
                className: 'leaflet-ant-path'
            }).addTo(networkMap);
        }

        networkMap.invalidateSize();
    });
}

function updateMapWithTelemetry(data) {
    if (!meterMarker) return;
    const el = meterMarker.getElement()?.querySelector('.meter-icon');
    if (!el) return;

    if (data.prediction === 1) {
        el.classList.add('alerting');
    } else {
        el.classList.remove('alerting');
    }
}

/* Handled in setupModalListeners */

// Initialize immediately (module scripts run after DOM is parsed anyway)
initDashboard();
