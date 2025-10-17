// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBEkliFEPXhSDdWl0rAEzKUiRQKx3FAa5I",
  authDomain: "synapse-app-6ac6c.firebaseapp.com",
  projectId: "synapse-app-6ac6c",
  storageBucket: "synapse-app-6ac6c.firebasestorage.app",
  messagingSenderId: "948931826581",
  appId: "1:948931826581:web:494211501adfb4760f1c9c",
  measurementId: "G-EZKLWJDKY9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);



// Initialize Firebase services
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const database = getDatabase(app);

export default app;