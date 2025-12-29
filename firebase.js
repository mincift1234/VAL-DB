import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  addDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// ✅ 네 Firebase 콘솔 값으로 교체
const firebaseConfig = {
  apiKey: "AIzaSyBkjyFytmhOhvnQa9FRItswHkCOuhaAPk0",
  authDomain: "val-gear-db.firebaseapp.com",
  projectId: "val-gear-db",
  storageBucket: "val-gear-db.firebasestorage.app",
  messagingSenderId: "155233667982",
  appId: "1:155233667982:web:ad4d63a01119a60a7172df",
  measurementId: "G-9VSBDNSS1M"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const fs = {
  // firestore
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  addDoc, updateDoc, deleteDoc, serverTimestamp,
  // auth
  signInWithPopup, signOut, onAuthStateChanged
};
