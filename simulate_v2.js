const fs = require('fs');

function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const NIGHT_AI_PRESETS = {
  1: { mudja: 0, baka: 3, choda: 2, omco: 1, puppet: 1 },
  2: { mudja: 2, baka: 5, choda: 4, omco: 4, puppet: 4 },
  3: { mudja: 5, baka: 8, choda: 7, omco: 6, puppet: 7 },
  4: { mudja: 9, baka: 11, choda: 10, omco: 9, puppet: 10 },
  5: { mudja: 13, baka: 14, choda: 14, omco: 13, puppet: 13 },
  6: { mudja: 20, baka: 20, choda: 20, omco: 20, puppet: 20 }
};

const PATH_BAKA = ['1A', '5', '1B', '3', '2A', '2B', 'LEFT_DOOR'];
const PATH_CHODA = ['1A', '1B', '7', '6', '4A', '4B', 'RIGHT_DOOR'];
const PATH_MUDJA = ['1A', '1B', '7', '6', '4A', '4B', 'RIGHT_DOOR'];

function runSimulationV2(nightNum, gameConfig, strategyName, runIndex) {
  const seed = 300000 + runIndex * 41 + nightNum * 83;
  const rng = mulberry32(seed);

  const preset = NIGHT_AI_PRESETS[nightNum];

  let nightMult;
  if (Array.isArray(gameConfig.nightMultipliers)) {
    nightMult = gameConfig.nightMultipliers[nightNum - 1];
  } else {
    nightMult = 1 + (nightNum - 1) * gameConfig.nightMultiplierStep;
  }

  let time = 0;
  let power = 100.0;
  let powerOut = false;
  let powerOutTimer = 0;

  let tapeCharge = 100.0;
  let windingTape = false;

  let leftDoorClosed = false;
  let rightDoorClosed = false;
  let leftLightOn = false;
  let rightLightOn = false;
  let camOpen = false;
  let currentCam = '1A';

  let omco = { stage: 0, progress: 0, sprinting: false, sprintTimer: 0 };
  let baka = { loc: '1A', moveTimer: 0, doorWait: 0 };
  let choda = { loc: '1A', moveTimer: 0, doorWait: 0 };
  let mudja = { loc: '1A', moveTimer: 0, doorWait: 0 };
  let puppet = { released: false, attackTimer: 0 };

  let omcoHits = 0;
  let camTime = 0;
  let leftDoorTime = 0;
  let rightDoorTime = 0;
  let lightTime = 0;

  // Session & conflict tracking
  let tapeWindSessions = 0;
  let totalTapeWindTime = 0;
  let maxTimeAwayFromCam5 = 0;
  let timeAwayFromCam5 = 0;

  let omcoSprintDuringCam = 0;
  let doorThreatDuringCam = 0;
  let rightDoorDoubleThreatEvents = 0; // choda & mudja both at right door

  let outcome = null;
  let deathTime = null;

  // Player state machine for competent play
  // States: 'OFFICE_PATROL', 'CHECKING_LEFT_LIGHT', 'CHECKING_RIGHT_LIGHT', 'WINDING_CAM5', 'WAITING_DOOR_BANG'
  let playerSubstate = 'OFFICE_PATROL';
  let stateTimer = 0;
  let patrolInterval = 1.6; // checks doors every 1.6s in office
  let patrolTimer = 0;
  let tapeWindSessionTarget = 1.5; // winds 1.5s per session
  let tapeWindElapsed = 0;

  let leftDoorHasEnemy = false;
  let rightDoorHasEnemy = false;

  const dt = 0.05;

  while (time < 360) {
    time += dt;
    timeAwayFromCam5 += dt;

    if (choda.loc === 'RIGHT_DOOR' && mudja.loc === 'RIGHT_DOOR') {
      rightDoorDoubleThreatEvents++;
    }

    if (time >= 360) {
      outcome = powerOut ? 'VICTORY_POWEROUT' : 'VICTORY';
      break;
    }

    if (powerOut) {
      powerOutTimer += dt;
      if (powerOutTimer >= 11.5) {
        outcome = 'LOSS_POWEROUT';
        deathTime = time;
        break;
      }
      continue;
    }

    // Power drain
    let usage = 1;
    if (camOpen) usage++;
    if (leftLightOn) usage++;
    if (rightLightOn) usage++;
    if (leftDoorClosed) usage++;
    if (rightDoorClosed) usage++;
    const usageLevel = Math.min(5, usage);
    const drainPerSec = (0.14 + (usageLevel - 1) * 0.24) * nightMult;
    power = Math.max(0, power - drainPerSec * dt);

    if (camOpen) camTime += dt;
    if (leftDoorClosed) leftDoorTime += dt;
    if (rightDoorClosed) rightDoorTime += dt;
    if (leftLightOn || rightLightOn) lightTime += dt;

    if (power <= 0) {
      power = 0;
      powerOut = true;
      leftDoorClosed = false;
      rightDoorClosed = false;
      leftLightOn = false;
      rightLightOn = false;
      camOpen = false;
      windingTape = false;
      continue;
    }

    // Tape / Puppet logic
    if (preset.puppet > 0 && !puppet.released) {
      if (windingTape && camOpen && currentCam === '5') {
        tapeCharge = Math.min(100, tapeCharge + 28.0 * dt);
        totalTapeWindTime += dt;
        timeAwayFromCam5 = 0;
      } else {
        const drain = (1.1 + preset.puppet * 0.19) * dt;
        tapeCharge = Math.max(0, tapeCharge - drain);
        if (timeAwayFromCam5 > maxTimeAwayFromCam5) {
          maxTimeAwayFromCam5 = timeAwayFromCam5;
        }
      }
      if (tapeCharge <= 0) {
        puppet.released = true;
      }
    }
    if (puppet.released) {
      puppet.attackTimer += dt;
      if (puppet.attackTimer >= 4.5) {
        outcome = 'LOSS_PUPPET';
        deathTime = time;
        break;
      }
    }

    // Omco logic
    if (preset.omco > 0 || omco.sprinting) {
      if (!omco.sprinting) {
        let omcoPaused = false;
        if (gameConfig.omcoPauseOnAnyCam && camOpen) {
          omcoPaused = true;
        } else if (camOpen && currentCam === '1C') {
          omcoPaused = true;
        }

        if (!omcoPaused) {
          omco.progress += (0.55 + preset.omco * 0.16) * dt;
          if (omco.progress > 33 && omco.stage === 0) omco.stage = 1;
          if (omco.progress > 66 && omco.stage === 1) omco.stage = 2;
          if (omco.progress >= 100 && omco.stage === 2) {
            omco.stage = 3;
            omco.sprinting = true;
            omco.sprintTimer = 0;
            if (camOpen) {
              omcoSprintDuringCam++;
            }
          }
        }
      } else {
        omco.sprintTimer += dt;
        const sprintLimit = 2.25;

        // Player hears Omco sprint cry -> react in 0.5s to shut left door
        if (omco.sprintTimer >= 0.50 && !leftDoorClosed) {
          if (camOpen) {
            camOpen = false;
            windingTape = false;
            playerSubstate = 'OFFICE_PATROL';
          }
          leftDoorClosed = true;
        }

        if (omco.sprintTimer >= sprintLimit) {
          if (leftDoorClosed) {
            const pen = gameConfig.omcoPenalty !== undefined ? gameConfig.omcoPenalty : 3.5;
            power = Math.max(0, power - pen);
            omco.sprinting = false;
            omco.stage = 0;
            omco.progress = rng() * 20;
            omcoHits++;
            // Left door stays closed until Baka is checked or player opens after bang
            if (!leftDoorHasEnemy) {
              leftDoorClosed = false;
            }
          } else {
            outcome = 'LOSS_OMCO';
            deathTime = time;
            break;
          }
        }
      }
    }

    // Door attacks: Baka (Left), Choda (Right), Mudja (Right)
    if (baka.loc === 'LEFT_DOOR') {
      baka.doorWait += dt;
      if (camOpen && baka.doorWait >= 4.8) {
        doorThreatDuringCam++;
      }
      if (baka.doorWait >= 4.8) {
        if (leftDoorClosed) {
          baka.loc = '1B';
          baka.doorWait = 0;
          baka.moveTimer = 0;
          leftDoorHasEnemy = false;
          leftDoorClosed = false; // Safe to open left door after Baka bounces!
        } else {
          if (camOpen || baka.doorWait >= 7.5) {
            outcome = 'LOSS_BAKA';
            deathTime = time;
            break;
          }
        }
      }
    }

    // Right door: evaluate Choda and Mudja
    [
      { ent: choda, id: 'choda' },
      { ent: mudja, id: 'mudja' }
    ].forEach(({ ent, id }) => {
      if (ent.loc === 'RIGHT_DOOR') {
        ent.doorWait += dt;
        if (camOpen && ent.doorWait >= 4.8) {
          doorThreatDuringCam++;
        }
        if (ent.doorWait >= 4.8) {
          if (rightDoorClosed) {
            ent.loc = '1B';
            ent.doorWait = 0;
            ent.moveTimer = 0;
            // Bang!
            // Crucial check: does the other enemy still remain at the right door?
            const otherEnemyStillThere = (id === 'choda' && mudja.loc === 'RIGHT_DOOR') ||
                                         (id === 'mudja' && choda.loc === 'RIGHT_DOOR');
            if (otherEnemyStillThere) {
              // Enemy still there! If player verifies light before opening, player keeps door closed!
              if (gameConfig.verifiesDoorBeforeOpening) {
                rightDoorClosed = true;
                rightDoorHasEnemy = true;
              } else {
                // Naive player opens door!
                rightDoorClosed = false;
                rightDoorHasEnemy = false;
              }
            } else {
              rightDoorClosed = false;
              rightDoorHasEnemy = false;
            }
          } else {
            if (camOpen || ent.doorWait >= 7.5) {
              outcome = (id === 'choda') ? 'LOSS_CHODA' : 'LOSS_MUDJA';
              deathTime = time;
            }
          }
        }
      }
    });
    if (outcome) break;

    // Movement checks
    [
      { cfg: { id: 'baka', ai: preset.baka, path: PATH_BAKA, interval: 4.4 }, ent: baka },
      { cfg: { id: 'choda', ai: preset.choda, path: PATH_CHODA, interval: 4.4 }, ent: choda },
      { cfg: { id: 'mudja', ai: preset.mudja, path: PATH_MUDJA, interval: 5.2 }, ent: mudja }
    ].forEach(({ cfg, ent }) => {
      if (cfg.ai <= 0) return;
      if (ent.loc === 'LEFT_DOOR' || ent.loc === 'RIGHT_DOOR') return;

      ent.moveTimer += dt;
      if (ent.moveTimer >= cfg.interval) {
        ent.moveTimer = 0;
        if (cfg.id === 'mudja' && camOpen && currentCam === ent.loc) return;

        const roll = Math.floor(rng() * 20) + 1;
        if (roll <= cfg.ai) {
          const idx = cfg.path.indexOf(ent.loc);
          if (idx >= 0 && idx < cfg.path.length - 1) {
            ent.loc = cfg.path[idx + 1];
            ent.doorWait = 0;
          }
        }
      }
    });

    // ------------------------------------------------------------------------
    // PLAYER DECISION LOGIC (Realistic Human Player Routine)
    // ------------------------------------------------------------------------
    // Do not take regular actions if reacting to Omco sprint
    if (omco.sprinting) continue;

    stateTimer += dt;

    if (playerSubstate === 'OFFICE_PATROL') {
      patrolTimer += dt;

      // Decide if tape needs winding:
      // High priority if tape < 45% (or 65% on night 5/6)
      const tapeCriticalThreshold = (nightNum >= 4) ? 65.0 : 45.0;
      const needsTape = tapeCharge <= tapeCriticalThreshold;

      if (needsTape && !leftDoorClosed && !rightDoorClosed) {
        // Human rule: Quick safety check of both doors BEFORE opening camera!
        playerSubstate = 'PRE_CAM_CHECK_LEFT';
        stateTimer = 0;
      } else if (patrolTimer >= patrolInterval) {
        // Routine door check
        playerSubstate = 'CHECKING_LEFT_LIGHT';
        stateTimer = 0;
        patrolTimer = 0;
      }
    } else if (playerSubstate === 'CHECKING_LEFT_LIGHT') {
      leftLightOn = true;
      if (baka.loc === 'LEFT_DOOR') {
        leftDoorHasEnemy = true;
        leftDoorClosed = true;
      }
      if (stateTimer >= 0.15) {
        leftLightOn = false;
        playerSubstate = 'CHECKING_RIGHT_LIGHT';
        stateTimer = 0;
      }
    } else if (playerSubstate === 'CHECKING_RIGHT_LIGHT') {
      rightLightOn = true;
      if (choda.loc === 'RIGHT_DOOR' || mudja.loc === 'RIGHT_DOOR') {
        rightDoorHasEnemy = true;
        rightDoorClosed = true;
      }
      if (stateTimer >= 0.15) {
        rightLightOn = false;
        playerSubstate = 'OFFICE_PATROL';
        stateTimer = 0;
      }
    } else if (playerSubstate === 'PRE_CAM_CHECK_LEFT') {
      // Pulse left light for 0.15s
      leftLightOn = true;
      if (baka.loc === 'LEFT_DOOR') {
        leftDoorHasEnemy = true;
        leftDoorClosed = true;
      }
      if (stateTimer >= 0.15) {
        leftLightOn = false;
        playerSubstate = 'PRE_CAM_CHECK_RIGHT';
        stateTimer = 0;
      }
    } else if (playerSubstate === 'PRE_CAM_CHECK_RIGHT') {
      // Pulse right light for 0.15s
      rightLightOn = true;
      if (choda.loc === 'RIGHT_DOOR' || mudja.loc === 'RIGHT_DOOR') {
        rightDoorHasEnemy = true;
        rightDoorClosed = true;
      }
      if (stateTimer >= 0.15) {
        rightLightOn = false;
        // If either door was closed because an enemy is at the door, we can still wind tape briefly if needed,
        // but if door is open and clear, it's 100% safe to wind tape!
        camOpen = true;
        currentCam = '5';
        windingTape = true;
        playerSubstate = 'WINDING_CAM5';
        tapeWindElapsed = 0;
        stateTimer = 0;
        tapeWindSessions++;
      }
    } else if (playerSubstate === 'WINDING_CAM5') {
      tapeWindElapsed += dt;

      // Determine session duration:
      // If a door is closed (costing power), do a shorter burst (1.0s).
      // Otherwise, wind up to target charge (~90%) or max 1.8s.
      const targetSessionTime = (leftDoorClosed || rightDoorClosed) ? 1.0 : 1.8;
      const reachedTarget = tapeCharge >= 92.0;

      if (reachedTarget || tapeWindElapsed >= targetSessionTime || omco.sprinting) {
        camOpen = false;
        windingTape = false;
        playerSubstate = 'OFFICE_PATROL';
        stateTimer = 0;
        patrolTimer = 0;
      }
    }
  }

  return {
    outcome,
    survived: outcome === 'VICTORY' || outcome === 'VICTORY_POWEROUT',
    remainingPower: power,
    deathTime,
    omcoHits,
    camTime,
    leftDoorTime,
    rightDoorTime,
    lightTime,
    tapeWindSessions,
    totalTapeWindTime,
    maxTimeAwayFromCam5,
    omcoSprintDuringCam,
    doorThreatDuringCam,
    rightDoorDoubleThreatEvents
  };
}

function runBatchV2(nightNum, gameConfig, strategyName, runCount = 500) {
  let victories = 0;
  let victoriesPowerOut = 0;
  let lossPowerOut = 0;
  let lossBaka = 0;
  let lossChoda = 0;
  let lossMudja = 0;
  let lossOmco = 0;
  let lossPuppet = 0;

  const powersOnVictory = [];
  const deathTimes = [];
  let totalOmcoHits = 0;
  let totalCamTime = 0;
  let totalDoorTime = 0;
  let totalLightTime = 0;
  let totalTapeWindSec = 0;
  let totalMaxAway = 0;

  for (let i = 0; i < runCount; i++) {
    const res = runSimulationV2(nightNum, gameConfig, strategyName, i);
    if (res.outcome === 'VICTORY') {
      victories++;
      powersOnVictory.push(res.remainingPower);
    } else if (res.outcome === 'VICTORY_POWEROUT') {
      victories++;
      victoriesPowerOut++;
      powersOnVictory.push(res.remainingPower);
    } else if (res.outcome === 'LOSS_POWEROUT') {
      lossPowerOut++;
      if (res.deathTime) deathTimes.push(res.deathTime);
    } else if (res.outcome === 'LOSS_BAKA') {
      lossBaka++;
      if (res.deathTime) deathTimes.push(res.deathTime);
    } else if (res.outcome === 'LOSS_CHODA') {
      lossChoda++;
      if (res.deathTime) deathTimes.push(res.deathTime);
    } else if (res.outcome === 'LOSS_MUDJA') {
      lossMudja++;
      if (res.deathTime) deathTimes.push(res.deathTime);
    } else if (res.outcome === 'LOSS_OMCO') {
      lossOmco++;
      if (res.deathTime) deathTimes.push(res.deathTime);
    } else if (res.outcome === 'LOSS_PUPPET') {
      lossPuppet++;
      if (res.deathTime) deathTimes.push(res.deathTime);
    }

    totalOmcoHits += res.omcoHits;
    totalCamTime += res.camTime;
    totalDoorTime += (res.leftDoorTime + res.rightDoorTime);
    totalLightTime += res.lightTime;
    totalTapeWindSec += res.totalTapeWindTime;
    totalMaxAway += res.maxTimeAwayFromCam5;
  }

  powersOnVictory.sort((a, b) => a - b);
  const medianPower = powersOnVictory.length > 0
    ? powersOnVictory[Math.floor(powersOnVictory.length / 2)]
    : 0;

  const avgDeath = deathTimes.length > 0
    ? (deathTimes.reduce((a, b) => a + b, 0) / deathTimes.length).toFixed(1) + 's'
    : 'N/A';

  return {
    night: nightNum,
    runs: runCount,
    victories,
    winRate: ((victories / runCount) * 100).toFixed(1) + '%',
    victoriesPowerOut,
    lossPowerOut,
    lossBaka,
    lossChoda,
    lossMudja,
    lossOmco,
    lossPuppet,
    avgDeath,
    medianPower: medianPower.toFixed(2) + '%',
    avgOmcoHits: (totalOmcoHits / runCount).toFixed(2),
    avgCamSec: (totalCamTime / runCount).toFixed(1) + 's',
    avgDoorSec: (totalDoorTime / runCount).toFixed(1) + 's',
    avgLightSec: (totalLightTime / runCount).toFixed(1) + 's',
    avgTapeWindSec: (totalTapeWindSec / runCount).toFixed(1) + 's',
    avgMaxAway: (totalMaxAway / runCount).toFixed(1) + 's'
  };
}

// ----------------------------------------------------------------------------
// TEST SUITE: Systematically test the user's requested scenarios
// ----------------------------------------------------------------------------

console.log('Testing Competent Human Player Routine...');

// Test 1: Compare Naive Right Door Opening vs Verified Right Door Opening on Night 5
const naiveDoorConfig = {
  nightMultiplierStep: 0.06,
  omcoPenalty: 3.5,
  omcoPauseOnAnyCam: false,
  verifiesDoorBeforeOpening: false
};
const verifiedDoorConfig = {
  nightMultiplierStep: 0.06,
  omcoPenalty: 3.5,
  omcoPauseOnAnyCam: false,
  verifiesDoorBeforeOpening: true
};

const resNaiveNight5 = runBatchV2(5, naiveDoorConfig, 'Naive Door Opening', 500);
const resVerifiedNight5 = runBatchV2(5, verifiedDoorConfig, 'Verified Door Opening', 500);

console.log('\n--- Night 5: Naive vs Verified Right Door ---');
console.log('Naive:', resNaiveNight5);
console.log('Verified:', resVerifiedNight5);

// Test 2: Test Omco Option A (Pause on ANY Cam)
const verifiedWithOmcoPause = {
  nightMultiplierStep: 0.06,
  omcoPenalty: 3.5,
  omcoPauseOnAnyCam: true,
  verifiesDoorBeforeOpening: true
};
const resOmcoPauseNight5 = runBatchV2(5, verifiedWithOmcoPause, 'Verified + Omco Pause Any Cam', 500);
console.log('\n--- Night 5: Omco Pauses on Cam ---');
console.log('Omco Pause:', resOmcoPauseNight5);

// Test 3: Test Multiplier & Penal variations with Verified Door + Omco Pause
const testConfigs = [
  {
    name: 'T1: Množitelj 0.06, Penal 3.5 (Samo mehanike: verifikacija vrata + Omčo pauzira na CAM)',
    cfg: { nightMultiplierStep: 0.06, omcoPenalty: 3.5, omcoPauseOnAnyCam: true, verifiesDoorBeforeOpening: true }
  },
  {
    name: 'T2: Množitelj 0.06, Penal 2.5',
    cfg: { nightMultiplierStep: 0.06, omcoPenalty: 2.5, omcoPauseOnAnyCam: true, verifiesDoorBeforeOpening: true }
  },
  {
    name: 'T3: Množitelj 0.03, Penal 2.5',
    cfg: { nightMultiplierStep: 0.03, omcoPenalty: 2.5, omcoPauseOnAnyCam: true, verifiesDoorBeforeOpening: true }
  },
  {
    name: 'T4: Per-Night Tuned Multipliers (Noć 1: 1.00, 2: 1.06, 3: 1.12, 4: 1.15, 5: 1.18, 6: 1.22), Penal 2.5',
    cfg: { nightMultipliers: [1.00, 1.06, 1.12, 1.15, 1.18, 1.22], omcoPenalty: 2.5, omcoPauseOnAnyCam: true, verifiesDoorBeforeOpening: true }
  }
];

const comprehensiveResults = {
  naiveVsVerifiedNight5: { naive: resNaiveNight5, verified: resVerifiedNight5 },
  omcoPauseNight5: resOmcoPauseNight5,
  progression: {}
};

testConfigs.forEach(({ name, cfg }) => {
  comprehensiveResults.progression[name] = [];
  for (let n = 1; n <= 6; n++) {
    const batch = runBatchV2(n, cfg, name, 500);
    comprehensiveResults.progression[name].push(batch);
  }
});

fs.writeFileSync('simulate_v2_results.json', JSON.stringify(comprehensiveResults, null, 2));
console.log('\nSimulacija V2 uspješno dovršena i spremljena u simulate_v2_results.json!');
