// src/screens/NoteEditorScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNotes } from '../context/NotesContext';

const NoteEditorScreen = ({ route, navigation }) => {
  const { note: existingNote } = route.params || {};
  const { createNote, updateNote } = useNotes();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (existingNote) {
      setTitle(existingNote.title);
      setContent(existingNote.content);
      setTags(existingNote.tags?.join(', ') || '');
    }
  }, [existingNote]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    const noteData = {
      title: title.trim(),
      content: content.trim(),
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
    };

    try {
      if (existingNote) {
        await updateNote(existingNote.id, noteData);
      } else {
        await createNote(noteData);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save note');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {existingNote ? 'Edit Note' : 'New Note'}
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveButton}>Save</Text>
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
        />
        
        <TextInput
          style={styles.contentInput}
          placeholder="Start writing your thoughts..."
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          placeholderTextColor="#999"
        />

        <TextInput
          style={styles.tagsInput}
          placeholder="Tags (comma separated)"
          value={tags}
          onChangeText={setTags}
          placeholderTextColor="#999"
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cancelButton: { color: '#6366f1', fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  saveButton: { color: '#6366f1', fontSize: 16, fontWeight: 'bold' },
  editor: { flex: 1, padding: 15 },
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    minHeight: 200,
  },
  tagsInput: {
    fontSize: 14,
    color: '#666',
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
});

export default NoteEditorScreen;