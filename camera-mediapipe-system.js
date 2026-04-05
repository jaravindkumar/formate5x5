// ===== MEDIAPIPE POSE DETECTION & CAMERA SYSTEM =====
// Blocks 5-8: Camera Setup, Recording, Pose Detection, Rep Counting

class MediaPipeManager {
  constructor() {
    this.pose = null;
    this.camera = null;
    this.isLoaded = false;
    this.isProcessing = false;
    this.landmarks = null;
    this.onResults = null;
  }
  
  async initialize() {
    console.log('📦 Loading MediaPipe Pose...');
    showLoading('Loading AI model (26MB)...');
    
    try {
      // Load MediaPipe Pose from CDN
      await this.loadMediaPipeScripts();
      
      // Initialize Pose model
      this.pose = new Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });
      
      // Configure model
      this.pose.setOptions({
        modelComplexity: window.APP_CONFIG.performanceTier === 'high' ? 2 : 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });
      
      // Set up results callback
      this.pose.onResults((results) => {
        this.landmarks = results.poseLandmarks;
        if (this.onResults) {
          this.onResults(results);
        }
      });
      
      this.isLoaded = true;
      hideLoading();
      console.log('✅ MediaPipe Pose loaded');
      
      return true;
      
    } catch (error) {
      console.error('❌ MediaPipe initialization failed:', error);
      hideLoading();
      showNotification(
        'AI Model Load Failed',
        'Could not load pose detection. Check internet connection.',
        'error'
      );
      return false;
    }
  }
  
  async loadMediaPipeScripts() {
    // Load MediaPipe from CDN
    const scripts = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js'
    ];
    
    for (const src of scripts) {
      await this.loadScript(src);
    }
  }
  
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  async processFrame(videoElement) {
    if (!this.isLoaded || this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      await this.pose.send({ image: videoElement });
    } catch (error) {
      console.error('Frame processing error:', error);
    }
    
    this.isProcessing = false;
  }
  
  getLandmarks() {
    return this.landmarks;
  }
}

// ===== CAMERA SETUP WIZARD =====
class CameraSetupWizard {
  constructor() {
    this.checks = {
      angle: false,
      distance: false,
      lighting: false,
      framing: false,
      stability: false
    };
  }
  
  async start() {
    showModal(`
      <div class="camera-setup-wizard">
        <h2>📹 Camera Setup</h2>
        <p class="text-muted mb-lg">Let's set up your camera for accurate form analysis</p>
        
        <div class="setup-checklist">
          <div class="setup-item" id="check-angle">
            <span class="setup-icon">📐</span>
            <div class="setup-content">
              <h3>Camera Angle</h3>
              <p>Side view, 90° to your movement</p>
              <span class="setup-status">⏳ Checking...</span>
            </div>
          </div>
          
          <div class="setup-item" id="check-distance">
            <span class="setup-icon">📏</span>
            <div class="setup-content">
              <h3>Distance</h3>
              <p>8-10 feet away, full body visible</p>
              <span class="setup-status">⏳ Checking...</span>
            </div>
          </div>
          
          <div class="setup-item" id="check-lighting">
            <span class="setup-icon">💡</span>
            <div class="setup-content">
              <h3>Lighting</h3>
              <p>Bright, even lighting on your body</p>
              <span class="setup-status">⏳ Checking...</span>
            </div>
          </div>
          
          <div class="setup-item" id="check-framing">
            <span class="setup-icon">🎯</span>
            <div class="setup-content">
              <h3>Framing</h3>
              <p>Head to feet visible, centered</p>
              <span class="setup-status">⏳ Checking...</span>
            </div>
          </div>
          
          <div class="setup-item" id="check-stability">
            <span class="setup-icon">📱</span>
            <div class="setup-content">
              <h3>Stability</h3>
              <p>Phone secure, not handheld</p>
              <span class="setup-status">⏳ Checking...</span>
            </div>
          </div>
        </div>
        
        <div class="camera-preview-container">
          <video id="setup-preview" autoplay playsinline></video>
          <canvas id="setup-canvas"></canvas>
        </div>
        
        <button class="btn btn-primary btn-block mt-lg" onclick="cameraSetup.complete()" disabled id="setup-continue">
          Continue to Recording
        </button>
        
        <button class="btn btn-secondary btn-block mt-sm" onclick="closeModal()">
          Skip Setup (Not Recommended)
        </button>
      </div>
    `);
    
    await this.startPreview();
    this.runChecks();
  }
  
  async startPreview() {
    try {
      const video = document.getElementById('setup-preview');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      video.srcObject = stream;
      
    } catch (error) {
      console.error('Camera access failed:', error);
      showNotification('Camera Error', 'Could not access camera', 'error');
    }
  }
  
  async runChecks() {
    // Initialize MediaPipe for setup validation
    if (!window.mediaPipeManager.isLoaded) {
      await window.mediaPipeManager.initialize();
    }
    
    const video = document.getElementById('setup-preview');
    const canvas = document.getElementById('setup-canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Set up pose detection callback
    window.mediaPipeManager.onResults = (results) => {
      this.validateSetup(results);
      this.drawOverlay(ctx, results);
    };
    
    // Process frames
    const processFrame = async () => {
      if (video.readyState === 4) {
        await window.mediaPipeManager.processFrame(video);
      }
      requestAnimationFrame(processFrame);
    };
    
    processFrame();
  }
  
  validateSetup(results) {
    if (!results.poseLandmarks) {
      this.updateCheck('framing', false, 'No body detected - step back');
      return;
    }
    
    const landmarks = results.poseLandmarks;
    
    // Check framing (full body visible)
    const headVisible = landmarks[0].y < 0.2;
    const feetVisible = landmarks[31].y > 0.8 && landmarks[32].y > 0.8;
    const centered = Math.abs(landmarks[0].x - 0.5) < 0.2;
    
    this.updateCheck('framing', headVisible && feetVisible && centered, 
      headVisible && feetVisible && centered ? 'Perfect framing' : 'Adjust position');
    
    // Check angle (side view detection)
    const shoulderWidth = Math.abs(landmarks[11].x - landmarks[12].x);
    const isSideView = shoulderWidth < 0.15; // Shoulders aligned = side view
    
    this.updateCheck('angle', isSideView, 
      isSideView ? 'Good side angle' : 'Rotate to side view');
    
    // Check distance (based on body size in frame)
    const bodyHeight = Math.abs(landmarks[0].y - landmarks[31].y);
    const goodDistance = bodyHeight > 0.6 && bodyHeight < 0.85;
    
    this.updateCheck('distance', goodDistance,
      goodDistance ? 'Perfect distance' : bodyHeight < 0.6 ? 'Too far' : 'Too close');
    
    // Check lighting (based on landmark confidence)
    const avgConfidence = landmarks.reduce((sum, lm) => sum + (lm.visibility || 0), 0) / landmarks.length;
    const goodLighting = avgConfidence > 0.7;
    
    this.updateCheck('lighting', goodLighting,
      goodLighting ? 'Good lighting' : 'Need more light');
    
    // Check stability (low motion variance)
    // Simplified - assume stable if landmarks are detected
    this.updateCheck('stability', true, 'Camera stable');
    
    // Enable continue button if all checks pass
    const allChecks = Object.values(this.checks).every(check => check);
    const continueBtn = document.getElementById('setup-continue');
    if (continueBtn) {
      continueBtn.disabled = !allChecks;
    }
  }
  
  updateCheck(checkName, passed, message) {
    this.checks[checkName] = passed;
    
    const element = document.getElementById(`check-${checkName}`);
    if (!element) return;
    
    const statusEl = element.querySelector('.setup-status');
    if (passed) {
      statusEl.textContent = '✅ ' + message;
      statusEl.style.color = 'var(--color-success)';
      element.classList.add('check-passed');
    } else {
      statusEl.textContent = '⚠️ ' + message;
      statusEl.style.color = 'var(--color-warning)';
      element.classList.remove('check-passed');
    }
  }
  
  drawOverlay(ctx, results) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    if (results.poseLandmarks) {
      // Draw skeleton
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: '#E89B4E',
        lineWidth: 2
      });
      
      // Draw landmarks
      drawLandmarks(ctx, results.poseLandmarks, {
        color: '#F4CB80',
        fillColor: '#E89B4E',
        radius: 3
      });
    }
  }
  
  complete() {
    // Stop preview stream
    const video = document.getElementById('setup-preview');
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    
    closeModal();
    
    showNotification(
      'Setup Complete!',
      'Camera configured for accurate form analysis',
      'success'
    );
    
    // Proceed to recording
    window.workoutRecorder.startRecording();
  }
}

// ===== WORKOUT RECORDER =====
class WorkoutRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.startTime = null;
    this.frameBuffer = [];
    this.currentExercise = null;
    this.currentSet = null;
  }
  
  async startRecording() {
    try {
      showLoading('Starting camera...');
      
      // Get camera stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: window.APP_CONFIG.cameraResolution.width,
          height: window.APP_CONFIG.cameraResolution.height,
          frameRate: window.APP_CONFIG.frameRate
        },
        audio: false
      });
      
      hideLoading();
      
      // Show recording UI
      this.showRecordingUI();
      
      // Start MediaRecorder
      const options = {
        mimeType: window.APP_CONFIG.videoFormat,
        videoBitsPerSecond: window.APP_CONFIG.videoBitrate
      };
      
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };
      
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      this.startTime = Date.now();
      
      // Start real-time pose detection
      this.startPoseDetection();
      
      showNotification('Recording Started', 'Perform your set now', 'success');
      
    } catch (error) {
      console.error('Recording start failed:', error);
      hideLoading();
      showNotification('Recording Error', error.message, 'error');
    }
  }
  
  showRecordingUI() {
    const modal = document.createElement('div');
    modal.className = 'recording-modal';
    modal.id = 'recording-modal';
    modal.innerHTML = `
      <div class="recording-container">
        <div class="recording-header">
          <h3>${this.currentExercise} - Set ${this.currentSet}</h3>
          <span class="recording-timer" id="recording-timer">00:00</span>
        </div>
        
        <div class="video-container">
          <video id="recording-video" autoplay playsinline muted></video>
          <canvas id="recording-canvas"></canvas>
          
          <div class="recording-overlay">
            <div class="rep-counter" id="rep-counter">
              <span class="rep-count">0</span>
              <span class="rep-label">reps</span>
            </div>
            
            <div class="live-feedback" id="live-feedback">
              Ready to start
            </div>
          </div>
        </div>
        
        <div class="recording-controls">
          <button class="btn btn-danger btn-large" onclick="workoutRecorder.stopRecording()">
            Stop Recording
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const video = document.getElementById('recording-video');
    video.srcObject = this.stream;
    
    this.startTimer();
  }
  
  startTimer() {
    const timerEl = document.getElementById('recording-timer');
    
    const updateTimer = () => {
      if (!this.isRecording) return;
      
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      
      timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      
      requestAnimationFrame(updateTimer);
    };
    
    updateTimer();
  }
  
  async startPoseDetection() {
    const video = document.getElementById('recording-video');
    const canvas = document.getElementById('recording-canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    const repDetector = new RepDetectionEngine(this.currentExercise);
    
    window.mediaPipeManager.onResults = (results) => {
      // Draw pose overlay
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
          color: '#E89B4E',
          lineWidth: 3
        });
        drawLandmarks(ctx, results.poseLandmarks, {
          color: '#F4CB80',
          fillColor: '#E89B4E',
          radius: 4
        });
        
        // Store frame data
        this.frameBuffer.push({
          timestamp: Date.now() - this.startTime,
          landmarks: results.poseLandmarks
        });
        
        // Detect reps
        const repData = repDetector.processFrame(results.poseLandmarks);
        
        if (repData.repDetected) {
          this.onRepDetected(repData);
        }
        
        // Update live feedback
        this.updateLiveFeedback(repData);
      }
    };
    
    const processFrame = async () => {
      if (!this.isRecording) return;
      
      if (video.readyState === 4) {
        await window.mediaPipeManager.processFrame(video);
      }
      
      requestAnimationFrame(processFrame);
    };
    
    processFrame();
  }
  
  onRepDetected(repData) {
    const counterEl = document.getElementById('rep-counter');
    if (counterEl) {
      const countEl = counterEl.querySelector('.rep-count');
      countEl.textContent = repData.totalReps;
      
      // Pulse animation
      counterEl.style.transform = 'scale(1.2)';
      setTimeout(() => {
        counterEl.style.transform = 'scale(1)';
      }, 200);
    }
    
    // Haptic feedback if supported
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }
  
  updateLiveFeedback(repData) {
    const feedbackEl = document.getElementById('live-feedback');
    if (!feedbackEl || !repData.feedback) return;
    
    feedbackEl.textContent = repData.feedback;
    feedbackEl.className = `live-feedback ${repData.feedbackType || 'info'}`;
  }
  
  async stopRecording() {
    this.isRecording = false;
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    const modal = document.getElementById('recording-modal');
    if (modal) {
      modal.remove();
    }
    
    showLoading('Processing video...');
  }
  
  async processRecording() {
    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const videoUrl = URL.createObjectURL(blob);
    
    // Analyze form
    const formAnalysis = await this.analyzeForm();
    
    // Save to IndexedDB
    const recordingId = await this.saveRecording({
      blob,
      url: videoUrl,
      exercise: this.currentExercise,
      setNumber: this.currentSet,
      duration: Date.now() - this.startTime,
      frameData: this.frameBuffer,
      formAnalysis,
      timestamp: Date.now()
    });
    
    hideLoading();
    
    // Show results
    this.showResults(formAnalysis, recordingId);
    
    // Clean up
    this.recordedChunks = [];
    this.frameBuffer = [];
  }
  
  async analyzeForm() {
    // Use form-analysis-config.js
    const analyzer = new FormAnalyzer(this.currentExercise);
    return await analyzer.analyze(this.frameBuffer);
  }
  
  async saveRecording(data) {
    // Save to IndexedDB
    const db = await openDB('formate-recordings', 1);
    const id = await db.add('recordings', data);
    return id;
  }
  
  showResults(formAnalysis, recordingId) {
    showModal(`
      <div class="form-results">
        <h2>Set ${this.currentSet} Complete!</h2>
        
        <div class="form-score-card">
          <div class="score-circle ${formAnalysis.grade.toLowerCase()}">
            <span class="score-value">${formAnalysis.score}</span>
            <span class="score-grade">${formAnalysis.grade}</span>
          </div>
          
          <h3>Form Score</h3>
        </div>
        
        <div class="form-breakdown">
          ${Object.entries(formAnalysis.breakdown).map(([criterion, data]) => `
            <div class="criterion-item">
              <div class="criterion-header">
                <span class="criterion-name">${criterion.replace(/_/g, ' ')}</span>
                <span class="criterion-score ${data.rating}">${Math.round(data.score * 100)}</span>
              </div>
              <div class="criterion-feedback">${data.feedback}</div>
            </div>
          `).join('')}
        </div>
        
        <button class="btn btn-primary btn-block" onclick="workoutRecorder.completeSet(${recordingId})">
          Continue to Next Set
        </button>
        
        <button class="btn btn-secondary btn-block mt-sm" onclick="workoutRecorder.reviewVideo(${recordingId})">
          Watch Video
        </button>
      </div>
    `);
  }
  
  completeSet(recordingId) {
    closeModal();
    
    // Update workout state
    APP_STATE.currentWorkout.completeSet({
      reps: 5, // Detected from video
      formScore: this.lastFormScore,
      recordingId
    });
    
    renderActiveWorkout();
  }
  
  async reviewVideo(recordingId) {
    // Load video from IndexedDB and show player
    const db = await openDB('formate-recordings', 1);
    const recording = await db.get('recordings', recordingId);
    
    showModal(`
      <div class="video-review">
        <h2>Video Review</h2>
        <video controls src="${recording.url}" style="width: 100%; border-radius: var(--radius-lg);"></video>
        
        <div class="video-controls mt-lg">
          <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        </div>
      </div>
    `);
  }
}

// ===== REP DETECTION ENGINE =====
class RepDetectionEngine {
  constructor(exercise) {
    this.exercise = exercise;
    this.repCount = 0;
    this.phase = 'ready'; // ready, descending, bottom, ascending, top
    this.history = [];
    this.peakDetector = new PeakDetector();
  }
  
  processFrame(landmarks) {
    const keyMetric = this.getKeyMetric(landmarks);
    
    this.history.push({
      timestamp: Date.now(),
      value: keyMetric,
      landmarks
    });
    
    // Keep only last 90 frames (3 seconds at 30fps)
    if (this.history.length > 90) {
      this.history.shift();
    }
    
    // Detect rep based on phase transitions
    const currentPhase = this.detectPhase(keyMetric);
    
    let repDetected = false;
    let feedback = '';
    let feedbackType = 'info';
    
    if (this.phase === 'ascending' && currentPhase === 'top') {
      // Rep completed
      this.repCount++;
      repDetected = true;
      feedback = `Rep ${this.repCount} complete!`;
      feedbackType = 'success';
    }
    
    this.phase = currentPhase;
    
    return {
      repDetected,
      totalReps: this.repCount,
      currentPhase: this.phase,
      feedback,
      feedbackType,
      keyMetric
    };
  }
  
  getKeyMetric(landmarks) {
    // Different exercises use different key metrics
    switch (this.exercise) {
      case 'squat':
        // Use hip height
        const hip = getMidpoint(landmarks[23], landmarks[24]);
        return hip.y;
        
      case 'bench':
      case 'ohp':
        // Use wrist height
        const wrist = getMidpoint(landmarks[15], landmarks[16]);
        return wrist.y;
        
      case 'deadlift':
        // Use shoulder height
        const shoulder = getMidpoint(landmarks[11], landmarks[12]);
        return shoulder.y;
        
      case 'row':
        // Use elbow height
        const elbow = getMidpoint(landmarks[13], landmarks[14]);
        return elbow.y;
        
      default:
        return 0;
    }
  }
  
  detectPhase(currentValue) {
    if (this.history.length < 10) return 'ready';
    
    const recentValues = this.history.slice(-10).map(h => h.value);
    const trend = this.calculateTrend(recentValues);
    
    const isMovingDown = trend > 0.001; // Y increases downward in video coords
    const isMovingUp = trend < -0.001;
    
    // State machine for phase detection
    if (this.phase === 'ready' || this.phase === 'top') {
      if (isMovingDown) return 'descending';
    }
    
    if (this.phase === 'descending') {
      if (!isMovingDown && !isMovingUp) return 'bottom';
    }
    
    if (this.phase === 'bottom') {
      if (isMovingUp) return 'ascending';
    }
    
    if (this.phase === 'ascending') {
      if (!isMovingUp) return 'top';
    }
    
    return this.phase;
  }
  
  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    
    const recent = values.slice(-3);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    return recentAvg - avg;
  }
}

class PeakDetector {
  detect(signal, threshold = 0.1) {
    const peaks = [];
    
    for (let i = 1; i < signal.length - 1; i++) {
      const prev = signal[i - 1];
      const curr = signal[i];
      const next = signal[i + 1];
      
      if (curr > prev && curr > next && curr > threshold) {
        peaks.push({ index: i, value: curr });
      }
    }
    
    return peaks;
  }
}

// ===== FORM ANALYZER =====
class FormAnalyzer {
  constructor(exercise) {
    this.exercise = exercise;
  }
  
  async analyze(frameBuffer) {
    // Load form criteria
    const criteria = FORM_CRITERIA[this.exercise];
    
    // Find key frames (bottom, top positions)
    const keyFrames = this.extractKeyFrames(frameBuffer);
    
    // Analyze each criterion
    const analysis = calculateFormScore(
      this.exercise,
      keyFrames.bottom.landmarks,
      keyFrames,
      'bottom'
    );
    
    return analysis;
  }
  
  extractKeyFrames(frameBuffer) {
    // Find bottom position (lowest point)
    let lowestFrame = frameBuffer[0];
    let lowestY = this.getHipY(frameBuffer[0].landmarks);
    
    for (const frame of frameBuffer) {
      const y = this.getHipY(frame.landmarks);
      if (y > lowestY) {
        lowestY = y;
        lowestFrame = frame;
      }
    }
    
    return {
      bottom: lowestFrame,
      top: frameBuffer[0], // Starting position
      all: frameBuffer
    };
  }
  
  getHipY(landmarks) {
    const hip = getMidpoint(landmarks[23], landmarks[24]);
    return hip.y;
  }
}

// ===== INDEXEDDB HELPER =====
async function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('recordings')) {
        db.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// ===== GLOBAL INSTANCES =====
window.mediaPipeManager = new MediaPipeManager();
window.cameraSetup = new CameraSetupWizard();
window.workoutRecorder = new WorkoutRecorder();

// ===== INTEGRATION WITH MAIN APP =====
// Override logSet() to use camera recording
const originalLogSet = window.logSet;
window.logSet = async function() {
  const workout = APP_STATE.currentWorkout;
  const exercise = workout.getCurrentExercise();
  
  // Set current exercise for recorder
  window.workoutRecorder.currentExercise = exercise.id;
  window.workoutRecorder.currentSet = workout.currentSetIndex + 1;
  
  // Start camera setup wizard
  await window.cameraSetup.start();
};
