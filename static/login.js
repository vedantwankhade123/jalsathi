import { db, doc, getDoc, setDoc, updateDoc } from './firebase-config.js';

// ---- STATE → CITY DATA ----
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

// ---- POPULATE STATE DROPDOWNS ----
function populateStates(selectId) {
    const sel = document.getElementById(selectId);
    sel.innerHTML = '<option value="">Select State</option>';
    Object.keys(STATE_CITIES).sort().forEach(state => {
        sel.innerHTML += `<option value="${state}">${state}</option>`;
    });
}

function populateCities(stateSelectId, citySelectId) {
    const state = document.getElementById(stateSelectId).value;
    const citySel = document.getElementById(citySelectId);
    if (!state) { citySel.innerHTML = '<option value="">Select state first</option>'; return; }
    const cities = STATE_CITIES[state] || [];
    citySel.innerHTML = '<option value="">Select City</option>';
    cities.forEach(c => { citySel.innerHTML += `<option value="${c}">${c}</option>`; });
}

// Init state dropdowns
populateStates('reg-admin-state');
populateStates('reg-cit-state');

// Set defaults to Maharashtra/Amravati
document.getElementById('reg-admin-state').value = "Maharashtra";
populateCities('reg-admin-state', 'reg-admin-city');
document.getElementById('reg-admin-city').value = "Amravati";

document.getElementById('reg-cit-state').value = "Maharashtra";
populateCities('reg-cit-state', 'reg-cit-city');
document.getElementById('reg-cit-city').value = "Amravati";

// Cascading: state change → populate cities
document.getElementById('reg-admin-state').addEventListener('change', () => populateCities('reg-admin-state', 'reg-admin-city'));
document.getElementById('reg-cit-state').addEventListener('change', () => populateCities('reg-cit-state', 'reg-cit-city'));

// ---- VIEW SWITCHING & MULTI-STEP ----
window.showView = function (view) {
    document.getElementById('view-signin').style.display = view === 'signin' ? 'block' : 'none';
    document.getElementById('view-register').style.display = view === 'register' ? 'block' : 'none';
};

window.nextStep = function (prefix, stepNum) {
    document.getElementById(`${prefix}-step-${stepNum - 1}`).style.display = 'none';
    document.getElementById(`${prefix}-step-${stepNum}`).style.display = 'block';
};

window.prevStep = function (prefix, stepNum) {
    document.getElementById(`${prefix}-step-${stepNum + 1}`).style.display = 'none';
    document.getElementById(`${prefix}-step-${stepNum}`).style.display = 'block';
};

window.switchRole = function (role) {
    document.getElementById('form-citizen').style.display = role === 'citizen' ? 'block' : 'none';
    document.getElementById('form-admin').style.display = role === 'admin' ? 'block' : 'none';
    document.getElementById('toggle-citizen').classList.toggle('active', role === 'citizen');
    document.getElementById('toggle-admin').classList.toggle('active', role === 'admin');
};

window.togglePassword = function (fieldId, btn) {
    const f = document.getElementById(fieldId);
    const isPass = f.type === 'password';
    f.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
};

function setLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// ---- SIGN IN ----
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    if (!email || !password) { errorEl.innerText = "Fill all fields."; return; }

    const btn = document.getElementById('btn-login');
    setLoading(btn, true);

    try {
        console.log("Attempting sign-in for:", email);
        if (!db) {
            throw new Error("Firestore is not initialized. Please check backend config.");
        }
        const snap = await getDoc(doc(db, 'users', email));
        if (!snap.exists()) {
            errorEl.innerText = "Account not found.";
            setLoading(btn, false);
            return;
        }
        const user = snap.data();
        if (user.password !== password) {
            errorEl.innerText = "Wrong password.";
            setLoading(btn, false);
            return;
        }
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_role', user.role);
        window.location.href = user.role === 'admin' ? '/admin_dashboard' : '/citizen_dashboard';
    } catch (err) {
        errorEl.innerText = "Error: " + err.message;
        setLoading(btn, false);
    }
});

// ---- CITIZEN: Send Email OTP ----
document.getElementById('btn-send-otp').addEventListener('click', async () => {
    const meter_id = document.getElementById('reg-meter-id').value.trim();
    const email = document.getElementById('reg-cit-email').value.trim();
    const errorEl = document.getElementById('reg-cit-error');
    const state = document.getElementById('reg-cit-state').value;
    const city = document.getElementById('reg-cit-city').value;
    const btn = document.getElementById('btn-send-otp');

    if (!meter_id || !email) { errorEl.innerText = "Fill all required fields in Step 1."; return; }
    if (!state || !city) { errorEl.innerText = "Please select your State and City."; return; }

    try {
        // 1. Validate meter exists in Firestore
        const meterSnap = await getDoc(doc(db, 'meters', meter_id));
        if (!meterSnap.exists()) { errorEl.innerText = "Meter ID not found."; return; }
        if (meterSnap.data().email !== email) { errorEl.innerText = "Email does not match meter."; return; }
        if (meterSnap.data().is_assigned) { errorEl.innerText = "Meter already assigned."; return; }

        // 2. Send OTP via backend
        setLoading(btn, true);
        errorEl.innerText = "";

        const res = await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.innerText = data.error || "Failed to send OTP.";
            setLoading(btn, false);
            return;
        }

        // 3. Move to OTP step
        setLoading(btn, false);
        errorEl.innerText = "";
        document.getElementById('cit-step-2').style.display = 'none';
        document.getElementById('cit-step-3').style.display = 'block';

    } catch (err) {
        errorEl.innerText = "Error: " + err.message;
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Email OTP';
    }
});

// ---- CITIZEN: Verify Email OTP ----
document.getElementById('btn-verify-otp').addEventListener('click', async () => {
    const meter_id = document.getElementById('reg-meter-id').value.trim();
    const email = document.getElementById('reg-cit-email').value.trim();
    const name = document.getElementById('reg-cit-name').value.trim();
    const password = document.getElementById('reg-cit-password').value;
    const state = document.getElementById('reg-cit-state').value;
    const city = document.getElementById('reg-cit-city').value;
    const enteredOtp = document.getElementById('reg-cit-otp').value.trim();
    const errorEl = document.getElementById('otp-error');
    const btn = document.getElementById('btn-verify-otp');

    if (!enteredOtp || enteredOtp.length !== 6) { errorEl.innerText = "Enter the 6-digit OTP."; return; }

    try {
        setLoading(btn, true);

        // 1. Verify OTP with backend
        const res = await fetch('/api/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp: enteredOtp })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.innerText = data.error || "Invalid OTP.";
            setLoading(btn, false);
            return;
        }

        // 2. OTP verified — capture citizen's live location
        let citizenLat = null, citizenLng = null;
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            citizenLat = pos.coords.latitude;
            citizenLng = pos.coords.longitude;
        } catch (e) { console.warn("Location not available."); }

        // 3. Save citizen user to Firestore (include GPS if captured)
        const userDoc = { name, password, role: 'citizen', meter_id, state, city, country: 'India' };
        if (citizenLat && citizenLng) { userDoc.lat = citizenLat; userDoc.lng = citizenLng; }
        await setDoc(doc(db, 'users', email), userDoc);

        // 4. Mark meter as assigned
        const meterUpdate = { is_assigned: true, email };
        if (citizenLat && citizenLng) { meterUpdate.lat = citizenLat; meterUpdate.lng = citizenLng; }
        await updateDoc(doc(db, 'meters', meter_id), meterUpdate);

        // 5. Redirect to citizen dashboard
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_role', 'citizen');
        window.location.href = '/citizen_dashboard';

    } catch (err) {
        errorEl.innerText = "Error: " + err.message;
        setLoading(btn, false);
    }
});

// ---- ADMIN REGISTRATION ----
document.getElementById('btn-register-admin').addEventListener('click', async () => {
    const email = document.getElementById('reg-admin-email').value;
    const name = document.getElementById('reg-admin-name').value;
    const password = document.getElementById('reg-admin-password').value;
    const secret_key = document.getElementById('reg-admin-secret').value;
    const state = document.getElementById('reg-admin-state').value;
    const city = document.getElementById('reg-admin-city').value;
    const errorEl = document.getElementById('reg-admin-error');

    if (!email || !name || !password || !secret_key) { errorEl.innerText = "Fill all fields."; return; }
    if (!state || !city) { errorEl.innerText = "Please select your State and City."; return; }

    try {
        const btn = document.getElementById('btn-register-admin');
        setLoading(btn, true);

        const secretSnap = await getDoc(doc(db, 'admin_secrets', secret_key));
        if (!secretSnap.exists() || secretSnap.data().is_used) {
            errorEl.innerText = "Invalid or already used Secret Key.";
            setLoading(btn, false);
            return;
        }
        await updateDoc(doc(db, 'admin_secrets', secret_key), { is_used: true });
        await setDoc(doc(db, 'users', email), {
            name, password, role: 'admin',
            state, city, country: 'India'
        });
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_role', 'admin');
        window.location.href = '/admin_dashboard';
    } catch (err) {
        errorEl.innerText = "Error: " + err.message;
        setLoading(btn, false);
    }
});
