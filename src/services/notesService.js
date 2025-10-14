// src/services/notesService.js
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { firestore } from '../config/firebase';

export const notesService = {
  // Create new note
  async createNote(noteData, userId) {
    try {
      const noteWithMetadata = {
        ...noteData,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPinned: false,
        isFavorite: false,
        tags: noteData.tags || [],
        permission: 'private'
      };

      const docRef = await addDoc(collection(firestore, 'notes'), noteWithMetadata);
      return { id: docRef.id, ...noteWithMetadata };
    } catch (error) {
      throw new Error('Failed to create note: ' + error.message);
    }
  },

  // Update existing note
  async updateNote(noteId, updates) {
    try {
      const noteRef = doc(firestore, 'notes', noteId);
      await updateDoc(noteRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      throw new Error('Failed to update note: ' + error.message);
    }
  },

  // Delete note
  async deleteNote(noteId) {
    try {
      await deleteDoc(doc(firestore, 'notes', noteId));
    } catch (error) {
      throw new Error('Failed to delete note: ' + error.message);
    }
  },

  // Get all notes for user
  async getUserNotes(userId) {
    try {
      const q = query(
        collection(firestore, 'notes'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      throw new Error('Failed to fetch notes: ' + error.message);
    }
  },

  // Real-time notes listener
  subscribeToUserNotes(userId, callback) {
    const q = query(
      collection(firestore, 'notes'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(notes);
    });
  },

  // Search notes
  async searchNotes(userId, searchTerm) {
    try {
      const allNotes = await this.getUserNotes(userId);
      return allNotes.filter(note =>
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } catch (error) {
      throw new Error('Search failed: ' + error.message);
    }
  }
};