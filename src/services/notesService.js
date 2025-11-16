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
  onSnapshot,
  getDoc
} from 'firebase/firestore';
import { firestore } from '../config/firebase';
import sqliteService from './sqliteService';

export const notesService = {
  // ========== NOTE OPERATIONS ==========
  
  // Create new note with full offline support
  async createNote(noteData, userId, categoryId = null) {
    try {
      const noteWithMetadata = {
        ...noteData,
        userId,
        categoryId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPinned: Boolean(noteData.isPinned || false),
        isFavorite: Boolean(noteData.isFavorite || false),
        tags: noteData.tags || [],
        permission: noteData.permission || 'private',
        syncStatus: 'synced'
      };

      console.log('📝 Creating note with category:', categoryId);

      let docRef;
      let finalNoteId;
      
      // Try Firebase first (when online)
      try {
        docRef = await addDoc(collection(firestore, 'notes'), noteWithMetadata);
        finalNoteId = docRef.id;
        noteWithMetadata.id = finalNoteId;
        console.log('✅ Note created in Firebase:', finalNoteId);
      } catch (firebaseError) {
        console.log('🌐 Offline - creating local note only');
        finalNoteId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        noteWithMetadata.id = finalNoteId;
        noteWithMetadata.syncStatus = 'pending';
        
        // Add to sync queue for when we're back online
        await sqliteService.markNoteForSync(finalNoteId, 'CREATE', noteWithMetadata);
      }

      // Update category note count if category is specified
      if (categoryId) {
        await this.updateCategoryNoteCount(categoryId, userId);
      }

      // Always save to SQLite (both online and offline)
      await sqliteService.saveNote(noteWithMetadata);
      console.log('💾 Note saved to local storage:', noteWithMetadata.title);
      
      return { id: finalNoteId, ...noteWithMetadata };
      
    } catch (error) {
      console.error('❌ Error creating note:', error);
      throw new Error('Failed to create note: ' + error.message);
    }
  },

  // Update existing note with offline support
  async updateNote(noteId, updates) {
    try {
      // FIXED: Ensure boolean values are properly set
      const updatedNote = {
        ...updates,
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced'
      };

      // Ensure boolean fields are explicitly set
      if (updates.isPinned !== undefined) {
        updatedNote.isPinned = Boolean(updates.isPinned);
      }
      if (updates.isFavorite !== undefined) {
        updatedNote.isFavorite = Boolean(updates.isFavorite);
      }

      console.log('✏️ Updating note:', noteId, 'Updates:', updatedNote);

      // Get current note to check for category changes
      const currentNote = await this.getNoteById(noteId);
      const oldCategoryId = currentNote?.categoryId;
      const newCategoryId = updates.categoryId;

      // Try Firebase first
      try {
        const noteRef = doc(firestore, 'notes', noteId);
        await updateDoc(noteRef, updatedNote);
        console.log('✅ Note updated in Firebase:', noteId);
      } catch (firebaseError) {
        console.log('🌐 Offline - updating local note only');
        updatedNote.syncStatus = 'pending';
        
        // Add to sync queue
        await sqliteService.markNoteForSync(noteId, 'UPDATE', updatedNote);
      }

      // Update category counts if category changed
      if (oldCategoryId !== newCategoryId) {
        if (oldCategoryId) {
          await this.updateCategoryNoteCount(oldCategoryId, currentNote.userId);
        }
        if (newCategoryId) {
          await this.updateCategoryNoteCount(newCategoryId, currentNote.userId);
        }
      }

      // Update SQLite - FIXED: Ensure we merge properly
      const currentNoteData = await sqliteService.getNoteById(noteId);
      if (currentNoteData) {
        const mergedNote = {
          ...currentNoteData,
          ...updatedNote,
          id: noteId
        };
        await sqliteService.saveNote(mergedNote);
        console.log('💾 Note updated in local storage:', mergedNote.title, 'isFavorite:', mergedNote.isFavorite);
      }
      
    } catch (error) {
      console.error('❌ Error updating note:', error);
      throw new Error('Failed to update note: ' + error.message);
    }
  },
  
  // Delete note with offline support
  async deleteNote(noteId) {
    try {
      console.log('🗑️ Deleting note:', noteId);

      // Get note first to handle category count
      const note = await this.getNoteById(noteId);
      const categoryId = note?.categoryId;
      const userId = note?.userId;

      // Try Firebase first
      try {
        await deleteDoc(doc(firestore, 'notes', noteId));
        console.log('✅ Note deleted from Firebase:', noteId);
      } catch (firebaseError) {
        console.log('🌐 Offline - marking for deletion locally');
        await sqliteService.markNoteForSync(noteId, 'DELETE', { id: noteId });
      }

      // Always delete from SQLite
      await sqliteService.deleteNote(noteId);
      console.log('🗑️ Note deleted from local storage');

      // Update category count if note had a category
      if (categoryId && userId) {
        await this.updateCategoryNoteCount(categoryId, userId);
      }
      
    } catch (error) {
      console.error('❌ Error deleting note:', error);
      throw new Error('Failed to delete note: ' + error.message);
    }
  },

  // Toggle pin status
  async togglePin(noteId, currentStatus) {
    try {
      await this.updateNote(noteId, { isPinned: !currentStatus });
      console.log('📌 Pin toggled for note:', noteId, !currentStatus);
    } catch (error) {
      console.error('❌ Error toggling pin:', error);
      throw error;
    }
  },

  // Toggle favorite status - FIXED VERSION
  async toggleFavorite(noteId, currentStatus) {
    try {
      console.log('⭐ Toggling favorite for note:', noteId, 'Current status:', currentStatus);
      
      // FIXED: Get the current note first to ensure we have the latest data
      const currentNote = await this.getNoteById(noteId);
      if (!currentNote) {
        throw new Error('Note not found');
      }
      
      const newFavoriteStatus = !currentNote.isFavorite;
      console.log('⭐ New favorite status will be:', newFavoriteStatus);
      
      // Use updateNote to toggle the favorite status
      await this.updateNote(noteId, { 
        isFavorite: newFavoriteStatus,
        updatedAt: new Date().toISOString()
      });
      
      console.log('✅ Favorite status updated to:', newFavoriteStatus);
      return newFavoriteStatus;
    } catch (error) {
      console.error('❌ Error toggling favorite:', error);
      throw error;
    }
  },

  // Get all notes for user with offline fallback - FIXED VERSION
  async getUserNotes(userId) {
    try {
      let notes = [];
      let source = 'Firebase';
      
      // Try Firebase first
      try {
        const q = query(
          collection(firestore, 'notes'),
          where('userId', '==', userId)
        );
        
        const querySnapshot = await getDocs(q);
        notes = querySnapshot.docs.map(doc => {
          const data = doc.data();
          // FIXED: Ensure boolean conversion from Firebase data
          return {
            id: doc.id,
            ...data,
            isPinned: Boolean(data.isPinned),
            isFavorite: Boolean(data.isFavorite),
            syncStatus: 'synced'
          };
        });
        
        console.log('✅ Notes loaded from Firebase:', notes.length);
        
        // Save all notes to SQLite for offline access
        const savePromises = notes.map(note => 
          sqliteService.saveNote(note).catch(e => 
            console.log('⚠️ Failed to save note to SQLite:', note.id)
          )
        );
        await Promise.all(savePromises);
        
      } catch (firebaseError) {
        console.log('🌐 Offline - loading notes from local storage');
        source = 'SQLite';
        notes = await sqliteService.getNotes(userId);
        
        // FIXED: Ensure boolean conversion from SQLite data
        notes = notes.map(note => ({
          ...note,
          isPinned: Boolean(note.isPinned),
          isFavorite: Boolean(note.isFavorite)
        }));
      }
      
      // Sort by most recent first
      const sortedNotes = notes.sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      
      console.log(`📚 Loaded ${sortedNotes.length} notes from ${source}`);
      return sortedNotes;
      
    } catch (error) {
      console.error('❌ Error fetching notes:', error);
      return [];
    }
  },

  // Get pinned notes only
  async getPinnedNotes(userId) {
    try {
      const allNotes = await this.getUserNotes(userId);
      const pinnedNotes = allNotes.filter(note => note.isPinned);
      console.log('📌 Pinned notes:', pinnedNotes.length);
      return pinnedNotes;
    } catch (error) {
      console.error('❌ Error getting pinned notes:', error);
      return [];
    }
  },

  // Get favorite notes only
  async getFavoriteNotes(userId) {
    try {
      const allNotes = await this.getUserNotes(userId);
      const favoriteNotes = allNotes.filter(note => note.isFavorite);
      console.log('⭐ Favorite notes:', favoriteNotes.length);
      return favoriteNotes;
    } catch (error) {
      console.error('❌ Error getting favorite notes:', error);
      return [];
    }
  },

  // Get notes by category
  async getNotesByCategory(userId, categoryId) {
    try {
      const allNotes = await this.getUserNotes(userId);
      const categoryNotes = allNotes.filter(note => note.categoryId === categoryId);
      console.log(`📁 Notes in category ${categoryId}:`, categoryNotes.length);
      return categoryNotes;
    } catch (error) {
      console.error('❌ Error getting notes by category:', error);
      return [];
    }
  },

  // Get uncategorized notes
  async getUncategorizedNotes(userId) {
    try {
      const allNotes = await this.getUserNotes(userId);
      const uncategorizedNotes = allNotes.filter(note => !note.categoryId);
      console.log('📄 Uncategorized notes:', uncategorizedNotes.length);
      return uncategorizedNotes;
    } catch (error) {
      console.error('❌ Error getting uncategorized notes:', error);
      return [];
    }
  },

  // ========== CATEGORY OPERATIONS ==========

  // Category operations with offline support
  async createCategory(categoryData, userId) {
    try {
      const categoryWithMetadata = {
        ...categoryData,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        noteCount: 0,
        syncStatus: 'synced'
      };

      console.log('📁 Creating category:', categoryData.name);

      let docRef;
      let finalCategoryId;
      
      // Try Firebase first
      try {
        docRef = await addDoc(collection(firestore, 'categories'), categoryWithMetadata);
        finalCategoryId = docRef.id;
        categoryWithMetadata.id = finalCategoryId;
        console.log('✅ Category created in Firebase:', finalCategoryId);
      } catch (firebaseError) {
        console.log('🌐 Offline - creating local category only');
        finalCategoryId = `local_category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        categoryWithMetadata.id = finalCategoryId;
        categoryWithMetadata.syncStatus = 'pending';
      }

      // Always save to SQLite
      await sqliteService.saveCategory(categoryWithMetadata);
      console.log('💾 Category saved to local storage:', categoryWithMetadata.name);
      
      return { id: finalCategoryId, ...categoryWithMetadata };
      
    } catch (error) {
      console.error('❌ Error creating category:', error);
      throw new Error('Failed to create category: ' + error.message);
    }
  },

  async updateCategory(categoryId, updates) {
    try {
      const updatedCategory = {
        ...updates,
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced'
      };

      console.log('✏️ Updating category:', categoryId);

      // Try Firebase first
      try {
        const categoryRef = doc(firestore, 'categories', categoryId);
        await updateDoc(categoryRef, updatedCategory);
        console.log('✅ Category updated in Firebase:', categoryId);
      } catch (firebaseError) {
        console.log('🌐 Offline - updating local category only');
        updatedCategory.syncStatus = 'pending';
      }

      // Update SQLite
      const currentCategory = await sqliteService.getCategoryById(categoryId);
      if (currentCategory) {
        const mergedCategory = {
          ...currentCategory,
          ...updatedCategory,
          id: categoryId
        };
        await sqliteService.saveCategory(mergedCategory);
        console.log('💾 Category updated in local storage');
      }
      
    } catch (error) {
      console.error('❌ Error updating category:', error);
      throw new Error('Failed to update category: ' + error.message);
    }
  },

  async deleteCategory(categoryId, userId) {
    try {
      console.log('🗑️ Deleting category:', categoryId);

      // Remove category from all notes first
      const allNotes = await this.getUserNotes(userId);
      const updatePromises = allNotes
        .filter(note => note.categoryId === categoryId)
        .map(note => this.updateNote(note.id, { categoryId: null }));
      
      await Promise.all(updatePromises);

      // Try Firebase first
      try {
        await deleteDoc(doc(firestore, 'categories', categoryId));
        console.log('✅ Category deleted from Firebase:', categoryId);
      } catch (firebaseError) {
        console.log('🌐 Offline - marking category for deletion locally');
      }

      // Delete category from SQLite
      await sqliteService.deleteCategory(categoryId);
      console.log('🗑️ Category deleted from local storage');
      
    } catch (error) {
      console.error('❌ Error deleting category:', error);
      throw new Error('Failed to delete category: ' + error.message);
    }
  },

  async getUserCategories(userId) {
    try {
      let categories = [];
      let source = 'Firebase';
      
      // Try Firebase first
      try {
        console.log('🔍 Attempting to load categories from Firebase for user:', userId);
        
        const q = query(
          collection(firestore, 'categories'),
          where('userId', '==', userId)
        );
        
        const querySnapshot = await getDocs(q);
        console.log('🔍 Firebase categories query result:', {
          empty: querySnapshot.empty,
          size: querySnapshot.size,
          docs: querySnapshot.docs.length
        });
        
        categories = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log('🔍 Processing category doc:', { id: doc.id, data });
          return {
            id: doc.id,
            ...data,
            syncStatus: 'synced'
          };
        });
        
        console.log('✅ Categories loaded from Firebase:', categories.length);
        
        // Save to SQLite
        const savePromises = categories.map(category => 
          sqliteService.saveCategory(category).catch(e => 
            console.log('⚠️ Failed to save category to SQLite:', category.id, e.message)
          )
        );
        await Promise.all(savePromises);
        
      } catch (firebaseError) {
        console.log('🌐 Offline - loading categories from local storage:', firebaseError.message);
        source = 'SQLite';
        categories = await sqliteService.getCategories(userId);
      }
      
      // Ensure all categories have proper structure
      const validatedCategories = categories.map(cat => ({
        id: cat.id,
        name: cat.name || 'Unnamed Category',
        color: cat.color || '#6366f1',
        userId: cat.userId || userId,
        createdAt: cat.createdAt || new Date().toISOString(),
        updatedAt: cat.updatedAt || new Date().toISOString(),
        noteCount: typeof cat.noteCount === 'number' ? cat.noteCount : 0,
        syncStatus: cat.syncStatus || 'synced'
      }));
      
      console.log(`📂 Loaded ${validatedCategories.length} categories from ${source}`);
      return validatedCategories;
      
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      return [];
    }
  },

  // Helper method to update category note counts
  async updateCategoryNoteCount(categoryId, userId) {
    try {
      const allNotes = await this.getUserNotes(userId);
      const noteCount = allNotes.filter(note => note.categoryId === categoryId).length;
      
      // Update in SQLite
      await sqliteService.updateCategoryNoteCount(categoryId, noteCount);
      
      // Update in Firebase if online
      try {
        const categoryRef = doc(firestore, 'categories', categoryId);
        await updateDoc(categoryRef, { 
          noteCount,
          updatedAt: new Date().toISOString()
        });
      } catch (firebaseError) {
        console.log('🌐 Offline - category count updated locally only');
      }
      
      console.log('📊 Updated category note count:', categoryId, noteCount);
    } catch (error) {
      console.error('❌ Error updating category note count:', error);
    }
  },

  // ========== UTILITY METHODS ==========

  // Real-time notes listener with SQLite caching
  subscribeToUserNotes(userId, callback) {
    console.log('🎯 Setting up Firestore real-time listener for user:', userId);
    
    try {
      const q = query(
        collection(firestore, 'notes'),
        where('userId', '==', userId)
      );

      let isFirstSnapshot = true;
      
      const unsubscribe = onSnapshot(q, 
        // Success callback
        async (snapshot) => {
          const notes = snapshot.docs.map(doc => {
            const data = doc.data();
            // FIXED: Ensure boolean conversion
            return {
              id: doc.id,
              ...data,
              isPinned: Boolean(data.isPinned),
              isFavorite: Boolean(data.isFavorite),
              syncStatus: 'synced'
            };
          });
          
          console.log('🔥 Firestore real-time update - notes:', notes.length);
          
          // Only save to SQLite if this is NOT the first snapshot
          if (!isFirstSnapshot) {
            const savePromises = notes.map(note => 
              sqliteService.saveNote(note).catch(e => 
                console.log('⚠️ Failed to cache note in SQLite:', note.id)
              )
            );
            await Promise.all(savePromises);
          } else {
            console.log('📱 First snapshot - skipping SQLite save (already handled by initial load)');
            isFirstSnapshot = false;
          }
          
          // Sort by most recent first
          const sortedNotes = notes.sort((a, b) => 
            new Date(b.updatedAt) - new Date(a.updatedAt)
          );
          
          callback(sortedNotes);
        },
        
        // Error callback
        async (error) => {
          console.error('❌ Firestore listener error, falling back to SQLite:', error);
          
          try {
            const notes = await sqliteService.getNotes(userId);
            // FIXED: Ensure boolean conversion
            const processedNotes = notes.map(note => ({
              ...note,
              isPinned: Boolean(note.isPinned),
              isFavorite: Boolean(note.isFavorite)
            }));
            const sortedNotes = processedNotes.sort((a, b) => 
              new Date(b.updatedAt) - new Date(a.updatedAt)
            );
            callback(sortedNotes);
          } catch (sqliteError) {
            console.error('❌ SQLite fallback also failed:', sqliteError);
            callback([]);
          }
        }
      );

      return unsubscribe;

    } catch (error) {
      console.error('❌ Error setting up Firestore listener:', error);
      
      // Immediate fallback to SQLite
      sqliteService.getNotes(userId)
        .then(notes => {
          // FIXED: Ensure boolean conversion
          const processedNotes = notes.map(note => ({
            ...note,
            isPinned: Boolean(note.isPinned),
            isFavorite: Boolean(note.isFavorite)
          }));
          const sortedNotes = processedNotes.sort((a, b) => 
            new Date(b.updatedAt) - new Date(a.updatedAt)
          );
          callback(sortedNotes);
        })
        .catch(error => {
          console.error('❌ SQLite fallback failed:', error);
          callback([]);
        });

      return () => console.log('📡 Listener unsubscribed');
    }
  },

  // Search notes across title, content, and tags
  async searchNotes(userId, searchTerm) {
    try {
      if (!searchTerm || searchTerm.trim() === '') {
        return [];
      }

      console.log('🔍 Searching notes for:', searchTerm);
      
      const allNotes = await this.getUserNotes(userId);
      const searchLower = searchTerm.toLowerCase().trim();
      
      const results = allNotes.filter(note => {
        const titleMatch = note.title?.toLowerCase().includes(searchLower);
        const contentMatch = note.content?.toLowerCase().includes(searchLower);
        const tagsMatch = note.tags?.some(tag => 
          tag.toLowerCase().includes(searchLower)
        );
        
        return titleMatch || contentMatch || tagsMatch;
      });

      console.log('🔍 Search results:', results.length);
      return results;
    } catch (error) {
      console.error('❌ Error searching notes:', error);
      return [];
    }
  },

  // Get notes by tag
  async getNotesByTag(userId, tag) {
    try {
      const allNotes = await this.getUserNotes(userId);
      const taggedNotes = allNotes.filter(note => 
        note.tags?.some(noteTag => 
          noteTag.toLowerCase() === tag.toLowerCase()
        )
      );
      console.log(`🏷️ Notes with tag "${tag}":`, taggedNotes.length);
      return taggedNotes;
    } catch (error) {
      console.error('❌ Error getting notes by tag:', error);
      return [];
    }
  },

  // Get all unique tags for a user
  async getUserTags(userId) {
    try {
      const allNotes = await this.getUserNotes(userId);
      const allTags = new Set();
      
      allNotes.forEach(note => {
        note.tags?.forEach(tag => {
          if (tag && tag.trim() !== '') {
            allTags.add(tag.toLowerCase());
          }
        });
      });
      
      const uniqueTags = Array.from(allTags);
      console.log('🏷️ User tags:', uniqueTags.length);
      return uniqueTags;
    } catch (error) {
      console.error('❌ Error getting user tags:', error);
      return [];
    }
  },

  // Sync pending changes when coming online
  async syncPendingChanges() {
    try {
      const syncQueue = await sqliteService.getSyncQueue();
      console.log('🔄 Syncing pending changes:', syncQueue.length);
      
      if (syncQueue.length === 0) {
        console.log('✅ No pending changes to sync');
        return;
      }

      let successfulSyncs = 0;
      let failedSyncs = 0;

      for (const item of syncQueue) {
        try {
          console.log(`🔄 Syncing ${item.operation} for ${item.recordId}`);
          
          switch (item.operation) {
            case 'CREATE':
              const docRef = await addDoc(collection(firestore, 'notes'), item.data);
              await sqliteService.saveNote({ 
                ...item.data, 
                id: docRef.id, 
                syncStatus: 'synced' 
              });
              await sqliteService.deleteNote(item.recordId);
              break;
              
            case 'UPDATE':
              const noteRef = doc(firestore, 'notes', item.recordId);
              await updateDoc(noteRef, item.data);
              await sqliteService.saveNote({ 
                id: item.recordId, 
                ...item.data, 
                syncStatus: 'synced' 
              });
              break;
              
            case 'DELETE':
              await deleteDoc(doc(firestore, 'notes', item.recordId));
              break;
          }
          
          await sqliteService.removeFromSyncQueue(item.id);
          successfulSyncs++;
          console.log('✅ Successfully synced:', item.operation, item.recordId);
          
        } catch (error) {
          failedSyncs++;
          console.error('❌ Failed to sync item:', item.id, error);
        }
      }

      console.log(`🔄 Sync completed: ${successfulSyncs} successful, ${failedSyncs} failed`);
      
    } catch (error) {
      console.error('❌ Error during sync process:', error);
    }
  },

  // Get note statistics
  async getNoteStats(userId) {
    try {
      const allNotes = await this.getUserNotes(userId);
      
      const stats = {
        total: allNotes.length,
        pinned: allNotes.filter(note => note.isPinned).length,
        favorites: allNotes.filter(note => note.isFavorite).length,
        withTags: allNotes.filter(note => note.tags && note.tags.length > 0).length,
        recent: allNotes.filter(note => {
          const noteDate = new Date(note.updatedAt);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return noteDate > weekAgo;
        }).length
      };
      
      console.log('📊 Note statistics:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Error getting note stats:', error);
      return { total: 0, pinned: 0, favorites: 0, withTags: 0, recent: 0 };
    }
  },

  // Export notes (for backup or sharing)
  async exportNotes(userId) {
    try {
      const allNotes = await this.getUserNotes(userId);
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalNotes: allNotes.length,
        notes: allNotes
      };
      console.log('📤 Exported notes:', allNotes.length);
      return exportData;
    } catch (error) {
      console.error('❌ Error exporting notes:', error);
      throw new Error('Failed to export notes');
    }
  },

  // Check if note exists
  async noteExists(noteId, userId) {
    try {
      const allNotes = await this.getUserNotes(userId);
      return allNotes.some(note => note.id === noteId);
    } catch (error) {
      console.error('❌ Error checking note existence:', error);
      return false;
    }
  },

  // Get note by ID
  async getNoteById(noteId) {
    try {
      // Try SQLite first (faster)
      let note = await sqliteService.getNoteById(noteId);
      
      if (!note) {
        // Fallback to Firebase
        try {
          const noteRef = doc(firestore, 'notes', noteId);
          const noteSnap = await getDoc(noteRef);
          if (noteSnap.exists()) {
            const data = noteSnap.data();
            note = {
              id: noteSnap.id,
              ...data,
              isPinned: Boolean(data.isPinned),
              isFavorite: Boolean(data.isFavorite),
              syncStatus: 'synced'
            };
            // Save to SQLite for future access
            await sqliteService.saveNote(note);
          }
        } catch (firebaseError) {
          console.log('🌐 Could not fetch note from Firebase');
        }
      } else {
        // FIXED: Ensure boolean conversion from SQLite
        note = {
          ...note,
          isPinned: Boolean(note.isPinned),
          isFavorite: Boolean(note.isFavorite)
        };
      }
      
      if (note) {
        console.log('📄 Found note by ID:', noteId);
      } else {
        console.log('❌ Note not found:', noteId);
      }
      return note || null;
    } catch (error) {
      console.error('❌ Error getting note by ID:', error);
      return null;
    }
  },

  // Debug method
  async debugFirebaseCategories(userId) {
    try {
      console.log('🔍 DEBUG: Checking Firebase categories for user:', userId);
      
      const q = query(
        collection(firestore, 'categories'),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      console.log('🔍 DEBUG: Firebase categories snapshot:', {
        exists: !querySnapshot.empty,
        size: querySnapshot.size,
        docs: querySnapshot.docs.map(doc => ({
          id: doc.id,
          data: doc.data()
        }))
      });
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('🔍 DEBUG: Error checking Firebase categories:', error);
      return [];
    }
  },

  // Initialize default categories
  async initializeDefaultCategories(userId) {
    try {
      console.log('🏗️ Initializing default categories for user:', userId);
      
      const defaultCategories = [
        {
          name: 'Personal',
          color: '#6366f1',
          noteCount: 0
        },
        {
          name: 'Work',
          color: '#10b981',
          noteCount: 0
        },
        {
          name: 'Study',
          color: '#f59e0b',
          noteCount: 0
        },
        {
          name: 'Ideas',
          color: '#8b5cf6',
          noteCount: 0
        }
      ];
      
      const createdCategories = [];
      
      for (const categoryData of defaultCategories) {
        try {
          const category = await this.createCategory(categoryData, userId);
          createdCategories.push(category);
          console.log('✅ Created default category:', categoryData.name);
        } catch (error) {
          console.log('⚠️ Could not create default category:', categoryData.name, error.message);
        }
      }
      
      console.log(`🏗️ Created ${createdCategories.length} default categories`);
      return createdCategories;
      
    } catch (error) {
      console.error('❌ Error initializing default categories:', error);
      return [];
    }
  }
}; 