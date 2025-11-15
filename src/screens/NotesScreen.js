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
  RefreshControl,
  Modal,
  ScrollView
} from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useAuth } from '../context/AuthContext';
import ShareModal from '../components/ShareModal';

const NotesScreen = ({ route, navigation }) => {
  const { 
    notes, 
    deleteNote, 
    togglePin, 
    toggleFavorite, 
    searchNotes, 
    loading, 
    syncPendingChanges,
    getNotesByCategory,
    getCategoryById,
    categories,
    updateNote
  } = useNotes();
  
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [actionsModalVisible, setActionsModalVisible] = useState(false);
  const [currentNote, setCurrentNote] = useState(null);

  // Get filter from navigation params
  const { filter, filterTitle, categoryId } = route.params || {};

  // Apply filters when notes or filter changes 
  useEffect(() => {
    console.log('🔄 Applying filter:', filter || 'all', 'Category ID:', categoryId);
    setActiveFilter(filter || 'all'); 
    
    applyFilters(filter || 'all', searchQuery, categoryId);
    
    // Update header title based on filter
    if (filterTitle) {
      navigation.setOptions({ title: filterTitle });
    } else if (categoryId) {
      const category = getCategoryById(categoryId);
      if (category) {
        navigation.setOptions({ title: category.name });
      }
    }
  }, [notes, filter, searchQuery, categoryId]);

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

  const applyFilters = (filterType, query = '', catId = null) => {
    let filtered = notes;
    
    console.log('🎯 Starting filter application:', {
      filterType,
      query,
      catId,
      totalNotes: notes.length
    });

    // Apply category filter first (if specified)
    if (catId) {
      filtered = getNotesByCategory(catId);
      console.log(`📁 Category filtered notes: ${filtered.length} for category ${catId}`);
    }
    
    // Apply main filter
    switch (filterType) {
      case 'pinned':
        filtered = filtered.filter(note => note.isPinned);
        console.log(`📌 Pinned notes: ${filtered.length}`);
        break;
      case 'favorites':
        filtered = filtered.filter(note => note.isFavorite);
        console.log(`⭐ Favorite notes: ${filtered.length}`);
        break;
      case 'uncategorized':
        filtered = filtered.filter(note => !note.categoryId);
        console.log(`📄 Uncategorized notes: ${filtered.length}`);
        break;
      case 'all':
      default:
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
    
    console.log('✅ Final filtered notes count:', filtered.length);
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

  const handleUpdateCategory = async (noteId, categoryId) => {
    try {
      console.log('📁 Updating note category:', noteId, categoryId);
      await updateNote(noteId, { categoryId });
      setActionsModalVisible(false);
    } catch (error) {
      console.error('❌ Error updating category:', error);
      Alert.alert('Error', 'Failed to update category');
    }
  };

  const handleUpdatePermission = async (noteId, permission) => {
    try {
      console.log('🔒 Updating note permission:', noteId, permission);
      await updateNote(noteId, { permission });
      setActionsModalVisible(false);
    } catch (error) {
      console.error('❌ Error updating permission:', error);
      Alert.alert('Error', 'Failed to update permission');
    }
  };

  // Add share note function
  const handleShareNote = (note) => {
    if (note.permission !== 'view_only') {
      Alert.alert(
        'Private Note',
        'Only public notes (View Only) can be shared. Change the note permission to "Public" to share it.',
        [{ text: 'OK' }]
      );
      return;
    }
    setSelectedNote(note);
    setShareModalVisible(true);
    setActionsModalVisible(false);
  };

  const closeShareModal = () => {
    setShareModalVisible(false);
    setSelectedNote(null);
  };

  const clearFilters = () => {
    setSearchQuery('');
    navigation.setParams({ 
      filter: 'all', 
      filterTitle: 'My Notes',
      categoryId: null 
    });
  };

  const openActionsModal = (note) => {
    setCurrentNote(note);
    setActionsModalVisible(true);
  };

  const closeActionsModal = () => {
    setActionsModalVisible(false);
    setCurrentNote(null);
  };

  const NoteCard = ({ note }) => {
    const category = note.categoryId ? getCategoryById(note.categoryId) : null;
    
    return (
      <TouchableOpacity 
        style={styles.noteCard}
        onPress={() => navigation.navigate('NoteEditor', { note })}
        onLongPress={() => openActionsModal(note)}
      >
        <View style={styles.noteHeader}>
          <Text style={styles.noteTitle}>{note.title}</Text>
          <View style={styles.noteActions}>
            {/* Quick action buttons */}
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
          </View>
        </View>
        
        <Text style={styles.noteContent} numberOfLines={3}>
          {note.content}
        </Text>
        
        <View style={styles.noteFooter}>
          <View style={styles.tagsContainer}>
            {/* Category Badge */}
            {category && (
              <View style={[styles.categoryBadge, { backgroundColor: category.color }]}>
                <Text style={styles.categoryText}>{category.name}</Text>
              </View>
            )}
            
            {/* Permission Badge */}
            <View style={[
              styles.permissionBadge,
              note.permission === 'view_only' ? styles.publicBadge : styles.privateBadge
            ]}>
              <Text style={styles.permissionText}>
                {note.permission === 'view_only' ? '👁️ Public' : '🔒 Private'}
              </Text>
            </View>
            
            {/* Tags */}
            {note.tags?.map((tag, index) => (
              <Text key={`${note.id}_tag_${index}`} style={styles.tag}>{tag}</Text>
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
          {!note.categoryId && <Text style={styles.statusUncategorized}>📄 Uncategorized</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  // Enhanced Actions Modal Component
const ActionsModal = () => {
  if (!currentNote) return null;

  const currentCategory = currentNote.categoryId ? getCategoryById(currentNote.categoryId) : null;

  return (
    <Modal
      visible={actionsModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={closeActionsModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.actionsModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Note Actions</Text>
            <Text style={styles.modalSubtitle}>{currentNote.title}</Text>
            <TouchableOpacity onPress={closeActionsModal} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Quick Toggle Actions */}
            <View style={styles.actionSection}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActions}>
                <TouchableOpacity 
                  style={styles.quickAction}
                  onPress={() => {
                    handleTogglePin(currentNote.id);
                    closeActionsModal();
                  }}
                >
                  <Text style={styles.quickActionIcon}>
                    {currentNote.isPinned ? '📌' : '📍'}
                  </Text>
                  <Text style={styles.quickActionText}>
                    {currentNote.isPinned ? 'Unpin' : 'Pin'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.quickAction}
                  onPress={() => {
                    handleToggleFavorite(currentNote.id);
                    closeActionsModal();
                  }}
                >
                  <Text style={styles.quickActionIcon}>
                    {currentNote.isFavorite ? '⭐' : '☆'}
                  </Text>
                  <Text style={styles.quickActionText}>
                    {currentNote.isFavorite ? 'Remove Favorite' : 'Add Favorite'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.quickAction,
                    currentNote.permission !== 'view_only' && styles.quickActionDisabled
                  ]}
                  onPress={() => {
                    if (currentNote.permission === 'view_only') {
                      handleShareNote(currentNote);
                    }
                  }}
                  disabled={currentNote.permission !== 'view_only'}
                >
                  <Text style={[
                    styles.quickActionIcon,
                    currentNote.permission !== 'view_only' && styles.quickActionIconDisabled
                  ]}>
                    📤
                  </Text>
                  <Text style={[
                    styles.quickActionText,
                    currentNote.permission !== 'view_only' && styles.quickActionTextDisabled
                  ]}>
                    Share
                  </Text>
                </TouchableOpacity>
              </View>
              {currentNote.permission !== 'view_only' && (
                <Text style={styles.shareHint}>
                  Note must be Public to share
                </Text>
              )}
            </View>

            {/* Category Selection */}
            <View style={styles.actionSection}>
              <Text style={styles.sectionTitle}>Category</Text>
              <View style={styles.categoryGrid}>
                <TouchableOpacity 
                  style={[
                    styles.categoryOption,
                    !currentNote.categoryId && styles.categoryOptionSelected
                  ]}
                  onPress={() => {
                    handleUpdateCategory(currentNote.id, null);
                    closeActionsModal();
                  }}
                >
                  <Text style={styles.categoryOptionText}>📄 No Category</Text>
                </TouchableOpacity>
                
                {categories.map((category) => (
                  <TouchableOpacity 
                    key={category.id}
                    style={[
                      styles.categoryOption,
                      { backgroundColor: category.color + '20' },
                      currentNote.categoryId === category.id && styles.categoryOptionSelected
                    ]}
                    onPress={() => {
                      handleUpdateCategory(currentNote.id, category.id);
                      closeActionsModal();
                    }}
                  >
                    <Text style={[styles.categoryOptionText, { color: category.color }]}>
                      📁 {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Permission Selection */}
            <View style={styles.actionSection}>
              <Text style={styles.sectionTitle}>Visibility</Text>
              <View style={styles.permissionGrid}>
                <TouchableOpacity 
                  style={[
                    styles.permissionOption,
                    currentNote.permission === 'private' && styles.permissionOptionSelected
                  ]}
                  onPress={() => {
                    handleUpdatePermission(currentNote.id, 'private');
                    closeActionsModal();
                  }}
                >
                  <View style={styles.permissionOptionHeader}>
                    <Text style={styles.permissionOptionIcon}>🔒</Text>
                    <Text style={styles.permissionOptionText}>Private</Text>
                  </View>
                  <Text style={styles.permissionOptionDescription}>
                    Only you can see this note
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.permissionOption,
                    currentNote.permission === 'view_only' && styles.permissionOptionSelected
                  ]}
                  onPress={() => {
                    handleUpdatePermission(currentNote.id, 'view_only');
                    closeActionsModal();
                  }}
                >
                  <View style={styles.permissionOptionHeader}>
                    <Text style={styles.permissionOptionIcon}>👁️</Text>
                    <Text style={styles.permissionOptionText}>Public</Text>
                  </View>
                  <Text style={styles.permissionOptionDescription}>
                    Anyone can view this note
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Destructive Actions */}
            <View style={styles.actionSection}>
              <TouchableOpacity 
                style={styles.editAction}
                onPress={() => {
                  closeActionsModal();
                  navigation.navigate('NoteEditor', { note: currentNote });
                }}
              >
                <Text style={styles.editActionIcon}>✏️</Text>
                <Text style={styles.editActionText}>Full Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.destructiveAction}
                onPress={() => {
                  closeActionsModal();
                  handleDeleteNote(currentNote.id, currentNote.title);
                }}
              >
                <Text style={styles.destructiveActionIcon}>🗑️</Text>
                <Text style={styles.destructiveActionText}>Delete Note</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

  if (loading && notes.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading your notes...</Text>
      </View>
    );
  }

  const displayNotes = searchQuery ? filteredNotes : (filteredNotes.length > 0 ? filteredNotes : notes);

  // Get current category info for display
  const currentCategory = categoryId ? getCategoryById(categoryId) : null;

  return (
    <View style={styles.container}>
      {/* Filter and Search Header */}
      <View style={styles.filterHeader}>
        {/* Category Info Banner */}
        {currentCategory && (
          <View style={[styles.categoryBanner, { backgroundColor: currentCategory.color }]}>
            <Text style={styles.categoryBannerText}>
              📁 {currentCategory.name} • {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {(searchQuery || activeFilter !== 'all' || categoryId) && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Active Filter Indicator */}
        {activeFilter !== 'all' && !categoryId && (
          <View style={styles.filterIndicator}>
            <Text style={styles.filterText}>
              Showing: {activeFilter === 'pinned' ? '📌 Pinned' : 
                       activeFilter === 'favorites' ? '⭐ Favorites' :
                       activeFilter === 'uncategorized' ? '📄 Uncategorized' : 'All'} 
              ({filteredNotes.length} notes)
            </Text>
          </View>
        )}
      </View>

      {displayNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>
            {categoryId ? '📁' :
             activeFilter === 'pinned' ? '📌' : 
             activeFilter === 'favorites' ? '⭐' : 
             activeFilter === 'uncategorized' ? '📄' : '📝'}
          </Text>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching notes' : 
             categoryId ? `No notes in ${currentCategory?.name || 'this category'}` :
             activeFilter === 'pinned' ? 'No pinned notes' :
             activeFilter === 'favorites' ? 'No favorite notes' :
             activeFilter === 'uncategorized' ? 'No uncategorized notes' :
             'No notes yet'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery ? 'Try a different search term' :
             categoryId ? 'Add notes to this category to see them here' :
             activeFilter === 'pinned' ? 'Pin important notes to see them here' :
             activeFilter === 'favorites' ? 'Mark notes as favorites to see them here' :
             activeFilter === 'uncategorized' ? 'All your notes without categories will appear here' :
             'Create your first note by tapping the + button below!'}
          </Text>
          {(searchQuery || activeFilter !== 'all' || categoryId) && (
            <TouchableOpacity style={styles.clearAllButton} onPress={clearFilters}>
              <Text style={styles.clearAllButtonText}>Show All Notes</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayNotes}
          renderItem={({ item, index }) => <NoteCard note={item} />}
          keyExtractor={(item, index) => `${item.id}_${index}`}
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
          extraData={displayNotes.length}
        />
      )}

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('NoteEditor', { 
          note: null,
          initialCategoryId: categoryId 
        })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.chatButton}
        onPress={() => navigation.navigate('Chat')}
      >
        <Text style={styles.chatButtonText}>💬</Text>
      </TouchableOpacity>

      {/* Share Modal */}
      <ShareModal
        visible={shareModalVisible}
        onClose={closeShareModal}
        note={selectedNote}
        navigation={navigation}
      />

      {/* Enhanced Actions Modal */}
      <ActionsModal />
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
  categoryBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  categoryBannerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
    marginLeft: 8,
  },
  shareIcon: {
    fontSize: 16,
    opacity: 0.7,
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
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 5,
    marginBottom: 5,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  permissionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 5,
    marginBottom: 5,
  },
  publicBadge: {
    backgroundColor: '#dbeafe',
  },
  privateBadge: {
    backgroundColor: '#f3f4f6',
  },
  permissionText: {
    fontSize: 10,
    fontWeight: '600',
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
    flexWrap: 'wrap',
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
  statusUncategorized: {
    fontSize: 11,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
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
  // Enhanced Actions Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionsModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    position: 'relative',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    padding: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
    maxHeight: 500,
  },
  actionSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  quickAction: {
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    minWidth: 80,
  },
  quickActionDisabled: {
    backgroundColor: '#f1f5f9',
    opacity: 0.6,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionIconDisabled: {
    opacity: 0.5,
  },
  quickActionText: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
    fontWeight: '500',
  },
  quickActionTextDisabled: {
    color: '#94a3b8',
  },
  shareHint: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  categoryOptionSelected: {
    borderWidth: 2,
    borderColor: '#6366f1',
    backgroundColor: '#e0e7ff',
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  permissionGrid: {
    gap: 12,
  },
  permissionOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  permissionOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#e0e7ff',
  },
  permissionOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionOptionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  permissionOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  permissionOptionDescription: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  destructiveAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 12,
  },
  destructiveActionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  destructiveActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  editAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 12,
  },
  editActionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  editActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
  },
});

export default NotesScreen;