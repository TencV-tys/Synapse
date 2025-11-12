// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { authService } from '../services/authService';
import sqliteService from '../services/sqliteService'; // FIXED IMPORT PATH
import NetInfo from '@react-native-community/netinfo';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Check online status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      console.log(online ? '🌐 App is online' : '📴 App is offline');
      setIsOnline(online);
    });

    return () => unsubscribe();
  }, []);

  // Load initial auth state - BOTH ONLINE AND OFFLINE
  useEffect(() => {
    console.log('🔄 AuthContext: Checking authentication state...');
    
    const checkAuthState = async () => {
      try {
        setLoading(true);
        
        // First, check Firebase auth (online)
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          console.log('🔥 Firebase auth state:', firebaseUser ? `User ${firebaseUser.email}` : 'No user');
          
          if (firebaseUser) {
            // User is signed in with Firebase - load full user data
            try {
              const userData = await authService.getCurrentUser(firebaseUser.uid);
              const mergedUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                emailVerified: firebaseUser.emailVerified,
                displayName: firebaseUser.displayName,
                ...userData
              };
              setUser(mergedUser);
              console.log('✅ User loaded from Firebase');
            } catch (error) {
              console.error('❌ Error loading Firebase user:', error);
              // Even if Firebase fails, try SQLite as fallback
              await checkSQLiteForUser(firebaseUser.email);
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
          
          // If we have a specific email, try to find that user
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
    
    // Set a timeout to prevent infinite loading
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
  }, []);

  const login = async (email, password) => {
    setAuthLoading(true);
    try {
      console.log('🔐 Attempting login for:', email);
      
      let userData;
      
      if (isOnline) {
        // Try online login first
        try {
          userData = await authService.login(email, password);
          console.log('✅ Online login successful');
        } catch (onlineError) {
          console.log('❌ Online login failed, trying offline:', onlineError.message);
          // If online fails, try offline
          userData = await authService.offlineLogin(email, password);
          console.log('✅ Offline login successful as fallback');
        }
      } else {
        // Offline login only
        userData = await authService.offlineLogin(email, password);
        console.log('✅ Offline login successful');
      }
      
      if (userData) {
        setUser(userData);
        return { success: true, data: userData };
      }
      
      return { success: false, error: 'Login failed' };
    } catch (error) {
      console.error('❌ Login error:', error);
      return { success: false, error: error.message };
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
        // Online registration - also saves to SQLite for offline access
        newUser = await authService.register(userData);
        console.log('✅ Online registration successful');
      } else {
        // Offline registration only
        newUser = await authService.offlineRegister(userData);
        console.log('✅ Offline registration successful');
      }
      
      if (newUser) {
        // For online registration, we don't auto-login
        // For offline registration, we can auto-login since we're already offline
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

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    authLoading,
    isOnline
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