// src/context/NotesContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { notesService } from '../services/notesService';

const NotesContext = createContext();

export const NotesProvider = ({ children }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Real-time subscription to user notes
  useEffect(() => {
    console.log('🔄 NotesContext: User changed', user ? user.uid : 'No user');
    
    if (!user) {
      console.log('❌ No user, clearing notes');
      setNotes([]);
      return;
    }

    console.log('🔥 Setting up Firebase listener for user:', user.uid);
    
    const unsubscribe = notesService.subscribeToUserNotes(user.uid, (userNotes) => {
      console.log('✅ Firebase returned notes:', userNotes.length, 'notes');
      setNotes(userNotes);
    });

    return unsubscribe;
  }, [user]);

  const createNote = async (noteData) => {
    if (!user) throw new Error('User must be logged in');
    
    setLoading(true);
    try {
      console.log('💾 Creating note:', noteData);
      const newNote = await notesService.createNote(noteData, user.uid);
      console.log('✅ Note created successfully:', newNote);
      return newNote;
    } catch (error) {
      console.error('❌ Error creating note:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateNote = async (id, updates) => {
    setLoading(true);
    try {
      console.log('📝 Updating note:', id, updates);
      await notesService.updateNote(id, updates);
      console.log('✅ Note updated successfully');
    } catch (error) {
      console.error('❌ Error updating note:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = async (id) => {
    setLoading(true);
    try {
      console.log('🗑️ Deleting note:', id);
      await notesService.deleteNote(id);
      console.log('✅ Note deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting note:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const togglePin = async (id) => {
    const note = notes.find(note => note.id === id);
    if (note) {
      console.log('📌 Toggling pin for note:', id, 'Current:', note.isPinned);
      await updateNote(id, { isPinned: !note.isPinned });
    }
  };

  const toggleFavorite = async (id) => {
    const note = notes.find(note => note.id === id);
    if (note) {
      console.log('⭐ Toggling favorite for note:', id, 'Current:', note.isFavorite);
      await updateNote(id, { isFavorite: !note.isFavorite });
    }
  };

  // FIXED: Search function that doesn't cause state updates during render
  const searchNotes = (query) => {
    if (!user || !query.trim()) return notes;
    
    console.log('🔍 Searching notes for:', query);
    return notes.filter(note =>
      note.title.toLowerCase().includes(query.toLowerCase()) ||
      note.content.toLowerCase().includes(query.toLowerCase()) ||
      (note.tags && note.tags.some(tag => 
        tag.toLowerCase().includes(query.toLowerCase())
      ))
    );
  };

  const getPinnedNotes = () => notes.filter(note => note.isPinned);
  const getFavoriteNotes = () => notes.filter(note => note.isFavorite);

  return (
    <NotesContext.Provider value={{
      notes,
      pinnedNotes: getPinnedNotes(),
      favorites: getFavoriteNotes(),
      loading,
      createNote,
      updateNote,
      deleteNote,
      togglePin,
      toggleFavorite,
      searchNotes,
    }}>
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => useContext(NotesContext);