// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Keyboard
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../config/firebase';
import { ref, push, onValue, off, set, serverTimestamp } from 'firebase/database';

const ChatScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // Get direct message parameters from navigation
  const { directMessage, targetUser } = route.params || {};
  
  const [activeChat, setActiveChat] = useState(
    directMessage ? targetUser?.id : 'public'
  );
  const [activeChatName, setActiveChatName] = useState(
    directMessage ? targetUser?.name : 'Public Chat'
  );
  const [showChatSelector, setShowChatSelector] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const flatListRef = useRef(null);

  // Keyboard handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // References
  const publicChatRef = ref(database, 'chats/public');
  const usersRef = ref(database, 'users');

  useEffect(() => {
    console.log('💬 ChatScreen mounted - Setting up listeners');
    console.log('📱 Chat mode:', directMessage ? `Direct with ${targetUser?.name}` : 'Public');
    
    if (!database) {
      console.error('❌ Database not initialized');
      setConnectionError(true);
      setLoading(false);
      return;
    }

    // Load chat messages
    const chatUnsubscribe = onValue(getActiveChatRef(), (snapshot) => {
      try {
        setConnectionError(false);
        const data = snapshot.val();
        
        if (data) {
          const messagesArray = Object.entries(data).map(([id, message]) => ({
            id,
            ...message
          })).sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB;
          });
          
          setMessages(messagesArray);
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error('❌ Error processing messages:', error);
        setConnectionError(true);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error('❌ Chat listener error:', error);
      setConnectionError(true);
      setLoading(false);
    });

    // Only load online users if in public chat mode
    if (!directMessage) {
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
          }
        } catch (error) {
          console.error('❌ Error loading users:', error);
        }
      });

      return () => {
        off(usersRef, 'value', usersUnsubscribe);
        off(getActiveChatRef(), 'value', chatUnsubscribe);
      };
    }

    return () => {
      console.log('🧹 Cleaning up chat listener');
      off(getActiveChatRef(), 'value', chatUnsubscribe);
    };
  }, [activeChat, directMessage]);

  const getActiveChatRef = () => {
    if (activeChat === 'public') {
      return publicChatRef;
    } else {
      // For direct messages, create a unique chat room ID
      const chatId = [user.uid, activeChat].sort().join('_');
      return ref(database, `chats/private/${chatId}`);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to send messages');
      return;
    }

    if (connectionError) {
      Alert.alert('Offline', 'Cannot send messages while offline. Please check your connection.');
      return;
    }

    setSending(true);
    const messageText = newMessage.trim();

    try {
      const chatRef = getActiveChatRef();
      const newMessageRef = push(chatRef);
      
      const messageData = {
        text: messageText,
        userId: user.uid,
        userName: user.name || user.email.split('@')[0],
        userEmail: user.email,
        userProfilePic: user.profilePic,
        userType: user.userType || 'student',
        timestamp: serverTimestamp(),
        chatType: activeChat === 'public' ? 'public' : 'private',
        recipientId: activeChat !== 'public' ? activeChat : null
      };
      
      await set(newMessageRef, messageData);
      setNewMessage('');
      
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('Send Failed', 'Could not send message. Please try again.');
      setConnectionError(true);
    } finally {
      setSending(false);
    }
  };

  const startDirectMessage = (targetUser) => {
    setActiveChat(targetUser.id);
    setActiveChatName(targetUser.name || targetUser.email.split('@')[0]);
    setShowChatSelector(false);
  };

  const showProfile = (userData) => {
    setSelectedUser(userData);
    setShowUserProfile(true);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    
    try {
      if (typeof timestamp === 'object' && timestamp.hasOwnProperty('.sv')) {
        return 'Sending...';
      }
      
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) return 'Just now';
      
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Just now';
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

  const renderMessage = ({ item, index }) => {
    const isCurrentUser = item.userId === user?.uid;
    const showHeader = index === 0 || item.userId !== messages[index - 1]?.userId;

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && showHeader && (
          <TouchableOpacity 
            style={styles.messageHeader}
            onPress={() => showProfile(item)}
          >
            {item.userProfilePic ? (
              <Image source={{ uri: item.userProfilePic }} style={styles.messageAvatar} />
            ) : (
              <View style={[styles.messageAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {item.userName ? item.userName.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.userName}</Text>
              <View style={styles.roleContainer}>
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
              </View>
            </View>
          </TouchableOpacity>
        )}
        
        <View style={[
          styles.messageBubble,
          isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
        ]}>
          <Text style={[
            styles.messageText,
            isCurrentUser ? styles.currentUserText : styles.otherUserText
          ]}>
            {item.text}
          </Text>
        </View>
        
        <View style={[
          styles.messageFooter,
          isCurrentUser ? styles.currentUserFooter : styles.otherUserFooter
        ]}>
          <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
          {isCurrentUser && (
            <Text style={styles.statusIcon}>✓</Text>
          )}
        </View>
      </View>
    );
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => startDirectMessage(item)}
      onLongPress={() => showProfile(item)}
    >
      {item.profilePic ? (
        <Image source={{ uri: item.profilePic }} style={styles.userAvatar} />
      ) : (
        <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name || item.email.split('@')[0]}</Text>
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
          <View style={styles.onlineIndicator} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>
      <Text style={styles.chatIcon}>💬</Text>
    </TouchableOpacity>
  );

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
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.chatSelector}
            onPress={() => !directMessage && setShowChatSelector(true)}
            disabled={directMessage}
          >
            <Text style={styles.title}>
              {directMessage ? '💬 ' : '👥 '}{activeChatName}
            </Text>
            {!directMessage && <Text style={styles.dropdownIcon}>▼</Text>}
          </TouchableOpacity>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, connectionError ? styles.offlineDot : styles.onlineDot]} />
          <Text style={styles.statusText}>
            {connectionError ? 'Offline' : 'Online'}
          </Text>
        </View>
      </View>

      {connectionError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            ⚠️ Connection issue. Check your internet connection.
          </Text>
        </View>
      )}

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>
              {directMessage ? 'Start a conversation' : 'No messages yet'}
            </Text>
            <Text style={styles.emptyText}>
              {directMessage 
                ? `Send a message to start chatting with ${activeChatName}`
                : 'Start the conversation! Send the first message.'
              }
            </Text>
          </View>
        }
      />

      {/* Message Input with Keyboard Handling */}
      <View style={[styles.inputContainer, { marginBottom: keyboardHeight }]}>
        <TextInput
          style={[
            styles.textInput,
            connectionError && styles.textInputDisabled
          ]}
          placeholder={connectionError ? "Offline - Can't send messages" : "Type a message..."}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={500}
          editable={!sending && !connectionError}
          onFocus={() => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
        />
        <TouchableOpacity 
          style={[
            styles.sendButton,
            (!newMessage.trim() || sending || connectionError) && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending || connectionError}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Chat Selector Modal - Only show in public chat mode */}
      {!directMessage && (
        <Modal
          visible={showChatSelector}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowChatSelector(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Chat</Text>
                <TouchableOpacity onPress={() => setShowChatSelector(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {/* Public Chat Option */}
              <TouchableOpacity 
                style={styles.chatOption}
                onPress={() => {
                  setActiveChat('public');
                  setActiveChatName('Public Chat');
                  setShowChatSelector(false);
                }}
              >
                <View style={styles.chatOptionIcon}>
                  <Text style={styles.chatOptionEmoji}>👥</Text>
                </View>
                <View style={styles.chatOptionInfo}>
                  <Text style={styles.chatOptionName}>Public Chat</Text>
                  <Text style={styles.chatOptionDescription}>
                    Chat with everyone in the community
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Online Users */}
              <Text style={styles.sectionTitle}>Online Users ({users.length})</Text>
              <FlatList
                data={users}
                renderItem={renderUserItem}
                keyExtractor={item => item.id}
                style={styles.usersList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text style={styles.noUsersText}>No other users online</Text>
                }
              />
            </View>
          </View>
        </Modal>
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
                  {selectedUser.name || selectedUser.email.split('@')[0]}
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

                <TouchableOpacity 
                  style={styles.messageUserButton}
                  onPress={() => {
                    startDirectMessage(selectedUser);
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
    padding: 15,
    paddingTop: 60,
    backgroundColor: '#6366f1',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 8,
  },
  dropdownIcon: {
    color: '#fff',
    fontSize: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  onlineDot: {
    backgroundColor: '#10b981',
  },
  offlineDot: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    textAlign: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 15,
    paddingBottom: 10,
  },
  messageContainer: {
    marginBottom: 15,
  },
  currentUserMessage: {
    alignItems: 'flex-end',
  },
  otherUserMessage: {
    alignItems: 'flex-start',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 10,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  avatarPlaceholder: {
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginRight: 6,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 4,
  },
  currentUserBubble: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  currentUserText: {
    color: '#fff',
  },
  otherUserText: {
    color: '#334155',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentUserFooter: {
    justifyContent: 'flex-end',
    marginRight: 10,
  },
  otherUserFooter: {
    justifyContent: 'flex-start',
    marginLeft: 10,
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8',
    marginRight: 4,
  },
  statusIcon: {
    fontSize: 11,
    color: '#94a3b8',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'flex-end',
     paddingBottom: Platform.OS === 'ios' ? 60 : 50,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
    paddingTop: 12,
    maxHeight: 100,
    fontSize: 16,
    marginRight: 10,
  },
  textInputDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#94a3b8',
  },
  sendButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 50,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
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
  chatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  chatOptionIcon: {
    marginRight: 12,
  },
  chatOptionEmoji: {
    fontSize: 24,
  },
  chatOptionInfo: {
    flex: 1,
  },
  chatOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 2,
  },
  chatOptionDescription: {
    fontSize: 12,
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 15,
    marginBottom: 10,
    marginLeft: 15,
  },
  usersList: {
    maxHeight: 300,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginLeft: 8,
    marginRight: 4,
  },
  onlineText: {
    fontSize: 11,
    color: '#10b981',
  },
  chatIcon: {
    fontSize: 16,
    marginLeft: 'auto',
  },
  noUsersText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: 20,
  },
  // Profile Modal Styles
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
    marginBottom: 20,
  },
  profileRoleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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

export default ChatScreen;