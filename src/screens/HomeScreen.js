// src/screens/HomeScreen.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useAuth } from '../context/AuthContext';

const HomeScreen = ({ navigation }) => {
  const { notes, pinnedNotes } = useNotes();
  const { user, logout } = useAuth();

  // Calculate created notes count (all notes belong to current user)
  const createdNotesCount = notes.length;

  const handleLogout = async () => {
    try {
      await logout();
      // Explicitly navigate to Login screen after logout
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Logout Failed', 'Unable to logout. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header with Logout */}
      <View style={styles.profileHeader}>
        <View style={styles.profileInfo}>
          <Text style={styles.welcome}>Welcome back, {user?.name || 'User'}! 👋</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Text style={styles.userType}>{user?.userType}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
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
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{createdNotesCount}</Text>
          <Text style={styles.statLabel}>Created</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.quickAction}
        onPress={() => navigation.navigate('Notes')}
      >
        <Text style={styles.quickActionText}>+ Create New Note</Text>
      </TouchableOpacity>

      {pinnedNotes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📌 Pinned Notes</Text>
          {pinnedNotes.slice(0, 3).map(note => (
            <TouchableOpacity 
              key={note.id} 
              style={styles.noteCard}
              onPress={() => navigation.navigate('NoteEditor', { note })}
            >
              <Text style={styles.noteTitle}>{note.title}</Text>
              <Text style={styles.notePreview}>
                {note.content?.substring(0, 100)}...
              </Text>
              <View style={styles.tagsContainer}>
                {note.tags?.slice(0, 3).map((tag, index) => (
                  <Text key={index} style={styles.tag}>{tag}</Text>
                ))}
              </View>
            </TouchableOpacity>
          ))}
          {pinnedNotes.length > 3 && (
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('Notes')}
            >
              <Text style={styles.viewAllText}>View All Pinned Notes ({pinnedNotes.length})</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Recent Notes Section */}
      {notes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Recent Notes</Text>
          {notes.slice(0, 3).map(note => (
            <TouchableOpacity 
              key={note.id} 
              style={styles.noteCard}
              onPress={() => navigation.navigate('NoteEditor', { note })}
            >
              <Text style={styles.noteTitle}>{note.title}</Text>
              <Text style={styles.notePreview}>
                {note.content?.substring(0, 80)}...
              </Text>
              <Text style={styles.noteDate}>
                {new Date(note.updatedAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))}
          {notes.length > 3 && (
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('Notes')}
            >
              <Text style={styles.viewAllText}>View All Notes ({notes.length})</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  profileInfo: {
    flex: 1,
    marginRight: 15,
  },
  welcome: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#1e293b',
    marginBottom: 4,
  },
  userEmail: { 
    fontSize: 14, 
    color: '#64748b', 
    marginBottom: 2,
  },
  userType: { 
    fontSize: 12, 
    color: '#6366f1', 
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statsContainer: { 
    flexDirection: 'row', 
    padding: 20, 
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: { 
    flex: 1,
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#6366f1' 
  },
  statLabel: { 
    color: '#64748b', 
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  quickAction: {
    backgroundColor: '#6366f1',
    margin: 20,
    marginTop: 10,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  quickActionText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  section: { 
    padding: 20,
    paddingTop: 10,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 15,
    color: '#1e293b',
  },
  noteCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  noteTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 8,
    color: '#1e293b',
  },
  notePreview: { 
    color: '#64748b', 
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  tagsContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#e0e7ff',
    color: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '500',
    marginRight: 6,
    marginBottom: 4,
  },
  viewAllButton: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  viewAllText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HomeScreen;