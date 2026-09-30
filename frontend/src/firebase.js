// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyD7iZq28ACFtST2Y4dloRRNHfiAKQJQV0g",
  authDomain: "mvdv-41350.firebaseapp.com",
  projectId: "mvdv-41350",
  storageBucket: "mvdv-41350.firebasestorage.app",
  messagingSenderId: "647954951699",
  appId: "1:647954951699:web:bcb26f62e90ba8e123d9e6",
  measurementId: "G-P9YESD820V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) analytics = getAnalytics(app);
  }).catch(() => {});
}

export { app, db, auth, analytics };
