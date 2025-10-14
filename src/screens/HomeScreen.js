// src/screens/HomeScreen.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useAuth } from '../context/AuthContext';

const HomeScreen = ({ navigation }) => {
  const { notes, pinnedNotes } = useNotes();
  const { user } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Welcome back, {user?.name}!</Text>
        <Text style={styles.subtitle}>Your knowledge hub</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{notes.length}</Text>
          <Text style={styles.statLabel}>Total Notes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pinnedNotes.length}</Text>
          <Text style={styles.statLabel}>Pinned</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.quickAction}
        onPress={() => navigation.navigate('Notes', { screen: 'CreateNote' })}
      >
        <Text style={styles.quickActionText}>+ Create New Note</Text>
      </TouchableOpacity>

      {pinnedNotes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pinned Notes</Text>
          {pinnedNotes.slice(0, 3).map(note => (
            <TouchableOpacity 
              key={note.id} 
              style={styles.noteCard}
              onPress={() => navigation.navigate('Notes', { note })}
            >
              <Text style={styles.noteTitle}>{note.title}</Text>
              <Text style={styles.notePreview}>
                {note.content.substring(0, 100)}...
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, backgroundColor: '#fff' },
  welcome: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 5 },
  statsContainer: { 
    flexDirection: 'row', 
    padding: 20, 
    justifyContent: 'space-around' 
  },
  statCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 10, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#6366f1' },
  statLabel: { color: '#666', marginTop: 5 },
  quickAction: {
    backgroundColor: '#6366f1',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  quickActionText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  section: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  noteCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  noteTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  notePreview: { color: '#666', fontSize: 14 },
});

export default HomeScreen;