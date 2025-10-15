// src/screens/ChatScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ChatScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>💬 Chat & Collaboration</Text>
      <Text style={styles.subtitle}>Coming Soon!</Text>
      <Text style={styles.description}>
        Real-time messaging, group discussions, and collaborative features will be implemented in the next phase.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    color: '#6366f1',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
  },
});

export default ChatScreen;