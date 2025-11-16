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
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import sqliteService from '../services/sqliteService';

const ProfileScreen = ({ navigation }) => {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [profilePic, setProfilePic] = useState(user?.profilePic || null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);

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
        
        // Directly set the image URI - React Native Image can handle file:// URIs
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
        
        // Directly set the image URI
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
      
      console.log('💾 Saving profile...');
      console.log('📸 Current profile pic:', profilePic);
      
      // If it's a local file URI, upload it to Firebase Storage first
      if (profilePic && profilePic.startsWith('file://')) {
        try {
          console.log('☁️ Uploading profile picture to Firebase...');
          setUploading(true);
          const downloadURL = await authService.uploadProfilePicture(profilePic, user.uid);
          finalProfilePic = downloadURL;
          console.log('✅ Profile picture uploaded:', downloadURL);
          setUploading(false);
        } catch (uploadError) {
          console.log('⚠️ Could not upload profile picture, keeping local URI:', uploadError.message);
          // Keep local URI as fallback - React Native Image can handle file:// URIs
          finalProfilePic = profilePic;
        }
      }

      // ✅ Create updated user object WITH profile picture
      const updatedUser = {
        ...user,
        name: name.trim(),
        profilePic: finalProfilePic, // ✅ Make sure this is included
        updatedAt: new Date().toISOString()
      };

      console.log('💾 Saving user to SQLite...');
      console.log('📸 Profile pic in user object:', updatedUser.profilePic ? 'YES' : 'NO');
      
      // ✅ ALWAYS save to SQLite (local database)
      await sqliteService.saveUser(updatedUser);
      console.log('💾 Profile saved to SQLite');

      // ✅ ALSO save to Firebase if user is online
      if (!user?.isOffline) {
        try {
          console.log('🔥 Saving user to Firebase...');
          await authService.updateUserProfile(updatedUser);
          console.log('🔥 Profile saved to Firebase');
        } catch (firebaseError) {
          console.log('⚠️ Firebase save failed, but SQLite saved:', firebaseError.message);
        }
      }

      // ✅ Update context for immediate UI update
      setUser(updatedUser);
      
      setIsEditing(false);
      console.log('✅ Profile update completed');
      Alert.alert('Success', 'Profile updated successfully!');
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile Settings</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
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
                      // Fallback to default avatar if image fails to load
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
              {user?.isOffline && ' • Offline Mode'}
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
                {user?.isOffline ? 'Offline Account' : 'Online Account'}
              </Text>
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  profileSection: {
    padding: 20,
    paddingBottom: 40, // Extra padding at bottom
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
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