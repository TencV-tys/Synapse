// src/components/ShareModal.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  TextInput,
  ActivityIndicator,
  Image,
  Share
} from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useAuth } from '../context/AuthContext';
import { database } from '../config/firebase';
import { ref, onValue, off, push, set, serverTimestamp } from 'firebase/database';

const ShareModal = ({ visible, onClose, note, navigation }) => {
  const { shareNote, isOnline } = useNotes();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('external'); // 'external' or 'inApp'
  const [users, setUsers] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Load online users and chat rooms
  useEffect(() => {
    if (!visible || !database) return;

    console.log('🔍 Loading users and chat rooms for sharing...');
    setLoadingUsers(true);

    // Load online users
    const usersRef = ref(database, 'users');
    const usersUnsubscribe = onValue(usersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const usersArray = Object.entries(data)
            .map(([id, userData]) => ({
              id,
              ...userData
            }))
            .filter(u => u.id !== user?.uid) // Exclude current user
            .filter(u => u.lastActive && (Date.now() - new Date(u.lastActive).getTime()) < 300000); // Online in last 5 minutes
          
          setUsers(usersArray);
        } else {
          setUsers([]);
        }
      } catch (error) {
        console.error('❌ Error loading users:', error);
      } finally {
        setLoadingUsers(false);
      }
    });

    // Load chat rooms (public chats)
    const chatsRef = ref(database, 'chats');
    const chatsUnsubscribe = onValue(chatsRef, (snapshot) => {
      try {
        const data = snapshot.val();
        const rooms = [];
        
        if (data && data.public) {
          // Add public chat room
          rooms.push({
            id: 'public',
            name: 'Public Chat',
            type: 'public',
            description: 'Chat with everyone in the community',
            memberCount: Object.keys(users).length,
            emoji: '👥'
          });
        }
        
        // You can add more chat rooms here from your database
        setChatRooms(rooms);
      } catch (error) {
        console.error('❌ Error loading chat rooms:', error);
      }
    });

    return () => {
      off(usersRef, 'value', usersUnsubscribe);
      off(chatsRef, 'value', chatsUnsubscribe);
    };
  }, [visible, user]);

  // External sharing functions
  const handleExternalShare = async (shareMethod) => {
    if (!isOnline) {
      Alert.alert(
        'Offline Mode',
        'Sharing is only available when you\'re online. Please check your internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const shareContent = await shareNote(note.id);
      
      if (shareMethod === 'native') {
        // Use React Native's Share API
        try {
          await Share.share({
            title: shareContent.title,
            message: `${shareContent.message}\n\n${note.content?.substring(0, 100)}...`,
            url: shareContent.url
          });
        } catch (shareError) {
          console.log('Share cancelled or failed:', shareError);
        }
      } else if (shareMethod === 'copy') {
        // Copy to clipboard (you'll need to install @react-native-clipboard/clipboard)
        // Clipboard.setString(shareContent.url);
        Alert.alert('Copied!', 'Note link copied to clipboard');
      }
      
      onClose();
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share note');
    }
  };

  // In-app sharing functions
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
      // Create a unique chat room ID for direct message
      const chatId = [user.uid, targetUser.id].sort().join('_');
      const chatRef = ref(database, `chats/private/${chatId}`);
      
      // Create the shared note message
      const messageData = {
        type: 'shared_note',
        noteId: note.id,
        noteTitle: note.title,
        noteContent: note.content ? note.content.substring(0, 200) + (note.content.length > 200 ? '...' : '') : 'No content',
        sharedBy: {
          userId: user.uid,
          userName: user.name || user.email.split('@')[0],
          userEmail: user.email
        },
        timestamp: serverTimestamp(),
        text: `📝 Shared note: "${note.title}"`
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
              onClose();
              // Navigate to the direct message
              navigation.navigate('Chat', { 
                directMessage: true,
                targetUser: targetUser
              });
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ Error sharing note to user:', error);
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
      
      // Create the shared note message
      const messageData = {
        type: 'shared_note',
        noteId: note.id,
        noteTitle: note.title,
        noteContent: note.content ? note.content.substring(0, 200) + (note.content.length > 200 ? '...' : '') : 'No content',
        sharedBy: {
          userId: user.uid,
          userName: user.name || user.email.split('@')[0],
          userEmail: user.email
        },
        timestamp: serverTimestamp(),
        text: `📝 Shared note: "${note.title}"`
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
              onClose();
              // Navigate to the chat room
              if (chatRoom.id === 'public') {
                navigation.navigate('Chat');
              } else {
                navigation.navigate('Chat', { 
                  directMessage: true,
                  targetUser: { id: chatRoom.id, name: chatRoom.name }
                });
              }
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ Error sharing note to chat:', error);
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

  // External Share Options
  const ExternalShareOptions = () => (
    <View style={styles.shareOptions}>
      <TouchableOpacity 
        style={[styles.shareOption, !isOnline && styles.disabledOption]}
        onPress={() => handleExternalShare('native')}
        disabled={!isOnline}
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconText}>📤</Text>
          {!isOnline && <View style={styles.offlineIndicator} />}
        </View>
        <View style={styles.optionInfo}>
          <Text style={styles.optionTitle}>Share via...</Text>
          <Text style={styles.optionDescription}>
            {isOnline ? 'Share with other apps' : 'Available online only'}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.shareOption, !isOnline && styles.disabledOption]}
        onPress={() => handleExternalShare('copy')}
        disabled={!isOnline}
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconText}>🔗</Text>
          {!isOnline && <View style={styles.offlineIndicator} />}
        </View>
        <View style={styles.optionInfo}>
          <Text style={styles.optionTitle}>Copy Link</Text>
          <Text style={styles.optionDescription}>
            {isOnline ? 'Copy shareable link' : 'Available online only'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  // In-App Share Components
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
          <View style={styles.onlineIndicator} />
          <Text style={styles.onlineText}>Online</Text>
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

  const InAppShareContent = () => (
    <>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users or chats..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
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

      {/* Content */}
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
          showsVerticalScrollIndicator={false}
          style={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>
                {selectedTab === 'users' ? '👥' : '💬'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No results found' : 
                 selectedTab === 'users' ? 'No users online' : 'No chat rooms available'}
              </Text>
            </View>
          }
        />
      )}
    </>
  );

  if (!note) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Share Note</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

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

          {/* Share Type Tabs */}
          <View style={styles.shareTypeTabs}>
            <TouchableOpacity 
              style={[styles.shareTypeTab, selectedTab === 'external' && styles.shareTypeTabActive]}
              onPress={() => setSelectedTab('external')}
            >
              <Text style={[styles.shareTypeTabText, selectedTab === 'external' && styles.shareTypeTabTextActive]}>
                External
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.shareTypeTab, selectedTab === 'inApp' && styles.shareTypeTabActive]}
              onPress={() => setSelectedTab('inApp')}
            >
              <Text style={[styles.shareTypeTabText, selectedTab === 'inApp' && styles.shareTypeTabTextActive]}>
                In-App
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content based on selected tab */}
          {selectedTab === 'external' ? (
            <ExternalShareOptions />
          ) : (
            <InAppShareContent />
          )}

          {/* Permission Warning */}
          {selectedTab === 'inApp' && note.permission !== 'view_only' && (
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

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    minHeight: 500,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
  },
  closeButton: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: 'bold',
  },
  notePreview: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
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
  // Share Type Tabs
  shareTypeTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  shareTypeTab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  shareTypeTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shareTypeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  shareTypeTabTextActive: {
    color: '#6366f1',
  },
  // External Share Styles
  shareOptions: {
    gap: 12,
    marginBottom: 20,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  disabledOption: {
    opacity: 0.5,
  },
  optionIcon: {
    marginRight: 16,
    position: 'relative',
  },
  optionIconText: {
    fontSize: 24,
  },
  offlineIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    backgroundColor: '#ef4444',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#64748b',
  },
  // In-App Share Styles
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
  list: {
    flex: 1,
    minHeight: 200,
    marginBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 11,
    color: '#10b981',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  chatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatIconText: {
    fontSize: 18,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 2,
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
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
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
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    marginBottom: 16,
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
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    marginBottom: 16,
  },
  offlineText: {
    textAlign: 'center',
    color: '#dc2626',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
});

export default ShareModal;