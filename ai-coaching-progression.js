// ===== AI COACHING SYSTEM (Block 14) =====
// Provides personalized coaching feedback using Groq LLaMA

class AICoach {
  constructor() {
    this.apiKey = null; // User will provide their own Groq API key
    this.model = 'llama-3.3-70b-versatile';
    this.baseURL = 'https://api.groq.com/openai/v1/chat/completions';
  }
  
  setAPIKey(key) {
    this.apiKey = key;
    localStorage.setItem('groq_api_key', key);
  }
  
  getAPIKey() {
    if (!this.apiKey) {
      this.apiKey = localStorage.getItem('groq_api_key');
    }
    return this.apiKey;
  }
  
  async generateCoaching(formAnalysis, exercise, userProfile, workoutHistory) {
    if (!this.getAPIKey()) {
      return this.generateOfflineCoaching(formAnalysis, exercise);
    }
    
    try {
      const prompt = this.buildCoachingPrompt(formAnalysis, exercise, userProfile, workoutHistory);
      
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `You are an expert strength coach specializing in 5x5 training and biomechanics. 
              Provide concise, actionable coaching feedback in 2-3 sentences. 
              Focus on the most critical form issues first. 
              Use encouraging but direct language.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 200
        })
      });
      
      const data = await response.json();
      return data.choices[0].message.content;
      
    } catch (error) {
      console.error('AI coaching generation failed:', error);
      return this.generateOfflineCoaching(formAnalysis, exercise);
    }
  }
  
  buildCoachingPrompt(formAnalysis, exercise, userProfile, workoutHistory) {
    const breakdown = formAnalysis.breakdown;
    const issues = Object.entries(breakdown)
      .filter(([_, data]) => data.rating === 'poor' || data.rating === 'fail')
      .map(([criterion, data]) => `${criterion}: ${data.feedback}`)
      .join('\n');
    
    const strengths = Object.entries(breakdown)
      .filter(([_, data]) => data.rating === 'excellent' || data.rating === 'good')
      .map(([criterion]) => criterion)
      .join(', ');
    
    return `
Exercise: ${exercise}
Overall Form Score: ${formAnalysis.score}/100 (Grade: ${formAnalysis.grade})

Strengths: ${strengths || 'None identified'}

Issues to address:
${issues || 'No major issues'}

User Profile:
- Experience: ${userProfile.experience}
- Current weight for ${exercise}: ${this.getCurrentWeight(exercise, workoutHistory)} lbs

Provide coaching feedback with:
1. What to fix immediately (most critical issue)
2. How to fix it (specific cue or drill)
3. Encouragement or next step
`;
  }
  
  getCurrentWeight(exercise, workoutHistory) {
    const lastWorkout = workoutHistory[workoutHistory.length - 1];
    if (!lastWorkout) return 'N/A';
    
    const exerciseData = lastWorkout.exercises.find(ex => ex.id === exercise);
    return exerciseData ? exerciseData.weight : 'N/A';
  }
  
  generateOfflineCoaching(formAnalysis, exercise) {
    // Fallback: rule-based coaching when no API key
    const breakdown = formAnalysis.breakdown;
    const criticalIssues = Object.entries(breakdown)
      .filter(([_, data]) => data.rating === 'fail' || data.rating === 'poor')
      .sort((a, b) => b[1].weightedScore - a[1].weightedScore); // Sort by importance
    
    if (criticalIssues.length === 0) {
      return `Excellent form! Your ${exercise} technique is solid. ${this.getProgressionAdvice(formAnalysis.score)}`;
    }
    
    const [topIssue, issueData] = criticalIssues[0];
    const fix = this.getDrillForIssue(exercise, topIssue);
    
    return `Primary focus: ${issueData.feedback} ${fix} Once you fix this, you'll see better gains and reduce injury risk.`;
  }
  
  getDrillForIssue(exercise, issue) {
    const drills = {
      squat: {
        depth: "Practice box squats or goblet squats to learn proper depth.",
        knee_tracking: "Do banded clamshells and lateral walks to strengthen glutes.",
        trunk_angle: "Work on ankle mobility with wall stretches and elevated heel squats.",
        tempo: "Count 3 seconds down out loud on every rep."
      },
      bench: {
        elbow_angle: "Practice with lighter weight, focus on tucking elbows to ribs.",
        wrist_alignment: "Adjust grip width - hands should be directly above elbows.",
        rom: "Use a board or mat on chest as depth marker.",
        tempo: "Lower bar over 2-3 seconds, pause at chest."
      },
      deadlift: {
        back_position: "Drop weight immediately. Practice RDLs with PVC pipe on back.",
        hip_hinge: "Do Romanian deadlifts to learn proper hip hinge pattern.",
        bar_path: "Bar should scrape shins - pull straight up, not forward.",
        lockout: "Squeeze glutes hard at top, thrust hips forward."
      },
      ohp: {
        bar_path: "Lean head back slightly, press bar straight up past face.",
        elbow_position: "Start with elbows in front of bar, not behind.",
        lockout: "Shrug shoulders at top, push head through arms.",
        core_stability: "Brace core harder, squeeze glutes to prevent layback."
      },
      row: {
        torso_angle: "Hinge at hips until torso is ~45°, maintain throughout set.",
        row_height: "Pull bar to sternum/belly button, not chest.",
        elbow_path: "Pull elbows straight back, not up toward ceiling.",
        tempo: "Control the descent - don't drop the bar."
      }
    };
    
    return drills[exercise]?.[issue] || "Focus on technique with lighter weight.";
  }
  
  getProgressionAdvice(score) {
    if (score >= 90) {
      return "Your form is excellent - consider adding weight next session.";
    } else if (score >= 80) {
      return "Solid form! Repeat this weight for one more session before progressing.";
    } else if (score >= 70) {
      return "Stay at this weight and focus on consistency before adding load.";
    } else {
      return "Work on form before progressing - consider reducing weight by 10%.";
    }
  }
}

// ===== SMART PROGRESSION SYSTEM (Block 15) =====
class SmartProgressionEngine {
  constructor() {
    this.baseProgression = {
      squat: 5,      // lbs per session
      bench: 5,
      deadlift: 10,  // Deadlift progresses faster
      ohp: 5,
      row: 5
    };
  }
  
  calculateNextWeight(exercise, currentWeight, recentSets, formAnalysis) {
    // Decision tree for progression
    const allSetsComplete = recentSets.every(set => set.reps >= 5);
    const avgFormScore = this.getAverageFormScore(recentSets);
    const isConsistentlyGood = this.checkConsistency(exercise);
    
    // RULE 1: Form must be acceptable (70+) to progress
    if (avgFormScore < 70) {
      return {
        nextWeight: currentWeight,
        recommendation: 'maintain',
        reason: 'Focus on improving form before adding weight',
        advice: 'Work on technique - form score below 70%'
      };
    }
    
    // RULE 2: Must complete all 5x5 (or 1x5 for deadlift)
    if (!allSetsComplete) {
      return {
        nextWeight: currentWeight,
        recommendation: 'maintain',
        reason: 'Did not complete all target reps',
        advice: 'Repeat this weight until you can do 5x5 with good form'
      };
    }
    
    // RULE 3: If failed 3 times in a row, deload
    const failureStreak = this.getFailureStreak(exercise);
    if (failureStreak >= 3) {
      const deloadWeight = Math.round(currentWeight * 0.9 / 5) * 5; // 10% deload, round to 5
      return {
        nextWeight: deloadWeight,
        recommendation: 'deload',
        reason: 'Failed to progress 3 sessions in a row',
        advice: 'Deload 10% and build back up with perfect form'
      };
    }
    
    // RULE 4: Form excellent (90+) and completing easily? Bigger jump
    if (avgFormScore >= 90 && isConsistentlyGood) {
      const aggressiveIncrease = this.baseProgression[exercise] * 2;
      return {
        nextWeight: currentWeight + aggressiveIncrease,
        recommendation: 'aggressive',
        reason: 'Excellent form and completing easily',
        advice: `Your form is perfect - jump to ${currentWeight + aggressiveIncrease} lbs`
      };
    }
    
    // RULE 5: Standard progression (all 5x5 complete, form good)
    return {
      nextWeight: currentWeight + this.baseProgression[exercise],
      recommendation: 'standard',
      reason: 'Completed all reps with good form',
      advice: `Add ${this.baseProgression[exercise]} lbs - keep up the good work!`
    };
  }
  
  getAverageFormScore(sets) {
    const scoresWithForm = sets.filter(set => set.formScore !== null);
    if (scoresWithForm.length === 0) return 100; // No form data = assume good
    
    const sum = scoresWithForm.reduce((total, set) => total + set.formScore, 0);
    return sum / scoresWithForm.length;
  }
  
  checkConsistency(exercise) {
    // Check last 3 workouts for this exercise
    const history = this.getExerciseHistory(exercise, 3);
    
    if (history.length < 2) return false;
    
    // All recent sessions should be complete
    return history.every(workout => {
      const exerciseData = workout.exercises.find(ex => ex.id === exercise);
      if (!exerciseData) return false;
      
      const allSetsComplete = exerciseData.completedSets?.every(set => set.reps >= 5);
      return allSetsComplete;
    });
  }
  
  getFailureStreak(exercise) {
    const history = this.getExerciseHistory(exercise, 5);
    let streak = 0;
    
    for (let i = history.length - 1; i >= 0; i--) {
      const workout = history[i];
      const exerciseData = workout.exercises.find(ex => ex.id === exercise);
      
      if (!exerciseData) continue;
      
      const failed = exerciseData.completedSets?.some(set => set.reps < 5);
      
      if (failed) {
        streak++;
      } else {
        break; // Streak broken
      }
    }
    
    return streak;
  }
  
  getExerciseHistory(exercise, count = 10) {
    return APP_STATE.workoutHistory
      .filter(workout => 
        workout.exercises.some(ex => ex.id === exercise)
      )
      .slice(-count);
  }
  
  generateProgressionReport(exercise) {
    const history = this.getExerciseHistory(exercise);
    
    if (history.length === 0) {
      return {
        startWeight: APP_STATE.user.startingWeights[exercise],
        currentWeight: APP_STATE.user.startingWeights[exercise],
        totalIncrease: 0,
        sessions: 0,
        avgProgressionPerSession: 0
      };
    }
    
    const startWeight = history[0].exercises.find(ex => ex.id === exercise).weight;
    const currentWeight = history[history.length - 1].exercises.find(ex => ex.id === exercise).weight;
    
    return {
      startWeight,
      currentWeight,
      totalIncrease: currentWeight - startWeight,
      sessions: history.length,
      avgProgressionPerSession: (currentWeight - startWeight) / history.length
    };
  }
}

// ===== CORRECTIVE EXERCISE LIBRARY =====
const CORRECTIVE_DRILLS = {
  squat: {
    depth_issues: {
      title: "Squat Depth Drill",
      exercises: [
        {
          name: "Box Squats",
          sets: "3x10",
          description: "Use a box at parallel height. Sit back until you touch, pause, then stand.",
          video_url: "placeholder"
        },
        {
          name: "Goblet Squats",
          sets: "3x12",
          description: "Hold dumbbell at chest. Squat deep, using elbows to push knees out.",
          video_url: "placeholder"
        },
        {
          name: "Wall Squats",
          sets: "3x30sec",
          description: "Face wall, toes 6 inches away. Squat without touching wall.",
          video_url: "placeholder"
        }
      ]
    },
    knee_valgus: {
      title: "Knee Tracking Drill",
      exercises: [
        {
          name: "Banded Clamshells",
          sets: "3x20 each",
          description: "Strengthen glute medius to prevent knee cave.",
          video_url: "placeholder"
        },
        {
          name: "Lateral Band Walks",
          sets: "3x15 each direction",
          description: "Step sideways with resistance band around knees.",
          video_url: "placeholder"
        },
        {
          name: "Single-Leg Glute Bridges",
          sets: "3x12 each",
          description: "Strengthen glutes unilaterally.",
          video_url: "placeholder"
        }
      ]
    },
    ankle_mobility: {
      title: "Ankle Mobility Drill",
      exercises: [
        {
          name: "Wall Ankle Stretch",
          sets: "3x30sec each",
          description: "Knee to wall, measure distance improvement over weeks.",
          video_url: "placeholder"
        },
        {
          name: "Elevated Heel Squats",
          sets: "3x10",
          description: "Squat with heels on small plates to practice pattern.",
          video_url: "placeholder"
        }
      ]
    }
  },
  
  bench: {
    elbow_flare: {
      title: "Elbow Tuck Drill",
      exercises: [
        {
          name: "Floor Press",
          sets: "3x8",
          description: "Forces proper elbow position. Pause at bottom.",
          video_url: "placeholder"
        },
        {
          name: "Close-Grip Bench",
          sets: "3x10",
          description: "Hands shoulder-width. Emphasizes triceps and tuck.",
          video_url: "placeholder"
        }
      ]
    },
    scapular_stability: {
      title: "Shoulder Stability Drill",
      exercises: [
        {
          name: "Scapular Wall Slides",
          sets: "3x12",
          description: "Learn to retract and depress scapulae.",
          video_url: "placeholder"
        },
        {
          name: "Band Pull-Aparts",
          sets: "3x20",
          description: "Strengthen rear delts and scapular retractors.",
          video_url: "placeholder"
        }
      ]
    }
  },
  
  deadlift: {
    rounded_back: {
      title: "Spinal Neutrality Drill",
      exercises: [
        {
          name: "RDL with PVC on Back",
          sets: "3x10",
          description: "PVC touches head, thoracic spine, sacrum throughout.",
          video_url: "placeholder"
        },
        {
          name: "Cat-Cow Stretch",
          sets: "3x10",
          description: "Learn to find neutral spine position.",
          video_url: "placeholder"
        },
        {
          name: "Deadbug",
          sets: "3x30sec",
          description: "Core stability with neutral spine.",
          video_url: "placeholder"
        }
      ]
    },
    hip_hinge: {
      title: "Hip Hinge Pattern Drill",
      exercises: [
        {
          name: "Romanian Deadlifts",
          sets: "3x12",
          description: "Light weight. Focus on pushing hips back.",
          video_url: "placeholder"
        },
        {
          name: "Kettlebell Swings",
          sets: "3x15",
          description: "Explosive hip extension practice.",
          video_url: "placeholder"
        }
      ]
    }
  },
  
  ohp: {
    bar_path: {
      title: "Overhead Press Path Drill",
      exercises: [
        {
          name: "Seated DB Press",
          sets: "3x12",
          description: "Learn vertical press pattern without leg drive.",
          video_url: "placeholder"
        },
        {
          name: "Wall-Facing Press",
          sets: "3x8",
          description: "Face wall 6 inches away. Forces correct bar path.",
          video_url: "placeholder"
        }
      ]
    },
    core_stability: {
      title: "Overhead Stability Drill",
      exercises: [
        {
          name: "Pallof Press",
          sets: "3x12 each",
          description: "Anti-rotation core strength.",
          video_url: "placeholder"
        },
        {
          name: "Overhead Carry",
          sets: "3x30sec each arm",
          description: "Walk with weight overhead. Build stability.",
          video_url: "placeholder"
        }
      ]
    }
  },
  
  row: {
    torso_angle: {
      title: "Rowing Posture Drill",
      exercises: [
        {
          name: "Chest-Supported Row",
          sets: "3x12",
          description: "Learn proper pulling without cheating.",
          video_url: "placeholder"
        },
        {
          name: "Pendlay Rows",
          sets: "3x8",
          description: "Reset each rep from floor with proper hip hinge.",
          video_url: "placeholder"
        }
      ]
    },
    lat_activation: {
      title: "Lat Engagement Drill",
      exercises: [
        {
          name: "Straight-Arm Pulldowns",
          sets: "3x15",
          description: "Isolate lat activation before rowing.",
          video_url: "placeholder"
        },
        {
          name: "Inverted Rows",
          sets: "3x10",
          description: "Bodyweight rows with perfect form.",
          video_url: "placeholder"
        }
      ]
    }
  }
};

// ===== GLOBAL INSTANCES =====
window.aiCoach = new AICoach();
window.progressionEngine = new SmartProgressionEngine();

// ===== API KEY SETUP =====
function setupGroqAPI() {
  showModal(`
    <div class="api-setup">
      <h2>🤖 AI Coaching Setup (Optional)</h2>
      <p class="text-muted mb-lg">Get personalized coaching feedback powered by Groq LLaMA</p>
      
      <div class="info-box mb-lg">
        <h3>Why add AI coaching?</h3>
        <ul style="padding-left: var(--spacing-lg); color: var(--text-secondary);">
          <li>Personalized technique advice</li>
          <li>Custom drill recommendations</li>
          <li>Adaptive programming based on your progress</li>
        </ul>
      </div>
      
      <div class="info-box warning mb-lg">
        <h3>⚠️ Required:</h3>
        <p>Free Groq API key from <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a></p>
        <p style="font-size: var(--font-size-sm); color: var(--text-muted); margin-top: var(--spacing-sm);">
          Your API key stays on your device and is only used when generating coaching feedback.
        </p>
      </div>
      
      <form id="api-setup-form" onsubmit="saveGroqAPI(event)">
        <div class="form-group">
          <label>Groq API Key</label>
          <input type="password" name="api_key" placeholder="gsk_..." required>
        </div>
        
        <button type="submit" class="btn btn-primary btn-block">
          Save & Enable AI Coaching
        </button>
        
        <button type="button" class="btn btn-secondary btn-block mt-sm" onclick="closeModal()">
          Skip (Use Offline Coaching)
        </button>
      </form>
    </div>
  `);
}

function saveGroqAPI(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const apiKey = formData.get('api_key');
  
  window.aiCoach.setAPIKey(apiKey);
  
  closeModal();
  
  showNotification(
    'AI Coaching Enabled!',
    'You\'ll now get personalized feedback after each set',
    'success'
  );
}

// ===== COACHING FEEDBACK UI =====
async function showCoachingFeedback(formAnalysis, exercise) {
  const coaching = await window.aiCoach.generateCoaching(
    formAnalysis,
    exercise,
    APP_STATE.user,
    APP_STATE.workoutHistory
  );
  
  // Add coaching to form results modal
  const resultsModal = document.querySelector('.form-results');
  if (!resultsModal) return;
  
  const coachingSection = document.createElement('div');
  coachingSection.className = 'coaching-feedback';
  coachingSection.innerHTML = `
    <h3 style="color: var(--color-primary); margin-bottom: var(--spacing-md);">
      💬 Coach's Advice
    </h3>
    <div style="background: var(--bg-tertiary); padding: var(--spacing-lg); border-radius: var(--radius-lg); border-left: 3px solid var(--color-primary);">
      <p style="line-height: 1.6; color: var(--text-secondary);">${coaching}</p>
    </div>
  `;
  
  resultsModal.insertBefore(coachingSection, resultsModal.querySelector('.btn'));
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AICoach,
    SmartProgressionEngine,
    CORRECTIVE_DRILLS
  };
}
