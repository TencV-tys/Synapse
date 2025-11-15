// src/context/NotesContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert } from 'react-native';
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
      
      // Sync when coming back online
      if (online) {
        syncPendingChanges();
      }
    });
    return () => unsubscribe();
  }, []);

  // Load notes and categories when user changes
  useEffect(() => {
    console.log('🔄 NotesContext: User changed', user ? user.uid : 'No user');
    // In your NotesContext.js, update the loadData function:
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
    
    // 🆕 Initialize default categories if none exist
    let finalCategories = userCategories;
    if (userCategories.length === 0) {
      console.log('🆕 No categories found, initializing default categories...');
      finalCategories = await notesService.initializeDefaultCategories(user.uid);
    }
    
    setNotes(userNotes);
    setCategories(finalCategories);
    
  } catch (error) {
    console.error('❌ Error loading data:', error);
    setNotes([]);
    setCategories([]);
  } finally {
    setLoading(false);
  }
};
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
      
      // Update local state
      setNotes(prev => [newNote, ...prev]);
      
      // Update category count if category was assigned
      if (categoryId) {
        await notesService.updateCategoryNoteCount(categoryId, user.uid);
        refreshCategories();
      }
      
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
      
      // Update local state
      setNotes(prev => prev.map(note => 
        note.id === id ? { ...note, ...updates, updatedAt: new Date().toISOString() } : note
      ));
      
      // Handle category changes
      if (updates.categoryId !== undefined) {
        refreshCategories();
      }
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
      
      // Get note before deletion to handle category count
      const noteToDelete = notes.find(note => note.id === id);
      const categoryId = noteToDelete?.categoryId;
      
      await notesService.deleteNote(id);
      
      // Update local state
      setNotes(prev => prev.filter(note => note.id !== id));
      
      // Update category count if note had a category
      if (categoryId && user) {
        await notesService.updateCategoryNoteCount(categoryId, user.uid);
        refreshCategories();
      }
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
        cat.id === id ? { ...cat, ...updates, updatedAt: new Date().toISOString() } : cat
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
      await notesService.deleteCategory(id, user.uid);
      
      // Update local state
      setCategories(prev => prev.filter(cat => cat.id !== id));
    } catch (error) {
      console.error('❌ Error deleting category:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Refresh categories data
  const refreshCategories = async () => {
    if (!user) return;
    
    try {
      const userCategories = await notesService.getUserCategories(user.uid);
      setCategories(userCategories);
    } catch (error) {
      console.error('❌ Error refreshing categories:', error);
    }
  };

  // Refresh all data
  const refreshData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      console.log('🔄 Manual refresh triggered');
      const [userNotes, userCategories] = await Promise.all([
        notesService.getUserNotes(user.uid),
        notesService.getUserCategories(user.uid)
      ]);
      
      setNotes(userNotes);
      setCategories(userCategories);
      console.log('✅ Data refreshed:', { notes: userNotes.length, categories: userCategories.length });
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Share and Permission operations
  const shareNote = async (noteId) => {
    if (!isOnline) {
      Alert.alert('Offline', 'You need to be online to share notes');
      return null;
    }

    try {
      const note = notes.find(note => note.id === noteId);
      if (!note) {
        Alert.alert('Error', 'Note not found');
        return null;
      }

      const shareContent = {
        title: `Check out this note: ${note.title}`,
        message: `${note.content}\n\n— Shared from Synapse Notes`,
        url: `https://synapse.com/notes/${noteId}`,
      };

      console.log('📤 Sharing note:', note.title);
      return shareContent;
    } catch (error) {
      console.error('❌ Error sharing note:', error);
      Alert.alert('Error', 'Failed to share note');
      return null;
    }
  };

  const updateNotePermissions = async (noteId, permission) => {
    try {
      console.log('🔒 Updating note permissions:', noteId, permission);
      await updateNote(noteId, { permission });
    } catch (error) {
      console.error('❌ Error updating permissions:', error);
      throw error;
    }
  };

  const getSharedNote = async (noteId) => {
    try {
      return await notesService.getNoteById(noteId);
    } catch (error) {
      console.error('❌ Error getting shared note:', error);
      return null;
    }
  };

  // Sync operations
  const syncPendingChanges = async () => {
    try {
      console.log('🔄 Syncing pending changes...');
      await notesService.syncPendingChanges();
      console.log('✅ Sync completed');
      
      // Refresh data after sync
      refreshData();
    } catch (error) {
      console.error('❌ Error during sync:', error);
    }
  };

  // Toggle operations
  const togglePin = async (id) => {
    const note = notes.find(note => note.id === id);
    if (note) {
      try {
        await notesService.togglePin(id, note.isPinned);
        
        // Update local state immediately for better UX
        setNotes(prev => prev.map(n => 
          n.id === id ? { ...n, isPinned: !n.isPinned } : n
        ));
      } catch (error) {
        console.error('❌ Error toggling pin:', error);
        throw error;
      }
    }
  };

  const toggleFavorite = async (id) => {
    const note = notes.find(note => note.id === id);
    if (note) {
      try {
        await notesService.toggleFavorite(id, note.isFavorite);
        
        // Update local state immediately for better UX
        setNotes(prev => prev.map(n => 
          n.id === id ? { ...n, isFavorite: !n.isFavorite } : n
        ));
      } catch (error) {
        console.error('❌ Error toggling favorite:', error);
        throw error;
      }
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
      togglePin,
      toggleFavorite,
      
      // Category operations
      createCategory,
      updateCategory,
      deleteCategory,
      getNotesByCategory,
      getCategoryById,
      
      // Share and Permission operations
      shareNote,
      updateNotePermissions,
      getSharedNote,
      
      // Utilities
      searchNotes,
      syncPendingChanges,
      refreshData,
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