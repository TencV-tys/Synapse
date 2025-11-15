// src/screens/HomeScreen.js
import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNotes } from '../context/NotesContext';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { notes, pinnedNotes, favorites, loading, syncPendingChanges } = useNotes();
  const [refreshing, setRefreshing] = useState(false);

  // Get recent notes (last 3 notes)
  const recentNotes = notes
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 3);

  const handleLogout = async () => {
    try {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              try {
                await logout();
              } catch (error) {
                console.error('Logout error:', error);
                Alert.alert('Error', 'Failed to logout. Please try again.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Pull to refresh function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      console.log('🔄 Manual refresh triggered');
      await syncPendingChanges();
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [syncPendingChanges]);

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

  const handleProfilePress = () => {
    try {
      navigation.navigate('Profile');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Cannot open profile at this time');
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

  const NotePreview = ({ note }) => (
    <TouchableOpacity 
      style={styles.notePreview}
      onPress={() => navigation.navigate('NoteEditor', { note })}
    >
      <View style={styles.notePreviewHeader}>
        <Text style={styles.notePreviewTitle} numberOfLines={1}>
          {note.title || 'Untitled Note'}
        </Text>
        <View style={styles.noteIndicators}>
          {note.isPinned && <Text style={styles.pinIndicator}>📌</Text>}
          {note.isFavorite && <Text style={styles.favIndicator}>⭐</Text>}
        </View>
      </View>
      <Text style={styles.notePreviewContent} numberOfLines={2}>
        {note.content || 'No content'}
      </Text>
      <View style={styles.notePreviewFooter}>
        {note.tags && note.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {note.tags.slice(0, 2).map((tag, index) => (
              <Text key={index} style={styles.tag} numberOfLines={1}>
                #{tag}
              </Text>
            ))}
            {note.tags.length > 2 && (
              <Text style={styles.moreTags}>+{note.tags.length - 2}</Text>
            )}
          </View>
        )}
        <Text style={styles.notePreviewDate}>
          {new Date(note.updatedAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Loading state
  if (loading && notes.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading your notes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {user?.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={styles.profilePic} />
          ) : (
            <View style={styles.profilePicPlaceholder}>
              <Text style={styles.profilePicText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcome}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name || user?.email}!</Text>
            <Text style={styles.noteCount}>
              {notes.length} note{notes.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={handleProfilePress}
          >
            <Text style={styles.profileButtonText}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
        showsVerticalScrollIndicator={false}
      >
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
            onPress={() => navigation.navigate('DirectMessages')}
          >
            <Text style={styles.actionIcon}>💭</Text>
            <Text style={styles.actionText}>Messages</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Notes Section */}
        {recentNotes.length > 0 && (
          <View style={styles.recentNotesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Notes</Text>
              <TouchableOpacity onPress={() => navigateToFilteredNotes('all')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.recentNotesContainer}>
              {recentNotes.map((note, index) => (
                <NotePreview key={note.id || index} note={note} />
              ))}
            </View>
          </View>
        )}

        {/* Chat Section */}
        <View style={styles.chatSection}>
          <Text style={styles.sectionTitle}>Collaborate</Text>
          <View style={styles.chatCardsContainer}>
            <TouchableOpacity 
              style={styles.chatCard}
              onPress={() => navigation.navigate('Chat')}
            >
              <View style={styles.chatIconContainer}>
                <Text style={styles.chatIcon}>👥</Text>
              </View>
              <View style={styles.chatContent}>
                <Text style={styles.chatTitle}>Public Chat</Text>
                <Text style={styles.chatDescription}>
                  Chat with everyone in the community
                </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.chatCard}
              onPress={() => navigation.navigate('DirectMessages')}
            >
              <View style={styles.chatIconContainer}>
                <Text style={styles.chatIcon}>💬</Text>
              </View>
              <View style={styles.chatContent}>
                <Text style={styles.chatTitle}>Direct Messages</Text>
                <Text style={styles.chatDescription}>
                  Private conversations with other users
                </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          </View>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#6366f1',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  profilePicPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profilePicText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  welcomeContainer: {
    flex: 1,
  },
  welcome: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  noteCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  profileButtonText: {
    color: '#fff',
    fontSize: 16,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  seeAllText: {
    color: '#6366f1',
    fontWeight: '600',
    fontSize: 14,
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
  recentNotesSection: {
    marginBottom: 30,
  },
  recentNotesContainer: {
    gap: 12,
  },
  notePreview: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notePreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    marginRight: 8,
  },
  noteIndicators: {
    flexDirection: 'row',
    gap: 4,
  },
  pinIndicator: {
    fontSize: 12,
  },
  favIndicator: {
    fontSize: 12,
  },
  notePreviewContent: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 18,
  },
  notePreviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  tag: {
    fontSize: 11,
    color: '#6366f1',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
  },
  moreTags: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  notePreviewDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  chatSection: {
    marginBottom: 30,
  },
  chatCardsContainer: {
    gap: 12,
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