// src/utils/clipboard.js
import * as Clipboard from 'expo-clipboard';
import { Alert, Platform, ToastAndroid } from 'react-native';

export const copyToClipboard = async (text) => {
  try {
    // Use Expo's Clipboard
    await Clipboard.setStringAsync(text);
    
    // Show success message
    if (Platform.OS === 'android') {
      ToastAndroid.show('✓ Copied!', ToastAndroid.SHORT);
    } else {
      Alert.alert('✓ Copied!', 'Text copied to clipboard');
    }
    
    return true;
  } catch (error) {
    console.log('❌ Clipboard failed, showing fallback:', error);
    
    // Fallback: Show text in alert for manual copying
    Alert.alert(
      'Copy Text',
      `Select and copy this text:\n\n${text}`,
      [
        { 
          text: 'OK', 
          style: 'default'
        },
        {
          text: 'Select All',
          onPress: () => {
            console.log('📋 Text ready for manual copy:', text);
          }
        }
      ],
      { cancelable: true }
    );
    return false;
  }
};

// Optional: If you want to read from clipboard
export const getClipboardText = async () => {
  try {
    const text = await Clipboard.getStringAsync();
    return text;
  } catch (error) {
    console.log('❌ Failed to read clipboard:', error);
    return '';
  }
};