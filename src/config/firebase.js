// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Fixed import

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBEkliFEPXhSDdWl0rAEzKUiRQKx3FAa5I",
  authDomain: "synapse-app-6ac6c.firebaseapp.com",
  databaseURL: "https://synapse-app-6ac6c-default-rtdb.firebaseio.com",
  projectId: "synapse-app-6ac6c",
  storageBucket: "synapse-app-6ac6c.firebasestorage.app",
  messagingSenderId: "948931826581",
  appId: "1:948931826581:web:494211501adfb4760f1c9c",
  measurementId: "G-EZKLWJDKY9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with AsyncStorage - Check if already initialized
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage) // Use AsyncStorage directly
  });
  console.log('✅ Firebase Auth initialized with AsyncStorage');
} catch (error) {
  // If already initialized, use getAuth
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
    console.log('✅ Firebase Auth already initialized, using getAuth');
  } else {
    throw error;
  }
}

// Initialize Firebase services
export const firestore = getFirestore(app);
export const database = getDatabase(app);
export { auth };

export default app;