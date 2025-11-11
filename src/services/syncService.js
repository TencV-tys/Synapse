// src/services/syncService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notesService } from './notesService';

const SYNC_QUEUE_KEY = 'sync_queue';

export const syncService = {
  // Queue changes for later sync
  async queueForSync(change) {
    try {
      const queue = await this.getSyncQueue();
      queue.push({
        ...change,
        timestamp: new Date().toISOString(),
      });
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      console.log('📤 Queued for sync:', change);
    } catch (error) {
      console.error('❌ Error queuing for sync:', error);
    }
  },

  // Get sync queue
  async getSyncQueue() {
    try {
      const queue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('❌ Error getting sync queue:', error);
      return [];
    }
  },

  // Sync all pending changes
  async syncAllPendingChanges(userId) {
    try {
      const queue = await this.getSyncQueue();
      console.log(`🔄 Syncing ${queue.length} pending changes...`);

      for (const change of queue) {
        try {
          switch (change.type) {
            case 'create':
              await notesService.createNoteInFirebase(change.data);
              break;
            case 'update':
              await notesService.updateNoteInFirebase(change.noteId, change.data);
              break;
            case 'delete':
              await notesService.deleteNoteFromFirebase(change.noteId);
              break;
          }
          console.log(`✅ Synced: ${change.type} for note ${change.noteId}`);
        } catch (error) {
          console.error(`❌ Failed to sync ${change.type} for note ${change.noteId}:`, error);
        }
      }

      // Clear queue after successful sync
      await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
      console.log('✅ All changes synced successfully');

    } catch (error) {
      console.error('❌ Error during bulk sync:', error);
    }
  },

  // Sync local data to SQLite
  async syncToLocal(remoteNotes, userId) {
    try {
      console.log('📥 Syncing remote data to local SQLite...');
      // Clear existing local notes for this user
      await notesService.clearUserNotesInSQLite(userId);
      
      // Save all remote notes to SQLite
      for (const note of remoteNotes) {
        await notesService.createNoteInSQLite(note);
      }
      console.log(`✅ Synced ${remoteNotes.length} notes to local storage`);
    } catch (error) {
      console.error('❌ Error syncing to local:', error);
    }
  },
};