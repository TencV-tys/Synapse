// src/context/NotesContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { notesService } from '../services/notesService';
import NetInfo from '@react-native-community/netinfo';

const NotesContext = createContext();

export const NotesProvider = ({ children }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const { user } = useAuth();

  // Check online status using NetInfo
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      console.log(online ? '🌐 App is online' : '📴 App is offline');
      setIsOnline(online);
    });

    return () => unsubscribe();
  }, []);

  // Load notes when user changes
  useEffect(() => {
    console.log('🔄 NotesContext: User changed', user ? user.uid : 'No user');
    
    const loadNotes = async () => {
      if (!user) {
        console.log('❌ No user, clearing notes');
        setNotes([]);
        return;
      }

      setLoading(true);
      try {
        console.log('📚 Loading notes for user:', user.uid);
        const userNotes = await notesService.getUserNotes(user.uid);
        console.log('✅ Notes loaded successfully:', userNotes.length, 'notes');
        setNotes(userNotes);
      } catch (error) {
        console.error('❌ Error loading notes:', error);
        setNotes([]);
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [user]);

  // Real-time subscription to user notes
  useEffect(() => {
    if (!user) {
      console.log('❌ No user, skipping real-time listener');
      return;
    }

    console.log('🎯 Setting up real-time listener for user:', user.uid);
    
    const unsubscribe = notesService.subscribeToUserNotes(user.uid, (userNotes) => {
      console.log('🔥 Real-time update - notes:', userNotes.length);
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
      await notesService.togglePin(id, note.isPinned);
    }
  };

  const toggleFavorite = async (id) => {
    const note = notes.find(note => note.id === id);
    if (note) {
      console.log('⭐ Toggling favorite for note:', id, 'Current:', note.isFavorite);
      await notesService.toggleFavorite(id, note.isFavorite);
    }
  };

  const searchNotes = (query) => {
    if (!user || !query.trim()) return notes;
    
    console.log('🔍 Searching notes for:', query);
    return notes.filter(note =>
      note.title?.toLowerCase().includes(query.toLowerCase()) ||
      note.content?.toLowerCase().includes(query.toLowerCase()) ||
      (note.tags && note.tags.some(tag => 
        tag.toLowerCase().includes(query.toLowerCase())
      ))
    );
  };

  const getPinnedNotes = () => notes.filter(note => note.isPinned);
  const getFavoriteNotes = () => notes.filter(note => note.isFavorite);

  const syncPendingChanges = async () => {
    try {
      console.log('🔄 Syncing pending changes...');
      await notesService.syncPendingChanges();
      console.log('✅ Sync completed');
    } catch (error) {
      console.error('❌ Error during sync:', error);
    }
  };

  const getNoteStats = async () => {
    if (!user) return null;
    return await notesService.getNoteStats(user.uid);
  };

  return (
    <NotesContext.Provider value={{
      notes,
      pinnedNotes: getPinnedNotes(),
      favorites: getFavoriteNotes(),
      loading,
      isOnline,
      createNote,
      updateNote,
      deleteNote,
      togglePin,
      toggleFavorite,
      searchNotes,
      syncPendingChanges,
      getNoteStats,
    }}>
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}; 