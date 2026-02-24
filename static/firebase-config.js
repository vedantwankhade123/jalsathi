import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBGR95XhH9mccgl_H75fhGl2GsHQ8_Cwu0",
    authDomain: "jalsathi-90012.firebaseapp.com",
    projectId: "jalsathi-90012",
    storageBucket: "jalsathi-90012.firebasestorage.app",
    messagingSenderId: "186233077263",
    appId: "1:186233077263:web:976240c88f8b331e22ad7a",
    measurementId: "G-XC0Z8NWWXN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth, collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, onSnapshot };
