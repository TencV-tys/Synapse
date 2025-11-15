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
  onSnapshot 
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
        categoryId, // Add category support
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPinned: false,
        isFavorite: false,
        tags: noteData.tags || [],
        permission: 'private',
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
        await this.updateCategoryNoteCount(categoryId);
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
      const updatedNote = {
        ...updates,
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced'
      };

      console.log('✏️ Updating note:', noteId, 'Updates:', updates);

      // Get current note to check for category changes
      const currentNote = await this.getNoteById(noteId, 'all');
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
          await this.updateCategoryNoteCount(oldCategoryId);
        }
        if (newCategoryId) {
          await this.updateCategoryNoteCount(newCategoryId);
        }
      }

      // For SQLite, we need to get the full note data first to ensure we have all fields
      try {
        const currentNote = await sqliteService.getNoteById(noteId);
        if (currentNote) {
          // Merge updates with existing note data to preserve all fields
          const mergedNote = {
            ...currentNote,
            ...updatedNote, // This overwrites only the updated fields
            id: noteId // Ensure ID is preserved
          };
          await sqliteService.saveNote(mergedNote);
          console.log('💾 Note updated in local storage with full data:', mergedNote.title);
        } else {
          // If note doesn't exist in SQLite, create a minimal version
          const minimalNote = {
            id: noteId,
            title: 'Untitled Note',
            content: '',
            tags: [],
            isPinned: false,
            isFavorite: false,
            userId: '', // This should ideally come from somewhere
            permission: 'private',
            createdAt: new Date().toISOString(),
            updatedAt: updatedNote.updatedAt,
            syncStatus: updatedNote.syncStatus,
            ...updates
          };
          await sqliteService.saveNote(minimalNote);
          console.log('💾 Note created in local storage (fallback):', minimalNote.title);
        }
      } catch (sqliteError) {
        console.error('❌ Error updating note in SQLite:', sqliteError);
        // Final fallback - just save what we have
        const fallbackNote = {
          id: noteId,
          title: 'Untitled Note',
          content: '',
          tags: [],
          isPinned: false,
          isFavorite: false,
          userId: '',
          permission: 'private',
          createdAt: new Date().toISOString(),
          updatedAt: updatedNote.updatedAt,
          syncStatus: updatedNote.syncStatus,
          ...updates
        };
        await sqliteService.saveNote(fallbackNote);
        console.log('💾 Note saved with fallback data:', fallbackNote.title);
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

      // Try Firebase first
      try {
        await deleteDoc(doc(firestore, 'notes', noteId));
        console.log('✅ Note deleted from Firebase:', noteId);
      } catch (firebaseError) {
        console.log('🌐 Offline - marking for deletion locally');
        // Add to sync queue for when we're back online
        await sqliteService.markNoteForSync(noteId, 'DELETE', { id: noteId });
      }

      // Always delete from SQLite
      await sqliteService.deleteNote(noteId);
      console.log('🗑️ Note deleted from local storage');
      
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

  // Toggle favorite status
  async toggleFavorite(noteId, currentStatus) {
    try {
      await this.updateNote(noteId, { isFavorite: !currentStatus });
      console.log('⭐ Favorite toggled for note:', noteId, !currentStatus);
    } catch (error) {
      console.error('❌ Error toggling favorite:', error);
      throw error;
    }
  },

  // Get all notes for user with offline fallback
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
        notes = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          syncStatus: 'synced'
        }));
        
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
        // If Firebase fails, load from SQLite
        notes = await sqliteService.getNotes(userId);
      }
      
      // Sort by most recent first
      const sortedNotes = notes.sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      
      console.log(`📚 Loaded ${sortedNotes.length} notes from ${source}`);
      return sortedNotes;
      
    } catch (error) {
      console.error('❌ Error fetching notes:', error);
      // Even if both fail, return empty array instead of throwing
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

  async deleteCategory(categoryId) {
    try {
      console.log('🗑️ Deleting category:', categoryId);

      // Try Firebase first
      try {
        await deleteDoc(doc(firestore, 'categories', categoryId));
        console.log('✅ Category deleted from Firebase:', categoryId);
      } catch (firebaseError) {
        console.log('🌐 Offline - marking category for deletion locally');
      }

      // Remove category from all notes first
      const allNotes = await this.getUserNotes('all'); // Get all notes to update
      const updatePromises = allNotes
        .filter(note => note.categoryId === categoryId)
        .map(note => this.updateNote(note.id, { categoryId: null }));
      
      await Promise.all(updatePromises);

      // Delete category
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
        const q = query(
          collection(firestore, 'categories'),
          where('userId', '==', userId)
        );
        
        const querySnapshot = await getDocs(q);
        categories = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          syncStatus: 'synced'
        }));
        
        console.log('✅ Categories loaded from Firebase:', categories.length);
        
        // Save to SQLite
        const savePromises = categories.map(category => 
          sqliteService.saveCategory(category).catch(e => 
            console.log('⚠️ Failed to save category to SQLite:', category.id)
          )
        );
        await Promise.all(savePromises);
        
      } catch (firebaseError) {
        console.log('🌐 Offline - loading categories from local storage');
        source = 'SQLite';
        categories = await sqliteService.getCategories(userId);
      }
      
      console.log(`📂 Loaded ${categories.length} categories from ${source}`);
      return categories;
      
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      return [];
    }
  },

  // Helper method to update category note counts
  async updateCategoryNoteCount(categoryId) {
    try {
      const allNotes = await this.getUserNotes('all');
      const noteCount = allNotes.filter(note => note.categoryId === categoryId).length;
      await sqliteService.updateCategoryNoteCount(categoryId, noteCount);
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
          const notes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            syncStatus: 'synced'
          }));
          
          console.log('🔥 Firestore real-time update - notes:', notes.length);
          
          // Only save to SQLite if this is NOT the first snapshot
          // (first load is already handled by getUserNotes)
          if (!isFirstSnapshot) {
            // Save all notes to SQLite for offline access
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
            // Fallback to SQLite
            const notes = await sqliteService.getNotes(userId);
            const sortedNotes = notes.sort((a, b) => 
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
          const sortedNotes = notes.sort((a, b) => 
            new Date(b.updatedAt) - new Date(a.updatedAt)
          );
          callback(sortedNotes);
        })
        .catch(error => {
          console.error('❌ SQLite fallback failed:', error);
          callback([]);
        });

      // Return a dummy unsubscribe function
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
              // Update SQLite with the real Firebase ID
              await sqliteService.saveNote({ 
                ...item.data, 
                id: docRef.id, 
                syncStatus: 'synced' 
              });
              // Delete the old local note
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
          
          // Remove from sync queue after successful sync
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
  async getNoteById(noteId, userId) {
    try {
      const allNotes = await this.getUserNotes(userId);
      const note = allNotes.find(note => note.id === noteId);
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
  }
};