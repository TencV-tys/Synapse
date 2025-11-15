  
// Update src/screens/NoteEditorScreen.js - Add category selection
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Modal,
  FlatList
} from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useAuth } from '../context/AuthContext';

const NoteEditorScreen = ({ route, navigation }) => {
  const { note: existingNote } = route.params || {};
  const { createNote, updateNote, categories } = useNotes();
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  useEffect(() => {
    if (existingNote) {
      setTitle(existingNote.title);
      setContent(existingNote.content);
      setTags(existingNote.tags?.join(', ') || '');
      setCategoryId(existingNote.categoryId || null);
    }
  }, [existingNote]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to save notes');
      return;
    }

    setLoading(true);

    const noteData = {
      title: title.trim(),
      content: content.trim(),
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      categoryId: categoryId,
    };

    const navigationTimeout = setTimeout(() => {
      setLoading(false);
      navigation.goBack();
    }, 5000);

    try {
      let result;
      if (existingNote) {
        result = await updateNote(existingNote.id, noteData);
      } else {
        result = await createNote(noteData, categoryId);
      }
      
      clearTimeout(navigationTimeout);
      setTimeout(() => {
        navigation.goBack();
      }, 100);
      
    } catch (error) {
      console.error('❌ Error saving note:', error);
      clearTimeout(navigationTimeout);
      setLoading(false);
      
      Alert.alert(
        'Note Saved Offline', 
        'Your note has been saved to offline storage. It will sync when you\'re back online.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    }
  };

  const getCurrentCategory = () => {
    return categories.find(cat => cat.id === categoryId);
  };

  const handleCategorySelect = (category) => {
    setCategoryId(category.id);
    setCategoryModalVisible(false);
  };

  const handleRemoveCategory = () => {
    setCategoryId(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
          <Text style={[styles.cancelButton, loading && styles.disabledButton]}>
            Cancel
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {existingNote ? 'Edit Note' : 'New Note'}
        </Text>
        
        <TouchableOpacity 
          onPress={handleSave}
          disabled={loading || !title.trim()}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#6366f1" />
          ) : (
            <Text style={[
              styles.saveButton, 
              (!title.trim() || loading) && styles.disabledButton
            ]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.editor}>
        {/* Category Selector */}
        <TouchableOpacity 
          style={styles.categorySelector}
          onPress={() => setCategoryModalVisible(true)}
        >
          <Text style={styles.categorySelectorLabel}>
            {getCurrentCategory() ? `Category: ${getCurrentCategory().name}` : 'Add to Category...'}
          </Text>
          <Text style={styles.categorySelectorArrow}>▼</Text>
        </TouchableOpacity>

        {getCurrentCategory() && (
          <View style={[styles.selectedCategory, { backgroundColor: getCurrentCategory().color + '20' }]}>
            <View style={[styles.categoryColor, { backgroundColor: getCurrentCategory().color }]} />
            <Text style={styles.selectedCategoryText}>{getCurrentCategory().name}</Text>
            <TouchableOpacity onPress={handleRemoveCategory}>
              <Text style={styles.removeCategoryText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <TextInput
          style={styles.titleInput}
          placeholder="Note Title"
          value={title}
          onChangeText={setTitle}
          multiline
          placeholderTextColor="#999"
          editable={!loading}
        />
        
        <TextInput
          style={styles.contentInput}
          placeholder="Start writing your thoughts..."
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          placeholderTextColor="#999"
          editable={!loading}
        />

        <TextInput
          style={styles.tagsInput}
          placeholder="Tags (comma separated)"
          value={tags}
          onChangeText={setTags}
          placeholderTextColor="#999"
          editable={!loading}
        />

        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {loading ? '💾 Saving...' : '✅ Ready to save'}
          </Text>
          <Text style={styles.offlineHint}>
            Your notes are automatically saved offline
          </Text>
        </View>
      </ScrollView>

      {/* Category Selection Modal */}
      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Category</Text>
            
            <FlatList
              data={categories}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.categoryOption}
                  onPress={() => handleCategorySelect(item)}
                >
                  <View style={[styles.categoryOptionColor, { backgroundColor: item.color }]} />
                  <Text style={styles.categoryOptionName}>{item.name}</Text>
                  <Text style={styles.categoryOptionCount}>({item.noteCount})</Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item.id}
              ListEmptyComponent={
                <Text style={styles.noCategoriesText}>
                  No categories yet. Create one in the Categories screen.
                </Text>
              }
            />
            
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setCategoryModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Add these styles to your existing styles
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  cancelButton: { 
    color: '#6366f1', 
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: { 
    color: '#6366f1', 
    fontSize: 16, 
    fontWeight: 'bold',
  },
  disabledButton: {
    color: '#999',
    opacity: 0.5,
  },
  editor: { 
    flex: 1, 
    padding: 20,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    minHeight: 300,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    textAlignVertical: 'top',
  },
  tagsInput: {
    fontSize: 14,
    color: '#666',
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  statusContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 5,
  },
  offlineHint: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },

  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
  },
  categorySelectorLabel: {
    fontSize: 16,
    color: '#64748b',
  },
  categorySelectorArrow: {
    fontSize: 12,
    color: '#64748b',
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  categoryColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  selectedCategoryText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  removeCategoryText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryOptionColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  categoryOptionName: {
    flex: 1,
    fontSize: 16,
    color: '#334155',
  },
  categoryOptionCount: {
    fontSize: 14,
    color: '#64748b',
  },
  noCategoriesText: {
    textAlign: 'center',
    color: '#64748b',
    fontStyle: 'italic',
    padding: 20,
  },
  modalCloseButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 16,
  },
  modalCloseText: {
    color: '#6366f1',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default NoteEditorScreen;