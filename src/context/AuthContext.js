// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Function to load user data from Firestore
  const loadUserData = async (firebaseUser) => {
    try {
      console.log('📡 Fetching user data from Firestore for:', firebaseUser.uid);
      const userData = await authService.getCurrentUser(firebaseUser.uid);
      console.log('✅ User data from Firestore:', userData);
      
      // Merge Firebase user with Firestore data
      const mergedUser = {
        // Firebase auth data
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        emailVerified: firebaseUser.emailVerified,
        displayName: firebaseUser.displayName,
        
        // Firestore user data (this should include 'name')
        ...userData
      };
      
      console.log('👤 Final merged user:', mergedUser);
      return mergedUser;
    } catch (error) {
      console.error('❌ Error fetching user data from Firestore:', error);
      // Fallback to just Firebase user data
      return firebaseUser;
    }
  };

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      console.log('🔥 Firebase auth state changed:', firebaseUser);
      
      if (firebaseUser) {
        const userData = await loadUserData(firebaseUser);
        setUser(userData);
      } else {
        console.log('🚪 No user logged in');
        setUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    setAuthLoading(true);
    try {
      const userData = await authService.login(email, password);
      
      // After login, load the full user data from Firestore
      if (userData) {
        const firebaseUser = auth.currentUser;
        const fullUserData = await loadUserData(firebaseUser);
        setUser(fullUserData);
        return { success: true, data: fullUserData };
      }
      
      return { success: true, data: userData };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setAuthLoading(false);
    }
  };

  const register = async (userData) => {
    setAuthLoading(true);
    try {
      const newUser = await authService.register(userData);
      
      // After registration, load the full user data
      if (newUser) {
        const firebaseUser = auth.currentUser;
        const fullUserData = await loadUserData(firebaseUser);
        setUser(fullUserData);
        return { success: true, data: fullUserData };
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
      await authService.logout();
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
    authLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);