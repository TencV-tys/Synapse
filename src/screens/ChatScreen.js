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
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../config/firebase';
import { ref, push, onValue, off, set, serverTimestamp } from 'firebase/database';

const ChatScreen = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const flatListRef = useRef(null);

  // Debug Firebase connection
  useEffect(() => {
    console.log('🔍 Checking Firebase Database connection...');
    console.log('📡 Database instance:', database ? '✅ Connected' : '❌ Not connected');
    console.log('👤 Current user:', user ? user.email : 'No user');
  }, [user]);

  // Reference to the chat messages in Firebase
  const chatRef = ref(database, 'chats/public');

  useEffect(() => {
    console.log('💬 ChatScreen mounted - Setting up real-time listener');
    
    if (!database) {
      console.error('❌ Database not initialized - check databaseURL in firebase config');
      setConnectionError(true);
      setLoading(false);
      Alert.alert('Configuration Error', 'Chat feature not configured properly.');
      return;
    }

    console.log('🎯 Setting up listener for:', chatRef.toString());
    
    // Listen for real-time messages
    const unsubscribe = onValue(chatRef, (snapshot) => {
      try {
        setConnectionError(false);
        const data = snapshot.val();
        console.log('📨 Firebase snapshot received:', data ? Object.keys(data).length + ' messages' : 'No data');
        
        if (data) {
          const messagesArray = Object.entries(data).map(([id, message]) => ({
            id,
            ...message
          })).sort((a, b) => {
            // Handle timestamp sorting safely
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB;
          });
          
          console.log('✅ Messages processed:', messagesArray.length);
          setMessages(messagesArray);
        } else {
          console.log('💬 No messages in database yet');
          setMessages([]);
        }
      } catch (error) {
        console.error('❌ Error processing messages:', error);
        setConnectionError(true);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error('❌ Firebase listener error:', error);
      console.error('Error details:', error.message, error.code);
      setConnectionError(true);
      setLoading(false);
      
      if (error.code === 'PERMISSION_DENIED') {
        Alert.alert(
          'Permission Denied', 
          'You need to update Firebase Realtime Database rules to allow read/write access.'
        );
      }
    });

    // Cleanup listener
    return () => {
      console.log('🧹 Cleaning up chat listener');
      off(chatRef, 'value', unsubscribe);
    };
  }, []);

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
      console.log('📤 Sending message as user:', user.email);
      
      const newMessageRef = push(chatRef);
      const messageData = {
        text: messageText,
        userId: user.uid,
        userName: user.name || user.email.split('@')[0],
        userEmail: user.email,
        timestamp: serverTimestamp(),
        userType: user.userType || 'user'
      };
      
      console.log('💾 Message data:', messageData);
      await set(newMessageRef, messageData);

      console.log('✅ Message sent successfully with ID:', newMessageRef.key);
      setNewMessage('');
      
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('❌ Error sending message:', error);
      console.error('Send error details:', error.message, error.code);
      
      if (error.code === 'PERMISSION_DENIED') {
        Alert.alert(
          'Send Failed', 
          'Permission denied. Please check Firebase Realtime Database rules.'
        );
      } else {
        Alert.alert('Send Failed', 'Could not send message. Please check your connection and try again.');
      }
      setConnectionError(true);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    
    try {
      // Handle serverTimestamp (pending)
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

  const renderMessage = ({ item, index }) => {
    const isCurrentUser = item.userId === user?.uid;
    const showHeader = index === 0 || item.userId !== messages[index - 1]?.userId;

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && showHeader && (
          <View style={styles.messageHeader}>
            <Text style={styles.userName}>{item.userName}</Text>
            {item.userType && item.userType !== 'user' && (
              <Text style={styles.userType}>{item.userType}</Text>
            )}
          </View>
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading messages...</Text>
        <Text style={styles.debugText}>Checking Firebase connection...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💬 Synapse Chat</Text>
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
            ⚠️ Connection issue. {user ? 'Check Firebase rules.' : 'Please login.'}
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
              {connectionError ? 'Connection Issue' : 'No messages yet'}
            </Text>
            <Text style={styles.emptyText}>
              {connectionError 
                ? 'Check Firebase Realtime Database configuration and rules.'
                : 'Start the conversation! Send the first message.'
              }
            </Text>
            {connectionError && (
              <Text style={styles.debugHelp}>
                Make sure Realtime Database is enabled and rules allow read/write.
              </Text>
            )}
          </View>
        }
      />

      {/* Message Input */}
      <View style={styles.inputContainer}>
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
    </KeyboardAvoidingView>
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
  debugText: {
    marginTop: 5,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: 60,
    backgroundColor: '#6366f1',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
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
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginRight: 6,
  },
  userType: {
    fontSize: 10,
    color: '#6366f1',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
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
    marginBottom: 10,
  },
  debugHelp: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ChatScreen;