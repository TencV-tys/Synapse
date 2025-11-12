// src/context/AuthContext.js - Simplified version
import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
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

  // Check online status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      console.log(online ? '🌐 App is online' : '📴 App is offline');
      setIsOnline(online);
    });

    return () => unsubscribe();
  }, []);

  // Load initial auth state
  useEffect(() => {
    console.log('🔄 AuthContext: Checking authentication state...');
    
    const checkAuthState = async () => {
      try {
        setLoading(true);
        
        // First, check Firebase auth
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          console.log('🔥 Firebase auth state:', firebaseUser ? `User ${firebaseUser.email}` : 'No user');
          
          if (firebaseUser) {
            // User is signed in with Firebase
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
          } else {
            // No Firebase user, check SQLite for offline access
            console.log('📱 Checking SQLite for offline users...');
            const offlineUsers = await sqliteService.getAllUsers();
            if (offlineUsers.length > 0) {
              console.log('✅ Using offline user from SQLite');
              setUser(offlineUsers[0]);
            } else {
              console.log('❌ No user found (online or offline)');
              setUser(null);
            }
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
        userData = await authService.login(email, password);
      } else {
        userData = await authService.offlineLogin(email, password);
      }
      
      if (userData) {
        const fullUserData = await loadUserData(userData);
        setUser(fullUserData);
        return { success: true, data: fullUserData };
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
        newUser = await authService.register(userData);
      } else {
        newUser = await authService.offlineRegister(userData);
      }
      
      if (newUser) {
        setUser(newUser);
        return { success: true, data: newUser };
      }
      
      return { success: true, data: newUser };
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

  // Helper function to load user data
  const loadUserData = async (userData) => {
    try {
      if (isOnline && userData.uid && !userData.isOffline) {
        const firestoreData = await authService.getCurrentUser(userData.uid);
        return { ...userData, ...firestoreData };
      }
      return userData;
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      return userData;
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