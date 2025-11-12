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
    
    // Get or create user data in Firestore
    let userData;
    try {
      const userDoc = await getDoc(doc(firestore, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        userData = userDoc.data();
        console.log('✅ User data loaded from Firestore');
      } else {
        // Create user data if it doesn't exist
        userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || email.split('@')[0],
          userType: 'student',
          password: password, // Store for offline access
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        await setDoc(doc(firestore, 'users', firebaseUser.uid), userData);
        console.log('✅ User data created in Firestore');
      }
    } catch (firestoreError) {
      console.log('⚠️ Firestore error, using basic data:', firestoreError.message);
      userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || email.split('@')[0],
        userType: 'student',
        password: password,
        lastLogin: new Date().toISOString(),
        createdAt: firebaseUser.metadata.creationTime
      };
    }
    
    // ALWAYS save to SQLite for offline access (whether Firestore worked or not)
    await sqliteService.saveUser(userData);
    console.log('✅ User data saved to SQLite for offline access');
    
    return userData;
  } catch (error) {
    console.error('❌ Online login error:', error.message);
    throw new Error(this.getAuthErrorMessage(error.code));
  }
},
async offlineLogin(email, password) {
  try {
    console.log('📴 Offline login for:', email);
    
    // Get user from SQLite
    const users = await sqliteService.getAllUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
      throw new Error('No account found with this email.');
    }
    
    // Check password
    if (user.password !== password) {
      throw new Error('Incorrect password.');
    }
    
    console.log('✅ Offline login successful for:', user.email);
    
    // Update last login
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
        password: password, // Store password
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

  // Offline registration (SQLite only) - WITH PASSWORD
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
      
      // Create user in SQLite WITH PASSWORD
      const newUser = {
        uid: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email,
        name: name,
        userType: userType || 'student',
        password: password, // Store the password
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