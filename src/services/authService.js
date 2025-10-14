// src/services/authService.js
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '../config/firebase';

export const authService = {
  // Register new user
  async register(userData) {
    try {
      const { email, password, name, userType } = userData;
      
      // Create authentication account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update profile with display name
      await updateProfile(user, {
        displayName: name
      });

      // Create user document in Firestore
      const userDoc = {
        uid: user.uid,
        email: user.email,
        name: name,
        userType: userType || 'student',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };

      await setDoc(doc(firestore, 'users', user.uid), userDoc);

      return userDoc;
    } catch (error) {
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  },

  // Login user
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update last login
      const userRef = doc(firestore, 'users', user.uid);
      await setDoc(userRef, {
        lastLogin: new Date().toISOString()
      }, { merge: true });

      // Get user data
      const userDoc = await getDoc(userRef);
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  },

  // Logout user
  async logout() {
    try {
      await signOut(auth);
    } catch (error) {
      throw new Error('Logout failed. Please try again.');
    }
  },

  // Get current user data
  async getCurrentUser(uid) {
    try {
      const userDoc = await getDoc(doc(firestore, 'users', uid));
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      throw new Error('Failed to fetch user data.');
    }
  },

  // Error message helper
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