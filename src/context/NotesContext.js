// Update src/context/NotesContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { notesService } from '../services/notesService';
import NetInfo from '@react-native-community/netinfo';

const NotesContext = createContext();

export const NotesProvider = ({ children }) => {
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const { user } = useAuth();

  // Check online status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      console.log(online ? '🌐 App is online' : '📴 App is offline');
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, []);

  // Load notes and categories when user changes
  useEffect(() => {
    console.log('🔄 NotesContext: User changed', user ? user.uid : 'No user');
    
    const loadData = async () => {
      if (!user) {
        setNotes([]);
        setCategories([]);
        return;
      }

      setLoading(true);
      try {
        console.log('📚 Loading data for user:', user.uid);
        const [userNotes, userCategories] = await Promise.all([
          notesService.getUserNotes(user.uid),
          notesService.getUserCategories(user.uid)
        ]);
        
        console.log('✅ Data loaded:', {
          notes: userNotes.length,
          categories: userCategories.length
        });
        
        setNotes(userNotes);
        setCategories(userCategories);
      } catch (error) {
        console.error('❌ Error loading data:', error);
        setNotes([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Real-time subscription to user notes
  useEffect(() => {
    if (!user) return;

    console.log('🎯 Setting up real-time listener for user:', user.uid);
    
    const unsubscribe = notesService.subscribeToUserNotes(user.uid, (userNotes) => {
      console.log('🔥 Real-time update - notes:', userNotes.length);
      setNotes(userNotes);
    });

    return unsubscribe;
  }, [user]);

  // Note operations
  const createNote = async (noteData, categoryId = null) => {
    if (!user) throw new Error('User must be logged in');
    
    setLoading(true);
    try {
      console.log('💾 Creating note with category:', categoryId);
      const newNote = await notesService.createNote(noteData, user.uid, categoryId);
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
      console.log('📝 Updating note:', id);
      await notesService.updateNote(id, updates);
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
    } catch (error) {
      console.error('❌ Error deleting note:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Category operations
  const createCategory = async (categoryData) => {
    if (!user) throw new Error('User must be logged in');
    
    setLoading(true);
    try {
      console.log('📁 Creating category:', categoryData.name);
      const newCategory = await notesService.createCategory(categoryData, user.uid);
      
      // Update local state
      setCategories(prev => [...prev, newCategory]);
      return newCategory;
    } catch (error) {
      console.error('❌ Error creating category:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = async (id, updates) => {
    setLoading(true);
    try {
      console.log('✏️ Updating category:', id);
      await notesService.updateCategory(id, updates);
      
      // Update local state
      setCategories(prev => prev.map(cat => 
        cat.id === id ? { ...cat, ...updates } : cat
      ));
    } catch (error) {
      console.error('❌ Error updating category:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id) => {
    setLoading(true);
    try {
      console.log('🗑️ Deleting category:', id);
      await notesService.deleteCategory(id);
      
      // Update local state
      setCategories(prev => prev.filter(cat => cat.id !== id));
    } catch (error) {
      console.error('❌ Error deleting category:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Getters
  const getPinnedNotes = () => notes.filter(note => note.isPinned);
  const getFavoriteNotes = () => notes.filter(note => note.isFavorite);
  const getNotesByCategory = (categoryId) => notes.filter(note => note.categoryId === categoryId);
  const getUncategorizedNotes = () => notes.filter(note => !note.categoryId);
  
  const getCategoryById = (categoryId) => 
    categories.find(cat => cat.id === categoryId);

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
      // Notes
      notes,
      pinnedNotes: getPinnedNotes(),
      favorites: getFavoriteNotes(),
      uncategorizedNotes: getUncategorizedNotes(),
      
      // Categories
      categories,
      
      // State
      loading,
      isOnline,
      
      // Note operations
      createNote,
      updateNote,
      deleteNote,
      togglePin: (id) => {
        const note = notes.find(note => note.id === id);
        if (note) notesService.togglePin(id, note.isPinned);
      },
      toggleFavorite: (id) => {
        const note = notes.find(note => note.id === id);
        if (note) notesService.toggleFavorite(id, note.isFavorite);
      },
      
      // Category operations
      createCategory,
      updateCategory,
      deleteCategory,
      getNotesByCategory,
      getCategoryById,
      
      // Utilities
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