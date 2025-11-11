// src/services/networkService.js
import { notesService } from './notesService';

console.log('🌐 Network service loading...');

let isOnline = true;

const setupNetworkListeners = () => {
  // For React Native, we'd use NetInfo, but for now assume online
  console.log('✅ Network service initialized - assuming online');
  isOnline = true;
};

const isConnected = () => {
  return isOnline;
};

const triggerSync = () => {
  console.log('🔄 Manual sync triggered');
  notesService.syncPendingChanges();
};

// Manual offline/online simulation
const setOnline = (online) => {
  isOnline = online;
  console.log(online ? '🌐 App set to ONLINE' : '📴 App set to OFFLINE');
  if (online) {
    triggerSync();
  }
};

// Initialize on import
setupNetworkListeners();

export default {
  isConnected,
  triggerSync,
  setOnline // For testing offline functionality
};