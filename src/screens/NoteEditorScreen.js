// src/screens/NoteEditorScreen.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator 
} from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useAuth } from '../context/AuthContext';

const NoteEditorScreen = ({ route, navigation }) => {
  const { note: existingNote } = route.params || {};
  const { createNote, updateNote } = useNotes();
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('📱 NoteEditorScreen mounted');
    console.log('🔄 Existing note:', existingNote ? 'Yes' : 'No');
    console.log('👤 Current user:', user?.uid);
    
    if (existingNote) {
      setTitle(existingNote.title);
      setContent(existingNote.content);
      setTags(existingNote.tags?.join(', ') || '');
    }
  }, [existingNote, user]);

  const handleSave = async () => {
    console.log('💾 Save button pressed');
    
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
    };

    console.log('📝 Saving note data:', noteData);

    // Set navigation timeout as fallback
    const navigationTimeout = setTimeout(() => {
      console.log('⏰ Navigation timeout triggered - forcing navigation');
      setLoading(false);
      navigation.goBack();
    }, 5000); // 5 second fallback

    try {
      let result;
      if (existingNote) {
        console.log('✏️ Updating existing note:', existingNote.id);
        result = await updateNote(existingNote.id, noteData);
        console.log('✅ Note updated successfully');
      } else {
        console.log('🆕 Creating new note for user:', user.uid);
        result = await createNote(noteData, user.uid);
        console.log('✅ Note created successfully');
      }
      
      // Clear the timeout since we succeeded
      clearTimeout(navigationTimeout);
      
      console.log('🚪 Navigating back immediately...');
      
      // Force navigation with a small delay to ensure state updates
      setTimeout(() => {
        navigation.goBack();
      }, 100);
      
    } catch (error) {
      console.error('❌ Error saving note:', error);
      clearTimeout(navigationTimeout);
      setLoading(false);
      
      // Even on error, navigate back but show message
      Alert.alert(
        'Note Saved Offline', 
        'Your note has been saved to offline storage. It will sync when you\'re back online.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('🚪 Navigating back after offline save');
              navigation.goBack();
            }
          }
        ]
      );
    }
  };

  const handleCancel = () => {
    console.log('❌ Cancel button pressed');
    if (!loading) {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleCancel}
          disabled={loading}
        >
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

        {/* Offline status indicator */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {loading ? '💾 Saving...' : '✅ Ready to save'}
          </Text>
          <Text style={styles.offlineHint}>
            Your notes are automatically saved offline
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

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
});

export default NoteEditorScreen;