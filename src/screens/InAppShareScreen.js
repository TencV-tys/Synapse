// src/screens/InAppShareScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  Keyboard,
  Dimensions,
  StatusBar
} from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useAuth } from '../context/AuthContext';
import { database, firestore } from '../config/firebase';
import { ref, onValue, off, push, set, serverTimestamp } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const InAppShareScreen = ({ route, navigation }) => {
  const { note } = route.params;
  const { isOnline } = useNotes();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Your existing getCompleteUserData function
  const getCompleteUserData = async (userId, realtimeData) => {
    try {
      const userDoc = await getDoc(doc(firestore, 'users', userId));
      
      if (userDoc.exists()) {
        const firestoreData = userDoc.data();
        return {
          id: userId,
          uid: userId,
          name: firestoreData.name || firestoreData.displayName || 
                (firestoreData.email ? firestoreData.email.split('@')[0] : 'User'),
          email: firestoreData.email || 'No email',
          profilePic: firestoreData.profilePic || firestoreData.photoURL || null,
          userType: firestoreData.userType || 'student',
          lastActive: realtimeData?.lastActive || firestoreData.lastActive,
          isOnline: realtimeData?.isOnline !== undefined ? realtimeData.isOnline : true,
          createdAt: firestoreData.createdAt,
          ...realtimeData,
          ...firestoreData
        };
      } else {
        return {
          id: userId,
          uid: userId,
          name: realtimeData?.name || realtimeData?.displayName || 
                (realtimeData?.email ? realtimeData.email.split('@')[0] : 'User'),
          email: realtimeData?.email || 'No email',
          profilePic: realtimeData?.profilePic || realtimeData?.photoURL || null,
          userType: realtimeData?.userType || 'student',
          lastActive: realtimeData?.lastActive,
          isOnline: realtimeData?.isOnline,
          createdAt: realtimeData?.createdAt,
          ...realtimeData
        };
      }
    } catch (error) {
      console.error('Error fetching Firestore data:', error);
      return {
        id: userId,
        uid: userId,
        name: realtimeData?.name || realtimeData?.displayName || 
              (realtimeData?.email ? realtimeData.email.split('@')[0] : 'User'),
        email: realtimeData?.email || 'No email',
        profilePic: realtimeData?.profilePic || realtimeData?.photoURL || null,
        userType: realtimeData?.userType || 'student',
        lastActive: realtimeData?.lastActive,
        isOnline: realtimeData?.isOnline,
        createdAt: realtimeData?.createdAt,
        ...realtimeData
      };
    }
  };

  // Load users and chat rooms
  useEffect(() => {
    if (!database) return;

    setLoadingUsers(true);

    const loadUsers = () => {
      const usersRef = ref(database, 'users');
      
      const usersUnsubscribe = onValue(usersRef, async (snapshot) => {
        try {
          const data = snapshot.val();
          
          if (data) {
            const usersPromises = Object.entries(data)
              .filter(([id]) => id !== user?.uid)
              .map(async ([id, userData]) => {
                const isIncomplete = !userData.name || !userData.email || !userData.userType;
                
                if (isIncomplete) {
                  return await getCompleteUserData(id, userData);
                } else {
                  return {
                    id,
                    uid: id,
                    name: userData.name || userData.displayName || 
                          (userData.email ? userData.email.split('@')[0] : 'User'),
                    email: userData.email || 'No email',
                    profilePic: userData.profilePic || userData.photoURL || null,
                    userType: userData.userType || 'student',
                    lastActive: userData.lastActive,
                    isOnline: userData.isOnline,
                    createdAt: userData.createdAt,
                    ...userData
                  };
                }
              });

            const usersArray = await Promise.all(usersPromises);
            setUsers(usersArray);
          } else {
            setUsers([]);
          }
        } catch (error) {
          console.error('Error loading users:', error);
          setUsers([]);
        } finally {
          setLoadingUsers(false);
        }
      });

      return usersUnsubscribe;
    };

    const loadChatRooms = () => {
      const chatsRef = ref(database, 'chats');
      const usersRef = ref(database, 'users');
      
      return onValue(chatsRef, (snapshot) => {
        try {
          const data = snapshot.val();
          const rooms = [];
          
          onValue(usersRef, (usersSnapshot) => {
            const usersData = usersSnapshot.val();
            const totalUsers = usersData ? Object.keys(usersData).length : 1;
            
            rooms.push({
              id: 'public',
              name: 'Public Chat',
              type: 'public',
              description: 'Chat with everyone in the community',
              memberCount: totalUsers,
              emoji: '👥'
            });

            if (data && data.private) {
              Object.entries(data.private).forEach(([chatId, chatData]) => {
                if (chatId.includes(user?.uid)) {
                  const userIds = chatId.split('_');
                  const otherUserId = userIds.find(id => id !== user?.uid);
                  const otherUser = users.find(u => u.id === otherUserId);
                  const chatName = otherUser ? `Chat with ${otherUser.name}` : 'Private Chat';
                  
                  rooms.push({
                    id: chatId,
                    name: chatName,
                    type: 'private',
                    description: 'Private conversation',
                    memberCount: 2,
                    emoji: '💬',
                    otherUserId: otherUserId
                  });
                }
              });
            }
            
            setChatRooms(rooms);
          }, { onlyOnce: true });
          
        } catch (error) {
          console.error('Error loading chat rooms:', error);
          setChatRooms([{
            id: 'public',
            name: 'Public Chat',
            type: 'public',
            description: 'Chat with everyone in the community',
            memberCount: users.length + 1,
            emoji: '👥'
          }]);
        }
      });
    };

    const usersUnsubscribe = loadUsers();
    const chatsUnsubscribe = loadChatRooms();

    return () => {
      off(ref(database, 'users'), 'value', usersUnsubscribe);
      off(ref(database, 'chats'), 'value', chatsUnsubscribe);
    };
  }, [user]);

  // Your existing share functions
  const handleShareToUser = async (targetUser) => {
    if (!isOnline) {
      Alert.alert('Offline', 'You need to be online to share notes');
      return;
    }

    if (!note || note.permission !== 'view_only') {
      Alert.alert(
        'Private Note',
        'Only public notes (View Only) can be shared. Change the note permission to "Public" to share it.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);
    try {
      const chatId = [user.uid, targetUser.id].sort().join('_');
      const chatRef = ref(database, `chats/private/${chatId}`);
      
      const completeUserData = await getCompleteUserData(user.uid, {
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        userType: user.userType
      });

      const messageData = {
        type: 'shared_note',
        noteId: note.id,
        noteTitle: note.title || 'Untitled Note',
        noteContent: note.content ? note.content.substring(0, 200) + (note.content.length > 200 ? '...' : '') : 'No content',
        userId: user.uid,
        userName: completeUserData.name,
        userEmail: completeUserData.email,
        userProfilePic: completeUserData.profilePic,
        userType: completeUserData.userType,
        timestamp: serverTimestamp(),
        text: `📝 Shared note: "${note.title || 'Untitled Note'}"`
      };
      
      const newMessageRef = push(chatRef);
      await set(newMessageRef, messageData);
      
      Alert.alert(
        'Note Shared',
        `"${note.title}" shared to ${targetUser.name}`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              navigation.navigate('Chat', { 
                directMessage: true,
                targetUser: {
                  id: targetUser.id,
                  name: targetUser.name,
                  email: targetUser.email,
                  profilePic: targetUser.profilePic,
                  userType: targetUser.userType
                }
              });
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error sharing note to user:', error);
      Alert.alert('Error', 'Failed to share note');
    } finally {
      setLoading(false);
    }
  };

  const handleShareToChat = async (chatRoom) => {
    if (!isOnline) {
      Alert.alert('Offline', 'You need to be online to share notes');
      return;
    }

    if (!note || note.permission !== 'view_only') {
      Alert.alert(
        'Private Note',
        'Only public notes (View Only) can be shared. Change the note permission to "Public" to share it.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);
    try {
      let chatRef;
      
      if (chatRoom.id === 'public') {
        chatRef = ref(database, 'chats/public');
      } else {
        chatRef = ref(database, `chats/private/${chatRoom.id}`);
      }
      
      const completeUserData = await getCompleteUserData(user.uid, {
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        userType: user.userType
      });

      const messageData = {
        type: 'shared_note',
        noteId: note.id,
        noteTitle: note.title || 'Untitled Note',
        noteContent: note.content ? note.content.substring(0, 200) + (note.content.length > 200 ? '...' : '') : 'No content',
        userId: user.uid,
        userName: completeUserData.name,
        userEmail: completeUserData.email,
        userProfilePic: completeUserData.profilePic,
        userType: completeUserData.userType,
        timestamp: serverTimestamp(),
        text: `📝 Shared note: "${note.title || 'Untitled Note'}"`
      };
      
      const newMessageRef = push(chatRef);
      await set(newMessageRef, messageData);
      
      Alert.alert(
        'Note Shared',
        `"${note.title}" shared to ${chatRoom.name}`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              if (chatRoom.id === 'public') {
                navigation.navigate('Chat');
              } else {
                const userIds = chatRoom.id.split('_');
                const otherUserId = userIds.find(id => id !== user?.uid);
                const otherUser = users.find(u => u.id === otherUserId);
                
                navigation.navigate('Chat', { 
                  directMessage: true,
                  targetUser: {
                    id: otherUserId,
                    name: otherUser?.name || 'User',
                    email: otherUser?.email,
                    profilePic: otherUser?.profilePic,
                    userType: otherUser?.userType
                  }
                });
              }
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error sharing note to chat:', error);
      Alert.alert('Error', 'Failed to share note');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChats = chatRooms.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleColor = (userType) => {
    switch (userType) {
      case 'teacher': return '#dc2626';
      case 'admin': return '#7c3aed';
      case 'student': return '#059669';
      default: return '#6b7280';
    }
  };

  const getRoleLabel = (userType) => {
    switch (userType) {
      case 'teacher': return 'Teacher';
      case 'admin': return 'Admin';
      case 'student': return 'Student';
      default: return 'User';
    }
  };

  const isUserOnline = (userData) => {
    return userData.isOnline || 
      (userData.lastActive && (Date.now() - new Date(userData.lastActive).getTime()) < 300000);
  };

  const UserItem = ({ user }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => handleShareToUser(user)}
      disabled={loading}
    >
      {user.profilePic ? (
        <Image source={{ uri: user.profilePic }} style={styles.userAvatar} />
      ) : (
        <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarText}>
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.name || user.email.split('@')[0]}</Text>
        <View style={styles.userDetails}>
          <View 
            style={[
              styles.roleBadge, 
              { backgroundColor: getRoleColor(user.userType) }
            ]}
          >
            <Text style={styles.roleText}>
              {getRoleLabel(user.userType)}
            </Text>
          </View>
          <View style={[styles.onlineIndicator, isUserOnline(user) ? styles.online : styles.offline]} />
          <Text style={[styles.onlineText, isUserOnline(user) ? styles.online : styles.offline]}>
            {isUserOnline(user) ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
      <Text style={styles.shareArrow}>➔</Text>
    </TouchableOpacity>
  );

  const ChatItem = ({ chat }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => handleShareToChat(chat)}
      disabled={loading}
    >
      <View style={styles.chatIcon}>
        <Text style={styles.chatIconText}>{chat.emoji || '💬'}</Text>
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{chat.name}</Text>
        <Text style={styles.chatDetails}>
          {chat.type === 'public' ? 'Public' : 'Private'} • {chat.memberCount || 0} members
        </Text>
      </View>
      <Text style={styles.shareArrow}>➔</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      

      {/* Note Preview */}
      <View style={styles.notePreview}>
        <Text style={styles.noteTitle} numberOfLines={1}>
          {note.title}
        </Text>
        <Text style={styles.noteContent} numberOfLines={2}>
          {note.content || 'No content'}
        </Text>
        <View style={[
          styles.noteBadge,
          note.permission === 'view_only' ? styles.publicBadge : styles.privateBadge
        ]}>
          <Text style={styles.noteBadgeText}>
            {note.permission === 'view_only' ? '👁️ Public' : '🔒 Private'}
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users or chats..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          returnKeyType="search"
          autoFocus={true}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            style={styles.clearSearchButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'users' && styles.tabActive]}
          onPress={() => setSelectedTab('users')}
        >
          <Text style={[styles.tabText, selectedTab === 'users' && styles.tabTextActive]}>
            👥 Users ({users.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'chats' && styles.tabActive]}
          onPress={() => setSelectedTab('chats')}
        >
          <Text style={[styles.tabText, selectedTab === 'chats' && styles.tabTextActive]}>
            💬 Chats ({chatRooms.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={styles.listContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Sharing note...</Text>
          </View>
        ) : loadingUsers ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={selectedTab === 'users' ? filteredUsers : filteredChats}
            renderItem={({ item }) => 
              selectedTab === 'users' ? 
                <UserItem user={item} /> : 
                <ChatItem chat={item} />
            }
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={true}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>
                  {selectedTab === 'users' ? '👥' : '💬'}
                </Text>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No results found' : 
                  selectedTab === 'users' ? 'No users found' : 'No chat rooms available'}
                </Text>
                {selectedTab === 'users' && !searchQuery && (
                  <Text style={styles.emptySubtext}>
                    Other users will appear here when they register in the app
                  </Text>
                )}
              </View>
            }
          />
        )}
      </View>

      {/* Permission Warning */}
      {note.permission !== 'view_only' && (
        <View style={styles.permissionWarning}>
          <Text style={styles.warningIcon}>🔒</Text>
          <Text style={styles.warningText}>
            This is a private note. Change permission to "Public" to share within the app.
          </Text>
        </View>
      )}

      {/* Offline Warning */}
      {!isOnline && (
        <View style={styles.offlineWarning}>
          <Text style={styles.offlineText}>📴 You are offline - Sharing unavailable</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    fontSize: 24,
    color: '#64748b',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
  },
  headerSpacer: {
    width: 24,
  },
  notePreview: {
    backgroundColor: '#f8fafc',
    padding: 16,
    margin: 24,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  noteContent: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  noteBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  publicBadge: {
    backgroundColor: '#dbeafe',
  },
  privateBadge: {
    backgroundColor: '#f3f4f6',
  },
  noteBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    marginHorizontal: 24,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 12,
    paddingRight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 16,
  },
  clearSearchButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  clearSearchText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginHorizontal: 24,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  tabText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    marginHorizontal: 24,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  userDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  roleText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  online: {
    backgroundColor: '#10b981',
  },
  offline: {
    backgroundColor: '#94a3b8',
  },
  onlineText: {
    fontSize: 12,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  chatIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatIconText: {
    fontSize: 20,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  chatDetails: {
    fontSize: 14,
    color: '#64748b',
  },
  shareArrow: {
    fontSize: 18,
    color: '#6366f1',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  emptyState: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 24,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },
  offlineWarning: {
    padding: 12,
    margin: 24,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  offlineText: {
    textAlign: 'center',
    color: '#dc2626',
    fontWeight: '600',
  },
});

export default InAppShareScreen;