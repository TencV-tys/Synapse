// src/services/sqliteService.js
console.log('📱 SQLite service loading...');

let db = null;
let isRealSQLite = false;

// Create enhanced mock database
function createEnhancedMockDatabase() {
  console.log('🔄 Creating enhanced mock database for React Native');
  
  // Use in-memory storage for React Native
  const mockData = {
    users: {},
    notes: {},
    categories: {},
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
                // Save user - COMPLETE PROFILE PICTURE HANDLING
                const [uid, email, name, userType, password, profilePic, createdAt, lastLogin, lastActive, isOnline, isOffline] = params;
                
                mockData.users[uid] = { 
                  uid, 
                  email, 
                  name, 
                  userType: userType || 'student',
                  password: password || '',
                  profilePic: profilePic || null,
                  createdAt: createdAt || new Date().toISOString(),
                  lastLogin: lastLogin || new Date().toISOString(),
                  lastActive: lastActive || new Date().toISOString(),
                  isOnline: isOnline === 1,
                  isOffline: isOffline === 1 
                };
                console.log('💾 [MOCK] User saved:', email);
                console.log('🖼️ Profile pic saved:', profilePic ? 'YES' : 'NO');
                console.log('📸 Profile pic URL:', profilePic || 'NULL');
                
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
                console.log('🖼️ Profile pic in retrieved user:', user?.profilePic ? 'YES' : 'NO');
                console.log('📸 Retrieved profile pic URL:', user?.profilePic || 'NULL');
                
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
                users.forEach(user => {
                  console.log(`👤 ${user.name}: profilePic = ${user.profilePic ? '✅' : '❌'}`);
                });
                
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rows: {
                      _array: users,
                      length: users.length,
                      item: (index) => users[index] || null
                    }
                  });
                }

              } else if (sqlLower.startsWith('insert or replace into syncqueue')) {
                // Add to sync queue
                const [id, tableName, recordId, operation, data, createdAt, status] = params;
                
                mockData.syncQueue[id] = {
                  id,
                  tableName,
                  recordId,
                  operation,
                  data: typeof data === 'string' ? JSON.parse(data) : data,
                  createdAt: createdAt || new Date().toISOString(),
                  status: status || 'pending'
                };
                console.log('🔄 [MOCK] Added to sync queue:', operation, recordId);
                
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

              } else if (sqlLower.startsWith('select * from syncqueue where status = ?')) {
                // Get sync queue
                const status = params[0];
                const syncItems = Object.values(mockData.syncQueue).filter(item => item.status === status);
                console.log(`🔄 [MOCK] Sync queue items with status ${status}:`, syncItems.length);
                
                if (successCallback) {
                  successCallback(mockTransaction, {
                    rows: {
                      _array: syncItems,
                      length: syncItems.length,
                      item: (index) => syncItems[index] || null
                    }
                  });
                }

              } else if (sqlLower.startsWith('delete from syncqueue where id = ?')) {
                // Remove from sync queue
                const syncId = params[0];
                const existed = mockData.syncQueue.hasOwnProperty(syncId);
                delete mockData.syncQueue[syncId];
                console.log('🗑️ [MOCK] Removed from sync queue:', syncId, existed ? '(existed)' : '(did not exist)');
                
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
                
              } else if (sqlLower.startsWith('insert or replace into notes')) {
                // Save note
                const [id, userId, title, content, tags, isPinned, isFavorite, permission, createdAt, updatedAt, syncStatus] = params;
                
                const existingNote = mockData.notes[id] || {};
                
                const updatedNote = {
                  ...existingNote,
                  id, 
                  userId: userId || existingNote.userId,
                  title: title || existingNote.title || 'Untitled Note',
                  content: content || existingNote.content || '',
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

// User operations - COMPLETE PROFILE PICTURE HANDLING
const saveUser = async (user) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve();
      return;
    }

    console.log('💾 Saving user to SQLite:', user.email);
    console.log('🖼️ Profile pic to save:', user.profilePic ? 'YES' : 'NO');
    console.log('📸 Profile pic URL:', user.profilePic || 'NULL');

    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR REPLACE INTO users (uid, email, name, userType, password, profilePic, createdAt, lastLogin, lastActive, isOnline, isOffline) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.uid, 
          user.email, 
          user.name, 
          user.userType || 'student',
          user.password || '',
          user.profilePic || null,
          user.createdAt || new Date().toISOString(),
          user.lastLogin || new Date().toISOString(),
          user.lastActive || new Date().toISOString(),
          user.isOnline ? 1 : 0,
          user.isOffline ? 1 : 0
        ],
        (tx, result) => {
          console.log('💾✅ User saved successfully to SQLite:', user.email);
          console.log('🖼️✅ Profile pic saved to SQLite:', user.profilePic ? 'YES' : 'NO');
          resolve(result);
        },
        (tx, error) => {
          console.log('⚠️ Could not save user to SQLite:', error);
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
            console.log('👤✅ User retrieved from SQLite:', user.email);
            console.log('🖼️✅ Profile pic in SQLite:', user.profilePic ? 'YES' : 'NO');
            console.log('📸 Profile pic URL from SQLite:', user.profilePic || 'NULL');
          } else {
            console.log('👤❌ User not found in SQLite for ID:', uid);
          }
          resolve(user);
        },
        (tx, error) => {
          console.log('⚠️ Could not get user from SQLite:', error);
          resolve(null);
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
          console.log(`👥✅ Retrieved ${users.length} users from SQLite`);
          users.forEach(user => {
            console.log(`👤 ${user.name}: profilePic = ${user.profilePic ? '✅' : '❌'}`);
          });
          resolve(users);
        },
        (tx, error) => {
          console.log('⚠️ Could not get users from SQLite:', error);
          resolve([]);
        }
      );
    });
  });
};

// ✅ SYNC FUNCTIONS
const addToSyncQueue = async (tableName, recordId, operation, data) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve();
      return;
    }

    const syncId = `${tableName}_${recordId}_${Date.now()}`;
    const dataString = JSON.stringify(data || {});

    console.log('🔄 Adding to sync queue:', operation, recordId);

    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR REPLACE INTO syncQueue (id, tableName, recordId, operation, data, createdAt, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          syncId,
          tableName,
          recordId,
          operation,
          dataString,
          new Date().toISOString(),
          'pending'
        ],
        (tx, result) => {
          console.log('🔄✅ Added to sync queue:', operation, recordId);
          resolve(result);
        },
        (tx, error) => {
          console.log('⚠️ Could not add to sync queue:', error);
          resolve();
        }
      );
    });
  });
};

const getSyncQueue = async () => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve([]);
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM syncQueue WHERE status = ? ORDER BY createdAt ASC',
        ['pending'],
        (tx, result) => {
          const syncItems = result.rows._array || [];
          console.log(`🔄✅ Retrieved ${syncItems.length} sync queue items`);
          
          // Parse JSON data
          const parsedItems = syncItems.map(item => ({
            ...item,
            data: typeof item.data === 'string' ? JSON.parse(item.data) : item.data
          }));
          
          resolve(parsedItems);
        },
        (tx, error) => {
          console.log('⚠️ Could not get sync queue:', error);
          resolve([]);
        }
      );
    });
  });
};

const removeFromSyncQueue = async (syncId) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve();
      return;
    }

    console.log('🗑️ Removing from sync queue:', syncId);

    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM syncQueue WHERE id = ?',
        [syncId],
        (tx, result) => {
          console.log('🗑️✅ Removed from sync queue:', syncId);
          resolve(result);
        },
        (tx, error) => {
          console.log('⚠️ Could not remove from sync queue:', error);
          resolve();
        }
      );
    });
  });
};

const markNoteForSync = async (noteId, operation, data) => {
  console.log('🔄 Marking note for sync:', operation, noteId);
  return addToSyncQueue('notes', noteId, operation, data);
};

// ✅ PROFILE PICTURE SYNC FUNCTIONS
const needsProfilePicSync = (user) => {
  if (!user || !user.profilePic) return false;
  
  const isLocalFile = user.profilePic.startsWith('file://');
  const isOnlineUser = !user.isOffline;
  
  return isLocalFile && isOnlineUser;
};

const markUserForProfilePicSync = async (user) => {
  if (!needsProfilePicSync(user)) {
    console.log('ℹ️ User does not need profile picture sync');
    return;
  }
  
  console.log('🔄 Marking user for profile picture sync:', user.email);
  
  return addToSyncQueue('users', user.uid, 'upload_profile_pic', {
    userId: user.uid,
    profilePicUri: user.profilePic,
    email: user.email,
    name: user.name
  });
};

const processProfilePicSync = async (syncItem, uploadFunction) => {
  try {
    console.log('🔄 Processing profile picture sync for:', syncItem.data.email);
    
    const { userId, profilePicUri } = syncItem.data;
    
    if (!profilePicUri || !profilePicUri.startsWith('file://')) {
      console.log('❌ Invalid profile picture URI for sync');
      return { success: false, error: 'Invalid profile picture URI' };
    }
    
    // Upload profile picture to Firebase Storage
    const downloadURL = await uploadFunction(profilePicUri, userId);
    console.log('✅ Profile picture uploaded during sync:', downloadURL);
    
    // Update user in SQLite with new URL
    const currentUser = await getUser(userId);
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        profilePic: downloadURL,
        updatedAt: new Date().toISOString()
      };
      
      await saveUser(updatedUser);
      console.log('✅ User updated in SQLite with cloud profile picture');
    }
    
    return { success: true, downloadURL };
  } catch (error) {
    console.error('❌ Error processing profile picture sync:', error);
    return { success: false, error: error.message };
  }
};

// ✅ AUTO SYNC FUNCTION
const processPendingSyncQueue = async (uploadFunction) => {
  try {
    console.log('🔄 Processing pending sync queue...');
    const pendingItems = await getSyncQueue();
    
    if (pendingItems.length === 0) {
      console.log('ℹ️ No pending sync items');
      return { processed: 0, failed: 0 };
    }
    
    let processed = 0;
    let failed = 0;
    
    for (const item of pendingItems) {
      try {
        if (item.operation === 'upload_profile_pic') {
          console.log('📸 Processing profile picture sync item:', item.id);
          const result = await processProfilePicSync(item, uploadFunction);
          
          if (result.success) {
            await removeFromSyncQueue(item.id);
            processed++;
            console.log('✅ Profile picture sync completed:', item.id);
          } else {
            failed++;
            console.log('❌ Profile picture sync failed:', item.id, result.error);
          }
        } else {
          // Handle other sync operations
          console.log('⚡ Processing other sync item:', item.operation);
          await removeFromSyncQueue(item.id);
          processed++;
        }
      } catch (error) {
        failed++;
        console.error('❌ Error processing sync item:', item.id, error);
      }
    }
    
    console.log(`🔄 Sync completed: ${processed} processed, ${failed} failed`);
    return { processed, failed };
  } catch (error) {
    console.error('❌ Error processing sync queue:', error);
    return { processed: 0, failed: 0 };
  }
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
              
              if (row.tags) {
                try {
                  if (typeof row.tags === 'string') {
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

// ✅ Initialize sync queue table
const createSyncQueueTable = async () => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.log('⚠️ Database not available');
      resolve();
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS syncQueue (
          id TEXT PRIMARY KEY,
          tableName TEXT NOT NULL,
          recordId TEXT NOT NULL,
          operation TEXT NOT NULL,
          data TEXT,
          createdAt TEXT NOT NULL,
          status TEXT DEFAULT 'pending'
        )`,
        [],
        (tx, result) => {
          console.log('🔄 Sync queue table ready');
          resolve(result);
        },
        (tx, error) => {
          console.log('⚠️ Could not create sync queue table:', error);
          resolve();
        }
      );
    });
  });
};

// Initialize sync queue table when service loads
createSyncQueueTable();

// Export everything - WITH SYNC FUNCTIONS
export default {
  // User operations
  saveUser,
  getUser,
  getAllUsers,
  
  // Note operations
  saveNote,
  getNotes,
  getNoteById,
  deleteNote,
  
  // Sync operations
  addToSyncQueue,
  getSyncQueue,
  removeFromSyncQueue,
  markNoteForSync,
  
  // ✅ Profile picture sync functions
  needsProfilePicSync,
  markUserForProfilePicSync,
  processProfilePicSync,
  processPendingSyncQueue, // ✅ ADDED
  
  // Category operations
  saveCategory,
  getCategories,
  getCategoryById,
  deleteCategory,
  updateCategoryNoteCount,
  
  // Database info
  isInitialized: () => true,
  isRealSQLite: () => isRealSQLite
};