// src/utils/clipboard.js
import { Platform, Alert } from 'react-native';

class ClipboardManager {
  constructor() {
    this.clipboard = null;
    this.initializeClipboard();
  }

  async initializeClipboard() {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const { default: Clipboard } = await import('@react-native-community/clipboard');
        this.clipboard = Clipboard;
        console.log('✅ Clipboard initialized successfully');
      }
    } catch (error) {
      console.log('❌ Clipboard not available, using fallback');
      this.clipboard = null;
    }
  }

  async setString(text) {
    try {
      if (this.clipboard && this.clipboard.setString) {
        await this.clipboard.setString(text);
        return true;
      } else {
        // Fallback: Show text in alert for manual copying
        this.showCopyFallback(text);
        return false;
      }
    } catch (error) {
      console.error('❌ Clipboard error:', error);
      this.showCopyFallback(text);
      return false;
    }
  }

  showCopyFallback(text) {
    Alert.alert(
      'Copy Text',
      text,
      [
        {
          text: 'OK',
          style: 'default'
        },
        {
          text: 'Select All',
          onPress: () => {
            // This will allow users to manually select and copy the text
            // Most devices will show selection handles when text is displayed
          }
        }
      ],
      { cancelable: true }
    );
  }

  async getString() {
    try {
      if (this.clipboard && this.clipboard.getString) {
        return await this.clipboard.getString();
      }
      return '';
    } catch (error) {
      console.error('❌ Clipboard get error:', error);
      return '';
    }
  }
}

// Create a singleton instance
export const clipboardManager = new ClipboardManager();