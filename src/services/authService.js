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
  // Online login
  async login(email, password) {
    try {
      console.log('🔐 Online login for:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      console.log('✅ Firebase login successful:', firebaseUser.uid);
      
      // Update last login time in Firestore
      try {
        await setDoc(doc(firestore, 'users', firebaseUser.uid), {
          lastLogin: new Date().toISOString()
        }, { merge: true });
      } catch (firestoreError) {
        console.log('⚠️ Could not update last login in Firestore:', firestoreError.message);
      }
      
      // Save user to SQLite for offline access
      const userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || email.split('@')[0],
        userType: 'student',
        lastLogin: new Date().toISOString(),
        createdAt: firebaseUser.metadata.creationTime
      };
      await sqliteService.saveUser(userData);
      
      return firebaseUser;
    } catch (error) {
      console.error('❌ Online login error:', error.message);
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  },

  // Offline login (SQLite only)
  async offlineLogin(email, password) {
    try {
      console.log('📴 Offline login for:', email);
      
      // Get all users from SQLite
      const users = await sqliteService.getAllUsers();
      const user = users.find(u => u.email === email);
      
      if (!user) {
        throw new Error('No account found with this email.');
      }
      
      // In a real app, you'd verify the password hash
      // For demo, we'll just check if the user exists
      console.log('✅ Offline login successful for:', user.email);
      
      // Update last login in SQLite
      const updatedUser = {
        ...user,
        lastLogin: new Date().toISOString()
      };
      await sqliteService.saveUser(updatedUser);
      
      return updatedUser;
    } catch (error) {
      console.error('❌ Offline login error:', error.message);
      throw new Error(error.message || 'Offline login failed');
    }
  },

  // Online registration
  async register(userData) {
    try {
      const { email, password, name, userType } = userData;
      
      console.log('👤 Online registration for:', email);
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
      
      console.log('✅ Online registration successful:', user.uid);
      return userDoc;
    } catch (error) {
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  },

  // Offline registration (SQLite only)
  async offlineRegister(userData) {
    try {
      const { email, password, name, userType } = userData;
      
      console.log('📴 Offline registration for:', email);
      
      // Check if user already exists
      const users = await sqliteService.getAllUsers();
      const existingUser = users.find(u => u.email === email);
      
      if (existingUser) {
        throw new Error('This email is already registered.');
      }
      
      // Create user in SQLite
      const newUser = {
        uid: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email,
        name: name,
        userType: userType || 'student',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        isOffline: true
      };
      
      await sqliteService.saveUser(newUser);
      console.log('✅ Offline registration successful');
      
      return newUser;
    } catch (error) {
      console.error('❌ Offline registration error:', error.message);
      throw new Error(error.message || 'Offline registration failed');
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