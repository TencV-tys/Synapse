// src/services/authService.js
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '../config/firebase';
import sqliteService from './sqliteService';

export const authService = {
  async register(userData) {
    try {
      const { email, password, name, userType } = userData;
      
      console.log('👤 Registering user:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: name
      });

      const userDoc = {
        uid: user.uid,
        email: user.email,
        name: name,
        userType: userType || 'student',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };

      await setDoc(doc(firestore, 'users', user.uid), userDoc);
      
      // Save to SQLite
      await sqliteService.saveUser(userDoc);
      
      console.log('✅ User registered and saved to SQLite:', user.uid);
      return userDoc;
    } catch (error) {
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  },

  async login(email, password) {
    try {
      console.log('🔐 Logging in user:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = doc(firestore, 'users', user.uid);
      await setDoc(userRef, {
        lastLogin: new Date().toISOString()
      }, { merge: true });

      const userDoc = await getDoc(userRef);
      const userData = userDoc.exists() ? userDoc.data() : null;

      // Save to SQLite
      if (userData) {
        await sqliteService.saveUser(userData);
      }

      console.log('✅ User logged in and saved to SQLite:', user.uid);
      return userData;
    } catch (error) {
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  },

  async getCurrentUser(uid) {
    try {
      // Try Firebase first
      const userDoc = await getDoc(doc(firestore, 'users', uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Save to SQLite
        await sqliteService.saveUser(userData);
        return userData;
      } else {
        // Fallback to SQLite
        console.log('🔍 User not in Firebase, checking SQLite...');
        return await sqliteService.getUser(uid);
      }
    } catch (error) {
      console.error('❌ Error fetching from Firebase, trying SQLite:', error);
      // Fallback to SQLite
      return await sqliteService.getUser(uid);
    }
  },

  async logout() {
    try {
      await signOut(auth);
      console.log('✅ User logged out');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      throw error;
    }
  },

  getAuthErrorMessage(errorCode) {
    const errorMessages = {
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/operation-not-allowed': 'Email/password accounts are not enabled.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.'
    };

    return errorMessages[errorCode] || 'An unexpected error occurred.';
  }
}; 