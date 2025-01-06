import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyAYamWLcvY38hbFvTFC02CcJ-OK16INP9g",
  authDomain: "connected-854c0.firebaseapp.com",
  projectId: "connected-854c0",
  storageBucket: "connected-854c0.firebasestorage.app",
  messagingSenderId: "737700205338",
  appId: "1:737700205338:web:45b3fb7042edcbcd6092a3",
  measurementId: "G-BVS42X4N0H",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);
