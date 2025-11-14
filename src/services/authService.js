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
// In authService.js - COMPLETELY REPLACE the login function with this:
async login(email, password) {
  try {
    console.log('🔐 Online login for:', email);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    console.log('✅ Firebase login successful:', firebaseUser.uid);
    
    // Create user data WITH PASSWORD - don't rely on Firestore
    const userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.displayName || email.split('@')[0],
      userType: 'student',
      password: password, // ✅ ALWAYS include the password
      lastLogin: new Date().toISOString(),
      createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
    };
    
    console.log('🔑 User data with password:', userData.password ? 'SET' : 'MISSING');
    
    // Try to update Firestore, but don't let it fail the login
    try {
      await setDoc(doc(firestore, 'users', firebaseUser.uid), userData, { merge: true });
      console.log('✅ User data saved to Firestore');
    } catch (firestoreError) {
      console.log('⚠️ Firestore save failed, but continuing:', firestoreError.message);
    }
    
    // ✅ CRITICAL: ALWAYS save to SQLite with password
    await sqliteService.saveUser(userData);
    console.log('✅ User data saved to SQLite for offline access');
    
    return userData;
  } catch (error) {
    console.error('❌ Online login error:', error.message);
    throw new Error(this.getAuthErrorMessage(error.code));
  }
}, 
// Add to src/services/authService.js
async updateUserProfile(userData) {
  try {
    console.log('📝 Updating user profile:', userData.email);
    
    // Update in Firestore
    await setDoc(doc(firestore, 'users', userData.uid), userData, { merge: true });
    console.log('✅ User profile updated in Firestore');
    
    // Also update in SQLite
    await sqliteService.saveUser(userData);
    console.log('✅ User profile updated in SQLite');
    
    return userData;
  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    throw error;
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
      
      console.log('🔑 Input password:', password);
      console.log('🔑 Stored password:', user.password);
      console.log('🔑 Password match:', user.password === password);
      
      // Check password - FIXED: Better comparison with debugging
      if (user.password && user.password.toString() === password.toString()) {
        console.log('✅ Offline login successful for:', user.email);
        
        // Update last login
        const updatedUser = {
          ...user,
          lastLogin: new Date().toISOString()
        };
        await sqliteService.saveUser(updatedUser);
        
        return updatedUser;
      } else {
        console.log('❌ Password mismatch');
        throw new Error('Incorrect password.');
      }
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

  // CREATE USER PROFILE - ADD THIS MISSING METHOD
  async createUserProfile(userData) {
    try {
      console.log('📝 Creating user profile in Firestore:', userData.email);
      await setDoc(doc(firestore, 'users', userData.uid), userData);
      console.log('✅ User profile created in Firestore');
      return userData;
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
      throw error;
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
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/invalid-credential': 'Invalid email or password.'
    };

    return errorMessages[errorCode] || 'An unexpected error occurred.';
  },
  // Add this function to your authService to debug
async debugSQLiteUsers() {
  try {
    const users = await sqliteService.getAllUsers();
    console.log('🐛 DEBUG: Users in SQLite:', users.length);
    users.forEach((user, index) => {
      console.log(`🐛 User ${index + 1}:`, {
        email: user.email,
        password: user.password ? 'SET' : 'MISSING',
        passwordLength: user.password ? user.password.length : 0
      });
    });
    return users;
  } catch (error) {
    console.error('🐛 DEBUG Error:', error);
    return [];
  }
},
// Add this debug function to your authService.js
async debugUserData() {
  try {
    console.log('🐛 DEBUG: Checking user data flow...');
    
    // Check what's in Firestore
    const currentUser = auth.currentUser;
    if (currentUser) {
      const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const firestoreData = userDoc.data();
        console.log('🐛 Firestore user data:', {
          email: firestoreData.email,
          hasPassword: !!firestoreData.password,
          password: firestoreData.password ? 'SET' : 'MISSING'
        });
      }
    }
    
    // Check what's in SQLite
    const sqliteUsers = await sqliteService.getAllUsers();
    console.log('🐛 SQLite users:', sqliteUsers.map(u => ({
      email: u.email,
      hasPassword: !!u.password,
      password: u.password ? 'SET' : 'MISSING'
    })));
    
  } catch (error) {
    console.error('🐛 DEBUG Error:', error);
  }
},
};