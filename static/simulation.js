import { db, doc, getDoc, setDoc, collection, onSnapshot } from './firebase-config.js';

let allNodes = [];
let selectedNodeId = null;
let simulationState = { nodes: {}, global: {} };
let map = null;
const nodeMarkers = {};
const pipelineLines = {};
const meterData = {}; // Firestore meter metadata keyed by meter ID

const layerState = {
    pipelines: true,
    infra: true,
    meters: true,
    alerts: true
};

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

let adminCity = "Amravati";
let cityCoords = CITY_DATA[adminCity];
const userEmail = localStorage.getItem('user_email');

async function initDashboard() {
    console.log("Simulation Dashboard Initializing for:", userEmail);
    try {
        console.log("Checking user session...");
        if (!userEmail) {
            console.warn("No user email in localStorage - Redirecting to login");
            window.location.href = '/login';
            return;
        }

        console.log("Loading admin context...");
        const userRef = doc(db, 'users', userEmail);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log("User data loaded:", userData.city);
            if (userData.city) {
                adminCity = userData.city;
                const cityEl = document.getElementById('current-city');
                if (cityEl) cityEl.innerText = adminCity.toUpperCase();

                if (CITY_DATA[adminCity]) {
                    cityCoords = CITY_DATA[adminCity];
                } else if (userData.city_lat && userData.city_lng) {
                    cityCoords = {
                        lat: userData.city_lat, lng: userData.city_lng,
                        source: `${adminCity} Source`,
                        srcLat: userData.city_lat + 0.05,
                        srcLng: userData.city_lng - 0.04
                    };
                }
                const sourceEl = document.getElementById('source-name');
                if (sourceEl) sourceEl.innerText = cityCoords.source;

                console.log("Initializing map...");
                initMap();

                console.log("Seeding infrastructure...");
                await seedDummyInfrastructure();

                console.log("Fetching simulation state...");
                await fetchState();
            }
            console.log("Simulation Dashboard initialization complete.");
        } else {
            console.error("Admin record not found in Firestore.");
            showToast("Admin account data missing.");
        }
    } catch (err) {
        console.error("CRITICAL Simulation Error:", err);
    }
}

async function seedDummyInfrastructure() {
    const infrastructure = [
        { id: `${adminCity.substring(0, 3).toUpperCase()}-HOSP-01`, type: 'Hospital', offsetLat: 0.005, offsetLng: 0.003 },
        { id: `${adminCity.substring(0, 3).toUpperCase()}-FIRE-01`, type: 'Firestation', offsetLat: -0.004, offsetLng: 0.005 },
        { id: `${adminCity.substring(0, 3).toUpperCase()}-SCHL-01`, type: 'School', offsetLat: 0.003, offsetLng: -0.004 }
    ];

    for (const item of infrastructure) {
        try {
            const nodeRef = doc(db, 'meters', item.id);
            const snap = await getDoc(nodeRef);
            if (!snap.exists()) {
                const lat = cityCoords.lat + (item.offsetLat || 0);
                const lng = cityCoords.lng + (item.offsetLng || 0);
                await setDoc(nodeRef, {
                    email: `admin@${adminCity.toLowerCase()}.gov`,
                    is_assigned: true,
                    is_simulated: true,
                    type: item.type,
                    lat: lat,
                    lng: lng,
                    city: adminCity
                });
                fetch('/api/register_node', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ node_id: item.id, is_simulated: true, city: adminCity, type: item.type })
                }).catch(() => { });
            }
        } catch (e) { console.error(`Error seeding ${item.type}:`, e); }
    }
}

function updateMapInfra() {
    if (!map || !cityCoords) return;
    const c = cityCoords;
    map.setView([c.lat, c.lng], 14);
    L.marker([c.srcLat, c.srcLng], {
        icon: L.divIcon({ className: '', html: `<div style="background:#1e3a5f;color:#93c5fd;padding:2px 6px;border-radius:4px;font-size:8px;font-weight:700;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,.3)"><i class="fa-solid fa-mountain" style="margin-right:3px"></i>${c.source}</div>`, iconSize: [90, 24], iconAnchor: [45, 12] })
    }).addTo(map);
    L.marker([c.lat, c.lng], {
        icon: L.divIcon({ className: '', html: `<div style="background:#991b1b;color:#fecaca;padding:2px 6px;border-radius:4px;font-size:8px;font-weight:700;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,.3)"><i class="fa-solid fa-industry" style="margin-right:3px"></i>WTP ${adminCity}</div>`, iconSize: [90, 24], iconAnchor: [45, 12] })
    }).addTo(map);
    L.polyline([[c.srcLat, c.srcLng], [(c.srcLat + c.lat) / 2 + .004, (c.srcLng + c.lng) / 2], [c.lat, c.lng]], { color: '#1e3a5f', weight: 3.5, opacity: .5 }).addTo(map);
}

async function fetchState() {
    try {
        const r = await fetch('/api/simulation/state');
        const data = await r.json();
        simulationState = data;
        allNodes = data.live_nodes;
        renderNodeList();
        if (selectedNodeId) updateControlUI();
        updateMarkers();
        updateSimulationStatus();
        updateGlobalUI();
    } catch (e) { console.error("Failed to fetch state", e); }
}

function updateGlobalUI() {
    const g = simulationState.global || {};
    if (g.source_capacity) {
        document.getElementById('storage-level').innerText = `${g.current_source_level || 0} / ${g.source_capacity} L`;
        document.getElementById('val-global-cap').innerText = g.source_capacity + 'L';
        document.getElementById('input-global-cap').value = g.source_capacity;
        document.getElementById('val-global-lvl').innerText = (g.current_source_level || 0) + 'L';
        document.getElementById('input-global-lvl').value = g.current_source_level || 0;
    }
}

async function updateGlobalSystem() {
    const cap = parseInt(document.getElementById('input-global-cap').value);
    const lvl = parseInt(document.getElementById('input-global-lvl').value);

    const response = await fetch('/api/simulation/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            target: 'global',
            updates: { source_capacity: cap, current_source_level: lvl }
        })
    });

    if (response.ok) {
        showToast("System-Wide Levels Synced!");
        fetchState();
    }
}

function renderNodeList() {
    const container = document.getElementById('nodes-container');
    const search = document.getElementById('node-search').value.toLowerCase();

    // Combine backend live_nodes with Firestore meter IDs for complete list
    const allKnownIds = new Set([...allNodes, ...Object.keys(meterData)]);
    let nodesToDisplay = Array.from(allKnownIds);

    // Apply city filter using Firestore meter metadata (not simulation state)
    let cityFilteredNodes = nodesToDisplay.filter(id => {
        const md = meterData[id];
        return md && (!md.city || md.city === adminCity);
    });

    if (cityFilteredNodes.length === 0 && nodesToDisplay.length > 0) {
        console.log(`No meters for ${adminCity}, showing all available nodes.`);
    } else {
        nodesToDisplay = cityFilteredNodes;
    }

    // Then apply search filter
    const filtered = nodesToDisplay.filter(id => id.toLowerCase().includes(search));

    if (filtered.length === 0) {
        container.innerHTML = `<p style="padding:1rem; text-align:center; color:#94a3b8">No meters found</p>`;
        return;
    }

    container.innerHTML = filtered.map(id => {
        const nodeState = simulationState.nodes[id] || {};
        const md = meterData[id] || {};
        const isAnomaly = nodeState.leak || nodeState.theft || nodeState.fault;
        const isActive = nodeState.is_active !== false;

        const mType = md.type || 'Citizen';
        const isInfra = mType === 'Hospital' || mType === 'Firestation' || mType === 'School' || id.includes('HOSP') || id.includes('FIRE') || id.includes('SCHL');
        if (isInfra && !layerState.infra) return '';
        if (!isInfra && !layerState.meters) return '';

        const icons = { 'Citizen': 'fa-house-chimney', 'Hospital': 'fa-hospital', 'Firestation': 'fa-fire-extinguisher', 'School': 'fa-school', 'Central Hub': 'fa-hubspot' };
        let typeIcon = icons[mType] || 'fa-house-chimney';
        let labelPrefix = isInfra ? 'INFRA' : 'METER';

        return `
            <div class="node-item ${selectedNodeId === id ? 'active' : ''}" onclick="selectNode('${id}')">
                <div class="node-info">
                   <h4><i class="fa-solid ${typeIcon}" style="margin-right:5px"></i> ${labelPrefix}: ${id}</h4>
                   <p>${isActive ? (isAnomaly ? 'SIMULATION INJECTED' : 'NOMINAL STATUS') : 'DISABLED'}</p>
                </div>
                <div style="width:10px; height:10px; border-radius:50%; background:${isActive ? (isAnomaly ? '#ef4444' : '#10b981') : '#64748b'}"></div>
            </div>
        `;
    }).join('');
}

function filterNodes() { renderNodeList(); }

function selectNode(id) {
    selectedNodeId = id;
    const panel = document.getElementById('control-panel');
    panel.style.display = 'block';
    panel.classList.remove('collapsed');
    renderNodeList();
    updateControlUI();
    if (nodeMarkers[id]) {
        map.setView(nodeMarkers[id].getLatLng(), 15, { animate: true });
    }
}

function updateControlUI() {
    const node = simulationState.nodes[selectedNodeId] || {
        leak: false, theft: false, fault: false, is_active: true, ph: 7.2
    };

    document.getElementById('current-node-name').innerText = selectedNodeId;
    const typeLabel = selectedNodeId.includes('HOSP') ? 'MEDICAL FACILITY' : (selectedNodeId.includes('FIRE') ? 'EMERGENCY SERVICES' : (selectedNodeId.includes('SCHL') ? 'EDUCATIONAL CAMPUS' : 'CITIZEN METER'));
    document.getElementById('current-node-type').innerText = typeLabel;

    const isIntervened = node.intervened === true;
    const statusLabel = isIntervened ? 'AUTO-SHUTOFF' : (node.is_active ? 'ACTIVE' : 'SUSPENDED');
    const statusBg = isIntervened ? '#475569' : (node.is_active ? '#10b981' : '#ef4444');

    document.getElementById('current-node-status').innerText = statusLabel;
    document.getElementById('current-node-status').style.background = statusBg;

    // Update buttons
    document.getElementById('btn-leak').className = `toggle-btn ${node.leak ? 'active' : ''}`;
    document.getElementById('btn-theft').className = `toggle-btn ${node.theft ? 'active' : ''}`;
    document.getElementById('btn-fault').className = `toggle-btn ${node.fault ? 'active' : ''}`;
    document.getElementById('btn-active').className = `toggle-btn success-mode ${node.is_active ? 'active' : ''}`;

    // Update Overrides
    const overrides = ['flow', 'pres', 'acoustic', 'ph', 'turbidity', 'chlorine'];
    overrides.forEach(p => {
        const val = node[p + (p === 'ph' ? '' : '_override')];
        const display = document.getElementById(`val-${p}`);
        const input = document.getElementById(`input-${p}`);
        if (val !== undefined && val !== null) {
            display.innerText = val;
            input.value = val;
        } else {
            display.innerText = "DEF";
            input.value = input.getAttribute('value');
        }
    });
}

function updateOverrideLabel(param, val) {
    document.getElementById(`val-${param}`).innerText = val;
}

async function applyBatchOverrides() {
    if (!selectedNodeId) return;
    const updates = {
        flow_override: parseFloat(document.getElementById('input-flow').value),
        pres_override: parseFloat(document.getElementById('input-pres').value),
        acoustic_override: parseFloat(document.getElementById('input-acoustic').value),
        ph: parseFloat(document.getElementById('input-ph').value),
        turbidity_override: parseFloat(document.getElementById('input-turbidity').value),
        chlorine_override: parseFloat(document.getElementById('input-chlorine').value)
    };

    const response = await fetch('/api/simulation/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'node', node_id: selectedNodeId, updates })
    });

    if (response.ok) {
        showToast("Simulation Parameters Injected successfully!");
        fetchState();
    }
}

async function resetOverrides() {
    if (!selectedNodeId) return;
    const updates = {
        flow_override: null, pres_override: null, acoustic_override: null,
        ph: 7.2, turbidity_override: null, chlorine_override: null
    };
    await fetch('/api/simulation/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'node', node_id: selectedNodeId, updates })
    });
    showToast("Engine defaults restored for " + selectedNodeId);
    fetchState();
}

async function toggleNodeParam(param) {
    if (!selectedNodeId) return;
    const currentState = simulationState.nodes[selectedNodeId] || { is_active: true };
    const newValue = !currentState[param];
    const response = await fetch('/api/simulation/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'node', node_id: selectedNodeId, updates: { [param]: newValue } })
    });
    if (response.ok) {
        showToast(`Dynamic Layer Mod: ${param.toUpperCase()} is now ${newValue ? 'ACTIVE' : 'INACTIVE'}`);
        fetchState();
    }
}

function initMap() {
    const c = cityCoords;
    map = L.map('simMap', { zoomControl: false }).setView([c.lat, c.lng], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM' }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    updateMapInfra();
    listenMeters();
}

function listenMeters() {
    onSnapshot(collection(db, 'meters'), snap => {
        snap.forEach(d => {
            const m = d.data();
            // Store meter metadata for city-filtering in renderNodeList
            meterData[d.id] = { ...m, id: d.id };

            // Only show meters for this admin's city
            if (m.city && m.city !== adminCity) return;

            // Default lat/lng to city center with small random offset if missing
            const lat = m.lat || (cityCoords.lat + (Math.random() * 0.02 - 0.01));
            const lng = m.lng || (cityCoords.lng + (Math.random() * 0.02 - 0.01));

            updateMarker(d.id, lat, lng, m);
            drawPipe(lat, lng, d.id, m.type);

            // Register with backend so it appears in allNodes / simulation state
            fetch('/api/register_node', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: d.id, is_simulated: !!m.is_simulated, city: m.city || adminCity, type: m.type || 'Citizen' })
            }).catch(() => { });
        });
        // Re-render node list with updated meter data
        renderNodeList();
    });
}

function drawPipe(lat, lng, id, type) {
    if (!cityCoords) return;
    if (pipelineLines[id]) map.removeLayer(pipelineLines[id]);
    if (!layerState.pipelines) return;

    const c = cityCoords;
    const color = type === 'Central Hub' ? '#8b5cf6' : '#3b82f6';

    const nodeState = simulationState.nodes[id] || { is_active: true, intervened: false };
    const isActive = nodeState.is_active !== false;
    const isIntervened = nodeState.intervened === true;

    // Using Leaflet.AntPath style dash animation if possible, or just standard dash
    pipelineLines[id] = L.polyline([[c.lat, c.lng], [(c.lat + lat) / 2, (c.lng + lng) / 2], [lat, lng]], {
        color: !isActive || isIntervened ? '#94a3b8' : color,
        weight: 2,
        opacity: 0.6,
        dashArray: !isActive || isIntervened ? '4, 4' : '10, 10',
        lineCap: 'round',
        className: !isActive || isIntervened ? 'pipe-stopped' : 'leaflet-ant-path'
    }).addTo(map);
}

function updateMarker(id, lat, lng, data) {
    const nodeState = simulationState.nodes[id] || {};
    const isAnomaly = nodeState.leak || nodeState.theft || nodeState.fault;
    const isActive = nodeState.is_active !== false;
    const isSelected = selectedNodeId === id;

    const isInfra = id.includes('HOSP') || id.includes('FIRE') || id.includes('SCHL');
    let visible = true;
    if (isInfra && !layerState.infra) visible = false;
    if (!isInfra && !layerState.meters) visible = false;
    if (!layerState.alerts && isAnomaly) visible = false;

    if (!visible) {
        if (nodeMarkers[id]) {
            map.removeLayer(nodeMarkers[id]);
            delete nodeMarkers[id];
        }
        return;
    }

    const icons = { 'Citizen': 'fa-house-chimney', 'Hospital': 'fa-hospital', 'Firestation': 'fa-fire-extinguisher', 'School': 'fa-school', 'Central Hub': 'fa-hubspot' };
    let icon = icons[data.type] || 'fa-droplet';

    if (id.includes('HOSP')) icon = 'fa-hospital';
    else if (id.includes('FIRE')) icon = 'fa-fire-extinguisher';
    else if (id.includes('SCHL')) icon = 'fa-school';
    else if (id.startsWith('MTR-') && icon === 'fa-droplet') icon = 'fa-house-chimney';

    const isIntervened = nodeState.intervened === true;
    const statusColor = isIntervened ? '#475569' : (!isActive ? '#64748b' : (isAnomaly ? '#ef4444' : '#2563eb'));
    const iconHTML = `<div class="meter-icon ${isSelected ? 'active-node' : ''} ${isAnomaly ? 'alert-node' : ''} ${isIntervened ? 'auto-shutoff' : ''}" style="background:${statusColor}; color: white !important;"><i class="fa-solid ${icon}"></i></div>`;

    if (nodeMarkers[id]) {
        nodeMarkers[id].setLatLng([lat, lng]).setIcon(L.divIcon({ className: '', html: iconHTML, iconSize: [32, 32], iconAnchor: [16, 16] }));
    } else {
        nodeMarkers[id] = L.marker([lat, lng], {
            icon: L.divIcon({ className: '', html: iconHTML, iconSize: [32, 32], iconAnchor: [16, 16] })
        }).addTo(map).on('click', () => selectNode(id));
    }
}

function updateSimulationStatus() {
    const container = document.getElementById('active-injections-container');
    const anomalies = [];

    Object.keys(simulationState.nodes).forEach(id => {
        const node = simulationState.nodes[id];
        if (node.leak) anomalies.push({ id, type: 'LEAK' });
        if (node.theft) anomalies.push({ id, type: 'THEFT' });
        if (node.fault) anomalies.push({ id, type: 'FAULT' });
        if (node.is_active === false) {
            anomalies.push({ id, type: node.intervened ? 'AI-STOP' : 'SUSP' });
        }
        if (node.flow_override !== null || node.pres_override !== null) anomalies.push({ id, type: 'OVR' });
    });

    if (anomalies.length === 0) {
        container.innerHTML = `<span style="font-size:0.7rem; color:var(--text-dim); opacity:0.6">No active anomalies detected</span>`;
    } else {
        const unique = Array.from(new Set(anomalies.map(a => `${a.id}:${a.type}`))).slice(0, 5);
        container.innerHTML = unique.map(key => {
            const [id, type] = key.split(':');
            const color = (type === 'OVR') ? '#0f62fe' : '#ef4444';
            return `<div class="injection-badge" style="color:${color}; border-color:${color}80; background:${color}10">
                <i class="fa-solid fa-circle-exclamation"></i> ${id}: ${type}
            </div>`;
        }).join('');
    }
    document.getElementById('sim-time').innerText = new Date().toLocaleTimeString();
}

function toggleLayer(layer, checked) {
    layerState[layer] = checked;
    renderNodeList();
    fetchState();
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

async function forceSuspension(shouldSuspend) {
    if (!selectedNodeId) return;
    await fetch('/api/simulation/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'node', node_id: selectedNodeId, updates: { is_active: !shouldSuspend } })
    });
    showToast(shouldSuspend ? "Connection Cut" : "Connection Restored");
    fetchState();
}

async function resetBilling() {
    if (!selectedNodeId || !confirm("Reset billing history for " + selectedNodeId + "?")) return;
    await fetch('/api/simulation/reset-billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ node_id: selectedNodeId }) });
    showToast("Billing Reset for " + selectedNodeId);
}

setInterval(fetchState, 4000);
// Initialize immediately
initDashboard();

window.selectNode = selectNode;
window.toggleNodeParam = toggleNodeParam;
window.filterNodes = filterNodes;
window.updateOverrideLabel = updateOverrideLabel;
window.applyBatchOverrides = applyBatchOverrides;
window.resetOverrides = resetOverrides;
window.forceSuspension = forceSuspension;
window.resetBilling = resetBilling;
window.toggleLayer = toggleLayer;
window.updateGlobalSystem = updateGlobalSystem;
