// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { authService } from '../services/authService';
import sqliteService from '../services/sqliteService';
import NetInfo from '@react-native-community/netinfo';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Check online status and trigger sync when coming online
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async state => {
      const online = state.isConnected && state.isInternetReachable;
      console.log(online ? '🌐 App is online' : '📴 App is offline');
      
      // If we just came online and have a user, process sync queue
      if (online && !isOnline && user) {
        console.log('🔄 App came online, processing sync queue...');
        try {
          const syncResult = await sqliteService.processPendingSyncQueue(
            authService.uploadProfilePicture.bind(authService)
          );
          console.log('🔄 Sync queue processed:', syncResult);
        } catch (syncError) {
          console.error('❌ Error processing sync queue:', syncError);
        }
      }
      
      setIsOnline(online);
    });

    return () => unsubscribe();
  }, [isOnline, user]);

  // Auth state listener
  useEffect(() => {
    console.log('🔄 AuthContext: Checking authentication state...');
    
    const checkAuthState = async () => {
      try {
        setLoading(true);
        
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          console.log('🔥 Firebase auth state:', firebaseUser ? `User ${firebaseUser.email}` : 'No user');
          
          if (firebaseUser) {
            try {
              const userData = await authService.getCurrentUser(firebaseUser.uid);
              const mergedUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                emailVerified: firebaseUser.emailVerified,
                displayName: firebaseUser.displayName,
                ...userData
              };
              
              // ✅ Check if user needs profile picture sync
              if (sqliteService.needsProfilePicSync(mergedUser)) {
                console.log('🔄 User needs profile picture sync, adding to queue...');
                await sqliteService.markUserForProfilePicSync(mergedUser);
                
                // Process sync queue immediately if online
                if (isOnline) {
                  console.log('🔄 Processing sync queue on login...');
                  await sqliteService.processPendingSyncQueue(
                    authService.uploadProfilePicture.bind(authService)
                  );
                }
              }
              
              setUser(mergedUser);
              console.log('✅ User loaded from Firebase');
            } catch (error) {
              console.error('❌ Error loading Firebase user:', error);
              // Create basic user from Firebase auth
              const basicUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                emailVerified: firebaseUser.emailVerified,
                displayName: firebaseUser.displayName,
                name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                userType: 'student',
                lastLogin: new Date().toISOString()
              };
              setUser(basicUser);
              console.log('✅ Using basic Firebase user data');
            }
          } else {
            // No Firebase user, check SQLite for offline access
            await checkSQLiteForUser();
          }
          
          setLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('❌ Error checking auth state:', error);
        setLoading(false);
        setUser(null);
      }
    };

    const checkSQLiteForUser = async (email = null) => {
      try {
        console.log('📱 Checking SQLite for users...');
        const offlineUsers = await sqliteService.getAllUsers();
        
        if (offlineUsers.length > 0) {
          let userToUse = offlineUsers[0];
          
          if (email) {
            userToUse = offlineUsers.find(u => u.email === email) || offlineUsers[0];
          }
          
          console.log('✅ Using user from SQLite:', userToUse.email);
          setUser(userToUse);
        } else {
          console.log('❌ No users found in SQLite');
          setUser(null);
        }
      } catch (error) {
        console.error('❌ Error checking SQLite:', error);
        setUser(null);
      }
    };

    const unsubscribe = checkAuthState();
    
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('⏰ Auth check timeout - forcing completion');
        setLoading(false);
      }
    }, 5000);

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
      clearTimeout(timeout);
    };
  }, [isOnline]);

  // Migrate offline user to Firebase - AUTOMATIC ACCOUNT CREATION
  const migrateOfflineUserToOnline = async (email, password) => {
    try {
      console.log('🔄 AUTO-CREATING Firebase account for offline user...');
      
      // First, verify the user exists offline with correct password
      const offlineUser = await authService.offlineLogin(email, password);
      
      if (!offlineUser) {
        throw new Error('No offline account found with these credentials.');
      }
      
      console.log('✅ Offline user verified:', offlineUser.email);
      console.log('🔥 Creating Firebase account with same credentials...');
       
      // Create Firebase account with the same credentials
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      console.log('✅ Firebase account created:', firebaseUser.email);
      
      // Handle profile picture sync if user has local profile pic
      let finalProfilePic = offlineUser.profilePic;
      if (offlineUser.profilePic && offlineUser.profilePic.startsWith('file://')) {
        console.log('🔄 Offline user has local profile picture, marking for sync...');
        // We'll mark for sync rather than upload immediately
      }
      
      // Create user profile in Firestore 
      const userProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: offlineUser.name || email.split('@')[0],
        userType: offlineUser.userType || 'student',
        password: password, // Store password for consistency
        profilePic: finalProfilePic,
        createdAt: offlineUser.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        isOffline: false
      };
      
      await authService.createUserProfile(userProfile);
      console.log('✅ User profile created in Firestore');
      
      // Update SQLite user with Firebase UID
      const updatedUser = {
        ...offlineUser,
        uid: firebaseUser.uid, // Replace offline ID with Firebase UID
        isOffline: false,
        lastLogin: new Date().toISOString()
      }; 
      
      await sqliteService.saveUser(updatedUser);
      console.log('✅ SQLite user updated with Firebase UID');
      
      // Mark for profile picture sync if needed
      if (sqliteService.needsProfilePicSync(updatedUser)) {
        console.log('🔄 Marking migrated user for profile picture sync...');
        await sqliteService.markUserForProfilePicSync(updatedUser);
      }
      
      return updatedUser;
    } catch (error) {
      console.error('❌ Auto-creation failed:', error.message);
      
      // Provide specific error messages
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email is already registered in Firebase. Please use login instead.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak. Please use a stronger password.');
      } else {
        throw new Error(`Failed to create online account: ${error.message}`);
      }
    }
  };

  // Main login function with AUTO-CREATION
  const login = async (email, password) => {
    setAuthLoading(true);
    try {
      console.log('🔐 Attempting login for:', email);
      console.log('🌐 Online status:', isOnline);
      
      let userData;
      
      if (isOnline) {
        try {
          console.log('🔥 Attempting Firebase authentication...');
          
          // Try to login with Firebase first
          userData = await authService.login(email, password);
          console.log('✅ Firebase login successful');
          
          // ✅ Check if user needs profile picture sync
          if (sqliteService.needsProfilePicSync(userData)) {
            console.log('🔄 User needs profile picture sync, adding to queue...');
            await sqliteService.markUserForProfilePicSync(userData);
            
            // Process sync queue immediately
            console.log('🔄 Processing sync queue on login...');
            await sqliteService.processPendingSyncQueue(
              authService.uploadProfilePicture.bind(authService)
            );
          }
          
        } catch (firebaseError) {
          console.log('🔥 Firebase authentication failed:', firebaseError.message);
          
          // If user not found in Firebase, check if they exist offline and AUTO-CREATE
          if (firebaseError.message.includes('user-not-found') || 
              firebaseError.message.includes('invalid-credential') ||
              firebaseError.message.includes('No account found')) {
            
            console.log('👤 User not in Firebase, checking for offline account...');
            userData = await migrateOfflineUserToOnline(email, password);
            console.log('✅ Offline user auto-migrated to online successfully!');
            
          } else if (firebaseError.message.includes('network')) {
            // Network error - fall back to offline login
            console.log('🌐 Network error, falling back to offline login...');
            userData = await authService.offlineLogin(email, password);
          } else {
            // Other errors (wrong password, etc.)
            throw new Error(firebaseError.message);
          }
        }
      } else {
        // Offline mode - use offline login only
        console.log('📴 Offline mode - using offline login');
        userData = await authService.offlineLogin(email, password);
      }
      
      if (userData) {
        setUser(userData);
        console.log('✅ Login successful, user set in context');
        return { success: true, data: userData };
      } else {
        throw new Error('Login failed - no user data returned');
      }
      
    } catch (error) {
      console.error('❌ Login error:', error.message);
      
      // Provide user-friendly error messages
      let errorMessage = error.message;
      if (error.message.includes('auth/invalid-email')) {
        errorMessage = 'Invalid email address. Please check your email.';
      } else if (error.message.includes('auth/user-not-found') || error.message.includes('No account found')) {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (error.message.includes('Incorrect password') || error.message.includes('auth/wrong-password')) {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.message.includes('auth/network-request-failed')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('email is already registered')) {
        errorMessage = 'This email is already registered. Please use login instead.';
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setAuthLoading(false);
    }
  };

  const register = async (userData) => {
    setAuthLoading(true);
    try {
      console.log('👤 Attempting registration for:', userData.email);
      
      let newUser;
      
      if (isOnline) {
        // Online registration
        newUser = await authService.register(userData);
        console.log('✅ Online registration successful');
      } else {
        // Offline registration
        newUser = await authService.offlineRegister(userData);
        console.log('✅ Offline registration successful');
      }
      
      if (newUser) {
        if (!isOnline) {
          setUser(newUser);
        }
        return { success: true, data: newUser };
      }
      
      return { success: false, error: 'Registration failed' };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Logging out user...');
      
      if (isOnline) {
        await authService.logout();
      }
      
      setUser(null);
      console.log('✅ User logged out successfully');
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  };

  // ✅ ADD THIS: Manual sync trigger
  const triggerSync = async () => {
    if (!isOnline || !user) {
      console.log('❌ Cannot sync: offline or no user');
      return { success: false, error: 'Cannot sync while offline' };
    }
    
    try {
      console.log('🔄 Manual sync triggered...');
      const result = await sqliteService.processPendingSyncQueue(
        authService.uploadProfilePicture.bind(authService)
      );
      console.log('✅ Manual sync completed:', result);
      return { success: true, result };
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    setUser,
    login,
    register,
    logout,
    loading,
    authLoading,
    isOnline,
    triggerSync // ✅ ADD THIS
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};