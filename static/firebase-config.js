import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";

// Fetch configuration from backend with error handling
let firebaseConfig;
try {
    const response = await fetch('/api/config/firebase');
    if (!response.ok) throw new Error(`Failed to fetch config: ${response.status}`);
    firebaseConfig = await response.json();
    console.log("Firebase config loaded successfully");
} catch (error) {
    console.error("CRITICAL: Failed to load Firebase configuration:", error);
    // Fallback to empty config to prevent total script crash, though it will likely fail later
    firebaseConfig = {};
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth, collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, onSnapshot };
