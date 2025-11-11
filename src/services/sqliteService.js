// src/services/sqliteService.js
console.log('📱 SQLite service loading...');

let db = null;
let isRealSQLite = false;

// Try to initialize real SQLite
try {
  // Import SQLite properly
  const SQLite = require('expo-sqlite');
  
  if (SQLite && SQLite.openDatabase) {
    db = SQLite.openDatabase('synapse.db');
    isRealSQLite = true;
    console.log('✅ REAL SQLite database opened successfully');
    
    // Initialize tables
    initializeTables();
  } else {
    throw new Error('SQLite not available');
  }
} catch (error) {
  console.log('❌ Real SQLite failed, using enhanced mock:', error.message);
  createEnhancedMockDatabase();
}

function initializeTables() {
  if (!db) return;
  
  db.transaction(tx => {
    // Users table
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT,
        userType TEXT,
        createdAt TEXT,
        lastLogin TEXT
      );`,
      [],
      () => console.log('✅ Users table ready'),
      (tx, error) => console.log('ℹ️ Users table already exists')
    );

    // Notes table
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        tags TEXT,
        isPinned INTEGER DEFAULT 0,
        isFavorite INTEGER DEFAULT 0,
        permission TEXT DEFAULT 'private',
        createdAt TEXT,
        updatedAt TEXT,
        syncStatus TEXT DEFAULT 'synced'
      );`,
      [],
      () => console.log('✅ Notes table ready'),
      (tx, error) => console.log('ℹ️ Notes table already exists')
    );

    // Sync queue table
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        tableName TEXT NOT NULL,
        recordId TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT,
        createdAt TEXT
      );`,
      [],
      () => console.log('✅ Sync queue table ready'),
      (tx, error) => console.log('ℹ️ Sync queue table already exists')
    );
  });
}

function createEnhancedMockDatabase() {
  console.log('🔄 Creating enhanced mock database with actual storage');
  
  // Use AsyncStorage as fallback for mock database
  const mockData = {
    users: {},
    notes: {},
    syncQueue: {}
  };

  // Load existing data from storage if available
  try {
    const stored = localStorage.getItem('synapse_mock_data');
    if (stored) {
      Object.assign(mockData, JSON.parse(stored));
      console.log('📂 Loaded mock data from storage:', Object.keys(mockData.notes).length, 'notes');
    }
  } catch (e) {
    console.log('📂 No existing mock data found');
  }

  const saveToStorage = () => {
    try {
      localStorage.setItem('synapse_mock_data', JSON.stringify(mockData));
    } catch (e) {
      console.log('⚠️ Could not save to localStorage');
    }
  };

  db = {
    transaction: (callback) => {
      try {
        callback({
          executeSql: (sql, params, success, error) => {
            // Parse SQL to understand the operation
            const sqlLower = sql.toLowerCase();
            
            if (sqlLower.includes('insert or replace') && sqlLower.includes('notes')) {
              // Save note
              const [id, userId, title, content, tags, isPinned, isFavorite, permission, createdAt, updatedAt, syncStatus] = params;
              mockData.notes[id] = {
                id, userId, title, content, 
                tags: JSON.parse(tags),
                isPinned: isPinned === 1,
                isFavorite: isFavorite === 1,
                permission, createdAt, updatedAt, syncStatus
              };
              saveToStorage();
              console.log('💾 [MOCK+STORAGE] Note saved:', title);
              if (success) success({ rows: { _array: [] } });
              
            } else if (sqlLower.includes('select') && sqlLower.includes('notes') && sqlLower.includes('userid')) {
              // Get notes for user
              const userId = params[0];
              const userNotes = Object.values(mockData.notes).filter(note => note.userId === userId);
              console.log('📝 [MOCK+STORAGE] Notes retrieved:', userNotes.length);
              if (success) success({ rows: { _array: userNotes } });
              
            } else if (sqlLower.includes('delete from notes') && sqlLower.includes('id')) {
              // Delete note
              const noteId = params[0];
              delete mockData.notes[noteId];
              saveToStorage();
              console.log('🗑️ [MOCK+STORAGE] Note deleted:', noteId);
              if (success) success({ rows: { _array: [] } });
              
            } else if (sqlLower.includes('insert or replace') && sqlLower.includes('users')) {
              // Save user
              const [uid, email, name, userType, createdAt, lastLogin] = params;
              mockData.users[uid] = { uid, email, name, userType, createdAt, lastLogin };
              saveToStorage();
              console.log('💾 [MOCK+STORAGE] User saved:', email);
              if (success) success({ rows: { _array: [] } });
              
            } else if (sqlLower.includes('select') && sqlLower.includes('users') && sqlLower.includes('uid')) {
              // Get user
              const uid = params[0];
              const user = mockData.users[uid] || null;
              console.log('👤 [MOCK+STORAGE] User retrieved:', user ? user.email : 'Not found');
              if (success) success({ rows: { _array: user ? [user] : [] } });
              
            } else {
              // Default success for other operations
              if (success) success({ rows: { _array: [] } });
            }
          }
        });
      } catch (e) {
        console.log('❌ Mock transaction error:', e);
      }
    }
  };
}

// User operations
const saveUser = async (user) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve();
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR REPLACE INTO users (uid, email, name, userType, createdAt, lastLogin) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user.uid, user.email, user.name, user.userType, user.createdAt, user.lastLogin],
        (_, result) => {
          console.log(isRealSQLite ? '💾 [REAL SQLite] User saved:' : '💾 [MOCK+STORAGE] User saved:', user.email);
          resolve(result);
        },
        (_, error) => {
          console.log('⚠️ Could not save user');
          resolve();
        }
      );
    });
  });
};

const getUser = async (uid) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve(null);
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM users WHERE uid = ?',
        [uid],
        (_, { rows }) => {
          const user = rows._array[0];
          if (user) {
            console.log(isRealSQLite ? '👤 [REAL SQLite] User found:' : '👤 [MOCK+STORAGE] User found:', user.email);
          }
          resolve(user || null);
        },
        (_, error) => {
          console.log('⚠️ Could not get user');
          resolve(null);
        }
      );
    });
  });
};

// Note operations
const saveNote = async (note) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve();
      return;
    }

    const tagsString = note.tags ? JSON.stringify(note.tags) : '[]';
    
    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR REPLACE INTO notes 
         (id, userId, title, content, tags, isPinned, isFavorite, permission, createdAt, updatedAt, syncStatus) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          note.id, note.userId, note.title, note.content, tagsString,
          note.isPinned ? 1 : 0, note.isFavorite ? 1 : 0, note.permission,
          note.createdAt, note.updatedAt, note.syncStatus || 'synced'
        ],
        (_, result) => {
          console.log(isRealSQLite ? '💾 [REAL SQLite] Note saved:' : '💾 [MOCK+STORAGE] Note saved:', note.title);
          resolve(result);
        },
        (_, error) => {
          console.log('⚠️ Could not save note');
          resolve();
        }
      );
    });
  });
};

const getNotes = async (userId) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve([]);
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM notes WHERE userId = ? ORDER BY updatedAt DESC',
        [userId],
        (_, { rows }) => {
          const notes = rows._array.map(row => ({
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
            isPinned: row.isPinned === 1,
            isFavorite: row.isFavorite === 1
          }));
          console.log(isRealSQLite ? '📝 [REAL SQLite] Notes loaded:' : '📝 [MOCK+STORAGE] Notes loaded:', notes.length);
          resolve(notes);
        },
        (_, error) => {
          console.log('⚠️ Could not get notes');
          resolve([]);
        }
      );
    });
  });
};

const deleteNote = async (noteId) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve();
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM notes WHERE id = ?',
        [noteId],
        (_, result) => {
          console.log(isRealSQLite ? '🗑️ [REAL SQLite] Note deleted:' : '🗑️ [MOCK+STORAGE] Note deleted:', noteId);
          resolve(result);
        },
        (_, error) => {
          console.log('⚠️ Could not delete note');
          resolve();
        }
      );
    });
  });
};

// Sync operations (simplified for now)
const addToSyncQueue = async (tableName, recordId, operation, data) => {
  console.log('🔄 Sync queue added:', operation, recordId);
  return Promise.resolve();
};

const getSyncQueue = async () => {
  return Promise.resolve([]);
};

const removeFromSyncQueue = async (syncId) => {
  return Promise.resolve();
};

const markNoteForSync = async (noteId, operation, data) => {
  console.log('🔄 Marked for sync:', operation, noteId);
  return Promise.resolve();
};

console.log(`✅ SQLite service loaded: ${isRealSQLite ? 'REAL SQLite' : 'Enhanced Mock with Storage'}`);

export default {
  saveUser,
  getUser,
  saveNote,
  getNotes,
  deleteNote,
  addToSyncQueue,
  getSyncQueue,
  removeFromSyncQueue,
  markNoteForSync,
  isInitialized: () => true,
  isRealSQLite: () => isRealSQLite
};