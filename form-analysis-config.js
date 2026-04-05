// ===== FORM ANALYSIS CONFIGURATION =====
// Scientific biomechanical criteria for all 5x5 exercises
// Based on research literature and clinical practice

const FORM_CRITERIA = {
  // ===== SQUAT =====
  squat: {
    landmarks: {
      required: ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 
                 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'],
      optional: ['left_heel', 'right_heel', 'left_foot_index', 'right_foot_index']
    },
    
    phases: {
      eccentric: 'descent',
      bottom: 'bottom_position',
      concentric: 'ascent'
    },
    
    criteria: {
      // DEPTH - Most critical
      depth: {
        metric: 'hip_knee_y_comparison',
        calculation: (landmarks) => {
          const hip = getMidpoint(landmarks.left_hip, landmarks.right_hip);
          const knee = getMidpoint(landmarks.left_knee, landmarks.right_knee);
          return hip.y - knee.y; // Positive = hip below knee = good depth
        },
        thresholds: {
          excellent: 0.05,  // Hip significantly below knee
          good: 0.02,       // Hip slightly below knee
          acceptable: 0.0,  // Hip at knee level (parallel)
          poor: -0.02,      // Hip above knee (shallow)
          fail: -0.05       // Very shallow
        },
        weight: 0.35,       // 35% of total form score
        feedback: {
          excellent: "Perfect depth! Hip well below knee.",
          good: "Good depth, hip at or below knee level.",
          acceptable: "Acceptable depth, aim slightly deeper.",
          poor: "Shallow squat - descend until hip is below knee.",
          fail: "Very shallow - focus on depth before adding weight."
        }
      },
      
      // KNEE TRACKING (valgus collapse)
      knee_tracking: {
        metric: 'knee_ankle_width_ratio',
        calculation: (landmarks) => {
          const kneeWidth = Math.abs(landmarks.left_knee.x - landmarks.right_knee.x);
          const ankleWidth = Math.abs(landmarks.left_ankle.x - landmarks.right_ankle.x);
          return kneeWidth / ankleWidth;
        },
        thresholds: {
          excellent: 1.05,  // Knees slightly wider than ankles (good push out)
          good: 0.95,       // Knees in line with ankles
          acceptable: 0.90, // Slight valgus
          poor: 0.85,       // Moderate valgus
          fail: 0.80        // Severe valgus collapse
        },
        weight: 0.25,
        feedback: {
          excellent: "Excellent knee tracking, pushing knees out nicely.",
          good: "Good knee alignment with ankles.",
          acceptable: "Slight knee cave - focus on pushing knees out.",
          poor: "Knees caving inward - strengthen glutes, widen stance.",
          fail: "Severe knee valgus - reduce weight, work on mobility."
        }
      },
      
      // TRUNK ANGLE
      trunk_angle: {
        metric: 'trunk_forward_lean',
        calculation: (landmarks) => {
          const shoulder = getMidpoint(landmarks.left_shoulder, landmarks.right_shoulder);
          const hip = getMidpoint(landmarks.left_hip, landmarks.right_hip);
          const vertical = { x: shoulder.x, y: 0 };
          return calculateAngle(shoulder, hip, vertical);
        },
        thresholds: {
          excellent: 45,    // 35-55° is optimal
          good: 55,         // 30-60° is acceptable
          acceptable: 60,   // Getting steep
          poor: 65,         // Excessive forward lean
          fail: 70          // Dangerous forward lean
        },
        invertedScale: false, // Lower is not better for trunk angle
        weight: 0.20,
        feedback: {
          excellent: "Good upright torso position.",
          good: "Acceptable trunk angle.",
          acceptable: "Leaning forward more than ideal - engage core.",
          poor: "Excessive forward lean - risk to lower back.",
          fail: "Dangerous lean angle - reduce weight immediately."
        }
      },
      
      // TEMPO (time under tension)
      tempo: {
        metric: 'descent_duration',
        calculation: (frameData) => {
          return frameData.eccentricDuration; // seconds
        },
        thresholds: {
          excellent: 2.5,   // 2-3 seconds optimal
          good: 2.0,        // 1.5-2.5 acceptable
          acceptable: 1.5,  // Minimum controlled
          poor: 1.0,        // Too fast
          fail: 0.7         // Bouncing/dropping
        },
        weight: 0.10,
        feedback: {
          excellent: "Perfect controlled descent (2-3 sec).",
          good: "Good tempo, controlled movement.",
          acceptable: "Slightly fast - control the descent.",
          poor: "Too fast - slow down for safety and hypertrophy.",
          fail: "Dropping too fast - major injury risk."
        }
      },
      
      // BAR PATH (for advanced, uses shoulder as proxy)
      bar_path: {
        metric: 'horizontal_deviation',
        calculation: (frameData) => {
          const shoulder = getMidpoint(frameData.left_shoulder, frameData.right_shoulder);
          return Math.abs(shoulder.x - frameData.startPosition.x);
        },
        thresholds: {
          excellent: 0.02,  // < 2% horizontal shift
          good: 0.04,       // < 4% shift
          acceptable: 0.06, // < 6% shift
          poor: 0.08,       // > 8% shift
          fail: 0.10        // > 10% shift (very unstable)
        },
        weight: 0.10,
        feedback: {
          excellent: "Excellent vertical bar path.",
          good: "Good stability, minimal drift.",
          acceptable: "Some horizontal drift - work on balance.",
          poor: "Bar drifting significantly - check foot position.",
          fail: "Unstable bar path - reduce weight, master technique."
        }
      }
    }
  },
  
  // ===== BENCH PRESS =====
  bench: {
    landmarks: {
      required: ['nose', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
                 'left_wrist', 'right_wrist', 'left_hip', 'right_hip'],
      optional: []
    },
    
    criteria: {
      // ELBOW ANGLE (tucked vs flared)
      elbow_angle: {
        metric: 'elbow_tuck_angle',
        calculation: (landmarks) => {
          // Angle between upper arm and torso
          const leftAngle = calculateElbowTuck(landmarks.left_shoulder, landmarks.left_elbow, landmarks.left_hip);
          const rightAngle = calculateElbowTuck(landmarks.right_shoulder, landmarks.right_elbow, landmarks.right_hip);
          return (leftAngle + rightAngle) / 2;
        },
        thresholds: {
          excellent: 45,    // 30-45° optimal tuck
          good: 55,         // 45-60° acceptable
          acceptable: 70,   // Getting flared
          poor: 80,         // Very flared (shoulder stress)
          fail: 85          // Dangerous
        },
        weight: 0.30,
        feedback: {
          excellent: "Perfect elbow tuck (30-45°).",
          good: "Good elbow position.",
          acceptable: "Elbows flaring slightly - tuck more.",
          poor: "Elbows too flared - shoulder injury risk.",
          fail: "Severe elbow flare - reduce weight, focus on form."
        }
      },
      
      // WRIST ALIGNMENT
      wrist_alignment: {
        metric: 'wrist_forearm_alignment',
        calculation: (landmarks) => {
          const leftDeviation = calculateWristDeviation(landmarks.left_wrist, landmarks.left_elbow);
          const rightDeviation = calculateWristDeviation(landmarks.right_wrist, landmarks.right_elbow);
          return (leftDeviation + rightDeviation) / 2;
        },
        thresholds: {
          excellent: 5,     // < 5° deviation
          good: 10,         // < 10° deviation
          acceptable: 15,   // < 15° deviation
          poor: 20,         // > 20° deviation
          fail: 25          // > 25° deviation
        },
        weight: 0.20,
        feedback: {
          excellent: "Perfect wrist alignment over forearm.",
          good: "Good wrist position.",
          acceptable: "Wrists bending slightly - stack over forearm.",
          poor: "Wrists cocked back - wrist strain risk.",
          fail: "Severe wrist deviation - check grip width."
        }
      },
      
      // RANGE OF MOTION
      rom: {
        metric: 'elbow_flexion_angle',
        calculation: (landmarks, phase) => {
          if (phase !== 'bottom') return null;
          const leftAngle = calculateJointAngle(landmarks.left_shoulder, landmarks.left_elbow, landmarks.left_wrist);
          const rightAngle = calculateJointAngle(landmarks.right_shoulder, landmarks.right_elbow, landmarks.right_wrist);
          return (leftAngle + rightAngle) / 2;
        },
        thresholds: {
          excellent: 90,    // 80-90° full ROM
          good: 100,        // 90-110° good
          acceptable: 120,  // 110-130° partial
          poor: 130,        // Very partial
          fail: 140         // Minimal ROM
        },
        weight: 0.25,
        feedback: {
          excellent: "Full range of motion to chest.",
          good: "Good ROM, bar close to chest.",
          acceptable: "Partial ROM - lower bar closer to chest.",
          poor: "Very limited ROM - work on shoulder mobility.",
          fail: "Minimal ROM - this is not a full rep."
        }
      },
      
      // TEMPO
      tempo: {
        metric: 'descent_control',
        calculation: (frameData) => {
          return frameData.eccentricDuration;
        },
        thresholds: {
          excellent: 2.0,
          good: 1.5,
          acceptable: 1.0,
          poor: 0.7,
          fail: 0.5
        },
        weight: 0.15,
        feedback: {
          excellent: "Excellent controlled lowering.",
          good: "Good tempo.",
          acceptable: "Control the descent more.",
          poor: "Too fast - slow down.",
          fail: "Dropping bar - major safety risk."
        }
      },
      
      // SYMMETRY
      symmetry: {
        metric: 'left_right_balance',
        calculation: (landmarks) => {
          const leftElbow = landmarks.left_elbow.y;
          const rightElbow = landmarks.right_elbow.y;
          return Math.abs(leftElbow - rightElbow);
        },
        thresholds: {
          excellent: 0.02,  // Very balanced
          good: 0.04,       // Balanced
          acceptable: 0.06, // Slight imbalance
          poor: 0.08,       // Noticeable imbalance
          fail: 0.10        // Severe imbalance
        },
        weight: 0.10,
        feedback: {
          excellent: "Perfect bilateral symmetry.",
          good: "Good balance left-right.",
          acceptable: "Slight imbalance - check form.",
          poor: "One side significantly higher - reduce weight.",
          fail: "Severe imbalance - stop and reset."
        }
      }
    }
  },
  
  // ===== DEADLIFT =====
  deadlift: {
    landmarks: {
      required: ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip',
                 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'],
      optional: []
    },
    
    criteria: {
      // BACK POSITION (most critical)
      back_position: {
        metric: 'spinal_neutrality',
        calculation: (landmarks) => {
          // Angle of shoulder-hip line relative to vertical
          const shoulder = getMidpoint(landmarks.left_shoulder, landmarks.right_shoulder);
          const hip = getMidpoint(landmarks.left_hip, landmarks.right_hip);
          return calculateBackAngle(shoulder, hip);
        },
        thresholds: {
          excellent: 45,    // Neutral spine ~30-45°
          good: 50,         // Acceptable
          acceptable: 55,   // Slight rounding
          poor: 60,         // Noticeable rounding
          fail: 65          // Dangerous flexion
        },
        weight: 0.40,       // CRITICAL for deadlift
        feedback: {
          excellent: "Perfect neutral spine position.",
          good: "Good back position.",
          acceptable: "Slight back rounding - brace harder.",
          poor: "Back rounding - reduce weight NOW.",
          fail: "STOP - severe spinal flexion, injury imminent."
        }
      },
      
      // HIP HINGE
      hip_hinge: {
        metric: 'hip_knee_ratio',
        calculation: (landmarks) => {
          const hipAngle = calculateJointAngle(landmarks.left_shoulder, landmarks.left_hip, landmarks.left_knee);
          const kneeAngle = calculateJointAngle(landmarks.left_hip, landmarks.left_knee, landmarks.left_ankle);
          return hipAngle / kneeAngle; // Should be > 1 (more hip than knee bend)
        },
        thresholds: {
          excellent: 1.5,   // Strong hip hinge
          good: 1.3,        // Good hinge
          acceptable: 1.1,  // Minimal hinge
          poor: 1.0,        // Equal (becoming squat)
          fail: 0.9         // Knee dominant (wrong pattern)
        },
        weight: 0.25,
        feedback: {
          excellent: "Perfect hip hinge mechanics.",
          good: "Good hip-dominant movement.",
          acceptable: "Use hips more, less knee bend.",
          poor: "Too much knee bend - this is not a squat.",
          fail: "Wrong movement pattern - reset and hinge at hips."
        }
      },
      
      // BAR PATH
      bar_path: {
        metric: 'vertical_bar_path',
        calculation: (frameData) => {
          return frameData.barHorizontalDeviation;
        },
        thresholds: {
          excellent: 0.02,
          good: 0.04,
          acceptable: 0.06,
          poor: 0.08,
          fail: 0.10
        },
        weight: 0.20,
        feedback: {
          excellent: "Bar traveling perfectly vertical.",
          good: "Good bar path.",
          acceptable: "Bar drifting slightly - stay closer.",
          poor: "Bar swinging away - pull back into shins.",
          fail: "Major bar deviation - reset position."
        }
      },
      
      // LOCKOUT
      lockout: {
        metric: 'hip_extension',
        calculation: (landmarks, phase) => {
          if (phase !== 'top') return null;
          const shoulder = getMidpoint(landmarks.left_shoulder, landmarks.right_shoulder);
          const hip = getMidpoint(landmarks.left_hip, landmarks.right_hip);
          const knee = getMidpoint(landmarks.left_knee, landmarks.right_knee);
          return calculateAngle(shoulder, hip, knee);
        },
        thresholds: {
          excellent: 175,   // Fully extended
          good: 170,        // Nearly full
          acceptable: 165,  // Slight bend
          poor: 160,        // Incomplete
          fail: 155         // Not locked out
        },
        weight: 0.15,
        feedback: {
          excellent: "Full lockout, hips through.",
          good: "Good lockout position.",
          acceptable: "Complete hip extension.",
          poor: "Incomplete lockout - squeeze glutes.",
          fail: "Not a full rep - lockout required."
        }
      }
    }
  },
  
  // ===== OVERHEAD PRESS =====
  ohp: {
    landmarks: {
      required: ['nose', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
                 'left_wrist', 'right_wrist', 'left_hip', 'right_hip'],
      optional: []
    },
    
    criteria: {
      // BAR PATH (critical for OHP)
      bar_path: {
        metric: 'j_curve_path',
        calculation: (frameData) => {
          return frameData.barPathDeviation; // Should follow slight J-curve
        },
        thresholds: {
          excellent: 0.03,
          good: 0.05,
          acceptable: 0.08,
          poor: 0.10,
          fail: 0.12
        },
        weight: 0.30,
        feedback: {
          excellent: "Perfect bar path around head.",
          good: "Good vertical press path.",
          acceptable: "Bar drifting slightly - lean back less.",
          poor: "Excessive forward/back bar travel.",
          fail: "Bar path too curved - reset form."
        }
      },
      
      // ELBOW POSITION
      elbow_position: {
        metric: 'elbow_alignment',
        calculation: (landmarks) => {
          // Elbows should be in front of bar at start
          const elbowX = (landmarks.left_elbow.x + landmarks.right_elbow.x) / 2;
          const wristX = (landmarks.left_wrist.x + landmarks.right_wrist.x) / 2;
          return elbowX - wristX; // Positive = elbows forward (good)
        },
        thresholds: {
          excellent: 0.05,  // Elbows well forward
          good: 0.03,       // Elbows slightly forward
          acceptable: 0.01, // Elbows barely forward
          poor: -0.01,      // Elbows behind bar
          fail: -0.03       // Elbows way behind
        },
        weight: 0.25,
        feedback: {
          excellent: "Perfect elbow position in front of bar.",
          good: "Good elbow alignment.",
          acceptable: "Get elbows more forward under bar.",
          poor: "Elbows too far back - inefficient press.",
          fail: "Reset elbow position before pressing."
        }
      },
      
      // LOCKOUT OVERHEAD
      lockout: {
        metric: 'overhead_extension',
        calculation: (landmarks, phase) => {
          if (phase !== 'top') return null;
          const wrist = getMidpoint(landmarks.left_wrist, landmarks.right_wrist);
          const shoulder = getMidpoint(landmarks.left_shoulder, landmarks.right_shoulder);
          return wrist.y - shoulder.y; // Higher = better lockout
        },
        thresholds: {
          excellent: 0.35,  // Bar well above head
          good: 0.30,       // Good lockout
          acceptable: 0.25, // Partial lockout
          poor: 0.20,       // Incomplete
          fail: 0.15        // Not pressed overhead
        },
        weight: 0.25,
        feedback: {
          excellent: "Full lockout directly overhead.",
          good: "Good overhead position.",
          acceptable: "Press bar higher - full lockout.",
          poor: "Incomplete lockout - lock elbows.",
          fail: "Not a full rep - press to full extension."
        }
      },
      
      // CORE STABILITY (no layback)
      core_stability: {
        metric: 'torso_layback',
        calculation: (landmarks) => {
          const shoulder = getMidpoint(landmarks.left_shoulder, landmarks.right_shoulder);
          const hip = getMidpoint(landmarks.left_hip, landmarks.right_hip);
          return calculateBackAngle(shoulder, hip);
        },
        thresholds: {
          excellent: 5,     // Minimal layback
          good: 10,         // Slight layback
          acceptable: 15,   // Noticeable layback
          poor: 20,         // Excessive layback
          fail: 25          // Dangerous hyperextension
        },
        weight: 0.20,
        feedback: {
          excellent: "Perfect upright torso, minimal layback.",
          good: "Good core stability.",
          acceptable: "Slight layback - brace core harder.",
          poor: "Too much layback - lower back stress.",
          fail: "Excessive hyperextension - reduce weight."
        }
      }
    }
  },
  
  // ===== BARBELL ROW =====
  row: {
    landmarks: {
      required: ['nose', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
                 'left_wrist', 'right_wrist', 'left_hip', 'right_hip'],
      optional: []
    },
    
    criteria: {
      // TORSO ANGLE (should be ~45°)
      torso_angle: {
        metric: 'back_angle_from_horizontal',
        calculation: (landmarks) => {
          const shoulder = getMidpoint(landmarks.left_shoulder, landmarks.right_shoulder);
          const hip = getMidpoint(landmarks.left_hip, landmarks.right_hip);
          return calculateTorsoAngle(shoulder, hip);
        },
        thresholds: {
          excellent: 45,    // Perfect 45° Pendlay row
          good: 50,         // Acceptable
          acceptable: 60,   // Getting upright
          poor: 70,         // Too upright (cheating)
          fail: 80          // Standing row (wrong exercise)
        },
        weight: 0.30,
        feedback: {
          excellent: "Perfect torso angle at 45°.",
          good: "Good rowing position.",
          acceptable: "Torso rising - maintain hip hinge.",
          poor: "Too upright - bend over more.",
          fail: "This is a standing row, not barbell row."
        }
      },
      
      // ROW HEIGHT (to sternum/lower chest)
      row_height: {
        metric: 'bar_to_chest_height',
        calculation: (landmarks, phase) => {
          if (phase !== 'top') return null;
          const wrist = getMidpoint(landmarks.left_wrist, landmarks.right_wrist);
          const shoulder = getMidpoint(landmarks.left_shoulder, landmarks.right_shoulder);
          return Math.abs(wrist.y - shoulder.y);
        },
        thresholds: {
          excellent: 0.05,  // Bar touches torso
          good: 0.08,       // Very close
          acceptable: 0.12, // Close
          poor: 0.15,       // Partial pull
          fail: 0.20        // Not pulling high enough
        },
        weight: 0.25,
        feedback: {
          excellent: "Bar touching torso, full ROM.",
          good: "Good pull height.",
          acceptable: "Pull bar higher to chest.",
          poor: "Partial ROM - pull to sternum.",
          fail: "Incomplete rep - row to torso."
        }
      },
      
      // ELBOW PATH (pulling back, not up)
      elbow_path: {
        metric: 'elbow_pull_angle',
        calculation: (landmarks) => {
          const elbowY = (landmarks.left_elbow.y + landmarks.right_elbow.y) / 2;
          const shoulderY = (landmarks.left_shoulder.y + landmarks.right_shoulder.y) / 2;
          return elbowY - shoulderY; // Should be near zero (pulling straight back)
        },
        thresholds: {
          excellent: 0.02,  // Elbows level with shoulders
          good: 0.05,       // Slight elevation
          acceptable: 0.08, // Noticeable shrug
          poor: 0.12,       // Excessive trap involvement
          fail: 0.15        // All traps, no lats
        },
        weight: 0.25,
        feedback: {
          excellent: "Perfect elbow path, pulling straight back.",
          good: "Good rowing mechanics.",
          acceptable: "Elbows rising slightly - pull to hips.",
          poor: "Shrugging traps - pull elbows back not up.",
          fail: "Wrong muscle emphasis - row to belly button."
        }
      },
      
      // TEMPO
      tempo: {
        metric: 'controlled_descent',
        calculation: (frameData) => {
          return frameData.eccentricDuration;
        },
        thresholds: {
          excellent: 1.5,
          good: 1.0,
          acceptable: 0.7,
          poor: 0.5,
          fail: 0.3
        },
        weight: 0.20,
        feedback: {
          excellent: "Perfect controlled lowering.",
          good: "Good tempo.",
          acceptable: "Control descent more.",
          poor: "Too fast - slow the negative.",
          fail: "Dropping weight - control required."
        }
      }
    }
  }
};

// ===== HELPER CALCULATION FUNCTIONS =====

function getMidpoint(point1, point2) {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2,
    z: point1.z && point2.z ? (point1.z + point2.z) / 2 : undefined
  };
}

function calculateAngle(point1, point2, point3) {
  const v1 = { x: point1.x - point2.x, y: point1.y - point2.y };
  const v2 = { x: point3.x - point2.x, y: point3.y - point2.y };
  
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  return Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
}

function calculateJointAngle(proximal, joint, distal) {
  return calculateAngle(proximal, joint, distal);
}

function calculateBackAngle(shoulder, hip) {
  const horizontal = { x: shoulder.x + 1, y: shoulder.y };
  return calculateAngle(hip, shoulder, horizontal);
}

function calculateTorsoAngle(shoulder, hip) {
  const horizontal = { x: hip.x + 1, y: hip.y };
  return 90 - calculateAngle(shoulder, hip, horizontal);
}

function calculateElbowTuck(shoulder, elbow, hip) {
  return calculateAngle(shoulder, elbow, hip);
}

function calculateWristDeviation(wrist, elbow) {
  const dx = Math.abs(wrist.x - elbow.x);
  const dy = Math.abs(wrist.y - elbow.y);
  return Math.atan2(dx, dy) * (180 / Math.PI);
}

// ===== FORM SCORE CALCULATION =====

function calculateFormScore(exercise, landmarks, frameData, phase) {
  const criteria = FORM_CRITERIA[exercise].criteria;
  let totalScore = 0;
  let totalWeight = 0;
  const breakdown = {};
  
  for (const [criterionName, criterion] of Object.entries(criteria)) {
    const value = criterion.calculation(landmarks, phase);
    
    if (value === null || value === undefined) continue;
    
    const score = evaluateCriterion(value, criterion.thresholds, criterion.invertedScale);
    const weightedScore = score * criterion.weight;
    
    totalScore += weightedScore;
    totalWeight += criterion.weight;
    
    breakdown[criterionName] = {
      value,
      score,
      weightedScore,
      rating: getRating(score),
      feedback: criterion.feedback[getRating(score)]
    };
  }
  
  const finalScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
  
  return {
    score: Math.round(finalScore),
    breakdown,
    grade: getGrade(finalScore)
  };
}

function evaluateCriterion(value, thresholds, inverted = false) {
  if (inverted) {
    if (value <= thresholds.excellent) return 1.0;
    if (value <= thresholds.good) return 0.85;
    if (value <= thresholds.acceptable) return 0.70;
    if (value <= thresholds.poor) return 0.50;
    return 0.30;
  } else {
    if (value >= thresholds.excellent) return 1.0;
    if (value >= thresholds.good) return 0.85;
    if (value >= thresholds.acceptable) return 0.70;
    if (value >= thresholds.poor) return 0.50;
    return 0.30;
  }
}

function getRating(score) {
  if (score >= 0.95) return 'excellent';
  if (score >= 0.80) return 'good';
  if (score >= 0.65) return 'acceptable';
  if (score >= 0.45) return 'poor';
  return 'fail';
}

function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FORM_CRITERIA,
    calculateFormScore,
    getMidpoint,
    calculateAngle,
    calculateJointAngle
  };
}
