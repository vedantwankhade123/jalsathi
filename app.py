from flask import Flask, jsonify, send_from_directory, request
import pickle
import numpy as np
import datetime
import smtplib
import random
import time
import os
from dotenv import load_dotenv
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_url_path='', static_folder='static')

# ---- SMTP CONFIG (Gmail App Password) ----
# ---- SMTP CONFIG (Loaded from .env) ----
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD")

# ---- OTP STORE (in-memory, {email: {otp, timestamp}}) ----
OTP_STORE = {}
OTP_EXPIRY_SECONDS = 300  # 5 minutes

try:
    with open('rf_model.pkl', 'rb') as f:
        model = pickle.load(f)
    print("AI Model loaded successfully.")
except FileNotFoundError:
    model = None
    print("AI Model not found.")

# ---- DYNAMIC METER REGISTRY ----
LIVE_NODES = {}

# ---- SIMULATION STATE (In-memory overrides) ----
# Format: { node_id: { "leak": bool, "theft": bool, "ph": float, "is_active": bool, "fault": bool } }
SIMULATION_STATE = {}
GLOBAL_PARAMS = {
    "source_capacity": 10000, # L
    "daily_flow_limit": 5000,   # L
    "current_source_level": 8500 # L
}
BILLING_STATE = {} # node_id -> {total_liters, history}
STANDARD_RATE = 0.05 # ₹0.05 per Liter

# ---- AI ENGINE STATE ----
AI_LOG = []  # List of {timestamp, node_id, action, anomaly_type, severity, details}
AI_STATS = {
    "total_inferences": 0, "anomalies_detected": 0, "auto_shutoffs": 0,
    "theft_blocks": 0, "contamination_blocks": 0, "auto_recoveries": 0,
    "normal_predictions": 0
}
# Recovery timers: { node_id: timestamp_when_to_recover }
AI_RECOVERY_TIMERS = {}
AI_RECOVERY_DELAY = 8  # seconds before auto-recovery

# Anomaly types for richer simulation
ANOMALY_TYPES = [
    {"name": "Potential Leak Detected", "flow": (35, 5), "pres": (45, 5), "acoustic": (30, 5), "sev_range": (3, 7)},
    {"name": "Urgent Cutoff: Pipe Burst", "flow": (10, 5), "pres": (20, 5), "acoustic": (70, 10), "sev_range": (7, 11)},
    {"name": "Water Theft Suspected", "flow": (15, 4), "pres": (55, 3), "acoustic": (25, 5), "sev_range": (5, 9)},
    {"name": "Pressure Anomaly", "flow": (45, 5), "pres": (25, 5), "acoustic": (20, 5), "sev_range": (4, 8)},
    {"name": "Contamination Risk", "flow": (48, 3), "pres": (58, 3), "acoustic": (15, 3), "sev_range": (3, 6)},
    {"name": "Meter Tamper Detected", "flow": (5, 3), "pres": (10, 4), "acoustic": (50, 8), "sev_range": (6, 10)},
]

# Supported Node Types
NODE_TYPES = {
    "Citizen": {"icon": "house", "priority": 1},
    "Hospital": {"icon": "hospital", "priority": 3},
    "Firestation": {"icon": "fire-extinguisher", "priority": 3},
    "School": {"icon": "school", "priority": 2},
    "Central Hub": {"icon": "hubspot", "priority": 4}
}

@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/login')
def serve_login():
    return send_from_directory('static', 'login.html')

@app.route('/admin_dashboard')
def serve_admin():
    return send_from_directory('static', 'admin_dashboard.html')

@app.route('/citizen_dashboard')
def serve_citizen():
    return send_from_directory('static', 'citizen_dashboard.html')

@app.route('/ai_engine')
def serve_ai_engine():
    return send_from_directory('static', 'ai_engine.html')

# ---- SEND EMAIL OTP ----
@app.route('/api/send-otp', methods=['POST'])
def send_otp():
    data = request.get_json()
    email = data.get('email', '').strip()
    if not email:
        return jsonify({"error": "Email is required."}), 400

    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    OTP_STORE[email] = {"otp": otp, "timestamp": time.time()}

    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_EMAIL
        msg['To'] = email
        msg['Subject'] = 'JALSATHI - Your Verification Code'

        body = f"""
        <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; padding: 40px;">
            <div style="max-width: 480px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(135deg, #0f62fe 0%, #1e3a8a 100%); padding: 32px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 1px;">💧 JALSATHI</h1>
                    <p style="color: #93c5fd; margin: 8px 0 0; font-size: 14px;">Smart Water Management System</p>
                </div>
                <div style="padding: 36px 32px; text-align: center;">
                    <p style="color: #475569; font-size: 15px; margin: 0 0 24px;">Use the verification code below to complete your registration:</p>
                    <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 24px; margin: 0 0 24px;">
                        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f62fe;">{otp}</span>
                    </div>
                    <p style="color: #94a3b8; font-size: 13px; margin: 0;">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
                </div>
                <div style="background: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 11px; margin: 0;">© 2026 JALSATHI. Automated message — do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(body, 'html'))

        # Try SSL first (port 465), fallback to TLS (port 587)
        try:
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
                server.sendmail(SMTP_EMAIL, email, msg.as_string())
        except Exception:
            with smtplib.SMTP('smtp.gmail.com', 587) as server:
                server.starttls()
                server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
                server.sendmail(SMTP_EMAIL, email, msg.as_string())

        return jsonify({"status": "ok", "message": "OTP sent to your email."})

    except Exception as e:
        print(f"SMTP Error: {e}")
        return jsonify({"error": f"Failed to send OTP email: {str(e)}"}), 500


# ---- VERIFY OTP ----
@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email', '').strip()
    entered_otp = data.get('otp', '').strip()

    if not email or not entered_otp:
        return jsonify({"error": "Email and OTP are required."}), 400

    stored = OTP_STORE.get(email)
    if not stored:
        return jsonify({"error": "No OTP was sent to this email. Please request a new one."}), 400

    # Check expiry
    elapsed = time.time() - stored["timestamp"]
    if elapsed > OTP_EXPIRY_SECONDS:
        del OTP_STORE[email]
        return jsonify({"error": "OTP has expired. Please request a new one."}), 400

    if stored["otp"] != entered_otp:
        return jsonify({"error": "Incorrect OTP. Please try again."}), 400

    # OTP valid — remove from store
    del OTP_STORE[email]
    return jsonify({"status": "ok", "message": "Email verified successfully."})

def send_bill_email(email, node_id, liters, amount):
    """Send a formatted bill email to the user."""
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_EMAIL
        msg['To'] = email
        msg['Subject'] = f"Water Utility Bill - {datetime.datetime.now().strftime('%B %Y')}"

        body = f"""
        Dear Citizen,

        Your water utility bill for the current period has been generated.

        Meter ID: {node_id}
        Total Consumption: {liters:.2f} Liters
        Total Amount Due: ₹{amount:.2f}

        Rate: ₹{STANDARD_RATE}/Liter

        Please visit your dashboard to make the payment.

        Regards,
        Jal Jeevan Team
        """
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send bill email: {e}")
        return False

@app.route('/api/citizen/send-bill', methods=['POST'])
def handle_send_bill():
    data = request.get_json()
    email = data.get('email')
    node_id = data.get('node_id')
    
    if not email or not node_id:
        return jsonify({"error": "Email and node_id required"}), 400
        
    usage = BILLING_STATE.get(node_id, {"total_liters": 0})
    amount = usage["total_liters"] * STANDARD_RATE
    
    if send_bill_email(email, node_id, usage["total_liters"], amount):
        return jsonify({"status": "ok", "message": "Bill sent to registered email."})
    else:
        return jsonify({"error": "Failed to send email"}), 500


@app.route('/api/admin/billing/summary')
def admin_billing_summary():
    # Sum up all usage and calculate estimated revenue
    total_revenue = 0
    total_liters = 0
    node_details = []
    
    for nid, data in BILLING_STATE.items():
        amount = data["total_liters"] * STANDARD_RATE
        total_revenue += amount
        total_liters += data["total_liters"]
        node_details.append({
            "node_id": nid,
            "total_liters": data["total_liters"],
            "current_amount": amount,
            "city": LIVE_NODES.get(nid, {}).get('city', 'Unknown')
        })
        
    return jsonify({
        "total_revenue": round(total_revenue, 2),
        "total_liters": round(total_liters, 2),
        "nodes": node_details
    })

@app.route('/api/register_node', methods=['POST'])
def register_node():
    data = request.get_json()
    node_id = data.get('node_id')
    if node_id:
        LIVE_NODES[node_id] = data
    return jsonify({"status": "ok", "total_nodes": len(LIVE_NODES)})

# ---- SIMULATION API ----

@app.route('/api/simulation/state', methods=['GET'])
def get_simulation_state():
    return jsonify({
        "nodes": SIMULATION_STATE,
        "global": GLOBAL_PARAMS,
        "live_nodes": list(LIVE_NODES.keys())
    })

@app.route('/api/simulation/update', methods=['POST'])
def update_simulation():
    data = request.get_json()
    target = data.get('target') # 'node' or 'global'
    
    if target == 'node':
        node_id = data.get('node_id')
        if not node_id:
            return jsonify({"error": "node_id required"}), 400
        
        if node_id not in SIMULATION_STATE:
            SIMULATION_STATE[node_id] = {
                "leak": False, "theft": False, "fault": False, 
                "ph": 7.0, "is_active": True, "intervened": False,
                "flow_override": None, "pres_override": None,
                "acoustic_override": None, "turbidity_override": None,
                "chlorine_override": None
            }
        
        # Update specific fields
        updates = data.get('updates', {})
        for k, v in updates.items():
            if k in SIMULATION_STATE[node_id]:
                SIMULATION_STATE[node_id][k] = v
                
    elif target == 'global':
        updates = data.get('updates', {})
        for k, v in updates.items():
            if k in GLOBAL_PARAMS:
                GLOBAL_PARAMS[k] = v
                
    return jsonify({"status": "ok", "state": get_simulation_state().json})

@app.route('/api/simulation/reset-billing', methods=['POST'])
def reset_billing():
    """Reset all billing data for simulation purposes."""
    global BILLING_STATE
    BILLING_STATE = {}
    return jsonify({"status": "ok", "message": "All billing data has been reset."})

# ---- CITIZEN DATA API ----

@app.route('/api/citizen/data/<node_id>')
def get_citizen_data(node_id):
    """Retrieve real-time data for a specific citizen's meter."""
    # Check if we have simulation state for this node
    state = SIMULATION_STATE.get(node_id, {
        "is_active": True, "ph": 7.2, "leak": False, "theft": False, "fault": False
    })
    
    if not state["is_active"]:
        return jsonify({
            "status": "suspended",
            "message": "Service suspended due to unpaid bills or maintenance.",
            "flow_rate": 0,
            "pressure": 0,
            "acoustic": 0
        })

    # Generate telemetry based on state
    if state.get("flow_override") is not None:
        flow_rate = state["flow_override"]
    elif state["leak"]:
        flow_rate = np.random.normal(15, 3)
    elif state["theft"]:
        flow_rate = np.random.normal(80, 10)
    else:
        flow_rate = np.random.normal(50, 5)

    if state.get("pres_override") is not None:
        pressure = state["pres_override"]
    elif state["leak"]:
        pressure = np.random.normal(20, 5)
    elif state["theft"]:
        pressure = np.random.normal(55, 5)
    else:
        pressure = np.random.normal(60, 4)

    if state.get("acoustic_override") is not None:
        acoustic = state["acoustic_override"]
    elif state["leak"]:
        acoustic = np.random.normal(75, 10)
    elif state["theft"]:
        acoustic = np.random.normal(20, 4)
    else:
        acoustic = np.random.normal(10, 2)

    # Priority logic for critical nodes
    node_type = LIVE_NODES.get(node_id, {}).get('type', 'Citizen')
    if node_type in ["Hospital", "Firestation"]:
        flow_rate = max(flow_rate, 45.0)
        pressure = max(pressure, 40.0)

    # Increment usage tracking for citizen access too
    if node_id not in BILLING_STATE:
        BILLING_STATE[node_id] = {"total_liters": 0, "history": []}
    
    liters_inc = (float(flow_rate) / 60.0) * 3
    BILLING_STATE[node_id]["total_liters"] += liters_inc

    return jsonify({
        "status": "active",
        "node_id": node_id,
        "flow_rate": round(float(flow_rate), 2),
        "pressure": round(float(pressure), 2),
        "acoustic": round(float(acoustic), 2),
        "ph": round(float(state["ph"]), 2),
        "turbidity": round(float(state.get("turbidity_override", np.random.normal(1.2, 0.2))), 2),
        "chlorine": round(float(state.get("chlorine_override", np.random.normal(1.0, 0.1))), 2),
        "timestamp": datetime.datetime.now().strftime('%H:%M:%S')
    })

@app.route('/api/citizen/pay-bill', methods=['POST'])
def pay_bill():
    """Handle bill payment and resume service."""
    data = request.get_json()
    node_id = data.get('node_id')
    
    if not node_id:
        return jsonify({"error": "node_id required"}), 400
        
    # Reset simulation state to active
    if node_id in SIMULATION_STATE:
        SIMULATION_STATE[node_id]["is_active"] = True
    else:
        SIMULATION_STATE[node_id] = {
            "is_active": True, "ph": 7.2, "leak": False, "theft": False, "fault": False
        }
        
    # Update billing state (historical)
    if node_id in BILLING_STATE:
        usage = BILLING_STATE[node_id]
        amount = usage["total_liters"] * STANDARD_RATE
        # Move current to history
        usage["history"].insert(0, {
            "period": "Dec 2026",
            "liters": round(usage["total_liters"], 2),
            "amount": round(amount, 2),
            "status": "Paid"
        })
        usage["total_liters"] = 0
        
    return jsonify({"status": "ok", "message": "Payment successful. Service resumed."})

@app.route('/api/citizen/billing/<node_id>')
def get_citizen_billing(node_id):
    """Calculate and return simplified billing data based on current usage."""
    # Initialize billing if not exists
    if node_id not in BILLING_STATE:
        BILLING_STATE[node_id] = {
            "total_liters": 0,
            "history": [
                {"period": "Oct 2026", "liters": 1250, "amount": 62.50, "status": "Paid"},
                {"period": "Nov 2026", "liters": 1100, "amount": 55.00, "status": "Paid"}
            ]
        }
    
    usage = BILLING_STATE[node_id]
    current_amount = usage["total_liters"] * STANDARD_RATE
    
    return jsonify({
        "node_id": node_id,
        "current_period": "Dec 2026",
        "total_liters": round(usage["total_liters"], 2),
        "current_amount": round(current_amount, 2),
        "rate": STANDARD_RATE,
        "history": usage["history"]
    })

# ---- Telemetry endpoint: uses LIVE_NODES if available, else fallback ----
@app.route('/api/admin/data/telemetry')
def get_telemetry():
    # Pick from live registered nodes, or use fallback
    if LIVE_NODES:
        node_id = np.random.choice(list(LIVE_NODES.keys()))
    else:
        node_id = np.random.choice(["MTR-001", "MTR-002", "MTR-003"])

    # Priority 1: Simulation State Overrides
    state = SIMULATION_STATE.get(node_id)
    
    if state and not state["is_active"]:
        # Suspended node
        flow_rate, pressure, acoustic, severity, anomaly_type = 0, 0, 0, 0, "Suspended"
    elif state and (state["leak"] or state["theft"] or state["fault"]):
        if state["leak"]:
            anom = next(a for a in ANOMALY_TYPES if "Leak" in a["name"] or "Burst" in a["name"])
        elif state["theft"]:
            anom = next(a for a in ANOMALY_TYPES if "Theft" in a["name"])
        else:
            anom = np.random.choice(ANOMALY_TYPES)
            
        flow_rate = np.random.normal(*anom["flow"])
        pressure = np.random.normal(*anom["pres"])
        acoustic = np.random.normal(*anom["acoustic"])
        severity = np.random.randint(*anom["sev_range"])
        anomaly_type = anom["name"]
    else:
        # Default logic (No more random anomalies as requested)
        flow_rate = np.random.normal(50, 5)
        pressure = np.random.normal(60, 4)
        acoustic = np.random.normal(10, 2)
        severity = 0
        anomaly_type = "Normal"

    # Priority logic for critical nodes
    node_type = LIVE_NODES.get(node_id, {}).get('type', 'Citizen')
    if node_type in ["Hospital", "Firestation"]:
        flow_rate = max(flow_rate, 45.0)
        pressure = max(pressure, 40.0)

    prediction = 0
    confidence = 0.0
    if model is not None:
        features = np.array([[flow_rate, pressure, acoustic]])
        if severity > 0:
            prediction = 1
            confidence = min(0.99, 0.7 + severity * 0.03)
        else:
            prediction = int(model.predict(features)[0])
            try:
                proba = model.predict_proba(features)[0]
                confidence = round(float(max(proba)), 4)
            except Exception:
                confidence = 0.85 if prediction == 1 else 0.95

    AI_STATS["total_inferences"] += 1
    now_ts = datetime.datetime.now()
    ts_str = now_ts.strftime('%H:%M:%S')

    # ---- AUTO-RECOVERY: check if previously intervened nodes are now normal ----
    for rid in list(AI_RECOVERY_TIMERS.keys()):
        rstate = SIMULATION_STATE.get(rid, {})
        # If the node's anomaly flags are all cleared, check timer
        if not rstate.get("leak") and not rstate.get("theft") and not rstate.get("fault"):
            if time.time() >= AI_RECOVERY_TIMERS[rid]:
                rstate["is_active"] = True
                rstate["intervened"] = False
                AI_STATS["auto_recoveries"] += 1
                AI_LOG.insert(0, {
                    "timestamp": ts_str, "node_id": rid,
                    "action": "AUTO-RECOVERY", "anomaly_type": "System Normal",
                    "severity": 0, "details": "Pipeline restored — anomaly cleared"
                })
                del AI_RECOVERY_TIMERS[rid]
        else:
            # Anomaly still active, reset recovery timer
            AI_RECOVERY_TIMERS[rid] = time.time() + AI_RECOVERY_DELAY

    # Build telemetry dict
    telemetry = {
        'timestamp': ts_str,
        'node_id': str(node_id),
        'flow_rate': round(float(flow_rate), 2),
        'pressure': round(float(pressure), 2),
        'acoustic': round(float(acoustic), 2),
        'prediction': prediction,
        'confidence': confidence,
        'severity': int(severity) if (prediction == 1 or severity > 0) else 0,
        'anomaly_type': str(anomaly_type),
        'status': 'NORMAL',
        'ai_action': None
    }

    # ---- COMPREHENSIVE AUTONOMOUS INTERVENTION ----
    if prediction == 1 and state and state.get("is_active"):
        ai_action = None

        if "Leak" in anomaly_type or "Burst" in anomaly_type:
            # LEAK/BURST: Cut pipeline flow immediately
            state["is_active"] = False
            state["intervened"] = True
            ai_action = "PIPELINE-SHUTOFF"
            telemetry['flow_rate'] = 0
            telemetry['pressure'] = 0
            telemetry['acoustic'] = 0
            telemetry['severity'] = 10
            telemetry['status'] = 'INTERVENED'
            AI_STATS["auto_shutoffs"] += 1
            AI_RECOVERY_TIMERS[node_id] = time.time() + AI_RECOVERY_DELAY
            AI_LOG.insert(0, {
                "timestamp": ts_str, "node_id": node_id,
                "action": "PIPELINE-SHUTOFF",
                "anomaly_type": anomaly_type,
                "severity": telemetry['severity'],
                "details": f"Pipeline cut — Flow:{flow_rate:.1f} Pres:{pressure:.1f} Acoustic:{acoustic:.1f}"
            })

        elif "Theft" in anomaly_type:
            # THEFT: Block connection + flag source
            state["is_active"] = False
            state["intervened"] = True
            ai_action = "THEFT-BLOCK"
            telemetry['flow_rate'] = 0
            telemetry['pressure'] = 0
            telemetry['severity'] = max(telemetry['severity'], 8)
            telemetry['status'] = 'INTERVENED'
            AI_STATS["theft_blocks"] += 1
            AI_RECOVERY_TIMERS[node_id] = time.time() + AI_RECOVERY_DELAY
            AI_LOG.insert(0, {
                "timestamp": ts_str, "node_id": node_id,
                "action": "THEFT-BLOCK",
                "anomaly_type": anomaly_type,
                "severity": telemetry['severity'],
                "details": f"Theft isolated at {node_id} — connection blocked, flow zeroed"
            })

        elif "Contam" in anomaly_type:
            # CONTAMINATION: Block water supply
            state["is_active"] = False
            state["intervened"] = True
            ai_action = "CONTAMINATION-BLOCK"
            telemetry['flow_rate'] = 0
            telemetry['status'] = 'INTERVENED'
            AI_STATS["contamination_blocks"] += 1
            AI_RECOVERY_TIMERS[node_id] = time.time() + AI_RECOVERY_DELAY
            AI_LOG.insert(0, {
                "timestamp": ts_str, "node_id": node_id,
                "action": "CONTAMINATION-BLOCK",
                "anomaly_type": anomaly_type,
                "severity": telemetry['severity'],
                "details": f"Water quality unsafe — supply blocked at {node_id}"
            })

        elif "Tamper" in anomaly_type:
            # TAMPER: Disable meter
            state["is_active"] = False
            state["intervened"] = True
            ai_action = "METER-DISABLED"
            telemetry['flow_rate'] = 0
            telemetry['pressure'] = 0
            telemetry['acoustic'] = 0
            telemetry['status'] = 'INTERVENED'
            AI_RECOVERY_TIMERS[node_id] = time.time() + AI_RECOVERY_DELAY
            AI_LOG.insert(0, {
                "timestamp": ts_str, "node_id": node_id,
                "action": "METER-DISABLED",
                "anomaly_type": anomaly_type,
                "severity": telemetry['severity'],
                "details": f"Meter tamper detected — meter disabled at {node_id}"
            })

        elif "Pressure" in anomaly_type:
            # PRESSURE ANOMALY: Reduce flow
            ai_action = "PRESSURE-REGULATE"
            telemetry['flow_rate'] = round(float(flow_rate) * 0.3, 2)
            telemetry['status'] = 'REGULATED'
            AI_LOG.insert(0, {
                "timestamp": ts_str, "node_id": node_id,
                "action": "PRESSURE-REGULATE",
                "anomaly_type": anomaly_type,
                "severity": telemetry['severity'],
                "details": f"Pressure drop → flow reduced to {telemetry['flow_rate']}L/min"
            })

        else:
            ai_action = "ANOMALY-FLAGGED"
            AI_LOG.insert(0, {
                "timestamp": ts_str, "node_id": node_id,
                "action": "ANOMALY-FLAGGED",
                "anomaly_type": anomaly_type,
                "severity": telemetry['severity'],
                "details": f"Anomaly detected — monitoring {node_id}"
            })

        telemetry['anomaly_type'] = f"[{ai_action}] {anomaly_type}"
        telemetry['ai_action'] = ai_action
        AI_STATS["anomalies_detected"] += 1
    else:
        AI_STATS["normal_predictions"] += 1

    # Keep AI log trimmed
    if len(AI_LOG) > 100:
        AI_LOG[:] = AI_LOG[:100]

    # Increment usage tracking
    if node_id not in BILLING_STATE:
        BILLING_STATE[node_id] = {"total_liters": 0, "history": [
            {"period": "Oct 2026", "liters": 1250, "amount": 62.50, "status": "Paid"},
            {"period": "Nov 2026", "liters": 1100, "amount": 55.00, "status": "Paid"}
        ]}

    # ---- BILLING AUTO-BLOCK ----
    liters_increment = (telemetry["flow_rate"] / 60.0) * 3
    node_billing = BILLING_STATE.get(node_id, {"total_liters": 0})
    node_billing["total_liters"] += liters_increment
    
    # Auto-block if usage exceeds a "demo limit" (e.g. 500L)
    if node_billing["total_liters"] > 500 and state and state.get("is_active"):
        state["is_active"] = False
        state["intervened"] = True
        telemetry['status'] = 'INTERVENED'
        telemetry['ai_action'] = 'BILLING-BLOCK'
        telemetry['anomaly_type'] = '[BILLING-BLOCK] Monthly Limit Exceeded'
        AI_LOG.insert(0, {
            "timestamp": ts_str, "node_id": node_id,
            "action": "BILLING-BLOCK", "anomaly_type": "Usage Limit",
            "severity": 9, "details": f"Usage {node_billing['total_liters']:.1f}L exceeds 500L limit — connection blocked"
        })

    return jsonify({"telemetry": telemetry})

# ---- AI ENGINE API ----

@app.route('/api/ai/status')
def ai_status():
    """Return AI model metadata and live stats."""
    model_info = {
        "model_type": "Random Forest Classifier",
        "features": ["flow_rate", "pressure", "acoustic_signal_strength"],
        "n_estimators": 100,
        "training_samples": 5000,
        "accuracy": 0.972,
        "status": "ACTIVE" if model is not None else "OFFLINE",
        "recovery_delay_seconds": AI_RECOVERY_DELAY
    }
    # Feature importance from trained model
    importance = {}
    if model is not None:
        try:
            imp = model.feature_importances_
            importance = {
                "flow_rate": round(float(imp[0]), 4),
                "pressure": round(float(imp[1]), 4),
                "acoustic": round(float(imp[2]), 4)
            }
        except Exception:
            importance = {"flow_rate": 0.35, "pressure": 0.30, "acoustic": 0.35}
    else:
        importance = {"flow_rate": 0.35, "pressure": 0.30, "acoustic": 0.35}

    return jsonify({
        "model": model_info,
        "stats": AI_STATS,
        "feature_importance": importance,
        "global_params": GLOBAL_PARAMS,
        "active_interventions": len(AI_RECOVERY_TIMERS),
        "recovering_nodes": list(AI_RECOVERY_TIMERS.keys())
    })

@app.route('/api/ai/log')
def ai_log():
    """Return the AI action log."""
    limit = request.args.get('limit', 50, type=int)
    return jsonify({"log": AI_LOG[:limit]})

@app.route('/api/ai/predict', methods=['POST'])
def ai_predict():
    """Run a single prediction with explanation."""
    data = request.get_json()
    flow = data.get('flow_rate', 50)
    pres = data.get('pressure', 60)
    acou = data.get('acoustic', 10)

    result = {"prediction": 0, "label": "Normal", "confidence": 0.95, "action": "None"}
    if model is not None:
        features = np.array([[flow, pres, acou]])
        pred = int(model.predict(features)[0])
        try:
            proba = model.predict_proba(features)[0]
            conf = round(float(max(proba)), 4)
        except Exception:
            conf = 0.85
        result["prediction"] = pred
        result["confidence"] = conf
        result["label"] = "Anomaly" if pred == 1 else "Normal"
        if pred == 1:
            if flow < 20:
                result["action"] = "PIPELINE-SHUTOFF (Suspected Burst)"
            elif flow < 40 and acou > 25:
                result["action"] = "PIPELINE-SHUTOFF (Suspected Leak)"
            elif pres > 50 and flow < 20:
                result["action"] = "THEFT-BLOCK"
            else:
                result["action"] = "ANOMALY-FLAGGED"

    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
