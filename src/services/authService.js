// src/services/authService.js
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, set, get } from 'firebase/database'; // ✅ ADD 'get' IMPORT
import { storage } from '../config/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'; // ✅ ADD deleteObject
import { auth, firestore, database } from '../config/firebase';
import sqliteService from './sqliteService';

export const authService = {
  // Online login - UPDATED WITH PROFILE SYNC CHECK
  async login(email, password) {
    try {
      console.log('🔐 Online login for:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      console.log('✅ Firebase login successful:', firebaseUser.uid);
      
      // Try to get existing user data first
      let userData;
      try {
        userData = await this.getCurrentUser(firebaseUser.uid);
        console.log('✅ Found existing user data');
      } catch (error) {
        console.log('ℹ️ No existing user data, creating new...');
        userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || email.split('@')[0],
          userType: 'student',
          password: password,
          lastLogin: new Date().toISOString(),
          createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
        };
      }

      // Update last login
      userData.lastLogin = new Date().toISOString();
      userData.isOnline = true;
      userData.isOffline = false;
      
      console.log('🔑 User data with password:', userData.password ? 'SET' : 'MISSING');
      
      // ✅ CRITICAL: Save to Realtime Database for chat features
      await this.saveUserToRealtimeDB(userData);
      
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

      // ✅ CHECK FOR PROFILE PICTURE SYNC
      if (sqliteService.needsProfilePicSync(userData)) {
        console.log('🔄 User needs profile picture sync, marking for sync...');
        await sqliteService.markUserForProfilePicSync(userData);
      }
      
      return userData;
    } catch (error) {
      console.error('❌ Online login error:', error.message);
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }, 

  // Online registration - UPDATED WITH PROFILE SYNC
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
        isOnline: true,
        isOffline: false
      };

      // ✅ CRITICAL: Save to Realtime Database for chat features
      await this.saveUserToRealtimeDB(userDoc);
      
      // Save to Firestore
      await setDoc(doc(firestore, 'users', user.uid), userDoc);
      
      // Save to SQLite
      await sqliteService.saveUser(userDoc);
      
      console.log('✅ Online registration successful:', user.uid);
      return userDoc;
    } catch (error) {
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  },

  // ✅ UPDATED: Save users to Realtime Database with better error handling
  async saveUserToRealtimeDB(userData) {
    try {
      console.log('💾 Saving user to Realtime DB:', userData.email);
      
      const userRef = ref(database, `users/${userData.uid}`);
      const userRealtimeData = {
        uid: userData.uid,
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
        userType: userData.userType || 'student',
        profilePic: userData.profilePic || null,
        lastActive: new Date().toISOString(),
        isOnline: userData.isOnline !== undefined ? userData.isOnline : true,
        isOffline: userData.isOffline || false,
        createdAt: userData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await set(userRef, userRealtimeData);
      
      console.log('✅ User saved to Realtime Database successfully');
      return true;
    } catch (error) {
      console.error('❌ Error saving user to Realtime DB:', error);
      console.error('Error details:', error.message, error.code);
      return false;
    }
  },

  // ✅ UPDATED: Upload profile picture to Firebase Storage with better error handling
  async uploadProfilePicture(localUri, userId) {
    try {
      console.log('📤 Starting profile picture upload...');
      console.log('📸 Local URI:', localUri);
      console.log('👤 User ID:', userId);

      if (!localUri) {
        throw new Error('No image provided');
      }

      if (!localUri.startsWith('file://')) {
        console.log('ℹ️ Already a URL, returning as-is:', localUri);
        return localUri; // Already a URL, return as-is
      }

      // Convert file:// URI to blob
      const response = await fetch(localUri);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      console.log('📦 Blob created, size:', blob.size);

      if (blob.size === 0) {
        throw new Error('Empty image file');
      }

      // Create storage reference with unique filename
      const fileName = `profile_${userId}_${Date.now()}.jpg`;
      const pictureRef = storageRef(storage, `profilePictures/${userId}/${fileName}`);
      
      console.log('🔥 Uploading to Firebase Storage...');
      
      // Upload to Firebase Storage with metadata
      const snapshot = await uploadBytes(pictureRef, blob, {
        contentType: 'image/jpeg',
        customMetadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString()
        }
      });
      
      console.log('✅ Upload completed:', snapshot.metadata.fullPath);

      // Get download URL
      const downloadURL = await getDownloadURL(pictureRef);
      console.log('🌐 Download URL obtained:', downloadURL);

      return downloadURL;
    } catch (error) {
      console.error('❌ Error uploading profile picture:', error);
      console.error('Error details:', error.message, error.code);
      throw new Error(`Failed to upload profile picture: ${error.message}`);
    }
  },

  // ✅ UPDATED: Delete old profile picture from storage
  async deleteProfilePicture(profilePicUrl) {
    try {
      if (!profilePicUrl || !profilePicUrl.startsWith('https://firebasestorage.googleapis.com/')) {
        console.log('ℹ️ No valid Firebase profile picture URL to delete');
        return;
      }

      console.log('🗑️ Deleting old profile picture:', profilePicUrl);
      
      try {
        // Extract path from URL and create reference
        const urlParts = profilePicUrl.split('/');
        const pathIndex = urlParts.indexOf('profilePictures');
        if (pathIndex !== -1) {
          const path = urlParts.slice(pathIndex).join('/').split('?')[0];
          const fileRef = storageRef(storage, path);
          await deleteObject(fileRef);
          console.log('✅ Old profile picture deleted from storage');
        }
      } catch (deleteError) {
        console.log('⚠️ Could not delete old picture (may not exist):', deleteError.message);
      }
    } catch (error) {
      console.error('❌ Error deleting old profile picture:', error);
    }
  },

  // ✅ UPDATED: Update user profile with sync support
  async updateUserProfile(userData, options = {}) {
    try {
      console.log('📝 Updating user profile:', userData.email);
      console.log('🖼️ Profile picture in update:', userData.profilePic ? 'SET' : 'NOT SET');
      console.log('🌐 Online status for update:', options.isOnline !== false);
      
      const isOnline = options.isOnline !== false;
      let finalUserData = { ...userData };
      
      // Handle profile picture based on online status
      if (userData.profilePic && userData.profilePic.startsWith('file://')) {
        if (isOnline) {
          try {
            console.log('☁️ Uploading profile picture during profile update...');
            const downloadURL = await this.uploadProfilePicture(userData.profilePic, userData.uid);
            finalUserData.profilePic = downloadURL;
            console.log('✅ Profile picture uploaded during update:', downloadURL);
          } catch (uploadError) {
            console.error('❌ Failed to upload profile picture during update:', uploadError);
            // Mark for sync instead of failing
            console.log('🔄 Will sync profile picture later');
            finalUserData.profilePic = userData.profilePic;
          }
        } else {
          console.log('📴 Offline mode - keeping local profile picture for sync');
          finalUserData.profilePic = userData.profilePic;
        }
      }
      
      // Update timestamps
      finalUserData.updatedAt = new Date().toISOString();
      finalUserData.lastActive = new Date().toISOString();
      
      // Save to SQLite first (always works)
      await sqliteService.saveUser(finalUserData);
      console.log('✅ User profile updated in SQLite');

      // Online updates
      if (isOnline) {
        try {
          // Update in Firestore
          await setDoc(doc(firestore, 'users', finalUserData.uid), finalUserData, { merge: true });
          console.log('✅ User profile updated in Firestore');
          
          // Update in Realtime Database
          await this.saveUserToRealtimeDB(finalUserData);
          
          // Check if we need to mark for sync (local picture that failed to upload)
          if (finalUserData.profilePic && finalUserData.profilePic.startsWith('file://')) {
            console.log('🔄 Marking local profile picture for sync...');
            await sqliteService.markUserForProfilePicSync(finalUserData);
          }
        } catch (onlineError) {
          console.error('❌ Online update failed:', onlineError);
          // Don't throw - SQLite was updated successfully
        }
      }
      
      return finalUserData;
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      throw error;
    }
  },

  // CREATE USER PROFILE - UPDATED WITH SYNC SUPPORT
  async createUserProfile(userData) {
    try {
      console.log('📝 Creating user profile in Firestore:', userData.email);
      
      // Handle profile picture upload if it's a local file
      let finalUserData = { ...userData };
      
      if (userData.profilePic && userData.profilePic.startsWith('file://')) {
        try {
          console.log('☁️ Uploading profile picture during profile creation...');
          const downloadURL = await this.uploadProfilePicture(userData.profilePic, userData.uid);
          finalUserData.profilePic = downloadURL;
          console.log('✅ Profile picture uploaded during creation:', downloadURL);
        } catch (uploadError) {
          console.error('❌ Failed to upload profile picture during creation:', uploadError);
          // Mark for sync
          console.log('🔄 Profile picture will be synced later');
          finalUserData.profilePic = userData.profilePic;
        }
      }
      
      await setDoc(doc(firestore, 'users', finalUserData.uid), finalUserData);
      
      // ✅ ALSO save to Realtime Database
      await this.saveUserToRealtimeDB(finalUserData);
      
      // ✅ Save to SQLite
      await sqliteService.saveUser(finalUserData);
      
      console.log('✅ User profile created in all databases');
      return finalUserData;
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
      throw error;
    }
  },

  // Offline login - UPDATED WITH BETTER DATA HANDLING
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
      
      // Check password
      if (user.password && user.password.toString() === password.toString()) {
        console.log('✅ Offline login successful for:', user.email);
        
        // Update last login
        const updatedUser = {
          ...user,
          lastLogin: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          isOnline: false,
          isOffline: true
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
      
      // Create user in SQLite WITH PASSWORD
      const newUser = {
        uid: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email,
        name: name,
        userType: userType || 'student',
        password: password,
        profilePic: userData.profilePic || null,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        isOnline: false,
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

  // ✅ UPDATED: Get current user with better fallback
  async getCurrentUser(uid) {
    try {
      // Try Firebase first if we have network
      try {
        const userDoc = await getDoc(doc(firestore, 'users', uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Ensure we have all required fields
          const completeUserData = {
            uid: uid,
            email: userData.email || '',
            name: userData.name || userData.email?.split('@')[0] || 'User',
            userType: userData.userType || 'student',
            password: userData.password || '',
            profilePic: userData.profilePic || null,
            createdAt: userData.createdAt || new Date().toISOString(),
            lastLogin: userData.lastLogin || new Date().toISOString(),
            lastActive: new Date().toISOString(),
            isOnline: true,
            isOffline: false,
            ...userData
          };
          // Save to SQLite for offline access
          await sqliteService.saveUser(completeUserData);
          return completeUserData;
        }
      } catch (firebaseError) {
        console.log('🔍 Firebase unavailable, using SQLite...');
      }
      
      // Fallback to SQLite
      console.log('🔍 Getting user from SQLite...');
      const sqliteUser = await sqliteService.getUser(uid);
      if (sqliteUser) {
        return {
          ...sqliteUser,
          isOnline: false,
          isOffline: true
        };
      }
      
      throw new Error('User not found');
    } catch (error) {
      console.error('❌ Error fetching user:', error);
      throw error;
    }
  },

  async logout() {
    try {
      // Update user status to offline before logging out
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const userRef = ref(database, `users/${currentUser.uid}`);
          await set(userRef, {
            isOnline: false,
            lastActive: new Date().toISOString()
          }, { merge: true });
          console.log('✅ User status set to offline');
        } catch (dbError) {
          console.log('⚠️ Could not update online status:', dbError.message);
        }
      }
      
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
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/network-request-failed': 'Network error. Please check your connection.'
    };

    return errorMessages[errorCode] || 'An unexpected error occurred.';
  },

  // ✅ ADDED: Test storage connection
  async testStorageConnection() {
    try {
      console.log('🧪 Testing storage connection...');
      // Try to list files in a test path (this will fail if no connection)
      const testRef = storageRef(storage, '.test-connection');
      // Just checking if storage is accessible
      console.log('✅ Storage connection test passed');
      return true;
    } catch (error) {
      console.error('❌ Storage connection test failed:', error);
      return false;
    }
  },

  // Debug functions (keep these)
  async debugSQLiteUsers() {
    try {
      const users = await sqliteService.getAllUsers();
      console.log('🐛 DEBUG: Users in SQLite:', users.length);
      users.forEach((user, index) => {
        console.log(`🐛 User ${index + 1}:`, {
          email: user.email,
          password: user.password ? 'SET' : 'MISSING',
          profilePic: user.profilePic ? 'SET' : 'MISSING',
          profilePicType: user.profilePic ? (user.profilePic.startsWith('file://') ? 'LOCAL' : 'CLOUD') : 'NONE'
        });
      });
      return users;
    } catch (error) {
      console.error('🐛 DEBUG Error:', error);
      return [];
    }
  },

  async debugUserData() {
    try {
      console.log('🐛 DEBUG: Checking user data flow...');
      
      // Check what's in Firestore
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const firestoreData = userDoc.data();
            console.log('🐛 Firestore user data:', {
              email: firestoreData.email,
              hasPassword: !!firestoreData.password,
              profilePic: firestoreData.profilePic ? 'SET' : 'MISSING'
            });
          }
        } catch (firestoreError) {
          console.log('🐛 Firestore not accessible');
        }
      }
      
      // Check what's in SQLite
      const sqliteUsers = await sqliteService.getAllUsers();
      console.log('🐛 SQLite users:', sqliteUsers.map(u => ({
        email: u.email,
        hasPassword: !!u.password,
        profilePic: u.profilePic ? (u.profilePic.startsWith('file://') ? 'LOCAL' : 'CLOUD') : 'NONE'
      })));
      
    } catch (error) {
      console.error('🐛 DEBUG Error:', error);
    }
  },

  // ✅ UPDATED: Migrate local profile pictures to cloud storage
  async migrateLocalProfilePicture(userId, localUri) {
    try {
      console.log('🔄 Migrating local profile picture to cloud storage...');
      console.log('👤 User ID:', userId);
      console.log('📸 Local URI:', localUri);

      if (!localUri || !localUri.startsWith('file://')) {
        throw new Error('No valid local profile picture found to migrate');
      }

      // Upload to Firebase Storage
      const downloadURL = await this.uploadProfilePicture(localUri, userId);
      console.log('✅ Profile picture migrated to cloud:', downloadURL);

      return downloadURL;
    } catch (error) {
      console.error('❌ Error migrating profile picture:', error);
      throw error;
    }
  },

  // ✅ UPDATED: Get user profile from Realtime Database
  async getUserFromRealtimeDB(userId) {
    try {
      console.log('🔍 Getting user from Realtime DB:', userId);
      
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        console.log('✅ User found in Realtime DB:', userData.email);
        return userData;
      } else {
        console.log('❌ User not found in Realtime DB');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting user from Realtime DB:', error);
      return null;
    }
  },

  // ✅ ADDED: Process sync queue (can be called from anywhere)
  async processAllPendingSyncs() {
    try {
      console.log('🔄 Processing all pending syncs...');
      const result = await sqliteService.processPendingSyncQueue(
        this.uploadProfilePicture.bind(this)
      );
      console.log('✅ Sync processing completed:', result);
      return result;
    } catch (error) {
      console.error('❌ Error processing syncs:', error);
      throw error;
    }
  }
};