// src/screens/NotesScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useAuth } from '../context/AuthContext';
 
const NotesScreen = ({ navigation }) => {
  const { notes, createNote, updateNote, deleteNote, togglePin, searchNotes, loading } = useNotes();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Debug logs
  console.log('📱 NotesScreen rendering with notes:', notes.length);
  console.log('📱 Current user:', user);

  // FIXED: Use the synchronous search function
  const filteredNotes = searchQuery ? searchNotes(searchQuery) : notes;

  const NoteCard = ({ note }) => (
    <TouchableOpacity 
      style={styles.noteCard}
      onPress={() => navigation.navigate('NoteEditor', { note })}
    >
      <View style={styles.noteHeader}>
        <Text style={styles.noteTitle}>{note.title}</Text>
        <TouchableOpacity onPress={() => togglePin(note.id)}>
          <Text style={styles.pinIcon}>{note.isPinned ? '📌' : '📍'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.noteContent} numberOfLines={3}>
        {note.content}
      </Text>
      <View style={styles.tagsContainer}>
        {note.tags?.map((tag, index) => (
          <Text key={index} style={styles.tag}>{tag}</Text>
        ))}
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

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {notes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No notes yet</Text>
          <Text style={styles.emptyText}>
            Create your first note by tapping the + button below!
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
          renderItem={({ item }) => <NoteCard note={item} />}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.notesList}
        />
      )}

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('NoteEditor', { note: null })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchContainer: { padding: 15, backgroundColor: '#fff' },
  searchInput: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 10,
    fontSize: 16,
  },
  notesList: { padding: 15 },
  noteCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
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
    alignItems: 'center',
    marginBottom: 10,
  },
  noteTitle: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  pinIcon: { fontSize: 16 },
  noteContent: { color: '#666', lineHeight: 20 },
  tagsContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginTop: 10 
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
  },
  fabText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
  },
});

export default NotesScreen;