// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, ActivityIndicator } from 'react-native';
import { NotesProvider } from './src/context/NotesContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import NotesScreen from './src/screens/NotesScreen';
import NoteEditorScreen from './src/screens/NoteEditorScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen'; // Add this import

const Stack = createStackNavigator();

// Loading Screen Component
const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
    <ActivityIndicator size="large" color="#6366f1" />
    <Text style={{ marginTop: 10, fontSize: 16, color: '#666' }}>Loading Synapse...</Text>
  </View>
);

// Unauthenticated stack (login/register)
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

// Authenticated stack (main app)
const AppStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: '#6366f1' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
    }}
  >
    <Stack.Screen 
      name="Home" 
      component={HomeScreen} 
      options={{ 
        title: 'Synapse',
        headerShown: false
      }} 
    />
    <Stack.Screen 
      name="Notes" 
      component={NotesScreen} 
      options={{ 
        title: 'My Notes',
        headerBackTitle: 'Back'
      }} 
    />
    <Stack.Screen 
      name="NoteEditor" 
      component={NoteEditorScreen} 
      options={{ 
        title: 'Edit Note',
        headerBackTitle: 'Back'
      }} 
    />
    <Stack.Screen 
      name="Chat" 
      component={ChatScreen} 
      options={{ 
        title: 'Chat',
        headerBackTitle: 'Back'
      }} 
    />
    <Stack.Screen 
      name="Profile" 
      component={ProfileScreen} 
      options={{ 
        title: 'Profile',
        headerBackTitle: 'Back'
      }} 
    />
  </Stack.Navigator>
);

// Root navigator that handles auth state
const RootNavigator = () => {
  const { user, loading } = useAuth();

  console.log('🔄 RootNavigator - Auth state:', { 
    user: user ? user.email : 'none', 
    loading 
  });

  // Show loading screen while checking auth state
  if (loading) {
    console.log('⏳ Showing loading screen...');
    return <LoadingScreen />;
  }

  // Show app if user is authenticated, auth stack if not
  console.log('🎯 Navigation decision:', user ? 'APP (authenticated)' : 'AUTH (not authenticated)');
  return user ? <AppStack /> : <AuthStack />;
};

// Main App component
export default function App() {
  return (
    <AuthProvider>
      <NotesProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </NotesProvider>
    </AuthProvider>
  );
}