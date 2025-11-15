// src/screens/NotesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useAuth } from '../context/AuthContext';

const NotesScreen = ({ route, navigation }) => {
  const { notes, deleteNote, togglePin, toggleFavorite, searchNotes, loading, syncPendingChanges } = useNotes();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
 
  // Get filter from navigation params
  const { filter, filterTitle } = route.params || {};

  // Apply filters when notes or filter changes
  useEffect(() => {
    console.log('🔄 Applying filter:', filter || 'all');
    setActiveFilter(filter || 'all');
    
    applyFilters(filter || 'all', searchQuery);
    
    // Update header title based on filter
    if (filterTitle) {
      navigation.setOptions({ title: filterTitle });
    }
  }, [notes, filter, searchQuery]);

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

  const applyFilters = (filterType, query = '') => {
    let filtered = notes;
    
    // Apply main filter
    switch (filterType) {
      case 'pinned':
        filtered = notes.filter(note => note.isPinned);
        console.log(`📌 Pinned notes: ${filtered.length}`);
        break;
      case 'favorites':
        filtered = notes.filter(note => note.isFavorite);
        console.log(`⭐ Favorite notes: ${filtered.length}`);
        break;
      case 'all':
      default:
        filtered = notes;
        console.log(`📚 All notes: ${filtered.length}`);
        break;
    }
    
    // Apply search filter if there's a search query
    if (query.trim()) {
      const searchResults = searchNotes(query);
      filtered = filtered.filter(note => 
        searchResults.some(searchNote => searchNote.id === note.id)
      );
      console.log(`🔍 Search results: ${filtered.length} notes`);
    }
    
    setFilteredNotes(filtered);
  };

  const handleDeleteNote = (noteId, noteTitle) => {
    Alert.alert(
      'Delete Note',
      `Are you sure you want to delete "${noteTitle}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('🗑️ Deleting note:', noteId);
            deleteNote(noteId);
          },
        },
      ]
    );
  };

  const handleTogglePin = (noteId) => {
    console.log('📌 Toggling pin for note:', noteId);
    togglePin(noteId);
  };

  const handleToggleFavorite = (noteId) => {
    console.log('⭐ Toggling favorite for note:', noteId);
    toggleFavorite(noteId);
  };

  const clearFilters = () => {
    setSearchQuery('');
    navigation.setParams({ filter: 'all', filterTitle: 'My Notes' });
  };

  const NoteCard = ({ note }) => (
    <TouchableOpacity 
      style={styles.noteCard}
      onPress={() => navigation.navigate('NoteEditor', { note })}
      onLongPress={() => {
        Alert.alert(
          'Note Actions',
          `What would you like to do with "${note.title}"?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: note.isPinned ? 'Unpin' : 'Pin',
              onPress: () => handleTogglePin(note.id),
            },
            {
              text: note.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
              onPress: () => handleToggleFavorite(note.id),
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => handleDeleteNote(note.id, note.title),
            },
          ]
        );
      }}
    >
      <View style={styles.noteHeader}>
        <Text style={styles.noteTitle}>{note.title}</Text>
        <View style={styles.noteActions}>
          {/* Favorite Button */}
          <TouchableOpacity 
            onPress={(e) => {
              e.stopPropagation();
              handleToggleFavorite(note.id);
            }}
            style={styles.actionButton}
          >
            <Text style={[
              styles.favoriteIcon,
              note.isFavorite && styles.favoriteIconActive
            ]}>
              {note.isFavorite ? '⭐' : '☆'}
            </Text>
          </TouchableOpacity>
          
          {/* Pin Button */}
          <TouchableOpacity 
            onPress={(e) => {
              e.stopPropagation();
              handleTogglePin(note.id);
            }}
            style={styles.actionButton}
          >
            <Text style={[
              styles.pinIcon,
              note.isPinned && styles.pinIconActive
            ]}>
              {note.isPinned ? '📌' : '📍'}
            </Text>
          </TouchableOpacity>
          
          {/* Delete Button */}
          <TouchableOpacity 
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteNote(note.id, note.title);
            }}
            style={styles.actionButton}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={styles.noteContent} numberOfLines={3}>
        {note.content}
      </Text>
      
      <View style={styles.noteFooter}>
        <View style={styles.tagsContainer}>
          {note.tags?.map((tag, index) => (
            <Text key={index} style={styles.tag}>{tag}</Text>
          ))}
        </View>
        <Text style={styles.dateText}>
          {new Date(note.updatedAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Status indicators */}
      <View style={styles.statusIndicators}>
        {note.isPinned && <Text style={styles.statusPinned}>📌 Pinned</Text>}
        {note.isFavorite && <Text style={styles.statusFavorite}>⭐ Favorite</Text>}
      </View>
    </TouchableOpacity>
  );

  if (loading && notes.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading your notes...</Text>
      </View>
    );
  }

  const displayNotes = searchQuery ? filteredNotes : (filteredNotes.length > 0 ? filteredNotes : notes);

  return (
    <View style={styles.container}>
      {/* Filter and Search Header */}
      <View style={styles.filterHeader}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {(searchQuery || activeFilter !== 'all') && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Active Filter Indicator */}
        {activeFilter !== 'all' && (
          <View style={styles.filterIndicator}>
            <Text style={styles.filterText}>
              Showing: {activeFilter === 'pinned' ? '📌 Pinned' : '⭐ Favorites'} 
              ({filteredNotes.length} notes)
            </Text>
          </View>
        )}
      </View>

      {displayNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>
            {activeFilter === 'pinned' ? '📌' : activeFilter === 'favorites' ? '⭐' : '📝'}
          </Text>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching notes' : 
             activeFilter === 'pinned' ? 'No pinned notes' :
             activeFilter === 'favorites' ? 'No favorite notes' :
             'No notes yet'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery ? 'Try a different search term' :
             activeFilter === 'pinned' ? 'Pin important notes to see them here' :
             activeFilter === 'favorites' ? 'Mark notes as favorites to see them here' :
             'Create your first note by tapping the + button below!'}
          </Text>
          {(searchQuery || activeFilter !== 'all') && (
            <TouchableOpacity style={styles.clearAllButton} onPress={clearFilters}>
              <Text style={styles.clearAllButtonText}>Show All Notes</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayNotes}
          renderItem={({ item }) => <NoteCard note={item} />}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.notesList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#6366f1']}
              tintColor="#6366f1"
            />
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('NoteEditor', { note: null })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.chatButton}
        onPress={() => navigation.navigate('Chat')}
      >
        <Text style={styles.chatButtonText}>💬</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  filterHeader: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    marginRight: 10,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  filterIndicator: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
    alignItems: 'center',
  },
  filterText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  notesList: { padding: 15 },
  noteCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  noteTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    flex: 1,
    color: '#333',
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 5,
    marginLeft: 10,
  },
  favoriteIcon: {
    fontSize: 16,
    opacity: 0.6,
  },
  favoriteIconActive: {
    opacity: 1,
  },
  pinIcon: {
    fontSize: 16,
    opacity: 0.6,
  },
  pinIconActive: {
    opacity: 1,
  },
  deleteIcon: { 
    fontSize: 16,
    opacity: 0.6,
  },
  noteContent: { 
    color: '#666', 
    lineHeight: 20,
    fontSize: 14,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  tagsContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    flex: 1,
  },
  tag: {
    backgroundColor: '#e0e7ff',
    color: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    marginRight: 5,
    marginBottom: 5,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 10,
  },
  statusIndicators: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
  },
  statusPinned: {
    fontSize: 11,
    color: '#10b981',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusFavorite: {
    fontSize: 11,
    color: '#f59e0b',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#6366f1',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { 
    color: '#fff', 
    fontSize: 24, 
    fontWeight: 'bold',
  },
  chatButton: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    backgroundColor: '#10b981',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  clearAllButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  clearAllButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default NotesScreen;