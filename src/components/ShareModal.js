// src/components/ShareModal.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  Keyboard,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useAuth } from '../context/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ShareModal = ({ visible, onClose, note, navigation }) => {
  const { shareNote, isOnline } = useNotes();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('external'); // 'external' or 'inApp'
  const [loading, setLoading] = useState(false);

  // Clear selection when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedTab('external');
    }
  }, [visible]);

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
        const shareText = `${shareContent.title}\n\n${shareContent.message}\n\n${shareContent.url}`;
        
        Alert.alert(
          'Copy Share Link', 
          `Select and copy this text to share:\n\n${shareText}`,
          [
            { 
              text: 'OK', 
              style: 'default'
            },
            {
              text: 'Select All',
              onPress: () => {
                console.log('📋 Text ready for manual copy:', shareText);
              }
            }
          ]
        );
      }
      
      onClose();
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share note');
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

  // Handle In-App share navigation
  const handleInAppShare = () => {
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

    onClose(); // Close the modal first
    navigation.navigate('InAppShare', { note }); // Navigate to the separate screen
  };

  if (!note) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <KeyboardAvoidingView 
        style={styles.flexContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >
        <View style={styles.flexContainer}>
          <View style={styles.fullScreenOverlay}>
            <View style={[
              styles.fullScreenContent,
              selectedTab === 'external' && styles.compactContent,
            ]}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Share Note</Text>
                <TouchableOpacity onPress={onClose} disabled={loading}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Note Preview - Only show for external tab */}
              {selectedTab === 'external' && (
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
              )}

              {/* Share Type Tabs */}
              <View style={styles.shareTypeTabs}>
                <TouchableOpacity 
                  style={[styles.shareTypeTab, selectedTab === 'external' && styles.shareTypeTabActive]}
                  onPress={() => {
                    setSelectedTab('external');
                    Keyboard.dismiss();
                  }}
                >
                  <Text style={[styles.shareTypeTabText, selectedTab === 'external' && styles.shareTypeTabTextActive]}>
                    External
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.shareTypeTab, selectedTab === 'inApp' && styles.shareTypeTabActive]}
                  onPress={() => {
                    setSelectedTab('inApp');
                    Keyboard.dismiss();
                  }}
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
                <View style={styles.inAppContent}>
                  <TouchableOpacity 
                    style={[styles.shareOption, !isOnline && styles.disabledOption]}
                    onPress={handleInAppShare}
                    disabled={!isOnline || note.permission !== 'view_only'}
                  >
                    <View style={styles.optionIcon}>
                      <Text style={styles.optionIconText}>👥</Text>
                      {!isOnline && <View style={styles.offlineIndicator} />}
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionTitle}>Share with Users & Chats</Text>
                      <Text style={styles.optionDescription}>
                        {isOnline ? 'Share with users or in chat rooms' : 'Available online only'}
                      </Text>
                    </View>
                    <Text style={styles.navigationArrow}>➔</Text>
                  </TouchableOpacity>

                  {/* Permission Warning for In-App */}
                  {note.permission !== 'view_only' && (
                    <View style={styles.permissionWarning}>
                      <Text style={styles.warningIcon}>🔒</Text>
                      <Text style={styles.warningText}>
                        This is a private note. Change permission to "Public" to share within the app.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Offline Warning */}
              {!isOnline && (
                <View style={styles.offlineWarning}>
                  <Text style={styles.offlineText}>📴 You are offline - Sharing unavailable</Text>
                </View>
              )}

              {/* Cancel Button */}
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  fullScreenContent: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 0,
  },
  compactContent: {
    maxHeight: SCREEN_HEIGHT * 0.7,
    marginTop: 'auto',
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
  navigationArrow: {
    fontSize: 18,
    color: '#6366f1',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  inAppContent: {
    marginBottom: 20,
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    marginTop: 12,
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
    marginTop: 8,
    marginBottom: 20,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
});

export default ShareModal;