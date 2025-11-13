// src/screens/LoginScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { login, authLoading, isOnline } = useAuth();

  useEffect(() => {
    console.log('📱 LoginScreen mounted - Online status:', isOnline);
  }, [isOnline]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    console.log('🔐 Attempting login for:', email);
    console.log('🌐 Online status:', isOnline);
    
    setIsLoggingIn(true);

    try {
      const result = await login(email, password);
      console.log('📋 Login result:', result);
      
      if (result.success) {
        console.log('✅ Login successful - navigation should happen automatically');
        // RootNavigator will handle navigation based on auth state
      } else {
        console.log('❌ Login failed:', result.error);
        
        // More specific error messages
        let errorMessage = result.error;
        if (result.error?.includes('network') || result.error?.includes('offline')) {
          errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
        } else if (result.error?.includes('password')) {
          errorMessage = 'Invalid password. Please try again.';
        } else if (result.error?.includes('account found')) {
          errorMessage = 'No account found with this email. Please sign up first or check your email.';
        } else if (result.error?.includes('invalid-email')) {
          errorMessage = 'Invalid email format. Please check your email address.';
        }
        
        Alert.alert('Login Failed', errorMessage);
        setPassword(''); // Clear password on error
      }
    } catch (error) {
      console.log('💥 Unexpected login error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      setPassword('');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleForgotPassword = () => {
    if (!isOnline) {
      Alert.alert('Offline Mode', 'Password reset is not available in offline mode. Please connect to the internet.');
      return;
    }
    Alert.alert('Forgot Password', 'Please contact support or check your email for password reset instructions.');
  };

  const isLoginDisabled = authLoading || isLoggingIn || !email || !password;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SYNAPSE</Text>
        <Text style={styles.subtitle}>Connect Your Knowledge</Text>
        
        {/* Offline Status Indicator */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
          <Text style={styles.statusText}>
            {isOnline ? 'Online' : 'Offline Mode'}
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>Welcome Back</Text>
        <Text style={styles.formSubtitle}>Sign in to continue</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!isLoggingIn}
        />
        
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            editable={!isLoggingIn}
          />
          <TouchableOpacity 
            style={styles.eyeIcon}
            onPress={togglePasswordVisibility}
            disabled={isLoggingIn}
          >
            <Text style={styles.eyeIconText}>
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </Text>
          </TouchableOpacity>
        </View>

        {!isOnline && (
          <View style={styles.offlineNotice}>
            <Text style={styles.offlineNoticeText}>
              📴 Offline Mode - Using local storage only
            </Text>
            <Text style={styles.offlineNoticeSubtext}>
              You can only login with previously saved accounts
            </Text>
          </View>
        )}

        <TouchableOpacity 
          style={[
            styles.loginButton, 
            isLoginDisabled && styles.loginButtonDisabled
          ]} 
          onPress={handleLogin}
          disabled={isLoginDisabled}
        >
          {authLoading || isLoggingIn ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>
              {isOnline ? 'Login' : 'Login Offline'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.forgotPassword}
          onPress={handleForgotPassword}
          disabled={isLoggingIn}
        >
          <Text style={styles.forgotPasswordText}>
            Forgot Password?
          </Text>
        </TouchableOpacity>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>
            Don't have an account? 
          </Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Register')}
            disabled={isLoggingIn}
          >
            <Text style={styles.registerBold}> Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Debug info - remove in production */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Debug: Online={isOnline.toString()}, Loading={authLoading.toString()}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  onlineDot: {
    backgroundColor: '#10b981',
  },
  offlineDot: {
    backgroundColor: '#f59e0b',
  },
  statusText: {
    color: '#e0e7ff',
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 5,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 25,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  passwordInput: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
  },
  eyeIconText: {
    fontSize: 18,
  },
  offlineNotice: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  offlineNoticeText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  offlineNoticeSubtext: {
    color: '#92400e',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.8,
  },
  loginButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 15,
    padding: 8,
  },
  forgotPasswordText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  registerText: {
    color: '#64748b',
    fontSize: 14,
  },
  registerBold: {
    color: '#6366f1',
    fontWeight: 'bold',
    fontSize: 14,
  },
  debugInfo: {
    marginTop: 20,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    alignSelf: 'center',
  },
  debugText: {
    color: '#e0e7ff',
    fontSize: 10, 
    textAlign: 'center',
  },
});

export default LoginScreen;