#!/usr/bin/env node

/**
 * Setup Default Exercise Routines
 * Creates the user's Monday-Friday workout plan as initial routines
 * 
 * Usage: node scripts/setup-default-exercise-routines.js [userId]
 */

const { Pool } = require('pg');
const path = require('path');

async function setupDefaultRoutines() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/family_event_planner';
  const userId = process.argv[2] ? parseInt(process.argv[2]) : null;
  
  console.log('💪 Setting up default exercise routines...');
  console.log('📍 Database:', connectionString.replace(/:[^:]*@/, ':***@'));

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Get user ID
    let targetUserId = userId;
    if (!targetUserId) {
      // Get first active user
      const userResult = await pool.query(
        'SELECT id, email, name FROM users WHERE active = true ORDER BY id ASC LIMIT 1'
      );
      
      if (userResult.rows.length === 0) {
        console.error('❌ No active users found. Please provide a userId or create a user first.');
        process.exit(1);
      }
      
      targetUserId = userResult.rows[0].id;
      console.log(`📋 Using user: ${userResult.rows[0].name} (${userResult.rows[0].email})`);
    } else {
      // Verify user exists
      const userResult = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [targetUserId]);
      if (userResult.rows.length === 0) {
        console.error(`❌ User ${targetUserId} not found.`);
        process.exit(1);
      }
      console.log(`📋 Using user: ${userResult.rows[0].name} (${userResult.rows[0].email})`);
    }

    // Check if routines already exist
    const existingRoutines = await pool.query(
      'SELECT COUNT(*) as count FROM exercise_routines WHERE user_id = $1',
      [targetUserId]
    );
    
    if (parseInt(existingRoutines.rows[0].count) > 0) {
      console.log('⚠️  User already has routines. Use --force to overwrite or delete existing routines first.');
      console.log('   To delete: DELETE FROM exercise_routines WHERE user_id = $1');
      process.exit(0);
    }

    const ExerciseService = require('../src/services/exercise-service');
    const logger = {
      info: (msg) => console.log(`ℹ️  ${msg}`),
      error: (msg, err) => console.error(`❌ ${msg}`, err),
      warn: (msg) => console.warn(`⚠️  ${msg}`),
      debug: () => {},
    };
    const exerciseService = new ExerciseService(pool, logger);

    // Define routines based on the user's workout plan
    const routines = [
      {
        routineName: "Upper Push",
        dayOfWeek: 1, // Monday
        description: "Fat loss + strength + knee longevity + athletic balance",
        exercises: [
          {
            exerciseName: "Band Chest Press",
            targetSets: 4,
            targetRepsMin: 12,
            targetRepsMax: 15,
            notes: "Squeeze chest, slow return",
            preferredEquipment: "bands",
            equipmentNotes: "Can use bands at home or machine at gym"
          },
          {
            exerciseName: "Push-ups",
            targetSets: 4,
            targetRepsMin: 10,
            targetRepsMax: 12,
            notes: "Keep body straight, controlled descent",
            preferredEquipment: "bodyweight",
            equipmentNotes: "Incline or floor"
          },
          {
            exerciseName: "Band Overhead Press",
            targetSets: 3,
            targetRepsMin: 10,
            targetRepsMax: 12,
            notes: "Ribs down, neutral spine",
            preferredEquipment: "bands"
          },
          {
            exerciseName: "Band Tricep Pushdowns",
            targetSets: 3,
            targetRepsMin: 15,
            targetRepsMax: 15,
            notes: "Elbows tucked, squeeze at bottom",
            preferredEquipment: "bands"
          },
          {
            exerciseName: "Dead Bug",
            targetSets: 3,
            targetRepsMin: 12,
            targetRepsMax: 12,
            notes: "Opposite arm/leg, low back pressed to floor",
            preferredEquipment: "bodyweight"
          }
        ]
      },
      {
        routineName: "Lower Body + VMO + Wall Squat",
        dayOfWeek: 2, // Tuesday
        description: "Knee health + posterior chain",
        exercises: [
          {
            exerciseName: "Wall Squat Hold",
            targetSets: 3,
            targetDurationSeconds: 30, // 20-40 sec range
            notes: "Knees over mid-foot, don't cave inward",
            preferredEquipment: "bodyweight"
          },
          {
            exerciseName: "Glute Bridge",
            targetSets: 4,
            targetRepsMin: 15,
            targetRepsMax: 15,
            notes: "Strong squeeze at top, 3-sec lower",
            preferredEquipment: "bodyweight"
          },
          {
            exerciseName: "Band Romanian Deadlift",
            targetSets: 4,
            targetRepsMin: 12,
            targetRepsMax: 15,
            notes: "Hinge from hips, hamstring stretch",
            preferredEquipment: "bands"
          },
          {
            exerciseName: "Side-lying Hip Abduction",
            targetSets: 4,
            targetRepsMin: 15,
            targetRepsMax: 15,
            notes: "Tension outer glute, toes angled slightly down",
            preferredEquipment: "bodyweight"
          },
          {
            exerciseName: "Terminal Knee Extensions (TKE)",
            targetSets: 3,
            targetRepsMin: 20,
            targetRepsMax: 20,
            notes: "Band at back of knee crease, smooth control",
            preferredEquipment: "bands"
          },
          {
            exerciseName: "Single-leg Balance",
            targetSets: 3,
            targetDurationSeconds: 50, // 45-60 sec
            notes: "Barefoot if possible",
            preferredEquipment: "bodyweight"
          },
          {
            exerciseName: "Standing Calf Raise",
            targetSets: 3,
            targetRepsMin: 20,
            targetRepsMax: 20,
            notes: "Full stretch + squeeze",
            preferredEquipment: "bodyweight"
          }
        ]
      },
      {
        routineName: "Mobility / Stretch",
        dayOfWeek: 3, // Wednesday
        description: "Recovery, flexibility, circulation, knee health (18-22 min)",
        exercises: [
          {
            exerciseName: "Warm tissue",
            targetSets: 1,
            targetDurationSeconds: 90, // 1-2 min
            notes: "March / light jog / hip circles",
            preferredEquipment: "bodyweight"
          },
          {
            exerciseName: "Hips stretch",
            targetSets: 1,
            targetDurationSeconds: 390, // 6-7 min
            notes: "World's Greatest Stretch, kneeling hip flexor, pigeon/figure-4",
            preferredEquipment: "bodyweight"
          },
          {
            exerciseName: "Hamstrings & calves stretch",
            targetSets: 1,
            targetDurationSeconds: 270, // 4-5 min
            notes: "Seated hamstring, band stretch, calf wall stretch",
            preferredEquipment: "bands"
          },
          {
            exerciseName: "Spine & core",
            targetSets: 1,
            targetDurationSeconds: 210, // 3-4 min
            notes: "Cat-Cow, Thread the Needle",
            preferredEquipment: "bodyweight"
          },
          {
            exerciseName: "Breathing",
            targetSets: 1,
            targetDurationSeconds: 150, // 2-3 min
            notes: "4-6 breathing (4s inhale / 6s exhale)",
            preferredEquipment: "bodyweight"
          }
        ]
      },
      {
        routineName: "Upper Pull",
        dayOfWeek: 4, // Thursday
        description: "Strength, posture, shoulder health",
        exercises: [
          {
            exerciseName: "Band Row",
            targetSets: 4,
            targetRepsMin: 12,
            targetRepsMax: 15,
            notes: "Pull to lower ribs, squeeze scapulae",
            preferredEquipment: "bands",
            equipmentNotes: "Or Low Row machine"
          },
          {
            exerciseName: "Face Pull",
            targetSets: 4,
            targetRepsMin: 15,
            targetRepsMax: 15,
            notes: "Band or cable at face height",
            preferredEquipment: "bands"
          },
          {
            exerciseName: "Band Lat Pulldown",
            targetSets: 3,
            targetRepsMin: 12,
            targetRepsMax: 12,
            notes: "Elbows down to back pockets",
            preferredEquipment: "bands",
            equipmentNotes: "Or machine"
          },
          {
            exerciseName: "Banded Bicep Curl",
            targetSets: 4,
            targetRepsMin: 12,
            targetRepsMax: 15,
            notes: "Elbows fixed by sides",
            preferredEquipment: "bands",
            equipmentNotes: "Or machine"
          },
          {
            exerciseName: "Farmer Carry",
            targetSets: 3,
            targetDurationSeconds: 60, // 1 min
            notes: "Walk tall, shoulders down",
            preferredEquipment: "free_weights"
          }
        ]
      },
      {
        routineName: "Conditioning + Stability",
        dayOfWeek: 5, // Friday
        description: "Fat loss, endurance, stability",
        exercises: [
          {
            exerciseName: "Treadmill Incline Walk",
            targetSets: 1,
            targetDurationSeconds: 1050, // 15-20 min (17.5 min average)
            notes: "~10-12% incline, ~3.0 mph, hands-free",
            preferredEquipment: "machine"
          },
          {
            exerciseName: "Single-leg Balance",
            targetSets: 3,
            targetDurationSeconds: 50, // 45-60 sec
            notes: "After treadmill",
            preferredEquipment: "bodyweight"
          },
          {
            exerciseName: "Cooldown",
            targetSets: 1,
            targetDurationSeconds: 360, // 5-7 min
            notes: "Slow walk + calves + hamstrings stretch",
            preferredEquipment: "bodyweight"
          }
        ]
      }
    ];

    // Create each routine
    console.log('\n📝 Creating routines...');
    for (const routineData of routines) {
      const routine = await exerciseService.createRoutine(targetUserId, routineData);
      console.log(`✅ Created: ${routine.routine_name} (${routine.exercises.length} exercises)`);
    }

    console.log('\n✅ Default exercise routines setup complete!');
    console.log(`   Created ${routines.length} routines for user ${targetUserId}`);

  } catch (error) {
    console.error('❌ Error setting up routines:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
setupDefaultRoutines().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

