// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAkkP608ckM-GoueQli64HNdwSZdxA35WQ",
  authDomain: "nsynctenantapp.firebaseapp.com",
  projectId: "nsynctenantapp",
  storageBucket: "nsynctenantapp.firebasestorage.app",
  messagingSenderId: "911719628000",
  appId: "1:911719628000:web:bc7d9e45aa0192e8a9a485",
  measurementId: "G-T2QKVBRKNJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };