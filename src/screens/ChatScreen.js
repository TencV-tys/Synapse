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
  Keyboard,
  ActionSheetIOS,
  Share
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database, firestore } from '../config/firebase';
import { ref, push, onValue, off, set, serverTimestamp, get } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { copyToClipboard } from '../utils/clipboard';
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
    directMessage ? targetUser?.uid || targetUser?.id : 'public'
  );
  const [activeChatName, setActiveChatName] = useState(
    directMessage ? targetUser?.name : 'Public Chat'
  );
  const [showChatSelector, setShowChatSelector] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // New states for message actions
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  
  const flatListRef = useRef(null);

  // ✅ Function to get complete user data from Firestore (same as DirectMessagesScreen)
  const getCompleteUserData = async (userId, realtimeData) => {
    try {
      console.log(`🔍 Fetching complete data from Firestore for: ${userId}`);
      
      const userDoc = await getDoc(doc(firestore, 'users', userId));
      
      if (userDoc.exists()) {
        const firestoreData = userDoc.data();
        console.log(`✅ Found complete user data in Firestore: ${firestoreData.name || userId}`);
        
        // Merge Realtime data with Firestore data
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
        console.log(`❌ User ${userId} not found in Firestore, using Realtime data`);
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
      console.error(`❌ Error fetching Firestore data for ${userId}:`, error);
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

  // ✅ Enhanced users loading with combined data
  const loadUsers = () => {
    return new Promise((resolve) => {
      const usersRef = ref(database, 'users');
      console.log('🔍 Setting up users listener for ChatScreen...');
      
      const usersUnsubscribe = onValue(usersRef, async (snapshot) => {
        try {
          const data = snapshot.val();
          console.log('📊 ChatScreen - Users data received from Realtime DB');
          
          if (data) {
            const usersPromises = Object.entries(data)
              .filter(([id]) => id !== user?.uid)
              .map(async ([id, userData]) => {
                // ✅ CHECK if user data is incomplete
                const isIncomplete = !userData.name || !userData.email || !userData.userType;
                
                if (isIncomplete) {
                  console.log(`🔄 ChatScreen - User ${id} has incomplete data, fetching from Firestore...`);
                  return await getCompleteUserData(id, userData);
                } else {
                  console.log(`✅ ChatScreen - User ${id} has complete data in Realtime DB`);
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
            
            console.log(`👥 ChatScreen - Processed ${usersArray.length} users (excluding current user)`);
            
            // Filter for online users only (last 5 minutes)
            const onlineUsers = usersArray.filter(u => 
              u.lastActive && (Date.now() - new Date(u.lastActive).getTime()) < 300000
            );
            
            setUsers(onlineUsers);
          } else {
            console.log('❌ ChatScreen - No users found in database');
            setUsers([]);
          }
        } catch (error) {
          console.error('❌ ChatScreen - Error loading users:', error);
        } finally {
          resolve();
        }
      }, (error) => {
        console.error('❌ ChatScreen - Firebase users listener error:', error);
        resolve();
      });

      return usersUnsubscribe;
    });
  };

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

  useEffect(() => {
    console.log('💬 ChatScreen mounted - Setting up listeners');
    console.log('📱 Chat mode:', directMessage ? `Direct with ${targetUser?.name}` : 'Public');
    console.log('👤 Current user:', user?.email);
    
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
          
          console.log(`💬 Loaded ${messagesArray.length} messages for ${activeChatName}`);
          setMessages(messagesArray);
        } else {
          console.log(`💬 No messages found for ${activeChatName}`);
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
      const usersUnsubscribe = loadUsers();

      return () => {
        console.log('🧹 Cleaning up ChatScreen listeners');
        off(ref(database, 'users'), 'value', usersUnsubscribe);
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
      
      // ✅ Get complete user data for message
      const completeUserData = await getCompleteUserData(user.uid, {
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        userType: user.userType
      });

      const messageData = {
        text: messageText,
        userId: user.uid,
        userName: completeUserData.name,
        userEmail: completeUserData.email,
        userProfilePic: completeUserData.profilePic,
        userType: completeUserData.userType,
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

  // Message Action Handlers
  const handleMessageLongPress = (message) => {
    setSelectedMessage(message);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Copy Text', 'Edit Message', 'Share', 'Delete'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 4,
        },
        (buttonIndex) => {
          handleActionSheetSelection(buttonIndex);
        }
      );
    } else {
      setActionSheetVisible(true);
    }
  };

  const handleActionSheetSelection = (buttonIndex) => {
    setActionSheetVisible(false);
    
    if (!selectedMessage) return;

    switch (buttonIndex) {
      case 1: // Copy
        handleCopyText();
        break;
      case 2: // Edit
        handleEditMessage();
        break;
      case 3: // Share
        handleShareMessage();
        break;
      case 4: // Delete
        handleDeleteMessage();
        break;
    }
    
    setSelectedMessage(null);
  };

const handleCopyText = async () => {
  if (!selectedMessage) return;
  
  try {
    await copyToClipboard(selectedMessage.text);
  } catch (error) {
    console.error('❌ Copy failed:', error);
    // Ultimate fallback
    Alert.alert('Message Text', selectedMessage.text);
  }
};
 
  const handleEditMessage = () => {
    if (!selectedMessage) return;
    
    // Only allow editing own messages
    if (selectedMessage.userId !== user?.uid) {
      Alert.alert('Cannot Edit', 'You can only edit your own messages');
      return;
    }
    
    setEditingMessage(selectedMessage);
    setEditText(selectedMessage.text);
  };

  const handleShareMessage = async () => {
    if (!selectedMessage) return;
    
    try {
      await Share.share({
        message: `${selectedMessage.userName}: ${selectedMessage.text}`,
        title: 'Message from Synapse Chat'
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share message');
    }
  };

  const handleDeleteMessage = () => {
    if (!selectedMessage) return;
    
    // Only allow deleting own messages
    if (selectedMessage.userId !== user?.uid) {
      Alert.alert('Cannot Delete', 'You can only delete your own messages');
      return;
    }
    
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => confirmDeleteMessage()
        }
      ]
    );
  };

  const confirmDeleteMessage = async () => {
    if (!selectedMessage) return;
    
    try {
      const messageRef = ref(database, `${getActiveChatRef().key}/${selectedMessage.id}`);
      await set(messageRef, null);
      Alert.alert('Success', 'Message deleted');
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  const saveEditedMessage = async () => {
    if (!editingMessage || !editText.trim()) return;
    
    try {
      const messageRef = ref(database, `${getActiveChatRef().key}/${editingMessage.id}`);
      
      await set(messageRef, {
        ...editingMessage,
        text: editText.trim(),
        editedAt: serverTimestamp(),
        isEdited: true
      });
      
      setEditingMessage(null);
      setEditText('');
      Alert.alert('Success', 'Message updated');
    } catch (error) {
      console.error('❌ Error updating message:', error);
      Alert.alert('Error', 'Failed to update message');
    }
  };

  const startDirectMessage = (targetUser) => {
    setActiveChat(targetUser.id);
    setActiveChatName(targetUser.name || targetUser.email.split('@')[0]);
    setShowChatSelector(false);
  };

  const showProfile = async (messageUserData) => {
    try {
      console.log('👤 ChatScreen - Showing profile for:', messageUserData);
      
      // Try to find user in current users list first
      let completeUserData = users.find(u => u.id === messageUserData.userId);
      
      if (!completeUserData) {
        console.log('🔍 User not in current list, fetching complete data...');
        completeUserData = await getCompleteUserData(messageUserData.userId, {
          name: messageUserData.userName,
          email: messageUserData.userEmail,
          profilePic: messageUserData.userProfilePic,
          userType: messageUserData.userType
        });
      }
      
      setSelectedUser(completeUserData);
      setShowUserProfile(true);
      
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      // Fallback to message data
      setSelectedUser({
        id: messageUserData.userId,
        name: messageUserData.userName,
        email: messageUserData.userEmail,
        userType: messageUserData.userType || 'student',
        profilePic: messageUserData.userProfilePic
      });
      setShowUserProfile(true);
    }
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

  const getUserDisplayName = (userData) => {
    if (!userData) return 'Unknown User';
    return userData.name || userData.userName || (userData.email ? userData.email.split('@')[0] : 'User');
  };

  const getUserEmail = (userData) => {
    if (!userData) return 'No email';
    return userData.email || userData.userEmail || 'No email available';
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

  // ✅ FIXED: Profile picture shows for BOTH users in messages with TIMESTAMP AT BOTTOM
  const renderMessage = ({ item, index }) => {
    const isCurrentUser = item.userId === user?.uid;

    return (
      <TouchableOpacity 
        style={[
          styles.messageContainer,
          isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
        ]}
        onLongPress={() => handleMessageLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        {/* PROFILE PICTURE FOR OTHER USERS */}
        {!isCurrentUser && (
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => showProfile(item)}
            activeOpacity={0.7}
          >
            {item.userProfilePic ? (
              <Image 
                source={{ uri: item.userProfilePic }} 
                style={styles.messageAvatar}
                onError={(error) => console.log('❌ Failed to load profile picture in message')}
              />
            ) : (
              <View style={[styles.messageAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {getUserDisplayName(item).charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        
        <View style={styles.messageContent}>
          {/* User info for other users' messages */}
          {!isCurrentUser && (
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{getUserDisplayName(item)}</Text>
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
          )}
          
          {/* Message bubble with timestamp at bottom */}
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
            
            {/* ✅ FIXED: TIMESTAMP AT BOTTOM OF MESSAGE BUBBLE */}
            <View style={[
              styles.messageFooter,
              isCurrentUser ? styles.currentUserFooter : styles.otherUserFooter
            ]}>
              <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
              {item.isEdited && (
                <Text style={styles.editedText}>(edited)</Text>
              )}
              {isCurrentUser && (
                <Text style={styles.statusIcon}>✓</Text>
              )}
            </View>
          </View>
        </View>

        {/* PROFILE PICTURE FOR CURRENT USER (on the right side) */}
        {isCurrentUser && (
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => showProfile({
              userId: user.uid,
              userName: user.name,
              userEmail: user.email,
              userProfilePic: user.profilePic,
              userType: user.userType
            })}
            activeOpacity={0.7}
          >
            {user.profilePic ? (
              <Image 
                source={{ uri: user.profilePic }} 
                style={styles.messageAvatar}
                onError={(error) => console.log('❌ Failed to load current user profile picture')}
              />
            ) : (
              <View style={[styles.messageAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {getUserDisplayName(user).charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => startDirectMessage(item)}
      onLongPress={() => {
        setSelectedUser(item);
        setShowUserProfile(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {item.profilePic ? (
          <Image 
            source={{ uri: item.profilePic }} 
            style={styles.userAvatar}
            onError={(error) => console.log('❌ Failed to load user profile picture')}
          />
        ) : (
          <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {getUserDisplayName(item).charAt(0).toUpperCase()}
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
        <Text style={styles.userName}>{getUserDisplayName(item)}</Text>
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
          <Text style={styles.onlineText}>
            {isUserOnline(item) ? 'Online' : formatLastSeen(item.lastActive)}
          </Text>
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

      {/* Message Input */}
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

      {/* Chat Selector Modal */}
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
                  <Image 
                    source={{ uri: selectedUser.profilePic }} 
                    style={styles.profileAvatar}
                    onError={(error) => console.log('❌ Failed to load profile picture in modal')}
                  />
                ) : (
                  <View style={[styles.profileAvatar, styles.avatarPlaceholder]}>
                    <Text style={styles.profileAvatarText}>
                      {getUserDisplayName(selectedUser).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                
                <Text style={styles.profileName}>
                  {getUserDisplayName(selectedUser)}
                </Text>
                <Text style={styles.profileEmail}>{getUserEmail(selectedUser)}</Text>
                
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
                  <View style={[
                    styles.statusIndicator, 
                    isUserOnline(selectedUser) ? styles.statusOnline : styles.statusOffline
                  ]} />
                  <Text style={styles.profileStatusText}>
                    {isUserOnline(selectedUser) ? 'Online' : `Last seen ${formatLastSeen(selectedUser.lastActive)}`}
                  </Text>
                </View>

                {!directMessage && (
                  <TouchableOpacity 
                    style={styles.messageUserButton}
                    onPress={() => {
                      startDirectMessage(selectedUser);
                      setShowUserProfile(false);
                    }}
                  >
                    <Text style={styles.messageUserButtonText}>💬 Send Message</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Message Modal */}
      <Modal
        visible={!!editingMessage}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingMessage(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.editModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Message</Text>
              <TouchableOpacity onPress={() => setEditingMessage(null)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.editTextInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              maxLength={500}
              placeholder="Edit your message..."
              autoFocus
            />
            
            <View style={styles.editModalActions}>
              <TouchableOpacity 
                style={styles.cancelEditButton}
                onPress={() => setEditingMessage(null)}
              >
                <Text style={styles.cancelEditButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.saveEditButton,
                  !editText.trim() && styles.saveEditButtonDisabled
                ]}
                onPress={saveEditedMessage}
                disabled={!editText.trim()}
              >
                <Text style={styles.saveEditButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Android ActionSheet */}
      {Platform.OS === 'android' && actionSheetVisible && (
        <View style={styles.actionSheetContainer}>
          <View style={styles.actionSheet}>
            <TouchableOpacity 
              style={styles.actionSheetOption}
              onPress={handleCopyText}
            >
              <Text style={styles.actionSheetOptionText}>Copy Text</Text>
            </TouchableOpacity>
            
            {selectedMessage?.userId === user?.uid && (
              <TouchableOpacity 
                style={styles.actionSheetOption}
                onPress={handleEditMessage}
              >
                <Text style={styles.actionSheetOptionText}>Edit Message</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.actionSheetOption}
              onPress={handleShareMessage}
            >
              <Text style={styles.actionSheetOptionText}>Share</Text>
            </TouchableOpacity>
            
            {selectedMessage?.userId === user?.uid && (
              <TouchableOpacity 
                style={styles.actionSheetDestructiveOption}
                onPress={handleDeleteMessage}
              >
                <Text style={styles.actionSheetDestructiveOptionText}>Delete</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.actionSheetCancel}
              onPress={() => setActionSheetVisible(false)}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ... (Keep all the same styles from your original ChatScreen)
// The styles remain exactly the same as in your original ChatScreen

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
  // Message container with profile picture for every message
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-start',
  },
  currentUserMessage: {
    justifyContent: 'flex-end',
  },
  otherUserMessage: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 8,
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  messageContent: {
    flex: 1,
    maxWidth: '80%',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 8,
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginRight: 6,
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
    padding: 12,
    borderRadius: 18,
    marginBottom: 4,
  },
  currentUserBubble: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  otherUserBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignSelf: 'flex-start',
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
  // ✅ FIXED: Message footer at bottom of bubble
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  currentUserFooter: {
    justifyContent: 'flex-end',
  },
  otherUserFooter: {
    justifyContent: 'flex-start',
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8',
    marginRight: 4,
  },
  editedText: {
    fontSize: 10,
    color: '#94a3b8',
    fontStyle: 'italic',
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
  onlineText: {
    fontSize: 11,
    color: '#64748b',
    marginLeft: 8,
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
  // Edit Modal Styles
  editModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    maxHeight: '60%',
  },
  editTextInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginVertical: 15,
  },
  editModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelEditButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelEditButtonText: {
    color: '#64748b',
    fontWeight: '600',
  },
  saveEditButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#6366f1',
  },
  saveEditButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  saveEditButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Action Sheet Styles for Android
  actionSheetContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  actionSheetOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  actionSheetOptionText: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
  },
  actionSheetDestructiveOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  actionSheetDestructiveOptionText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    fontWeight: '600',
  },
  actionSheetCancel: {
    paddingVertical: 15,
    marginTop: 10,
  },
  actionSheetCancelText: {
    fontSize: 16,
    color: '#6366f1',
    textAlign: 'center',
    fontWeight: '600',
  }, 
}); 
 
export default ChatScreen;