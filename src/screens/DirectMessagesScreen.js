// src/screens/DirectMessagesScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../config/firebase';
import { ref, onValue, off, set } from 'firebase/database';

const DirectMessagesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const loadUsers = () => {
    return new Promise((resolve) => {
      const usersRef = ref(database, 'users');
      console.log('🔍 Setting up users listener...');
      
      const usersUnsubscribe = onValue(usersRef, (snapshot) => {
        try {
          const data = snapshot.val();
          console.log('📊 Users data received:', data);
          
          if (data) {
            const usersArray = Object.entries(data)
              .map(([id, userData]) => ({
                id,
                // Ensure complete user profile data
                name: userData.name || userData.displayName || (userData.email ? userData.email.split('@')[0] : 'User'),
                email: userData.email || 'No email',
                profilePic: userData.profilePic || userData.photoURL || null,
                userType: userData.userType || 'student',
                lastActive: userData.lastActive,
                isOnline: userData.isOnline,
                createdAt: userData.createdAt,
                ...userData
              }))
              .filter(u => u.id !== user?.uid); // Exclude current user
            
            console.log(`👥 Processed ${usersArray.length} users (excluding current user)`);
            setUsers(usersArray);
            setHasData(usersArray.length > 0);
          } else {
            console.log('❌ No users found in database');
            setUsers([]);
            setHasData(false);
          }
        } catch (error) {
          console.error('❌ Error loading users:', error);
          setHasData(false);
        } finally {
          setLoading(false);
          setRefreshing(false);
          resolve();
        }
      }, (error) => {
        console.error('❌ Firebase users listener error:', error);
        console.error('Error code:', error.code, 'Message:', error.message);
        setLoading(false);
        setRefreshing(false);
        setHasData(false);
        resolve();
      });

      return usersUnsubscribe;
    });
  };

  const loadRecentChats = () => {
    const chatsRef = ref(database, 'chats/private');
    const chatsUnsubscribe = onValue(chatsRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const recentChatsArray = [];
          
          // Find chats involving current user and get last message
          Object.entries(data).forEach(([chatId, messages]) => {
            if (chatId.includes(user?.uid)) {
              const messageArray = Object.values(messages);
              const lastMessage = messageArray[messageArray.length - 1];
              
              if (lastMessage) {
                // Extract the other user's ID from chat ID
                const userIds = chatId.split('_');
                const otherUserId = userIds.find(id => id !== user?.uid);
                
                recentChatsArray.push({
                  chatId,
                  otherUserId,
                  lastMessage: lastMessage.text,
                  timestamp: lastMessage.timestamp,
                  unread: 0,
                  lastMessageData: lastMessage // Store complete message data
                });
              }
            }
          });
          
          // Sort by timestamp
          recentChatsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setRecentChats(recentChatsArray);
        }
      } catch (error) {
        console.error('❌ Error loading recent chats:', error);
      }
    });

    return chatsUnsubscribe;
  };

  useEffect(() => {
    console.log('💬 DirectMessagesScreen mounted - User:', user?.email);
    
    if (!database) {
      console.error('❌ Database not initialized');
      setLoading(false);
      return;
    }

    const usersUnsubscribe = loadUsers();
    const chatsUnsubscribe = loadRecentChats();

    return () => {
      console.log('🧹 Cleaning up DirectMessagesScreen listeners');
      off(ref(database, 'users'), 'value', usersUnsubscribe);
      off(ref(database, 'chats/private'), 'value', chatsUnsubscribe);
    };
  }, [user]);

  const onRefresh = async () => {
    console.log('🔄 Manual refresh triggered');
    setRefreshing(true);
    await loadUsers();
  };

  const startChat = (targetUser) => {
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
  };

  const showProfile = async (userData) => {
    try {
      console.log('👤 Showing profile for:', userData);
      
      // Get fresh user data from Firebase to ensure we have the latest
      const userRef = ref(database, `users/${userData.id}`);
      
      onValue(userRef, (snapshot) => {
        const freshUserData = snapshot.val();
        if (freshUserData) {
          const completeUserData = {
            id: userData.id,
            name: freshUserData.name || freshUserData.displayName || (freshUserData.email ? freshUserData.email.split('@')[0] : 'User'),
            email: freshUserData.email || 'No email',
            profilePic: freshUserData.profilePic || freshUserData.photoURL || null,
            userType: freshUserData.userType || 'student',
            lastActive: freshUserData.lastActive,
            isOnline: freshUserData.isOnline,
            createdAt: freshUserData.createdAt,
            ...freshUserData
          };
          setSelectedUser(completeUserData);
          setShowUserProfile(true);
        }
      }, { onlyOnce: true });
      
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      // Fallback to the data we already have
      setSelectedUser(userData);
      setShowUserProfile(true);
    }
  };

  const createDemoUsers = async () => {
    try {
      console.log('🎭 Creating demo users...');
      
      const demoUsers = [
        {
          id: 'demo_teacher_1',
          email: 'teacher.demo@synapse.com',
          name: 'Dr. Sarah Wilson',
          displayName: 'Dr. Sarah Wilson',
          userType: 'teacher',
          profilePic: null,
          lastActive: new Date().toISOString(),
          isOnline: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo_student_1',
          email: 'student1.demo@synapse.com',
          name: 'Alex Johnson',
          displayName: 'Alex Johnson',
          userType: 'student',
          profilePic: null,
          lastActive: new Date(Date.now() - 15 * 60000).toISOString(), // 15 mins ago
          isOnline: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo_student_2',
          email: 'student2.demo@synapse.com',
          name: 'Maria Garcia',
          displayName: 'Maria Garcia',
          userType: 'student',
          profilePic: null,
          lastActive: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
          isOnline: false,
          createdAt: new Date().toISOString()
        }
      ];

      // Save demo users to Firebase
      for (const demoUser of demoUsers) {
        const userRef = ref(database, `users/${demoUser.id}`);
        await set(userRef, demoUser);
        console.log(`✅ Created demo user: ${demoUser.name}`);
      }

      Alert.alert('Demo Users Created', 'You can now test the messaging features with demo users!');
      
    } catch (error) {
      console.error('❌ Error creating demo users:', error);
      Alert.alert('Error', 'Could not create demo users. Please check your Firebase configuration.');
    }
  };

  const continueChat = (chat) => {
    // Find user info for this chat
    const userInfo = users.find(u => u.id === chat.otherUserId);
    if (userInfo) {
      navigation.navigate('Chat', {
        directMessage: true,
        targetUser: {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
          profilePic: userInfo.profilePic,
          userType: userInfo.userType
        }
      });
    } else {
      // If user not in current list, try to fetch fresh data
      const userRef = ref(database, `users/${chat.otherUserId}`);
      onValue(userRef, (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
          navigation.navigate('Chat', {
            directMessage: true,
            targetUser: {
              id: chat.otherUserId,
              name: userData.name || userData.displayName || (userData.email ? userData.email.split('@')[0] : 'User'),
              email: userData.email,
              profilePic: userData.profilePic || userData.photoURL,
              userType: userData.userType
            }
          });
        }
      }, { onlyOnce: true });
    }
  };

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

  const formatLastSeen = (lastActive) => {
    if (!lastActive) return 'Never';
    
    const diff = Date.now() - new Date(lastActive).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => startChat(item)}
      onLongPress={() => showProfile(item)}
    >
      <View style={styles.avatarContainer}>
        {item.profilePic ? (
          <Image source={{ uri: item.profilePic }} style={styles.userAvatar} />
        ) : (
          <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {item.name ? item.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
        )}
        <View 
          style={[
            styles.onlineIndicator,
            isUserOnline(item) ? styles.online : styles.offline
          ]} 
        />
      </View>
      
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <View style={styles.userDetails}>
          <View 
            style={[
              styles.roleBadge, 
              { backgroundColor: getRoleColor(item.userType) }
            ]}
          >
            <Text style={styles.roleText}>
              {getRoleLabel(item.userType)}
            </Text>
          </View>
          <Text style={styles.lastSeen}>
            {isUserOnline(item) ? 'Online' : formatLastSeen(item.lastActive)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.chatIcon}>💬</Text>
    </TouchableOpacity>
  );

  const renderRecentChat = ({ item }) => {
    const userInfo = users.find(u => u.id === item.otherUserId);
    if (!userInfo) return null;

    return (
      <TouchableOpacity 
        style={styles.recentChatItem}
        onPress={() => continueChat(item)}
        onLongPress={() => showProfile(userInfo)}
      >
        <View style={styles.avatarContainer}>
          {userInfo.profilePic ? (
            <Image source={{ uri: userInfo.profilePic }} style={styles.userAvatar} />
          ) : (
            <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {userInfo.name ? userInfo.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}
          <View 
            style={[
              styles.onlineIndicator,
              isUserOnline(userInfo) ? styles.online : styles.offline
            ]} 
          />
        </View>
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatUserName}>
              {userInfo.name}
            </Text>
            <Text style={styles.chatTime}>
              {item.timestamp ? formatLastSeen(item.timestamp) : ''}
            </Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>
        
        {item.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{item.unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💬 Direct Messages</Text>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
          <Text style={styles.refreshButton}>🔄</Text>
        </TouchableOpacity>
      </View>

      {!hasData && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No Other Users Yet</Text>
          <Text style={styles.emptyText}>
            You're currently the only user in the app. 
            When other users register and come online, they'll appear here for direct messaging.
          </Text>
          
          <View style={styles.emptyActions}>
            <TouchableOpacity 
              style={styles.demoButton}
              onPress={createDemoUsers}
            >
              <Text style={styles.demoButtonText}>🎭 Create Demo Users</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.publicChatButton}
              onPress={() => navigation.navigate('Chat')}
            >
              <Text style={styles.publicChatButtonText}>💬 Try Public Chat</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.emptyHint}>
            Tip: Open the app on another device with a different account to test messaging
          </Text>
        </View>
      )}

      {hasData && (
        <FlatList
          data={[
            ...(recentChats.length > 0 ? [
              { type: 'header', title: 'Recent Conversations', key: 'recent-header' },
              ...recentChats.map(chat => ({ type: 'recent', ...chat }))
            ] : []),
            { type: 'header', title: 'All Users', key: 'users-header' },
            ...users.map(user => ({ type: 'user', ...user }))
          ]}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{item.title}</Text>
                </View>
              );
            } else if (item.type === 'recent') {
              return renderRecentChat({ item });
            } else {
              return renderUserItem({ item });
            }
          }}
          keyExtractor={(item, index) => item.key || item.id || index.toString()}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6366f1']}
              tintColor="#6366f1"
            />
          }
        />
      )}

      {/* User Profile Modal */}
      <Modal
        visible={showUserProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUserProfile(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.profileModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>User Profile</Text>
              <TouchableOpacity onPress={() => setShowUserProfile(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedUser && (
              <View style={styles.profileContent}>
                {selectedUser.profilePic ? (
                  <Image source={{ uri: selectedUser.profilePic }} style={styles.profileAvatar} />
                ) : (
                  <View style={[styles.profileAvatar, styles.avatarPlaceholder]}>
                    <Text style={styles.profileAvatarText}>
                      {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>
                )}
                
                <Text style={styles.profileName}>
                  {selectedUser.name}
                </Text>
                <Text style={styles.profileEmail}>{selectedUser.email}</Text>
                
                <View 
                  style={[
                    styles.profileRoleBadge,
                    { backgroundColor: getRoleColor(selectedUser.userType) }
                  ]}
                >
                  <Text style={styles.profileRoleText}>
                    {getRoleLabel(selectedUser.userType)}
                  </Text>
                </View>

                <View style={styles.profileStatus}>
                  <View 
                    style={[
                      styles.statusIndicator,
                      isUserOnline(selectedUser) ? styles.statusOnline : styles.statusOffline
                    ]} 
                  />
                  <Text style={styles.profileStatusText}>
                    {isUserOnline(selectedUser) ? 'Online' : `Last seen ${formatLastSeen(selectedUser.lastActive)}`}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={styles.messageUserButton}
                  onPress={() => {
                    startChat(selectedUser);
                    setShowUserProfile(false);
                  }}
                >
                  <Text style={styles.messageUserButtonText}>💬 Send Message</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#6366f1',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    fontSize: 20,
    color: '#fff',
    padding: 8,
  },
  list: {
    flex: 1,
  },
  sectionHeader: {
    padding: 15,
    paddingBottom: 10,
    backgroundColor: '#f8fafc',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  recentChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  online: {
    backgroundColor: '#10b981',
  },
  offline: {
    backgroundColor: '#94a3b8',
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  roleText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  lastSeen: {
    fontSize: 12,
    color: '#64748b',
  },
  chatIcon: {
    fontSize: 18,
    color: '#6366f1',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  chatTime: {
    fontSize: 12,
    color: '#64748b',
  },
  lastMessage: {
    fontSize: 14,
    color: '#64748b',
  },
  unreadBadge: {
    backgroundColor: '#6366f1',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  emptyActions: {
    gap: 12,
    width: '100%',
    maxWidth: 280,
  },
  demoButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  demoButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  publicChatButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  publicChatButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyHint: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  profileModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
  },
  closeButton: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: 'bold',
  },
  profileContent: {
    alignItems: 'center',
    padding: 20,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 12,
  },
  profileRoleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  profileRoleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusOnline: {
    backgroundColor: '#10b981',
  },
  statusOffline: {
    backgroundColor: '#94a3b8',
  },
  profileStatusText: {
    fontSize: 14,
    color: '#64748b',
  },
  messageUserButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  messageUserButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default DirectMessagesScreen; 