// src/screens/DebugScreen.js
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useAuth } from '../context/AuthContext';
import { notesService } from '../services/notesService';

const DebugScreen = () => {
  const { user } = useAuth();
  const { notes, categories, refreshData } = useNotes();

  const debugCategories = async () => {
    if (!user) return;
    
    console.log('🔍 Starting categories debug...');
    
    // Check Firebase directly
    const firebaseCategories = await notesService.debugFirebaseCategories(user.uid);
    console.log('🔍 Firebase categories result:', firebaseCategories);
    
    // Check SQLite
    const sqliteCategories = await notesService.getUserCategories(user.uid);
    console.log('🔍 SQLite categories result:', sqliteCategories);
    
    // Initialize default categories if needed
    if (firebaseCategories.length === 0 && sqliteCategories.length === 0) {
      console.log('🔍 No categories found, creating defaults...');
      await notesService.initializeDefaultCategories(user.uid);
      await refreshData();
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Debug Information</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User</Text>
        <Text>UID: {user?.uid || 'No user'}</Text>
        <Text>Email: {user?.email || 'No email'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <Text>Total: {notes.length}</Text>
        <Text>Pinned: {notes.filter(n => n.isPinned).length}</Text>
        <Text>Favorites: {notes.filter(n => n.isFavorite).length}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <Text>Total: {categories.length}</Text>
        {categories.map((cat, index) => (
          <Text key={cat.id} style={styles.categoryItem}>
            {index + 1}. {cat.name} ({cat.noteCount} notes) - {cat.color}
          </Text>
        ))}
        {categories.length === 0 && (
          <Text style={styles.warning}>No categories found!</Text>
        )}
      </View>

      <TouchableOpacity style={styles.debugButton} onPress={debugCategories}>
        <Text style={styles.debugButtonText}>Debug Categories</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.debugButton} onPress={refreshData}>
        <Text style={styles.debugButtonText}>Refresh Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  categoryItem: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
  warning: {
    color: 'red',
    fontStyle: 'italic',
  },
  debugButton: {
    backgroundColor: '#6366f1',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  debugButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default DebugScreen;