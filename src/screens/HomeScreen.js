// src/screens/HomeScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNotes } from '../context/NotesContext';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { notes, pinnedNotes, favorites } = useNotes();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Function to navigate to Notes with filter
  const navigateToFilteredNotes = (filterType) => {
    console.log('🔍 Navigating to notes with filter:', filterType);
    navigation.navigate('Notes', { 
      filter: filterType,
      filterTitle: getFilterTitle(filterType)
    });
  };

  const getFilterTitle = (filterType) => {
    switch (filterType) {
      case 'all': return 'All Notes';
      case 'pinned': return 'Pinned Notes';
      case 'favorites': return 'Favorite Notes';
      default: return 'My Notes';
    }
  };

  const StatCard = ({ title, value, color, filterType }) => (
    <TouchableOpacity 
      style={[styles.statCard, { borderLeftColor: color }]} 
      onPress={() => navigateToFilteredNotes(filterType)}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Welcome back, {user?.name || user?.email}!</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Quick Stats</Text>
        <View style={styles.statsContainer}>
          <StatCard 
            title="Total Notes" 
            value={notes.length} 
            color="#6366f1"
            filterType="all"
          />
          <StatCard 
            title="Pinned" 
            value={pinnedNotes.length} 
            color="#10b981"
            filterType="pinned"
          />
          <StatCard 
            title="Favorites" 
            value={favorites.length} 
            color="#f59e0b"
            filterType="favorites"
          />
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('NoteEditor', { note: null })}
          >
            <Text style={styles.actionIcon}>📝</Text>
            <Text style={styles.actionText}>New Note</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigateToFilteredNotes('all')}
          >
            <Text style={styles.actionIcon}>📚</Text>
            <Text style={styles.actionText}>All Notes</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionText}>Chat</Text>
          </TouchableOpacity>
        </View>

        {/* Add a dedicated Chat section */}
        <View style={styles.chatSection}>
          <Text style={styles.sectionTitle}>Collaborate</Text>
          <TouchableOpacity 
            style={styles.chatCard}
            onPress={() => navigation.navigate('Chat')}
          >
            <View style={styles.chatIconContainer}>
              <Text style={styles.chatIcon}>💬</Text>
            </View>
            <View style={styles.chatContent}>
              <Text style={styles.chatTitle}>Synapse Chat</Text>
              <Text style={styles.chatDescription}>
                Real-time messaging with other users. Discuss ideas and collaborate instantly.
              </Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        </View>

        {notes.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptyText}>
              Get started by creating your first note!
            </Text>
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => navigation.navigate('NoteEditor', { note: null })}
            >
              <Text style={styles.createButtonText}>Create First Note</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#6366f1',
  },
  welcome: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  logoutButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 5,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 5,
  },
  statTitle: {
    fontSize: 12,
    color: '#64748b',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  chatSection: {
    marginBottom: 30,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chatIconContainer: {
    marginRight: 15,
  },
  chatIcon: {
    fontSize: 32,
  },
  chatContent: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 5,
  },
  chatDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 18,
  },
  arrow: {
    fontSize: 20,
    color: '#6366f1',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600', 
    fontSize: 14,
  },
});

export default HomeScreen;