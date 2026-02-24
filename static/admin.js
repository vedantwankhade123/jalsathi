import { db, doc, getDoc, setDoc, updateDoc, collection, getDocs, onSnapshot } from './firebase-config.js';

const userEmail = localStorage.getItem('user_email');
const userRole = localStorage.getItem('user_role');
console.log("Admin Dashboard Module Initializing...");
if (!userEmail || userRole !== 'admin') {
    console.warn("Unauthorized access or missing session - Redirecting to login");
    window.location.href = '/login';
}

// ---- CITY COORDINATES & SOURCES ----
const CITY_DATA = {
    Pune: { lat: 18.5204, lng: 73.8567, source: "Khadakwasla Dam", srcLat: 18.4410, srcLng: 73.7700 },
    Mumbai: { lat: 19.0760, lng: 72.8777, source: "Bhatsa Dam", srcLat: 19.4000, srcLng: 73.4500 },
    Delhi: { lat: 28.6139, lng: 77.2090, source: "Yamuna Barrage", srcLat: 28.7000, srcLng: 77.2100 },
    "New Delhi": { lat: 28.6139, lng: 77.2090, source: "Yamuna Barrage", srcLat: 28.7000, srcLng: 77.2100 },
    Bangalore: { lat: 12.9716, lng: 77.5946, source: "Cauvery WTP", srcLat: 12.8900, srcLng: 77.5200 },
    Hyderabad: { lat: 17.3850, lng: 78.4867, source: "Osmansagar Dam", srcLat: 17.3800, srcLng: 78.3100 },
    Chennai: { lat: 13.0827, lng: 80.2707, source: "Chembarambakkam", srcLat: 13.0400, srcLng: 80.0700 },
    Kolkata: { lat: 22.5726, lng: 88.3639, source: "Garden Reach WTP", srcLat: 22.5100, srcLng: 88.3100 },
    Jaipur: { lat: 26.9124, lng: 75.7873, source: "Bisalpur Dam", srcLat: 26.2600, srcLng: 75.6500 },
    Ahmedabad: { lat: 23.0225, lng: 72.5714, source: "Narmada Canal", srcLat: 23.1200, srcLng: 72.4800 },
    Nagpur: { lat: 21.1458, lng: 79.0882, source: "Gorewada Lake", srcLat: 21.1800, srcLng: 79.0500 },
    Lucknow: { lat: 26.8467, lng: 80.9462, source: "Gomti Barrage", srcLat: 26.8600, srcLng: 80.9200 },
    Bhopal: { lat: 23.2599, lng: 77.4126, source: "Upper Lake WTP", srcLat: 23.2400, srcLng: 77.3800 },
    Chandigarh: { lat: 30.7333, lng: 76.7794, source: "Kajauli WTP", srcLat: 30.8400, srcLng: 76.6100 },
    Patna: { lat: 25.6093, lng: 85.1376, source: "Ganga WTP", srcLat: 25.6200, srcLng: 85.1000 },
    Bhubaneswar: { lat: 20.2961, lng: 85.8245, source: "Mahanadi WTP", srcLat: 20.3100, srcLng: 85.7800 },
    Guwahati: { lat: 26.1445, lng: 91.7362, source: "Brahmaputra WTP", srcLat: 26.1600, srcLng: 91.7100 },
    Ranchi: { lat: 23.3441, lng: 85.3096, source: "Kanke Dam", srcLat: 23.3900, srcLng: 85.3200 },
    Raipur: { lat: 21.2514, lng: 81.6296, source: "Kharun River WTP", srcLat: 21.2700, srcLng: 81.5900 },
    Dehradun: { lat: 30.3165, lng: 78.0322, source: "Song River WTP", srcLat: 30.3400, srcLng: 78.0100 },
    Thiruvananthapuram: { lat: 8.5241, lng: 76.9366, source: "Aruvikkara Dam", srcLat: 8.5500, srcLng: 77.0200 },
    Kochi: { lat: 9.9312, lng: 76.2673, source: "Aluva WTP", srcLat: 10.1100, srcLng: 76.3500 },
    Visakhapatnam: { lat: 17.6868, lng: 83.2185, source: "Yeleru Reservoir", srcLat: 17.6600, srcLng: 82.9100 },
    Surat: { lat: 21.1702, lng: 72.8311, source: "Ukai Dam WTP", srcLat: 21.2500, srcLng: 73.5900 },
    Coimbatore: { lat: 11.0168, lng: 76.9558, source: "Siruvani Dam", srcLat: 10.9500, srcLng: 76.6200 },
    Panaji: { lat: 15.4909, lng: 73.8278, source: "Selaulim Dam", srcLat: 15.2500, srcLng: 74.0600 },
    Shimla: { lat: 31.1048, lng: 77.1734, source: "Gumma WTP", srcLat: 31.0600, srcLng: 77.1200 },
    Amravati: { lat: 20.9374, lng: 77.7796, source: "Upper Wardha Dam", srcLat: 21.2721, srcLng: 78.0667 },
};

const STATE_CITIES = {
    "Maharashtra": ["Pune", "Mumbai", "Nagpur", "Nashik", "Aurangabad", "Thane", "Solapur", "Kolhapur", "Sangli", "Amravati"],
    "Delhi": ["New Delhi", "Delhi"],
    "Karnataka": ["Bangalore", "Mysore", "Hubli", "Mangalore", "Belgaum", "Gulbarga"],
    "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli", "Tirunelveli"],
    "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Bardhaman"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Gandhinagar"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Agra", "Varanasi", "Allahabad", "Noida", "Ghaziabad", "Meerut"],
    "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain"],
    "Punjab": ["Chandigarh", "Ludhiana", "Amritsar", "Jalandhar", "Patiala"],
    "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Karnal"],
    "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kannur"],
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Nellore"],
    "Bihar": ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur"],
    "Assam": ["Guwahati", "Silchar", "Dibrugarh"],
    "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro"],
    "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba"],
    "Uttarakhand": ["Dehradun", "Haridwar", "Rishikesh", "Nainital"],
    "Goa": ["Panaji", "Vasco da Gama", "Margao"],
    "Himachal Pradesh": ["Shimla", "Manali", "Dharamsala"]
};

const COLONIES = [{ name: "Sector 42", color: "#2563eb" }, { name: "Green Valley", color: "#10b981" }, { name: "East Park", color: "#8b5cf6" }, { name: "Riverview", color: "#f59e0b" }, { name: "West End", color: "#ef4444" }];

let adminCity = null, cityCoords = null, adminData = {};
let map = null, mapFull = null;
const nodeMarkers = {}, nodeMarkersFull = {}, pipelineLines = {}, pipelineLinesFull = {}, colonyStats = {};

// Analytics
let alertCount = 0, theftCount = 0, leakCount = 0, pressureDropCount = 0, totalAnomalies = 0;
const anomalyLog = [], timeLabels = [], phData = [], turbData = [], chlorData = [], flowData = [], pressData = [];
const anomalyTypes = { 'Water Theft': 0, 'Pipe Leak': 0, 'Pressure Drop': 0, 'Contamination': 0, 'Meter Tamper': 0 };
const theftTimeline = [], leakTimeline = [];
let chartQuality, chartFlow, chartAnomaly, chartTheft;

// ---- SETTINGS: State → City cascade ----
function populateSettingsStates() {
    const sel = document.getElementById('settings-state');
    sel.innerHTML = '<option value="">Select State</option>';
    Object.keys(STATE_CITIES).sort().forEach(s => {
        sel.innerHTML += `<option value="${s}">${s}</option>`;
    });
}
function populateSettingsCities() {
    const state = document.getElementById('settings-state').value;
    const citySel = document.getElementById('settings-city');
    if (!state) { citySel.innerHTML = '<option value="">Select state first</option>'; return; }
    const cities = STATE_CITIES[state] || [];
    citySel.innerHTML = '<option value="">Select City</option>';
    cities.forEach(c => { citySel.innerHTML += `<option value="${c}">${c}</option>`; });
}
populateSettingsStates();
document.getElementById('settings-state').addEventListener('change', populateSettingsCities);

// ---- GEOCODE HELPER ----
async function geocodeCity(city, state) {
    try {
        const q = `${city}, ${state}, India`;
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
        const d = await r.json();
        if (d.length) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
    } catch (e) { console.warn('Geocode failed:', e); }
    return null;
}

async function initDashboard() {
    console.log("initDashboard starting for:", userEmail);
    try {
        console.log("Fetching admin document...");
        const snap = await getDoc(doc(db, 'users', userEmail));
        if (snap.exists()) {
            adminData = snap.data();
            console.log("Admin data loaded for city:", adminData.city);

            document.getElementById('user-name').innerText = adminData.name;
            document.getElementById('user-city').innerText = `${adminData.city || '—'}, ${adminData.state || ''}`;
            document.getElementById('admin-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(adminData.name)}&background=2563eb&color=fff&size=64`;

            const profileName = document.getElementById('profile-name');
            if (profileName) profileName.innerText = adminData.name;
            const profileEmail = document.getElementById('profile-email');
            if (profileEmail) profileEmail.innerText = userEmail;
            const profileCity = document.getElementById('profile-city');
            if (profileCity) profileCity.innerText = adminData.city || '—';
            const profileState = document.getElementById('profile-state');
            if (profileState) profileState.innerText = adminData.state || '—';
            const profileCountry = document.getElementById('profile-country');
            if (profileCountry) profileCountry.innerText = adminData.country || '—';

            if (adminData.state) {
                const stateSel = document.getElementById('settings-state');
                if (stateSel) {
                    stateSel.value = adminData.state;
                    populateSettingsCities();
                    const citySel = document.getElementById('settings-city');
                    if (citySel && adminData.city) citySel.value = adminData.city;
                }
            }

            adminCity = adminData.city || 'Amravati';

            if (CITY_DATA[adminCity]) {
                cityCoords = CITY_DATA[adminCity];
            } else if (adminData.city_lat && adminData.city_lng) {
                cityCoords = {
                    lat: adminData.city_lat, lng: adminData.city_lng,
                    source: `${adminCity} Water Source`, srcLat: adminData.city_lat + 0.06, srcLng: adminData.city_lng - 0.05
                };
            } else if (adminData.city && adminData.state) {
                console.log("Geocoding city...");
                const geo = await geocodeCity(adminData.city, adminData.state);
                if (geo) {
                    cityCoords = {
                        lat: geo.lat, lng: geo.lng,
                        source: `${adminCity} Water Source`, srcLat: geo.lat + 0.06, srcLng: geo.lng - 0.05
                    };
                    await updateDoc(doc(db, 'users', userEmail), { city_lat: geo.lat, city_lng: geo.lng });
                } else {
                    cityCoords = CITY_DATA['Amravati'];
                }
            } else {
                cityCoords = CITY_DATA['Amravati'];
            }

            console.log("Initializing maps...");
            initMaps();
            console.log("Initializing charts...");
            initCharts();
            console.log("Dashboard initialization complete.");
        } else {
            console.error("Admin record not found in Firestore.");
            showToast("Admin account data missing.");
        }
    } catch (e) { console.error("CRITICAL Admin Error:", e); }
}

initDashboard();

// ---- SIDEBAR NAV ----
const pageTitles = {
    overview: { title: 'Overview', desc: 'Real-time monitoring & status' },
    analytics: { title: 'Analytics', desc: 'Charts, anomaly & theft detection' },
    map: { title: 'Network Map', desc: 'Full topology' },
    meters: { title: 'Register Meters', desc: 'Add & manage meters' },
    citizens: { title: 'Citizens', desc: 'Registered citizens' },
    billing: { title: 'Billing Management', desc: 'Revenue & network usage summary' },
    settings: { title: 'Settings', desc: 'Network location & profile' }
};
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const s = item.getAttribute('data-section');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active-section'));
        document.getElementById(`sec-${s}`).classList.add('active-section');
        document.getElementById('page-title').innerText = pageTitles[s].title;
        document.getElementById('page-desc').innerText = pageTitles[s].desc;
        setTimeout(() => { if (map) map.invalidateSize(); if (mapFull) mapFull.invalidateSize(); }, 150);
        if (s === 'citizens') loadCitizens();
        if (s === 'billing') fetchBillingData();
    });
});

async function fetchBillingData() {
    const body = document.getElementById('admin-billing-body');
    body.innerHTML = '<tr><td colspan="5" class="centered"><i class="fa-solid fa-spinner fa-spin"></i> Loading billing data...</td></tr>';
    try {
        const r = await fetch('/api/admin/billing/summary');
        const data = await r.json();

        document.getElementById('total-revenue').innerText = `₹${data.total_revenue.toLocaleString()}`;
        document.getElementById('admin-total-liters').innerText = `${data.total_liters.toLocaleString()} L`;

        body.innerHTML = '';
        if (data.nodes.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="centered">No billing records yet.</td></tr>';
            return;
        }

        data.nodes.forEach(n => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${n.node_id}</strong></td>
                <td>${n.city}</td>
                <td>${n.total_liters.toFixed(2)} L</td>
                <td>₹${n.current_amount.toFixed(2)}</td>
                <td><button class="btn-sm btn-outline">Details</button></td>
            `;
            body.appendChild(tr);
        });
    } catch (e) {
        body.innerHTML = `<tr><td colspan="5" class="centered color-red">Error: ${e.message}</td></tr>`;
    }
}

// ---- SIGN OUT MODAL ----
document.getElementById('btn-logout').addEventListener('click', () => document.getElementById('logout-modal').classList.add('show'));
document.getElementById('btn-cancel-logout').addEventListener('click', () => document.getElementById('logout-modal').classList.remove('show'));
document.getElementById('btn-confirm-logout').addEventListener('click', () => { localStorage.clear(); window.location.href = '/login'; });

// ---- SETTINGS: SAVE (geocode if not in CITY_DATA) ----
document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const state = document.getElementById('settings-state').value;
    const city = document.getElementById('settings-city').value;
    const msg = document.getElementById('settings-msg');
    if (!state || !city) { msg.style.color = '#ef4444'; msg.innerText = 'Select both state and city.'; return; }
    try {
        msg.style.color = '#64748b'; msg.innerText = `Locating ${city}, ${state}...`;
        const updateData = { city, state };
        // If city not in CITY_DATA, geocode and store coordinates
        if (!CITY_DATA[city]) {
            const geo = await geocodeCity(city, state);
            if (geo) {
                updateData.city_lat = geo.lat;
                updateData.city_lng = geo.lng;
            } else {
                msg.style.color = '#ef4444'; msg.innerText = `Could not locate ${city}. Try a different city.`; return;
            }
        } else {
            // Clear stored coords since we have CITY_DATA
            updateData.city_lat = null;
            updateData.city_lng = null;
        }
        await updateDoc(doc(db, 'users', userEmail), updateData);
        msg.style.color = '#10b981';
        msg.innerText = `Saved! Switching to ${city}, ${state}...`;
        setTimeout(() => window.location.reload(), 1200);
    } catch (e) { msg.style.color = '#ef4444'; msg.innerText = 'Error: ' + e.message; }
});

// ---- MAPS ----
function initMaps() {
    const c = cityCoords;
    map = L.map('waterMap').setView([c.lat, c.lng], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM' }).addTo(map);
    drawInfra(map, c);
    setTimeout(() => {
        mapFull = L.map('waterMapFull').setView([c.lat, c.lng], 14);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM' }).addTo(mapFull);
        drawInfra(mapFull, c);
        // Start listening AFTER both maps are ready
        listenMeters();
    }, 600);
    setInterval(fetchTelemetry, 3000);
}

function mkIcon(h) { return L.divIcon({ className: '', html: h, iconSize: [90, 24], iconAnchor: [45, 12] }); }
function drawInfra(m, c) {
    L.marker([c.srcLat, c.srcLng], { icon: mkIcon(`<div style="background:#1e3a5f;color:#93c5fd;padding:2px 6px;border-radius:4px;font-size:8px;font-weight:700;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,.3)"><i class="fa-solid fa-mountain" style="margin-right:3px"></i>${c.source}</div>`) }).addTo(m).bindPopup(`<b>${c.source}</b><br>Raw Water Source`);
    L.marker([c.lat, c.lng], { icon: mkIcon(`<div style="background:#991b1b;color:#fecaca;padding:2px 6px;border-radius:4px;font-size:8px;font-weight:700;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,.3)"><i class="fa-solid fa-industry" style="margin-right:3px"></i>WTP ${adminCity}</div>`) }).addTo(m).bindPopup(`<b>WTP ${adminCity}</b>`);
    L.polyline([[c.srcLat, c.srcLng], [(c.srcLat + c.lat) / 2 + .004, (c.srcLng + c.lng) / 2], [c.lat, c.lng]], { color: '#1e3a5f', weight: 3.5, opacity: .5 }).addTo(m);
}
function genColony(id, lat, lng, idx, m) {
    const col = COLONIES[idx % COLONIES.length]; const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) { const a = (2 * Math.PI / n) * i, d = .0006 + Math.random() * .0004; const h = lat + Math.cos(a) * d, g = lng + Math.sin(a) * d; L.circleMarker([h, g], { radius: 2.5, fillColor: col.color, color: col.color, weight: 1, fillOpacity: .35 }).addTo(m); L.polyline([[lat, lng], [h, g]], { color: col.color, weight: 1, opacity: .2, dashArray: '3,3' }).addTo(m); }
    return col;
}
function drawPipe(lat, lng, id, m, s, type) {
    if (!cityCoords) return; if (s[id]) m.removeLayer(s[id]); const c = cityCoords;
    const color = type === 'Central Hub' ? '#8b5cf6' : '#2563eb';
    const weight = type === 'Central Hub' ? 3.5 : 2;
    s[id] = L.polyline([[c.lat, c.lng], [(c.lat + lat) / 2 + (Math.random() * .003 - .0015), (c.lng + lng) / 2 + (Math.random() * .003 - .0015)], [lat, lng]], {
        color,
        weight,
        opacity: .6,
        dashArray: '10, 10',
        className: 'leaflet-ant-path'
    }).addTo(m);
}

// ---- LOCATION SEARCH (Nominatim) ----
document.getElementById('btn-search-loc').addEventListener('click', async () => {
    const q = document.getElementById('location-search').value.trim();
    if (!q) { showToast("Enter a place name."); return; }
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
        const d = await r.json();
        if (d.length) {
            const lt = parseFloat(d[0].lat), ln = parseFloat(d[0].lon);
            document.getElementById('new-meter-lat').value = lt.toFixed(6);
            document.getElementById('new-meter-lng').value = ln.toFixed(6);
            if (map) map.setView([lt, ln], 15);
            showToast(`Found: ${d[0].display_name.split(',').slice(0, 2).join(',')}`, true);
        } else showToast("Not found.");
    } catch (e) { showToast("Error: " + e.message); }
});

// ---- GPS ----
document.getElementById('btn-use-location').addEventListener('click', () => {
    if (!navigator.geolocation) { showToast("No GPS."); return; }
    navigator.geolocation.getCurrentPosition(
        p => { document.getElementById('new-meter-lat').value = p.coords.latitude.toFixed(6); document.getElementById('new-meter-lng').value = p.coords.longitude.toFixed(6); if (map) map.setView([p.coords.latitude, p.coords.longitude], 15); showToast("GPS captured!", true); },
        e => showToast("GPS error: " + e.message)
    );
});

// ---- AUTO GENERATE METER ID ----
document.getElementById('btn-gen-id').addEventListener('click', async () => {
    try {
        const snap = await getDocs(collection(db, 'meters'));
        let maxNum = 0;
        snap.forEach(d => { const match = d.id.match(/MTR-(\d+)/); if (match) maxNum = Math.max(maxNum, parseInt(match[1])); });
        const newId = `MTR-${String(maxNum + 1).padStart(3, '0')}`;
        document.getElementById('new-meter-id').value = newId;
        showToast(`Generated: ${newId}`, true);
    } catch (e) { showToast("Error: " + e.message); }
});

// ---- REGISTER NODE WITH BACKEND FOR TELEMETRY ----
function registerNodeForTelemetry(nodeId, isSim = false, colony = '', type = 'Citizen') {
    fetch('/api/register_node', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId, is_simulated: isSim, city: adminCity, colony, type })
    }).catch(() => { });
}

// ---- CREATE SIMULATION METERS NEAR A REAL METER ----
async function createSimMeters(realId, lat, lng, email, type = 'Citizen') {
    if (isNaN(lat) || isNaN(lng)) return;
    for (let i = 1; i <= 2; i++) {
        const simId = `${realId}-SIM${i}`;
        // Offset by ~200-500m in random direction
        const angle = Math.random() * 2 * Math.PI;
        const dist = 0.002 + Math.random() * 0.003; // ~200-500m
        const simLat = lat + Math.cos(angle) * dist;
        const simLng = lng + Math.sin(angle) * dist;
        try {
            const exists = await getDoc(doc(db, 'meters', simId));
            if (!exists.exists()) {
                await setDoc(doc(db, 'meters', simId), {
                    email: `sim-${email}`, is_assigned: true, is_simulated: true, type,
                    lat: simLat, lng: simLng, city: adminCity, parent_meter: realId
                });
                registerNodeForTelemetry(simId, true, '', type);
            }
        } catch (e) { console.warn('Sim meter error:', e); }
    }
}

// ---- ADD METER (real + auto-create 2 sim meters) ----
document.getElementById('btn-add-meter').addEventListener('click', async () => {
    const id = document.getElementById('new-meter-id').value.trim();
    const email = document.getElementById('new-meter-email').value.trim();
    const type = document.getElementById('new-meter-type').value;
    const lat = parseFloat(document.getElementById('new-meter-lat').value);
    const lng = parseFloat(document.getElementById('new-meter-lng').value);
    if (!id || !email) { showToast("Meter ID and Email required."); return; }
    try {
        if ((await getDoc(doc(db, 'meters', id))).exists()) { showToast("ID exists."); return; }
        const d = { email, type, is_assigned: false, city: adminCity, is_simulated: false };
        if (!isNaN(lat) && !isNaN(lng)) { d.lat = lat; d.lng = lng; }
        await setDoc(doc(db, 'meters', id), d);
        registerNodeForTelemetry(id, false, '', type);
        // Auto-create 2 nearby simulation meters
        const meterLat = !isNaN(lat) ? lat : cityCoords.lat + Math.random() * .01;
        const meterLng = !isNaN(lng) ? lng : cityCoords.lng + Math.random() * .01;
        await createSimMeters(id, meterLat, meterLng, email, type);
        showToast(`✅ ${id} (${type}) created`, true);
        ['new-meter-id', 'new-meter-email', 'new-meter-lat', 'new-meter-lng', 'location-search'].forEach(x => document.getElementById(x).value = '');
    } catch (e) { showToast("Error: " + e.message); }
});

// ---- SHOW METER MODAL ----
function showMeterModal(m, colName) {
    const isSim = !!m.is_simulated;
    document.getElementById('mm-title').innerText = m.id;
    document.getElementById('mm-id').innerText = m.id;
    document.getElementById('mm-type').innerHTML = isSim ? '<span style="color:#94a3b8">Simulated Node</span>' : '<span style="color:#2563eb">Real Meter</span>';
    document.getElementById('mm-email').innerText = isSim ? 'Simulation' : (m.email || '—');
    document.getElementById('mm-status').innerHTML = isSim ? '<span style="color:#94a3b8">🔹 Sim Active</span>' : (m.is_assigned ? '<span style="color:#2563eb">🟢 Assigned</span>' : '<span style="color:#10b981">⚪ Available</span>');
    document.getElementById('mm-colony').innerText = colName || '—';
    document.getElementById('mm-coords').innerText = (m.lat && m.lng) ? `${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}` : 'Auto-placed';
    document.getElementById('mm-city').innerText = m.city || adminCity || '—';
    const parentRow = document.getElementById('mm-parent-row');
    if (isSim && m.parent_meter) { parentRow.style.display = ''; document.getElementById('mm-parent').innerText = m.parent_meter; }
    else { parentRow.style.display = 'none'; }
    document.getElementById('meter-modal').classList.add('show');
}

// ---- ICON FACTORY ----
function meterHouseIcon(isSim, isAssigned, type = 'Citizen') {
    const cls = isSim ? 'sim' : (isAssigned ? 'real-active' : 'real-free');
    const icons = {
        'Citizen': 'fa-house-chimney',
        'Hospital': 'fa-hospital',
        'Firestation': 'fa-fire-extinguisher',
        'School': 'fa-school',
        'Central Hub': 'fa-hubspot'
    };
    const fa = icons[type] || 'fa-house-chimney';
    const hubClass = type === 'Central Hub' ? 'hub-marker' : '';

    return L.divIcon({
        className: '',
        html: `<div class="meter-icon ${cls} ${hubClass}"><i class="fa-solid ${fa}"></i></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
}

// ---- HEATMAP (placeholder, meters already shown as markers) ----
function updateHeatmap(meters) {
    // Future: render a Leaflet heatmap layer from meter positions
}

// ---- REALTIME METERS ----
function listenMeters() {
    let ci = 0;
    onSnapshot(collection(db, 'meters'), snap => {
        const tb = document.getElementById('meters-table-body'), rb = document.getElementById('recent-meters-body');
        tb.innerHTML = ''; rb.innerHTML = ''; let t = 0, a = 0, av = 0, simCount = 0; ci = 0;
        COLONIES.forEach(c => { colonyStats[c.name] = { total: 0, active: 0 }; });
        const all = []; snap.forEach(d => all.push({ id: d.id, ...d.data() }));

        // Register ALL nodes to backend for telemetry regardless of filter
        all.forEach(m => registerNodeForTelemetry(m.id, !!m.is_simulated, m.colony || '', m.type || 'Citizen', m.city || 'Amravati'));

        // Loosen filter: Show specified city, or all if no city set, or show all if city has 0 meters
        let cityMeters = all.filter(m => !m.city || m.city === adminCity);
        if (cityMeters.length === 0 && all.length > 0) {
            console.log(`No meters for ${adminCity}, showing all available meters.`);
            cityMeters = all;
        }

        updateHeatmap(cityMeters);

        cityMeters.forEach(m => {
            const id = m.id;
            const isSim = !!m.is_simulated;
            if (!isSim) { t++; if (m.is_assigned) a++; else av++; } else { simCount++; }
            const c = cityCoords, lat = m.lat || (c.lat + Math.random() * .02 - .01), lng = m.lng || (c.lng + Math.random() * .02 - .01);
            const col = COLONIES[ci % COLONIES.length];
            if (!isSim) { colonyStats[col.name].total++; if (m.is_assigned) colonyStats[col.name].active++; }

            function place(tM, mk, ln) {
                if (!tM) return;
                if (!mk[id]) {
                    mk[id] = L.marker([lat, lng], { icon: meterHouseIcon(isSim, m.is_assigned, m.type) }).addTo(tM);
                    mk[id].on('click', () => showMeterModal(m, col.name));
                    drawPipe(lat, lng, id, tM, ln, m.type);
                    if (!isSim && m.type !== 'Central Hub') genColony(id, lat, lng, ci, tM);
                } else {
                    mk[id].setIcon(meterHouseIcon(isSim, m.is_assigned, m.type));
                    mk[id].off('click').on('click', () => showMeterModal(m, col.name));
                }
            }
            place(map, nodeMarkers, pipelineLines); place(mapFull, nodeMarkersFull, pipelineLinesFull);
            const typeLabel = m.type || 'Citizen';
            const simBadge = isSim ? '<span class="badge" style="background:#f1f5f9;color:#64748b">SIM</span>' : '';
            const bg = isSim ? simBadge : (m.is_assigned ? '<span class="badge badge-active">Assigned</span>' : '<span class="badge badge-free">Available</span>');
            const lc = (m.lat && m.lng) ? `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}` : 'Auto';
            tb.innerHTML += `<tr style="${isSim ? 'opacity:.6' : ''}"><td><strong>${id}</strong></td><td>${lc}</td><td>${bg}</td><td>${isSim ? '<em>sim</em>' : m.email}</td><td style="color:${col.color};font-weight:600;font-size:.65rem">${typeLabel}</td></tr>`;
            if (ci < 5 && !isSim) rb.innerHTML += `<tr><td><strong>${id}</strong></td><td>${bg}</td><td style="color:${col.color};font-weight:600;font-size:.65rem">${typeLabel}</td></tr>`;
            ci++;
        });
        document.getElementById('total-meters').innerText = t;
        document.getElementById('active-meters').innerText = a;
        document.getElementById('available-meters').innerText = av;
        updColony();
    });
}

function updColony() {
    const p = document.getElementById('colony-stats'); if (!p) return; p.innerHTML = '';
    for (const [n, d] of Object.entries(colonyStats)) { if (!d.total) continue; const c = COLONIES.find(x => x.name === n); p.innerHTML += `<div class="colony-row"><span class="colony-dot" style="background:${c.color}"></span><span class="colony-name">${n}</span><span class="colony-count">${d.active}/${d.total}</span></div>`; }
    if (!p.innerHTML) p.innerHTML = '<p class="muted centered">No meters yet.</p>';
}

// ---- CITIZENS ----
async function loadCitizens() {
    try {
        const s = await getDocs(collection(db, 'users'));
        const tb = document.getElementById('citizens-table-body'); tb.innerHTML = '';
        s.forEach(d => { const u = d.data(); if (u.role === 'citizen') tb.innerHTML += `<tr><td>${d.id}</td><td>${u.name || '—'}</td><td>${u.meter_id || '—'}</td><td><span class="badge badge-active">Citizen</span></td></tr>`; });
        if (!tb.innerHTML) tb.innerHTML = '<tr><td colspan="4" class="muted centered">No citizens yet.</td></tr>';
    } catch (e) { console.error(e); }
}

// ---- CHARTS ----
function initCharts() {
    const co = {
        responsive: true, interaction: { mode: 'index', intersect: false },
        plugins: {
            tooltip: { backgroundColor: 'rgba(15,23,42,0.92)', titleColor: '#f8fafc', bodyColor: '#cbd5e1', padding: 12, cornerRadius: 8, titleFont: { weight: '700', size: 12 }, bodyFont: { size: 11 }, displayColors: true, boxPadding: 4 },
            legend: { labels: { usePointStyle: true, padding: 12, font: { size: 10 } } }
        },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 9 } } }, y: { grid: { color: '#e2e8f055' }, ticks: { font: { size: 9 } } } }
    };

    chartQuality = new Chart(document.getElementById('chartQuality'), {
        type: 'line', data: {
            labels: [], datasets: [
                { label: 'pH', data: [], borderColor: '#16a34a', backgroundColor: 'rgba(22,163,106,.1)', tension: .4, fill: true, pointRadius: 3, pointHoverRadius: 7, borderWidth: 2 },
                { label: 'Turbidity (NTU)', data: [], borderColor: '#db2777', backgroundColor: 'rgba(219,39,119,.1)', tension: .4, fill: true, pointRadius: 3, pointHoverRadius: 7, borderWidth: 2 },
                { label: 'Chlorine (mg/L)', data: [], borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.1)', tension: .4, fill: true, pointRadius: 3, pointHoverRadius: 7, borderWidth: 2 }
            ]
        }, options: co
    });

    chartFlow = new Chart(document.getElementById('chartFlow'), {
        type: 'line', data: {
            labels: [], datasets: [
                { label: 'Flow Rate (L/min)', data: [], borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.1)', tension: .4, fill: true, pointRadius: 3, pointHoverRadius: 7, borderWidth: 2, yAxisID: 'y' },
                { label: 'Pressure (PSI)', data: [], borderColor: '#ea580c', backgroundColor: 'rgba(234,88,12,.1)', tension: .4, fill: true, pointRadius: 3, pointHoverRadius: 7, borderWidth: 2, yAxisID: 'y1' }
            ]
        }, options: { ...co, scales: { ...co.scales, y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 9 } } } } }
    });

    chartAnomaly = new Chart(document.getElementById('chartAnomaly'), {
        type: 'doughnut', data: { labels: Object.keys(anomalyTypes), datasets: [{ data: Object.values(anomalyTypes), backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'], hoverOffset: 10 }] },
        options: { responsive: true, cutout: '55%', plugins: { tooltip: { backgroundColor: 'rgba(15,23,42,0.92)', padding: 12, cornerRadius: 8, bodyFont: { size: 11 }, titleFont: { size: 12, weight: '700' } }, legend: { position: 'bottom', labels: { usePointStyle: true, padding: 10, font: { size: 10 } } } } }
    });

    chartTheft = new Chart(document.getElementById('chartTheft'), {
        type: 'bar', data: {
            labels: [], datasets: [
                { label: 'Theft', data: [], backgroundColor: 'rgba(239,68,68,.75)', borderRadius: 4, hoverBackgroundColor: '#ef4444' },
                { label: 'Leak', data: [], backgroundColor: 'rgba(245,158,11,.75)', borderRadius: 4, hoverBackgroundColor: '#f59e0b' }
            ]
        }, options: { ...co, scales: { ...co.scales, y: { ...co.scales.y, beginAtZero: true, ticks: { stepSize: 1, font: { size: 9 } } } } }
    });
}

// ---- TELEMETRY ----
async function fetchTelemetry() { try { const r = await fetch('/api/admin/data/telemetry'); const d = await r.json(); if (d.telemetry) handleTelemetry(d.telemetry); } catch (e) { } }

function handleTelemetry(t) {
    const now = new Date(), ts = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const ph = (6.5 + Math.random() * 1.5).toFixed(1);
    const pr = t.pressure || (40 + Math.random() * 15).toFixed(1);
    const fl = t.flow_rate || (120 + Math.random() * 80).toFixed(0);
    const tu = (0.5 + Math.random() * 3.5).toFixed(1);
    const cl = (0.5 + Math.random() * 1.5).toFixed(2);
    const te = (22 + Math.random() * 8).toFixed(1);

    document.getElementById('metric-pressure').innerText = `${pr} PSI`;
    document.getElementById('metric-ph').innerText = ph;
    document.getElementById('metric-flow').innerText = `${fl} L/min`;
    document.getElementById('metric-turbidity').innerText = `${tu} NTU`;
    document.getElementById('metric-chlorine').innerText = `${cl} mg/L`;
    document.getElementById('metric-temp').innerText = `${te} °C`;

    // Charts
    timeLabels.push(ts);
    phData.push(+ph); turbData.push(+tu); chlorData.push(+cl); flowData.push(+fl); pressData.push(+pr);
    const mx = 20;
    if (timeLabels.length > mx) { timeLabels.shift(); phData.shift(); turbData.shift(); chlorData.shift(); flowData.shift(); pressData.shift(); }
    if (chartQuality) { chartQuality.data.labels = [...timeLabels]; chartQuality.data.datasets[0].data = [...phData]; chartQuality.data.datasets[1].data = [...turbData]; chartQuality.data.datasets[2].data = [...chlorData]; chartQuality.update('none'); }
    if (chartFlow) { chartFlow.data.labels = [...timeLabels]; chartFlow.data.datasets[0].data = [...flowData]; chartFlow.data.datasets[1].data = [...pressData]; chartFlow.update('none'); }

    // Anomaly detection
    if (t.prediction === 1) {
        totalAnomalies++; alertCount++;
        document.getElementById('alert-count').innerText = alertCount;
        document.getElementById('total-anomalies').innerText = totalAnomalies;

        const aType = t.anomaly_type || 'Unknown';
        const isTheft = aType.toLowerCase().includes('theft') || (+fl < 50 && +pr > 50);
        const isLeak = aType.toLowerCase().includes('leak') || (+pr < 30);

        if (isTheft) { theftCount++; document.getElementById('theft-count').innerText = theftCount; }
        if (isLeak) { leakCount++; document.getElementById('leak-count').innerText = leakCount; }
        if (aType.toLowerCase().includes('pressure')) { pressureDropCount++; document.getElementById('pressure-drop-count').innerText = pressureDropCount; }

        if (isTheft) anomalyTypes['Water Theft']++;
        else if (isLeak) anomalyTypes['Pipe Leak']++;
        else if (aType.toLowerCase().includes('pressure')) anomalyTypes['Pressure Drop']++;
        else if (aType.toLowerCase().includes('contam') || +ph < 6.5 || +tu > 3) anomalyTypes['Contamination']++;
        else anomalyTypes['Meter Tamper']++;

        if (chartAnomaly) { chartAnomaly.data.datasets[0].data = Object.values(anomalyTypes); chartAnomaly.update(); }

        theftTimeline.push(isTheft ? 1 : 0); leakTimeline.push(isLeak ? 1 : 0);
        if (theftTimeline.length > mx) { theftTimeline.shift(); leakTimeline.shift(); }
        if (chartTheft) { chartTheft.data.labels = timeLabels.slice(-theftTimeline.length); chartTheft.data.datasets[0].data = [...theftTimeline]; chartTheft.data.datasets[1].data = [...leakTimeline]; chartTheft.update('none'); }

        anomalyLog.unshift({ time: ts, node: t.node_id, type: isTheft ? '🚨 Theft' : isLeak ? '💧 Leak' : aType, sev: t.severity, detail: `Flow:${fl} | Pres:${pr} | pH:${ph}` });
        const logBody = document.getElementById('anomaly-log-body');
        logBody.innerHTML = anomalyLog.slice(0, 20).map(a => `<tr><td>${a.time}</td><td>${a.node}</td><td><strong>${a.type}</strong></td><td><span class="badge ${a.sev >= 7 ? 'badge-active' : 'badge-free'}" style="${a.sev >= 7 ? 'background:rgba(239,68,68,.1);color:#ef4444' : ''}">${a.sev}/10</span></td><td class="muted">${a.detail}</td></tr>`).join('');

        const list = document.getElementById('alerts-list');
        if (list.children[0]?.classList.contains('muted')) list.innerHTML = '';
        const item = document.createElement('div');
        item.className = 'alert-item critical';
        item.innerHTML = `<h4>${isTheft ? '<i class="fa-solid fa-user-secret"></i> THEFT: ' : isLeak ? '<i class="fa-solid fa-droplet-slash"></i> LEAK: ' : ''}${aType}</h4><p>${t.node_id} | ${fl}L/min | ${pr}PSI | pH:${ph} | Sev:${t.severity}/10</p>`;
        list.prepend(item);

        [nodeMarkers, nodeMarkersFull].forEach(m => {
            if (m[t.node_id]) {
                const el = m[t.node_id].getElement().querySelector('.meter-icon');
                if (el) {
                    el.classList.add('alerting');
                }
                m[t.node_id].openPopup();
            }
        });
        showToast(`ALERT: ${isTheft ? 'THEFT' : isLeak ? 'LEAK' : aType} at ${t.node_id}`);
    } else {
        [nodeMarkers, nodeMarkersFull].forEach(m => {
            if (m[t.node_id]) {
                const el = m[t.node_id].getElement().querySelector('.meter-icon');
                if (el) {
                    el.classList.remove('alerting');
                }
            }
        });
    }
}

function showToast(m, s = false) {
    const t = document.createElement('div'); t.className = `toast ${s ? 'success' : ''}`;
    t.innerHTML = m; document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3500);
}
