// src/services/sqliteService.js
console.log('📱 SQLite service loading...');

let db = null;
let isRealSQLite = false;

// Create enhanced mock database
function createEnhancedMockDatabase() {
  console.log('🔄 Creating enhanced mock database for React Native');
  
  // Use in-memory storage for React Native - ADD CATEGORIES HERE
  const mockData = {
    users: {},
    notes: {},
    categories: {}, // ✅ ADDED CATEGORIES
    syncQueue: {}
  };

  console.log('📂 Initialized mock database in memory');

  // Create a simple mock database interface
  const mockDB = {
    transaction: (callback) => {
      try {
        // Create a mock transaction object
        const mockTransaction = {
          executeSql: (sql, params = [], successCallback, errorCallback) => {
            console.log('⚡ [MOCK] Executing SQL:', sql.substring(0, 100) + '...');
            
            try {
              const sqlLower = sql.toLowerCase().trim();
              
              // Handle different SQL operations
              if (sqlLower.startsWith('insert or replace into users')) {
                // Save user
                const [uid, email, name, userType, password, createdAt, lastLogin, isOffline] = params;
                mockData.users[uid] = { 
                  uid, 
                  email, 
                  name, 
                  userType: userType || 'student',
                  password: password || '',
                  createdAt: createdAt || new Date().toISOString(),
                  lastLogin: lastLogin || new Date().toISOString(),
                  isOffline: isOffline === 1 
                };
                console.log('💾 [MOCK] User saved:', email);
                if (successCallback) {
                  successCallback(mockTransaction, {
                    insertId: 1,
                    rowsAffected: 1,
                    rows: {
                      _array: [],
                      length: 0,
                      item: () => null
                    }
                  });
                }
                
              } else if (sqlLower.startsWith('select * from users where uid = ?')) {
                // Get user by ID
                const uid = params[0];
                const user = mockData.users[uid] || null;
                console.log('👤 [MOCK] User retrieved by ID:', user ? user.email : 'Not found');
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rows: {
                      _array: user ? [user] : [],
                      length: user ? 1 : 0,
                      item: (index) => user ? user : null
                    }
                  });
                }
                
              } else if (sqlLower.startsWith('select * from users order by lastlogin desc')) {
                // Get all users
                const users = Object.values(mockData.users);
                console.log(`👥 [MOCK] All users retrieved: ${users.length}`);
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rows: {
                      _array: users,
                      length: users.length,
                      item: (index) => users[index] || null
                    }
                  });
                }
                
              } else if (sqlLower.startsWith('insert or replace into notes')) {
                // Save note - handle partial updates by merging with existing data
                const [id, userId, title, content, tags, isPinned, isFavorite, permission, createdAt, updatedAt, syncStatus] = params;
                
                // Get existing note data to preserve fields that aren't being updated
                const existingNote = mockData.notes[id] || {};
                
                const updatedNote = {
                  ...existingNote, // Keep existing fields
                  id, 
                  userId: userId || existingNote.userId, // Use new value or keep existing
                  title: title || existingNote.title || 'Untitled Note', // Use new value or keep existing
                  content: content || existingNote.content || '', // Use new value or keep existing
                  tags: typeof tags === 'string' ? JSON.parse(tags) : (tags || existingNote.tags || []),
                  isPinned: isPinned === 1 ? true : (isPinned === 0 ? false : (existingNote.isPinned || false)),
                  isFavorite: isFavorite === 1 ? true : (isFavorite === 0 ? false : (existingNote.isFavorite || false)),
                  permission: permission || existingNote.permission || 'private',
                  createdAt: createdAt || existingNote.createdAt || new Date().toISOString(),
                  updatedAt: updatedAt || existingNote.updatedAt || new Date().toISOString(),
                  syncStatus: syncStatus || existingNote.syncStatus || 'synced'
                };
                
                mockData.notes[id] = updatedNote;
                console.log('💾 [MOCK] Note saved:', updatedNote.title);
                
                if (successCallback) {
                  successCallback(mockTransaction, {
                    insertId: 1,
                    rowsAffected: 1,
                    rows: {
                      _array: [],
                      length: 0,
                      item: () => null
                    }
                  });
                }
                
              } else if (sqlLower.startsWith('select * from notes where userid = ?')) {
                // Get notes for user
                const userId = params[0];
                const userNotes = Object.values(mockData.notes).filter(note => note.userId === userId);
                console.log('📝 [MOCK] Notes retrieved for user:', userNotes.length);
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rows: {
                      _array: userNotes,
                      length: userNotes.length,
                      item: (index) => userNotes[index] || null
                    }
                  });
                }
                
              } else if (sqlLower.startsWith('select * from notes where id = ?')) {
                // Get note by ID
                const noteId = params[0];
                const note = mockData.notes[noteId] || null;
                console.log('📄 [MOCK] Note retrieved by ID:', note ? note.title : 'Not found');
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rows: {
                      _array: note ? [note] : [],
                      length: note ? 1 : 0,
                      item: (index) => note ? note : null
                    }
                  });
                }
                
              } else if (sqlLower.startsWith('delete from notes where id = ?')) {
                // Delete note
                const noteId = params[0];
                const existed = mockData.notes.hasOwnProperty(noteId);
                delete mockData.notes[noteId];
                console.log('🗑️ [MOCK] Note deleted:', noteId, existed ? '(existed)' : '(did not exist)');
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rowsAffected: existed ? 1 : 0,
                    rows: {
                      _array: [],
                      length: 0,
                      item: () => null
                    }
                  });
                }

              // ✅ ADD CATEGORIES HANDLING HERE
              } else if (sqlLower.startsWith('select * from categories where userid = ?')) {
                // Get categories for user
                const userId = params[0];
                const userCategories = Object.values(mockData.categories).filter(cat => cat.userId === userId);
                console.log('📂 [MOCK] Categories retrieved for user:', userCategories.length);
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rows: {
                      _array: userCategories,
                      length: userCategories.length,
                      item: (index) => userCategories[index] || null
                    }
                  });
                }
                
              } else if (sqlLower.startsWith('insert or replace into categories')) {
                // Save category
                const [id, name, color, userId, createdAt, updatedAt, noteCount, syncStatus] = params;
                
                mockData.categories[id] = {
                  id, 
                  name, 
                  color, 
                  userId,
                  createdAt: createdAt || new Date().toISOString(),
                  updatedAt: updatedAt || new Date().toISOString(),
                  noteCount: noteCount || 0,
                  syncStatus: syncStatus || 'synced'
                };
                console.log('💾 [MOCK] Category saved:', name);
                if (successCallback) {
                  successCallback(mockTransaction, {
                    insertId: 1,
                    rowsAffected: 1,
                    rows: {
                      _array: [],
                      length: 0,
                      item: () => null
                    }
                  });
                }
                
              } else if (sqlLower.startsWith('select * from categories where id = ?')) {
                // Get category by ID
                const categoryId = params[0];
                const category = mockData.categories[categoryId] || null;
                console.log('📁 [MOCK] Category retrieved by ID:', category ? category.name : 'Not found');
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rows: {
                      _array: category ? [category] : [],
                      length: category ? 1 : 0,
                      item: (index) => category ? category : null
                    }
                  });
                }
                
              } else if (sqlLower.startsWith('delete from categories where id = ?')) {
                // Delete category
                const categoryId = params[0];
                const existed = mockData.categories.hasOwnProperty(categoryId);
                delete mockData.categories[categoryId];
                console.log('🗑️ [MOCK] Category deleted:', categoryId, existed ? '(existed)' : '(did not exist)');
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rowsAffected: existed ? 1 : 0,
                    rows: {
                      _array: [],
                      length: 0,
                      item: () => null
                    }
                  });
                }
                
              } else if (sqlLower.startsWith('update categories set notecount')) {
                // Update category note count
                const [noteCount, updatedAt, categoryId] = params;
                const category = mockData.categories[categoryId];
                if (category) {
                  category.noteCount = noteCount;
                  category.updatedAt = updatedAt;
                  console.log('📊 [MOCK] Category note count updated:', categoryId, noteCount);
                }
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rowsAffected: category ? 1 : 0,
                    rows: {
                      _array: [],
                      length: 0,
                      item: () => null
                    }
                  });
                }
                
              } else if (sqlLower.startsWith('create table')) {
                // Table creation - always succeed
                console.log('📊 [MOCK] Table creation attempted');
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rows: {
                      _array: [],
                      length: 0,
                      item: () => null
                    }
                  });
                }
                
              } else {
                // Default success for other operations
                console.log('🔧 [MOCK] Default SQL handler for:', sql.substring(0, 50) + '...');
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rows: {
                      _array: [],
                      length: 0,
                      item: () => null
                    }
                  });
                }
              }
            } catch (error) {
              console.error('❌ [MOCK] SQL execution error:', error);
              if (errorCallback) {
                errorCallback(mockTransaction, error);
              }
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
        `INSERT OR REPLACE INTO users (uid, email, name, userType, password, createdAt, lastLogin, isOffline) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.uid, 
          user.email, 
          user.name, 
          user.userType || 'student',
          user.password || '', // ✅ Ensure password is never undefined
          user.createdAt || new Date().toISOString(),
          user.lastLogin || new Date().toISOString(),
          user.isOffline ? 1 : 0
        ],
        (tx, result) => {
          console.log('💾 [MOCK] User saved successfully:', user.email);
          console.log('🔑 Password saved:', user.password ? 'YES' : 'NO');
          resolve(result);
        },
        (tx, error) => {
          console.log('⚠️ Could not save user:', error);
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
        (tx, result) => {
          const user = result.rows._array[0] || null;
          if (user) {
            console.log('👤 [MOCK] User found:', user.email);
          } else {
            console.log('👤 [MOCK] User not found for ID:', uid);
          }
          resolve(user);
        },
        (tx, error) => {
          console.log('⚠️ Could not get user:', error);
          resolve(null); // Resolve with null instead of rejecting
        }
      );
    });
  });
};

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
        (tx, result) => {
          const users = result.rows._array || [];
          console.log(`👥 [MOCK] Retrieved ${users.length} users from database`);
          resolve(users);
        },
        (tx, error) => {
          console.log('⚠️ Could not get users:', error);
          resolve([]); // Always resolve with empty array
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
        (tx, result) => {
          console.log('💾 [MOCK] Note saved:', note.title);
          resolve(result);
        },
        (tx, error) => {
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
        (tx, result) => {
          try {
            const notes = (result.rows._array || []).map(row => {
              let tags = [];
              
              // Safely parse tags
              if (row.tags) {
                try {
                  if (typeof row.tags === 'string') {
                    // Remove any unexpected characters and parse
                    const cleanedTags = row.tags.replace(/[^\w\s",\[\]]/g, '');
                    tags = JSON.parse(cleanedTags);
                  } else if (Array.isArray(row.tags)) {
                    tags = row.tags;
                  }
                } catch (parseError) {
                  console.log('⚠️ Could not parse tags, using empty array:', parseError.message);
                  tags = [];
                }
              }
              
              return {
                ...row,
                tags: tags,
                isPinned: row.isPinned === 1,
                isFavorite: row.isFavorite === 1
              };
            });
            console.log('📝 [MOCK] Notes loaded:', notes.length);
            resolve(notes);
          } catch (error) {
            console.error('❌ Error processing notes:', error);
            resolve([]);
          }
        },
        (tx, error) => {
          console.log('⚠️ Could not get notes:', error);
          resolve([]);
        }
      );
    });
  });
};

const getNoteById = async (noteId) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve(null);
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM notes WHERE id = ?',
        [noteId],
        (tx, result) => {
          const row = result.rows._array[0] || null;
          if (row) {
            let tags = [];
            // Safely parse tags
            if (row.tags) {
              try {
                if (typeof row.tags === 'string') {
                  const cleanedTags = row.tags.replace(/[^\w\s",\[\]]/g, '');
                  tags = JSON.parse(cleanedTags);
                } else if (Array.isArray(row.tags)) {
                  tags = row.tags;
                }
              } catch (parseError) {
                console.log('⚠️ Could not parse tags for note:', noteId);
                tags = [];
              }
            }
            
            const note = {
              ...row,
              tags: tags,
              isPinned: row.isPinned === 1,
              isFavorite: row.isFavorite === 1
            };
            console.log('📄 [MOCK] Note found by ID:', note.title);
            resolve(note);
          } else {
            console.log('📄 [MOCK] Note not found by ID:', noteId);
            resolve(null);
          }
        },
        (tx, error) => {
          console.log('⚠️ Could not get note by ID:', error);
          resolve(null);
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
        (tx, result) => {
          console.log('🗑️ [MOCK] Note deleted:', noteId);
          resolve(result);
        },
        (tx, error) => {
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

// Category operations
const createCategoriesTable = async () => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve();
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          userId TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          noteCount INTEGER DEFAULT 0,
          syncStatus TEXT DEFAULT 'synced'
        )`,
        [],
        (tx, result) => {
          console.log('📊 Categories table ready');
          resolve(result);
        },
        (tx, error) => {
          console.log('⚠️ Could not create categories table:', error);
          resolve();
        }
      );
    });
  });
};

// Initialize categories table when service loads
createCategoriesTable();

// Category CRUD operations
const saveCategory = async (category) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve();
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR REPLACE INTO categories 
         (id, name, color, userId, createdAt, updatedAt, noteCount, syncStatus) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          category.id,
          category.name,
          category.color,
          category.userId,
          category.createdAt || new Date().toISOString(),
          category.updatedAt || new Date().toISOString(),
          category.noteCount || 0,
          category.syncStatus || 'synced'
        ],
        (tx, result) => {
          console.log('💾 [MOCK] Category saved:', category.name);
          resolve(result);
        },
        (tx, error) => {
          console.log('⚠️ Could not save category:', error);
          resolve();
        }
      );
    });
  });
};

const getCategories = async (userId) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve([]);
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM categories WHERE userId = ? ORDER BY name ASC',
        [userId],
        (tx, result) => {
          const categories = result.rows._array || [];
          console.log('📂 [MOCK] Categories loaded:', categories.length);
          resolve(categories);
        },
        (tx, error) => {
          console.log('⚠️ Could not get categories:', error);
          resolve([]);
        }
      );
    });
  });
};

const getCategoryById = async (categoryId) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve(null);
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM categories WHERE id = ?',
        [categoryId],
        (tx, result) => {
          const category = result.rows._array[0] || null;
          console.log('📁 [MOCK] Category found:', category ? category.name : 'Not found');
          resolve(category);
        },
        (tx, error) => {
          console.log('⚠️ Could not get category:', error);
          resolve(null);
        }
      );
    });
  });
};

const deleteCategory = async (categoryId) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve();
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM categories WHERE id = ?',
        [categoryId],
        (tx, result) => {
          console.log('🗑️ [MOCK] Category deleted:', categoryId);
          resolve(result);
        },
        (tx, error) => {
          console.log('⚠️ Could not delete category:', error);
          resolve();
        }
      );
    });
  });
};

// Update noteCount for categories
const updateCategoryNoteCount = async (categoryId, noteCount) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve();
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        'UPDATE categories SET noteCount = ?, updatedAt = ? WHERE id = ?',
        [noteCount, new Date().toISOString(), categoryId],
        (tx, result) => {
          console.log('📊 [MOCK] Category note count updated:', categoryId, noteCount);
          resolve(result);
        },
        (tx, error) => {
          console.log('⚠️ Could not update category note count:', error);
          resolve();
        }
      );
    });
  });
};

// Export everything
export default {
  saveUser,
  getUser,
  getAllUsers,
  saveNote,
  getNotes,
  getNoteById,
  deleteNote,
  addToSyncQueue,
  getSyncQueue,
  removeFromSyncQueue,
  markNoteForSync,
  saveCategory,
  getCategories,
  getCategoryById,
  deleteCategory,
  updateCategoryNoteCount,
  isInitialized: () => true,
  isRealSQLite: () => isRealSQLite
};