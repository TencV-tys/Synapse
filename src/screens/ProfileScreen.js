// src/screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  RefreshControl
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import sqliteService from '../services/sqliteService';
import { database } from '../config/firebase';
import { ref, set } from 'firebase/database';

const ProfileScreen = ({ navigation }) => {
  const { user, setUser, isOnline, triggerSync } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [profilePic, setProfilePic] = useState(user?.profilePic || null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // Request permissions on component mount
  useEffect(() => {
    requestPermissions();
  }, []);

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setProfilePic(user.profilePic || null);
    }
  }, [user]);

  const requestPermissions = async () => {
    try {
      console.log('🔍 Requesting media library permissions...');
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('📸 Media library permission status:', mediaStatus);
      
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📷 Camera permission status:', cameraStatus);

      if (mediaStatus !== 'granted') {
        Alert.alert(
          'Permission Required', 
          'We need access to your photo library to set profile pictures.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Check for pending sync
      const syncItems = await sqliteService.getSyncQueue();
      if (syncItems.length > 0 && isOnline) {
        setSyncStatus(`🔄 ${syncItems.length} pending sync items`);
      } else {
        setSyncStatus(syncItems.length > 0 ? '📴 Sync pending (offline)' : '✅ Synced');
      }
    } catch (error) {
      console.error('❌ Error checking sync status:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const pickImage = async () => {
    try {
      console.log('🖼️ Launching image picker...');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: false,
        exif: false,
      });

      console.log('📸 Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageAsset = result.assets[0];
        console.log('✅ Image selected:', imageAsset.uri);
        
        setUploading(true);
        setProfilePic(imageAsset.uri);
        console.log('🖼️ Profile picture set to local URI');
        setUploading(false);
        setImageModalVisible(false);
        Alert.alert('Success', 'Profile picture selected! Remember to save your changes.');
      } else {
        console.log('🚫 Image selection cancelled');
      }
    } catch (error) {
      console.error('❌ Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setUploading(false);
    }
  };

  const takePhoto = async () => {
    try {
      console.log('📷 Launching camera...');
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('📸 Camera result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageAsset = result.assets[0];
        console.log('✅ Photo taken:', imageAsset.uri);
        
        setUploading(true);
        setProfilePic(imageAsset.uri);
        console.log('🖼️ Profile picture set from camera');
        setUploading(false);
        setImageModalVisible(false);
        Alert.alert('Success', 'Profile picture taken! Remember to save your changes.');
      }
    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      setUploading(false);
    }
  };

  const removeProfilePic = () => {
    console.log('🗑️ Removing profile picture');
    setProfilePic(null);
    setImageModalVisible(false);
    Alert.alert('Success', 'Profile picture removed! Remember to save your changes.');
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);
    try {
      let finalProfilePic = profilePic;
      let needsSync = false;
      
      console.log('💾 Saving profile...');
      console.log('🖼️ Current profile pic:', profilePic);
      console.log('🌐 Online status:', isOnline);
      
      // ✅ SMART PROFILE PICTURE HANDLING
      if (profilePic && profilePic.startsWith('file://')) {
        if (isOnline) {
          try {
            console.log('☁️ Uploading profile picture to Firebase Storage...');
            setUploading(true);
            
            // Upload to Firebase Storage and get download URL
            const downloadURL = await authService.uploadProfilePicture(profilePic, user.uid);
            finalProfilePic = downloadURL;
            
            console.log('✅ Profile picture uploaded to Firebase Storage:', downloadURL);
            console.log('📸 New profile pic URL:', finalProfilePic);
            
            setUploading(false);
          } catch (uploadError) {
            console.error('❌ Error uploading profile picture:', uploadError);
            // Keep local URI and mark for sync
            finalProfilePic = profilePic;
            needsSync = true;
            console.log('🔄 Upload failed, marking for sync');
          }
        } else {
          // Offline mode - keep local URI
          console.log('📴 Offline mode - keeping local profile picture URI');
          finalProfilePic = profilePic;
          needsSync = true;
        }
      } else if (!profilePic) {
        // If removing profile picture, set to null
        finalProfilePic = null;
      }
      // If profilePic is already a URL (not file://), keep it as is

      // ✅ COMPLETE user object with ALL fields including profile picture
      const updatedUser = {
        uid: user.uid,
        email: user.email,
        name: name.trim(),
        profilePic: finalProfilePic,
        userType: user.userType || 'student',
        password: user.password || '',
        createdAt: user.createdAt || new Date().toISOString(),
        lastLogin: user.lastLogin || new Date().toISOString(),
        lastActive: new Date().toISOString(),
        isOnline: isOnline,
        isOffline: !isOnline,
        updatedAt: new Date().toISOString()
      };

      console.log('💾 Saving user data...');
      console.log('📸 Final profile pic URL:', updatedUser.profilePic);
      console.log('🔄 Needs sync:', needsSync);
      
      // ✅ Save to SQLite FIRST (always)
      await sqliteService.saveUser(updatedUser);
      console.log('💾✅ Profile saved to SQLite');

      // ✅ Mark for sync if needed
      if (needsSync && isOnline) {
        console.log('🔄 Marking profile picture for sync...');
        await sqliteService.markUserForProfilePicSync(updatedUser);
      }

      // ✅ Save to Firebase Realtime Database if online
      if (isOnline) {
        try {
          console.log('🔥 Saving user to Firebase Realtime Database...');
          const userRef = ref(database, `users/${user.uid}`);
          await set(userRef, updatedUser);
          console.log('🔥✅ Profile saved to Firebase Realtime Database');
        } catch (firebaseError) {
          console.error('❌ Firebase save failed:', firebaseError);
          // Don't alert here - SQLite saved successfully
        }
      }

      // ✅ Update context for immediate UI update
      setUser(updatedUser);
      
      setIsEditing(false);
      console.log('✅ Profile update completed successfully');
      
      // Show appropriate message
      if (needsSync) {
        Alert.alert(
          'Success', 
          'Profile updated! Profile picture will sync when possible.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Success', 'Profile updated successfully!');
      }
      
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleCancelEdit = () => {
    console.log('🚫 Canceling edit');
    setName(user?.name || '');
    setProfilePic(user?.profilePic || null);
    setIsEditing(false);
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline. Please check your internet connection.');
      return;
    }

    setLoading(true);
    try {
      const result = await triggerSync();
      if (result.success) {
        Alert.alert('Success', `Sync completed! Processed ${result.result.processed} items.`);
      } else {
        Alert.alert('Sync Failed', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sync: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fixExistingUserData = async () => {
    try {
      console.log('🔧 Fixing existing user data structure...');
      
      // Get current user data from SQLite first
      const currentUserData = await sqliteService.getUser(user.uid);
      console.log('📊 Current SQLite user data:', currentUserData);
      
      // Create COMPLETE user object with all required fields
      const completeUser = {
        uid: user.uid,
        email: user.email,
        name: user.name || currentUserData?.name || 'User',
        profilePic: user.profilePic || currentUserData?.profilePic || null,
        userType: user.userType || currentUserData?.userType || 'student',
        password: user.password || currentUserData?.password || '',
        createdAt: user.createdAt || currentUserData?.createdAt || new Date().toISOString(),
        lastLogin: user.lastLogin || currentUserData?.lastLogin || new Date().toISOString(),
        lastActive: new Date().toISOString(),
        isOnline: isOnline,
        isOffline: !isOnline,
        updatedAt: new Date().toISOString()
      };

      console.log('📊 Fixed user data to save:', completeUser);
      
      // ✅ Save COMPLETE user object to SQLite FIRST
      await sqliteService.saveUser(completeUser);
      console.log('💾✅ User data fixed in SQLite!');
      
      // ✅ Save COMPLETE user object to Firebase if online
      if (isOnline) {
        const userRef = ref(database, `users/${user.uid}`);
        await set(userRef, completeUser);
        console.log('🔥✅ User data fixed in Firebase!');
      }
      
      console.log('✅ User data structure fixed!');
      Alert.alert('Success', 'User data structure has been fixed!');
      
      // ✅ Update local state immediately
      setUser(completeUser);
      setProfilePic(completeUser.profilePic);
      
    } catch (error) {
      console.error('❌ Error fixing user data:', error);
      Alert.alert('Error', 'Failed to fix user data structure: ' + error.message);
    }
  };

  // Check sync status on component mount
  useEffect(() => {
    const checkSyncStatus = async () => {
      try {
        const syncItems = await sqliteService.getSyncQueue();
        if (syncItems.length > 0) {
          setSyncStatus(isOnline ? `🔄 ${syncItems.length} pending` : '📴 Sync pending');
        } else {
          setSyncStatus('✅ Synced');
        }
      } catch (error) {
        console.error('❌ Error checking sync status:', error);
      }
    };

    checkSyncStatus();
  }, [isOnline]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile Settings</Text>
        <Text style={styles.syncStatus}>{syncStatus}</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.profileSection}>
          {/* Profile Picture Section */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity 
              style={styles.avatarWrapper}
              onPress={() => {
                if (isEditing) {
                  setImageModalVisible(true);
                }
              }}
              disabled={!isEditing}
            >
              {profilePic ? (
                <View style={styles.imageContainer}>
                  <Image 
                    source={{ uri: profilePic }} 
                    style={styles.avatarImage}
                    onLoad={() => console.log('✅ Image loaded successfully')}
                    onError={(error) => {
                      console.log('❌ Failed to load profile picture:', error.nativeEvent.error);
                      console.log('📸 Attempted to load:', profilePic);
                      Alert.alert('Error', 'Failed to load profile picture. Please try selecting a different image.');
                    }}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
              )}
              {isEditing && (
                <View style={styles.editBadge}>
                  <Text style={styles.editBadgeText}>✎</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.userType}>
              {user?.userType === 'student' ? 'Student' : 
               user?.userType === 'teacher' ? 'Teacher' : 
               user?.userType === 'creative' ? 'Creative' : 'User'}
              {!isOnline && ' • Offline Mode'}
            </Text>
            
            {isEditing && (
              <TouchableOpacity 
                style={styles.changePhotoButton}
                onPress={() => setImageModalVisible(true)}
              >
                <Text style={styles.changePhotoText}>
                  {profilePic ? 'Change Photo' : 'Add Photo'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Sync and Fix Buttons */}
          <View style={styles.actionButtons}>
            {!isEditing && isOnline && (
              <TouchableOpacity 
                style={styles.syncButton}
                onPress={handleManualSync}
                disabled={loading}
              >
                <Text style={styles.syncButtonText}>🔄 Sync Now</Text>
              </TouchableOpacity>
            )}
            
            {!isEditing && (
              <TouchableOpacity 
                style={styles.fixButton}
                onPress={fixExistingUserData}
              >
                <Text style={styles.fixButtonText}>🔧 Fix User Data</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Profile Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                editable={isEditing}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.readOnlyText}>{user?.email}</Text>
            </View>

            {!isEditing ? (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={handleCancelEdit}
                  disabled={loading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={handleSaveProfile}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Account Information */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Member since</Text>
              <Text style={styles.infoValue}>
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
              </Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Last login</Text>
              <Text style={styles.infoValue}>
                {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Unknown'}
              </Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Sync Status</Text>
              <Text style={styles.infoValue}>{syncStatus}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Profile Picture Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Profile Picture</Text>
            
            {uploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={pickImage}
                >
                  <Text style={styles.modalButtonText}>📁 Choose from Gallery</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={takePhoto}
                >
                  <Text style={styles.modalButtonText}>📷 Take Photo</Text>
                </TouchableOpacity>
                
                {profilePic && (
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.removeButton]}
                    onPress={removeProfilePic}
                  >
                    <Text style={styles.removeButtonText}>🗑️ Remove Current Photo</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelModalButton]}
                  onPress={() => setImageModalVisible(false)}
                >
                  <Text style={styles.cancelModalButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
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
  header: {
    backgroundColor: '#6366f1',
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  syncStatus: {
    fontSize: 12,
    color: '#e0e7ff',
    marginTop: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  profileSection: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#6366f1',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 5,
  },
  userType: {
    fontSize: 14,
    color: '#94a3b8',
    textTransform: 'capitalize',
    marginBottom: 10,
  },
  changePhotoButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#6366f1',
    borderRadius: 20,
  },
  changePhotoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  syncButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#10b981',
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  fixButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  fixButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 20,
  },
  modalButton: {
    width: '100%',
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  removeButton: {
    backgroundColor: '#fef2f2',
  },
  removeButtonText: {
    color: '#dc2626',
    fontWeight: '500',
  },
  cancelModalButton: {
    backgroundColor: '#f3f4f6',
    marginTop: 10,
  },
  cancelModalButtonText: {
    color: '#6b7280',
  },
  uploadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 10,
    color: '#64748b',
  },
  // Form Styles
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  readOnlyText: {
    fontSize: 16,
    color: '#64748b',
    paddingVertical: 12,
  },
  editButton: {
    backgroundColor: '#6366f1',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  saveButton: {
    backgroundColor: '#6366f1',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 15,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
  }, 
  infoValue: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
});

export default ProfileScreen;