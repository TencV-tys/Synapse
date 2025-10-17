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
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const notes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort locally temporarily
      return notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      throw new Error('Failed to fetch notes: ' + error.message);
    }
  },

  // Real-time notes listener (TEMPORARY - without orderBy)
  subscribeToUserNotes(userId, callback) {
    console.log('🎯 Setting up Firestore query for user:', userId);
    
    try {
      // Temporary: Remove orderBy while index is building
      const q = query(
        collection(firestore, 'notes'),
        where('userId', '==', userId)
        // orderBy('updatedAt', 'desc') // Add this back after index is built
      );

      return onSnapshot(q, (snapshot) => {
        console.log('🔥 Firestore snapshot - docs found:', snapshot.docs.length);
        const notes = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('📄 Document data:', { id: doc.id, ...data });
          return {
            id: doc.id,
            ...data
          };
        });
        
        // Sort locally temporarily
        const sortedNotes = notes.sort((a, b) => 
          new Date(b.updatedAt) - new Date(a.updatedAt)
        );
        
        callback(sortedNotes);
      }, (error) => {
        console.error('❌ Firestore snapshot error:', error);
      });
    } catch (error) {
      console.error('❌ Error setting up Firestore query:', error);
    }
  },

  // Search notes
  async searchNotes(userId, searchTerm) {
    try {
      const allNotes = await this.getUserNotes(userId);
      return allNotes.filter(note =>
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (note.tags && note.tags.some(tag => 
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
    } catch (error) {
      throw new Error('Search failed: ' + error.message);
    }
  }
};