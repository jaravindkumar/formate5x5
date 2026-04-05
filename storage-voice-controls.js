// ===== STORAGE MANAGEMENT SYSTEM (Block 16) =====

class StorageManager {
  constructor() {
    this.dbName = 'formate-storage';
    this.dbVersion = 1;
    this.retentionPolicies = {
      all: 'Keep all recordings',
      flagged: 'Keep only flagged/poor form recordings',
      recent: 'Keep last 30 days only',
      none: 'Delete after viewing'
    };
  }
  
  async initialize() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Recordings store
        if (!db.objectStoreNames.contains('recordings')) {
          const recordingsStore = db.createObjectStore('recordings', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          recordingsStore.createIndex('exercise', 'exercise', { unique: false });
          recordingsStore.createIndex('timestamp', 'timestamp', { unique: false });
          recordingsStore.createIndex('formScore', 'formAnalysis.score', { unique: false });
        }
        
        // Frame data store (separate for efficiency)
        if (!db.objectStoreNames.contains('frameData')) {
          db.createObjectStore('frameData', {
            keyPath: 'recordingId'
          });
        }
      };
    });
  }
  
  async saveRecording(recordingData) {
    const { frameData, ...metaData } = recordingData;
    
    // Save metadata
    const tx = this.db.transaction(['recordings', 'frameData'], 'readwrite');
    
    const recordingId = await new Promise((resolve, reject) => {
      const request = tx.objectStore('recordings').add(metaData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Save frame data separately
    await new Promise((resolve, reject) => {
      const request = tx.objectStore('frameData').add({
        recordingId,
        data: frameData
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    await tx.complete;
    
    // Apply retention policy
    await this.applyRetentionPolicy();
    
    return recordingId;
  }
  
  async getRecording(id) {
    const tx = this.db.transaction(['recordings', 'frameData'], 'readonly');
    
    const recording = await new Promise((resolve, reject) => {
      const request = tx.objectStore('recordings').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    const frameData = await new Promise((resolve, reject) => {
      const request = tx.objectStore('frameData').get(id);
      request.onsuccess = () => resolve(request.result?.data);
      request.onerror = () => reject(request.error);
    });
    
    return { ...recording, frameData };
  }
  
  async getAllRecordings() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('recordings', 'readonly');
      const request = tx.objectStore('recordings').getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async deleteRecording(id) {
    const tx = this.db.transaction(['recordings', 'frameData'], 'readwrite');
    
    await Promise.all([
      new Promise((resolve, reject) => {
        const request = tx.objectStore('recordings').delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = tx.objectStore('frameData').delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);
  }
  
  async applyRetentionPolicy() {
    const policy = APP_STATE.settings.videoRetention;
    const recordings = await this.getAllRecordings();
    
    switch(policy) {
      case 'flagged':
        // Keep only recordings with poor form (score < 70)
        for (const rec of recordings) {
          if (rec.formAnalysis?.score >= 70) {
            await this.deleteRecording(rec.id);
          }
        }
        break;
        
      case 'recent':
        // Keep only last 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        for (const rec of recordings) {
          if (rec.timestamp < thirtyDaysAgo) {
            await this.deleteRecording(rec.id);
          }
        }
        break;
        
      case 'none':
        // Delete all after viewing
        for (const rec of recordings) {
          if (rec.viewed) {
            await this.deleteRecording(rec.id);
          }
        }
        break;
        
      case 'all':
      default:
        // Keep everything
        break;
    }
  }
  
  async getStorageUsage() {
    if (!navigator.storage || !navigator.storage.estimate) {
      return { used: 0, total: 0, percentage: 0 };
    }
    
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const total = estimate.quota || 0;
    const percentage = total > 0 ? (used / total) * 100 : 0;
    
    return {
      used: this.formatBytes(used),
      total: this.formatBytes(total),
      percentage: Math.round(percentage),
      usedBytes: used,
      totalBytes: total
    };
  }
  
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
  
  async clearAllData() {
    const tx = this.db.transaction(['recordings', 'frameData'], 'readwrite');
    
    await Promise.all([
      new Promise((resolve, reject) => {
        const request = tx.objectStore('recordings').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = tx.objectStore('frameData').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);
    
    showNotification('Storage Cleared', 'All recordings have been deleted', 'success');
  }
}

// ===== VOICE COMMAND SYSTEM (Block 17) =====

class VoiceCommandHandler {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.commands = {
      'start set': () => this.executeCommand('startSet'),
      'stop set': () => this.executeCommand('stopSet'),
      'next exercise': () => this.executeCommand('nextExercise'),
      'rest timer': () => this.executeCommand('startRestTimer'),
      'skip rest': () => this.executeCommand('skipRest'),
      'end workout': () => this.executeCommand('endWorkout'),
      'show progress': () => this.executeCommand('showProgress'),
      'show profile': () => this.executeCommand('showProfile'),
      'help': () => this.executeCommand('showHelp')
    };
  }
  
  initialize() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return false;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    
    this.recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const command = event.results[last][0].transcript.toLowerCase().trim();
      
      console.log('Voice command:', command);
      this.processCommand(command);
    };
    
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Restart listening
        this.startListening();
      }
    };
    
    this.recognition.onend = () => {
      if (this.isListening) {
        this.recognition.start(); // Auto-restart
      }
    };
    
    return true;
  }
  
  startListening() {
    if (!this.recognition) {
      if (!this.initialize()) {
        showNotification(
          'Voice Commands Unavailable',
          'Your browser does not support voice recognition',
          'warning'
        );
        return;
      }
    }
    
    try {
      this.recognition.start();
      this.isListening = true;
      
      showNotification(
        'Voice Commands Active',
        'Say "help" to hear available commands',
        'info'
      );
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
    }
  }
  
  stopListening() {
    if (this.recognition && this.isListening) {
      this.isListening = false;
      this.recognition.stop();
      
      showNotification(
        'Voice Commands Deactivated',
        '',
        'info'
      );
    }
  }
  
  processCommand(spokenText) {
    // Find matching command
    for (const [command, action] of Object.entries(this.commands)) {
      if (spokenText.includes(command)) {
        action();
        this.provideFeedback(command);
        return;
      }
    }
    
    // No match found
    console.log('Unknown command:', spokenText);
  }
  
  executeCommand(commandName) {
    switch(commandName) {
      case 'startSet':
        if (APP_STATE.currentWorkout) {
          logSet();
        }
        break;
        
      case 'stopSet':
        if (window.workoutRecorder.isRecording) {
          window.workoutRecorder.stopRecording();
        }
        break;
        
      case 'nextExercise':
        // Skip to next exercise
        break;
        
      case 'startRestTimer':
        startRestTimer();
        break;
        
      case 'skipRest':
        // Cancel rest timer
        break;
        
      case 'endWorkout':
        confirmEndWorkout();
        break;
        
      case 'showProgress':
        switchTab('progress');
        break;
        
      case 'showProfile':
        switchTab('profile');
        break;
        
      case 'showHelp':
        this.showCommandsList();
        break;
    }
  }
  
  provideFeedback(command) {
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // Visual feedback
    const feedbackEl = document.getElementById('voice-feedback');
    if (feedbackEl) {
      feedbackEl.textContent = `✓ ${command}`;
      feedbackEl.style.opacity = '1';
      
      setTimeout(() => {
        feedbackEl.style.opacity = '0';
      }, 2000);
    }
  }
  
  showCommandsList() {
    showModal(`
      <div class="voice-commands-help">
        <h2>🎤 Voice Commands</h2>
        <p class="text-muted mb-lg">Say any of these commands while working out:</p>
        
        <div class="command-list">
          ${Object.keys(this.commands).map(cmd => `
            <div class="command-item">
              <span class="command-text">"${cmd}"</span>
            </div>
          `).join('')}
        </div>
        
        <button class="btn btn-primary btn-block mt-lg" onclick="closeModal()">
          Got It
        </button>
      </div>
    `);
  }
}

// ===== GESTURE CONTROL SYSTEM =====

class GestureController {
  constructor() {
    this.lastGesture = null;
    this.gestureThreshold = 0.8; // Confidence threshold
  }
  
  detectGesture(landmarks) {
    if (!landmarks) return null;
    
    // Thumbs up gesture (both hands) = good set
    const thumbsUp = this.detectThumbsUp(landmarks);
    if (thumbsUp) {
      return 'confirm';
    }
    
    // Wave gesture = skip/cancel
    const wave = this.detectWave(landmarks);
    if (wave) {
      return 'cancel';
    }
    
    // Clap = start/stop recording
    const clap = this.detectClap(landmarks);
    if (clap) {
      return 'toggle_recording';
    }
    
    return null;
  }
  
  detectThumbsUp(landmarks) {
    // Left or right hand thumbs up
    // Thumb tip higher than other fingers
    const leftThumbUp = landmarks[4].y < landmarks[8].y && 
                        landmarks[4].y < landmarks[12].y;
    
    const rightThumbUp = landmarks[4].y < landmarks[8].y && 
                         landmarks[4].y < landmarks[12].y;
    
    return leftThumbUp || rightThumbUp;
  }
  
  detectWave(landmarks) {
    // Hand moving left-right repeatedly
    // Simplified version
    return false; // Implement if needed
  }
  
  detectClap(landmarks) {
    // Hands coming together quickly
    const leftHand = landmarks[15]; // Left wrist
    const rightHand = landmarks[16]; // Right wrist
    
    const distance = Math.sqrt(
      Math.pow(leftHand.x - rightHand.x, 2) +
      Math.pow(leftHand.y - rightHand.y, 2)
    );
    
    return distance < 0.1; // Very close together
  }
  
  processGesture(gesture) {
    if (!gesture || gesture === this.lastGesture) return;
    
    this.lastGesture = gesture;
    
    switch(gesture) {
      case 'confirm':
        // Good set completed
        if (window.workoutRecorder.isRecording) {
          window.workoutRecorder.stopRecording();
        }
        break;
        
      case 'cancel':
        // Cancel current action
        if (window.workoutRecorder.isRecording) {
          window.workoutRecorder.stopRecording();
        }
        break;
        
      case 'toggle_recording':
        // Start/stop recording
        if (window.workoutRecorder.isRecording) {
          window.workoutRecorder.stopRecording();
        } else {
          logSet();
        }
        break;
    }
    
    // Reset after 1 second
    setTimeout(() => {
      this.lastGesture = null;
    }, 1000);
  }
}

// ===== STORAGE SETTINGS UI =====

function showStorageSettings() {
  showModal(`
    <div class="storage-settings">
      <h2>💾 Storage Settings</h2>
      
      <div class="storage-usage-card mb-lg">
        <h3>Storage Usage</h3>
        <div id="storage-usage-display">Loading...</div>
      </div>
      
      <div class="form-group">
        <label>Video Retention Policy</label>
        <select id="retention-policy" onchange="updateRetentionPolicy(this.value)">
          <option value="all">Keep All Recordings</option>
          <option value="flagged">Keep Only Poor Form (Score < 70)</option>
          <option value="recent">Keep Last 30 Days Only</option>
          <option value="none">Delete After Viewing</option>
        </select>
        <p class="help-text">Choose how long to keep your workout videos</p>
      </div>
      
      <button class="btn btn-danger btn-block mt-lg" onclick="confirmClearStorage()">
        Clear All Recordings
      </button>
      
      <button class="btn btn-secondary btn-block mt-sm" onclick="closeModal()">
        Close
      </button>
    </div>
  `);
  
  // Load current usage
  updateStorageDisplay();
  
  // Set current policy
  document.getElementById('retention-policy').value = APP_STATE.settings.videoRetention;
}

async function updateStorageDisplay() {
  const usage = await window.storageManager.getStorageUsage();
  
  const displayEl = document.getElementById('storage-usage-display');
  if (!displayEl) return;
  
  displayEl.innerHTML = `
    <div class="storage-bar-container">
      <div class="storage-bar" style="width: ${usage.percentage}%"></div>
    </div>
    <p class="text-muted" style="margin-top: var(--spacing-sm);">
      ${usage.used} used of ${usage.total} (${usage.percentage}%)
    </p>
  `;
}

function updateRetentionPolicy(policy) {
  APP_STATE.settings.videoRetention = policy;
  saveSettings(APP_STATE.settings);
  
  showNotification(
    'Policy Updated',
    `Video retention set to: ${policy}`,
    'success'
  );
  
  // Apply immediately
  window.storageManager.applyRetentionPolicy();
}

function confirmClearStorage() {
  if (confirm('Delete ALL workout recordings? This cannot be undone.')) {
    window.storageManager.clearAllData();
    updateStorageDisplay();
  }
}

// ===== GLOBAL INSTANCES =====
window.storageManager = new StorageManager();
window.voiceCommands = new VoiceCommandHandler();
window.gestureController = new GestureController();

// ===== AUTO-INITIALIZE =====
document.addEventListener('DOMContentLoaded', async () => {
  await window.storageManager.initialize();
  console.log('✅ Storage manager initialized');
  
  if (APP_STATE.settings.voiceCommandsEnabled) {
    window.voiceCommands.initialize();
  }
});

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    StorageManager,
    VoiceCommandHandler,
    GestureController
  };
}
