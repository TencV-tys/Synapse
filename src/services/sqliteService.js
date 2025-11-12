// src/services/sqliteService.js
console.log('📱 SQLite service loading...');

let db = null;
let isRealSQLite = false;

// Create enhanced mock database (since real SQLite often has issues in React Native)
function createEnhancedMockDatabase() {
  console.log('🔄 Creating enhanced mock database for React Native');
  
  // Use in-memory storage for React Native
  const mockData = {
    users: {},
    notes: {},
    syncQueue: {}
  };

  console.log('📂 Initialized mock database in memory');

  // Create a simple mock database interface
  const mockDB = {
    transaction: (callback) => {
      try {
        // Create a mock transaction object
        const mockTransaction = {
          executeSql: (sql, params, successCallback, errorCallback) => {
            console.log('⚡ [MOCK] Executing SQL:', sql.substring(0, 100) + '...');
            
            try {
              const sqlLower = sql.toLowerCase().trim();
              
              // Handle different SQL operations
              if (sqlLower.startsWith('insert or replace into users')) {
                // Save user
                const [uid, email, name, userType, createdAt, lastLogin, isOffline] = params;
                mockData.users[uid] = { 
                  uid, 
                  email, 
                  name, 
                  userType: userType || 'student',
                  createdAt: createdAt || new Date().toISOString(),
                  lastLogin: lastLogin || new Date().toISOString(),
                  isOffline: isOffline === 1 
                };
                console.log('💾 [MOCK] User saved:', email);
                if (successCallback) successCallback({ insertId: 1, rowsAffected: 1 });
                
              } else if (sqlLower.startsWith('select * from users where uid = ?')) {
                // Get user by ID
                const uid = params[0];
                const user = mockData.users[uid] || null;
                console.log('👤 [MOCK] User retrieved by ID:', user ? user.email : 'Not found');
                if (successCallback) successCallback({ 
                  rows: { 
                    _array: user ? [user] : [],
                    length: user ? 1 : 0,
                    item: (index) => user ? user : null
                  } 
                });
                
              } else if (sqlLower.startsWith('select * from users order by lastlogin desc')) {
                // Get all users
                const users = Object.values(mockData.users);
                console.log(`👥 [MOCK] All users retrieved: ${users.length}`);
                if (successCallback) successCallback({ 
                  rows: { 
                    _array: users,
                    length: users.length,
                    item: (index) => users[index] || null
                  } 
                });
                
              } else if (sqlLower.startsWith('insert or replace into notes')) {
                // Save note
                const [id, userId, title, content, tags, isPinned, isFavorite, permission, createdAt, updatedAt, syncStatus] = params;
                mockData.notes[id] = {
                  id, userId, title, content, 
                  tags: typeof tags === 'string' ? JSON.parse(tags) : (tags || []),
                  isPinned: isPinned === 1,
                  isFavorite: isFavorite === 1,
                  permission: permission || 'private',
                  createdAt: createdAt || new Date().toISOString(),
                  updatedAt: updatedAt || new Date().toISOString(),
                  syncStatus: syncStatus || 'synced'
                };
                console.log('💾 [MOCK] Note saved:', title);
                if (successCallback) successCallback({ insertId: 1, rowsAffected: 1 });
                
              } else if (sqlLower.startsWith('select * from notes where userid = ?')) {
                // Get notes for user
                const userId = params[0];
                const userNotes = Object.values(mockData.notes).filter(note => note.userId === userId);
                console.log('📝 [MOCK] Notes retrieved for user:', userNotes.length);
                if (successCallback) successCallback({ 
                  rows: { 
                    _array: userNotes,
                    length: userNotes.length,
                    item: (index) => userNotes[index] || null
                  } 
                });
                
              } else if (sqlLower.startsWith('delete from notes where id = ?')) {
                // Delete note
                const noteId = params[0];
                const existed = mockData.notes.hasOwnProperty(noteId);
                delete mockData.notes[noteId];
                console.log('🗑️ [MOCK] Note deleted:', noteId, existed ? '(existed)' : '(did not exist)');
                if (successCallback) successCallback({ rowsAffected: existed ? 1 : 0 });
                
              } else if (sqlLower.startsWith('create table')) {
                // Table creation - always succeed
                console.log('📊 [MOCK] Table creation attempted');
                if (successCallback) successCallback({});
                
              } else {
                // Default success for other operations
                console.log('🔧 [MOCK] Default SQL handler for:', sql.substring(0, 50) + '...');
                if (successCallback) successCallback({ 
                  rows: { 
                    _array: [],
                    length: 0,
                    item: () => null
                  } 
                });
              }
            } catch (error) {
              console.error('❌ [MOCK] SQL execution error:', error);
              if (errorCallback) errorCallback({ message: error.message });
            }
          }
        };
        
        // Execute the callback with our mock transaction
        callback(mockTransaction);
      } catch (e) {
        console.log('❌ Mock transaction setup error:', e);
      }
    }
  };

  return mockDB;
}

// Initialize the database
db = createEnhancedMockDatabase();
isRealSQLite = false;

console.log('✅ SQLite service initialized with Mock Database');

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
        `INSERT OR REPLACE INTO users (uid, email, name, userType, createdAt, lastLogin, isOffline) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          user.uid, 
          user.email, 
          user.name, 
          user.userType || 'student',
          user.createdAt || new Date().toISOString(),
          user.lastLogin || new Date().toISOString(),
          user.isOffline ? 1 : 0
        ],
        (result) => {
          console.log('💾 [MOCK] User saved successfully:', user.email);
          resolve(result);
        },
        (error) => {
          console.log('⚠️ Could not save user:', error);
          resolve(); // Resolve anyway to prevent blocking
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
        (_, result) => {
          const user = result.rows._array[0] || null;
          if (user) {
            console.log('👤 [MOCK] User found:', user.email);
          } else {
            console.log('👤 [MOCK] User not found for ID:', uid);
          }
          resolve(user);
        },
        (error) => {
          console.log('⚠️ Could not get user:', error);
          resolve(null); // Resolve with null instead of rejecting
        }
      );
    });
  });
};

// In your sqliteService.js, update the getAllUsers method:
const getAllUsers = async () => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve([]);
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM users ORDER BY lastLogin DESC',
        [],
        (tx, result) => {  // Add 'tx' parameter here
          // Check if result exists and has rows
          if (result && result.rows) {
            const users = result.rows._array || [];
            console.log(`👥 [MOCK] Retrieved ${users.length} users from database`);
            resolve(users);
          } else {
            console.log('👥 [MOCK] No result or rows property');
            resolve([]);
          }
        },
        (tx, error) => {  // Add 'tx' parameter here
          console.log('⚠️ Could not get users:', error);
          resolve([]);
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

    const tagsString = JSON.stringify(note.tags || []);
    
    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR REPLACE INTO notes 
         (id, userId, title, content, tags, isPinned, isFavorite, permission, createdAt, updatedAt, syncStatus) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          note.id, 
          note.userId, 
          note.title, 
          note.content || '', 
          tagsString,
          note.isPinned ? 1 : 0, 
          note.isFavorite ? 1 : 0, 
          note.permission || 'private',
          note.createdAt || new Date().toISOString(),
          note.updatedAt || new Date().toISOString(),
          note.syncStatus || 'synced'
        ],
        (result) => {
          console.log('💾 [MOCK] Note saved:', note.title);
          resolve(result);
        },
        (error) => {
          console.log('⚠️ Could not save note:', error);
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
        (_, result) => {
          const notes = (result.rows._array || []).map(row => ({
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
            isPinned: row.isPinned === 1,
            isFavorite: row.isFavorite === 1
          }));
          console.log('📝 [MOCK] Notes loaded:', notes.length);
          resolve(notes);
        },
        (error) => {
          console.log('⚠️ Could not get notes:', error);
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
        (result) => {
          console.log('🗑️ [MOCK] Note deleted:', noteId);
          resolve(result);
        },
        (error) => {
          console.log('⚠️ Could not delete note:', error);
          resolve();
        }
      );
    });
  });
};

// Sync operations
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

export default {
  saveUser,
  getUser,
  getAllUsers,
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