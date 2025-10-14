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
    if (!user) {
      setNotes([]);
      return;
    }

    const unsubscribe = notesService.subscribeToUserNotes(user.uid, (userNotes) => {
      setNotes(userNotes);
    });

    return unsubscribe;
  }, [user]);

  const createNote = async (noteData) => {
    if (!user) throw new Error('User must be logged in');
    
    setLoading(true);
    try {
      const newNote = await notesService.createNote(noteData, user.uid);
      return newNote;
    } finally {
      setLoading(false);
    }
  };

  const updateNote = async (id, updates) => {
    setLoading(true);
    try {
      await notesService.updateNote(id, updates);
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = async (id) => {
    setLoading(true);
    try {
      await notesService.deleteNote(id);
    } finally {
      setLoading(false);
    }
  };

  const togglePin = async (id) => {
    const note = notes.find(note => note.id === id);
    if (note) {
      await updateNote(id, { isPinned: !note.isPinned });
    }
  };

  const toggleFavorite = async (id) => {
    const note = notes.find(note => note.id === id);
    if (note) {
      await updateNote(id, { isFavorite: !note.isFavorite });
    }
  };

  const searchNotes = async (query) => {
    if (!user) return [];
    
    setLoading(true);
    try {
      return await notesService.searchNotes(user.uid, query);
    } finally {
      setLoading(false);
    }
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