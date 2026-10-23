const fs = require('fs');

// Seeded PRNG (Mulberry32)
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

/**
 * Runs a single simulation run adhering strictly to the script.js logic.
 *
 * @param {number} nightNum - 1 to 6
 * @param {object} gameConfig - balance constants and mechanical toggles
 * @param {object} botStrategy - strategy parameters (non-cheating, observation-based)
 * @param {number} runIndex - run index for deterministic seed
 */
function runSingleSimulation(nightNum, gameConfig, botStrategy, runIndex) {
  const seed = 200000 + runIndex * 37 + nightNum * 73;
  const rng = mulberry32(seed);

  const preset = NIGHT_AI_PRESETS[nightNum];

  // Multiplier calculation: supports per-night array or linear step
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

  // Cassette tape / Puppet
  let tapeCharge = 100.0;
  let windingTape = false;

  // Doors, lights, monitor
  let leftDoorClosed = false;
  let rightDoorClosed = false;
  let leftLightOn = false;
  let rightLightOn = false;
  let camOpen = false;
  let currentCam = '1A';

  // Entities
  let omco = { stage: 0, progress: 0, sprinting: false, sprintTimer: 0 };
  let baka = { loc: '1A', moveTimer: 0, doorWait: 0 };
  let choda = { loc: '1A', moveTimer: 0, doorWait: 0 };
  let mudja = { loc: '1A', moveTimer: 0, doorWait: 0 };
  let puppet = { released: false, attackTimer: 0 };

  // Metrics
  let omcoHits = 0;
  let camTime = 0;
  let leftDoorTime = 0;
  let rightDoorTime = 0;
  let lightTime = 0;

  // Session tracking
  let tapeSessions = [];
  let currentSessionDuration = 0;
  let timeSinceLastTape = 0;
  let maxTimeAwayFromTape = 0;

  // Overlap tracking
  let omcoSprintDuringTape = 0;
  let doorAttackDuringTape = 0;
  let rightDoorStackCount = 0; // both Choda & Mudja at right door at same time

  let outcome = null;
  let deathTime = null;

  // Bot perception & state machine (NO access to hidden entity coordinates!)
  let botPerception = {
    hearsOmcoSprint: false,
    sprintHeardTimer: 0,

    // Visual sight at door window (only true when light is on)
    seesBakaAtLeft: false,
    seesRightThreat: false,

    // Audio bang detection
    leftDoorBanged: false,
    rightDoorBanged: false,

    // Door check schedule
    doorCheckTimer: 0,
    activeLightSide: 'left',
    lightPulseTimer: 0,
    isPulsingLight: false,

    // Verification light pulse after door bang (to prevent opening while 2nd enemy is still there)
    verifyingRightDoor: false,
    verifyingRightDoorTimer: 0,

    // Tape winding cycle
    tapeWindTimer: 0
  };

  const dt = 0.05; // 20 updates per second

  while (time < 360) {
    time += dt;
    timeSinceLastTape += dt;

    // Check right door stacking
    if (choda.loc === 'RIGHT_DOOR' && mudja.loc === 'RIGHT_DOOR') {
      rightDoorStackCount++;
    }

    // 1. Victory check at 06:00 AM (has priority over powerOut jumpscare)
    if (time >= 360) {
      outcome = powerOut ? 'VICTORY_POWEROUT' : 'VICTORY';
      break;
    }

    // 2. Power Out sequence
    if (powerOut) {
      powerOutTimer += dt;
      if (powerOutTimer >= 11.5) {
        outcome = 'LOSS_POWEROUT';
        deathTime = time;
        break;
      }
      continue;
    }

    // 3. Power usage calculation
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

    // 4. Cassette Tape / Puppet logic
    if (preset.puppet > 0 && !puppet.released) {
      if (windingTape && camOpen && currentCam === '5') {
        const windSpeed = gameConfig.tapeWindSpeed || 28.0;
        tapeCharge = Math.min(100, tapeCharge + windSpeed * dt);
        currentSessionDuration += dt;
        timeSinceLastTape = 0;
      } else {
        const drainSpeed = gameConfig.tapeDrainRate || (1.1 + preset.puppet * 0.19);
        tapeCharge = Math.max(0, tapeCharge - drainSpeed * dt);
        if (currentSessionDuration > 0) {
          tapeSessions.push(currentSessionDuration);
          currentSessionDuration = 0;
        }
        if (timeSinceLastTape > maxTimeAwayFromTape) {
          maxTimeAwayFromTape = timeSinceLastTape;
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

    // 5. Omco logic
    if (preset.omco > 0 || omco.sprinting) {
      if (!omco.sprinting) {
        // Evaluate Omco progress modifier based on config:
        // Option 0: Baseline - only CAM 1C pauses
        // Option A: ANY camera pauses Omco completely
        // Option B: ANY camera slows Omco by 50%
        let omcoPaused = false;
        let speedMultiplier = 1.0;

        if (gameConfig.omcoPauseOnAnyCam && camOpen) {
          omcoPaused = true;
        } else if (gameConfig.omcoSlowOnAnyCam && camOpen) {
          speedMultiplier = 0.5;
        } else if (camOpen && currentCam === '1C') {
          omcoPaused = true;
        }

        if (!omcoPaused) {
          omco.progress += (0.55 + preset.omco * 0.16) * speedMultiplier * dt;
          if (omco.progress > 33 && omco.stage === 0) omco.stage = 1;
          if (omco.progress > 66 && omco.stage === 1) omco.stage = 2;
          if (omco.progress >= 100 && omco.stage === 2) {
            omco.stage = 3;
            omco.sprinting = true;
            omco.sprintTimer = 0;
            // Bot hears sprint cry immediately
            botPerception.hearsOmcoSprint = true;
            botPerception.sprintHeardTimer = 0;

            if (camOpen && currentCam === '5' && windingTape) {
              omcoSprintDuringTape++;
            }
          }
        }
      } else {
        // Omco is sprinting down West Hall (CAM 2A) -> 2.25s sprint limit
        omco.sprintTimer += dt;
        botPerception.sprintHeardTimer += dt;
        const sprintLimit = 2.25;

        // Bot reacts to sprint cry
        if (botPerception.hearsOmcoSprint && botPerception.sprintHeardTimer >= botStrategy.omcoReactTime) {
          if (camOpen) {
            camOpen = false;
            windingTape = false;
          }
          leftDoorClosed = true;
        }

        if (omco.sprintTimer >= sprintLimit) {
          if (leftDoorClosed) {
            // Blocked hit!
            const penalty = (gameConfig.omcoPenalty !== undefined) ? gameConfig.omcoPenalty : 3.5;
            power = Math.max(0, power - penalty);
            omco.sprinting = false;
            omco.stage = 0;
            omco.progress = rng() * 20;
            omcoHits++;
            botPerception.hearsOmcoSprint = false;
            botPerception.leftDoorBanged = true;
          } else {
            outcome = 'LOSS_OMCO';
            deathTime = time;
            break;
          }
        }
      }
    }

    // 6. Door attacks: Baka (Left), Choda (Right), Mudja (Right)
    // Left Door (Baka)
    if (baka.loc === 'LEFT_DOOR') {
      baka.doorWait += dt;
      if (camOpen && currentCam === '5' && windingTape && baka.doorWait >= 4.8) {
        doorAttackDuringTape++;
      }
      if (baka.doorWait >= 4.8) {
        if (leftDoorClosed) {
          baka.loc = '1B';
          baka.doorWait = 0;
          baka.moveTimer = 0;
          botPerception.leftDoorBanged = true;
        } else {
          if (camOpen || baka.doorWait >= 7.5) {
            outcome = 'LOSS_BAKA';
            deathTime = time;
            break;
          }
        }
      }
    }

    // Right Door (Choda and Mudja evaluated independently)
    [
      { ent: choda, id: 'choda' },
      { ent: mudja, id: 'mudja' }
    ].forEach(({ ent, id }) => {
      if (ent.loc === 'RIGHT_DOOR') {
        ent.doorWait += dt;
        if (camOpen && currentCam === '5' && windingTape && ent.doorWait >= 4.8) {
          doorAttackDuringTape++;
        }
        if (ent.doorWait >= 4.8) {
          if (rightDoorClosed) {
            // Blocked!
            ent.loc = '1B';
            ent.doorWait = 0;
            ent.moveTimer = 0;
            botPerception.rightDoorBanged = true;
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

    // 7. Regular path moves (interval checks)
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
        // Mudja slowed if watched on cam
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

    // 8. Bot Behavior (Realistic Human Decisions based ONLY on Perception)

    // Left door management after Omco hit or Baka hit
    if (leftDoorClosed && !omco.sprinting) {
      if (botPerception.leftDoorBanged) {
        // Player hears bang, waits 0.3s reaction time, then opens door
        botPerception.leftDoorBanged = false;
        leftDoorClosed = false;
        botPerception.seesBakaAtLeft = false;
      }
    }

    // Right door management: Test naive bot vs cue-verifying bot
    if (rightDoorClosed) {
      if (botPerception.rightDoorBanged) {
        botPerception.rightDoorBanged = false;

        if (botStrategy.verifiesRightDoorBeforeOpening) {
          // Smart strategy: When right door bangs, do a quick light check before opening!
          botPerception.verifyingRightDoor = true;
          botPerception.verifyingRightDoorTimer = 0;
        } else {
          // Naive strategy: Immediately opens right door after bang!
          rightDoorClosed = false;
          botPerception.seesRightThreat = false;
        }
      }

      if (botPerception.verifyingRightDoor) {
        botPerception.verifyingRightDoorTimer += dt;
        // Pulse right light while door is closed for 0.2s
        rightLightOn = true;
        const stillThreat = (choda.loc === 'RIGHT_DOOR' || mudja.loc === 'RIGHT_DOOR');
        if (botPerception.verifyingRightDoorTimer >= 0.2) {
          rightLightOn = false;
          botPerception.verifyingRightDoor = false;
          if (stillThreat) {
            // Keep door closed! A second enemy was stacked behind!
            rightDoorClosed = true;
          } else {
            // Threat genuinely gone, safe to open!
            rightDoorClosed = false;
            botPerception.seesRightThreat = false;
          }
        }
      }
    }

    // Door closing reaction if enemy was spotted via light
    if (botPerception.seesBakaAtLeft && !leftDoorClosed) {
      if (camOpen) { camOpen = false; windingTape = false; }
      leftDoorClosed = true;
    }
    if (botPerception.seesRightThreat && !rightDoorClosed) {
      if (camOpen) { camOpen = false; windingTape = false; }
      rightDoorClosed = true;
    }

    // Light flash routine (Office patrol)
    if (!camOpen && !leftDoorClosed && !rightDoorClosed && !omco.sprinting) {
      botPerception.doorCheckTimer += dt;
      if (botPerception.doorCheckTimer >= botStrategy.doorCheckInterval) {
        // Pulse light for 0.20s
        botPerception.lightPulseTimer += dt;
        if (botPerception.activeLightSide === 'left') {
          leftLightOn = true;
          rightLightOn = false;
          if (baka.loc === 'LEFT_DOOR') {
            botPerception.seesBakaAtLeft = true;
          }
        } else {
          rightLightOn = true;
          leftLightOn = false;
          if (choda.loc === 'RIGHT_DOOR' || mudja.loc === 'RIGHT_DOOR') {
            botPerception.seesRightThreat = true;
          }
        }

        if (botPerception.lightPulseTimer >= 0.20) {
          leftLightOn = false;
          rightLightOn = false;
          botPerception.lightPulseTimer = 0;
          botPerception.doorCheckTimer = 0;
          botPerception.activeLightSide = (botPerception.activeLightSide === 'left') ? 'right' : 'left';
        }
      }
    }

    // Cassette Tape Winding Routine (CAM 5)
    // Decide whether to wind tape based on strategy thresholds
    if (!camOpen && !leftDoorClosed && !rightDoorClosed && !omco.sprinting) {
      const needsWind = (tapeCharge <= botStrategy.tapeLowThreshold) ||
                        (botStrategy.usesWarningCue && tapeCharge < 28);
      if (needsWind) {
        camOpen = true;
        currentCam = '5';
        windingTape = true;
        botPerception.tapeWindTimer = 0;
      }
    }

    if (camOpen && currentCam === '5' && windingTape) {
      botPerception.tapeWindTimer += dt;

      // Stop winding if:
      // 1. Charge reached target, OR
      // 2. Max continuous session duration exceeded (for micro-winders), OR
      // 3. Sprint heard
      const reachedTarget = tapeCharge >= botStrategy.tapeTargetCharge;
      const sessionMaxReached = botStrategy.maxSessionDuration && (botPerception.tapeWindTimer >= botStrategy.maxSessionDuration);

      if (reachedTarget || sessionMaxReached || botPerception.hearsOmcoSprint) {
        camOpen = false;
        windingTape = false;
      }
    }
  }

  if (currentSessionDuration > 0) {
    tapeSessions.push(currentSessionDuration);
  }

  const avgSession = tapeSessions.length > 0 
    ? (tapeSessions.reduce((a, b) => a + b, 0) / tapeSessions.length) 
    : 0;

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
    totalWindSessions: tapeSessions.length,
    avgSessionDuration: avgSession,
    maxTimeAwayFromTape,
    omcoSprintDuringTape,
    doorAttackDuringTape,
    rightDoorStackCount
  };
}

/**
 * Runs a batch of 500 simulations for a given night and returns aggregate metrics.
 */
function runAuditBatch(nightNum, gameConfig, botStrategy, runCount = 500) {
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
  let totalLeftDoorTime = 0;
  let totalRightDoorTime = 0;
  let totalLightTime = 0;

  let totalSessions = 0;
  let totalAvgSessionDur = 0;
  let totalMaxAway = 0;
  let totalSprintDuringTape = 0;
  let totalDoorDuringTape = 0;
  let totalStackCount = 0;

  for (let i = 0; i < runCount; i++) {
    const res = runSingleSimulation(nightNum, gameConfig, botStrategy, i);

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
    totalLeftDoorTime += res.leftDoorTime;
    totalRightDoorTime += res.rightDoorTime;
    totalLightTime += res.lightTime;

    totalSessions += res.totalWindSessions;
    totalAvgSessionDur += res.avgSessionDuration;
    totalMaxAway += res.maxTimeAwayFromTape;
    totalSprintDuringTape += res.omcoSprintDuringTape;
    totalDoorDuringTape += res.doorAttackDuringTape;
    totalStackCount += res.rightDoorStackCount;
  }

  powersOnVictory.sort((a, b) => a - b);
  const medianPower = powersOnVictory.length > 0
    ? powersOnVictory[Math.floor(powersOnVictory.length / 2)]
    : 0;

  const avgDeathTime = deathTimes.length > 0
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
    avgDeathTime,
    medianPower: medianPower.toFixed(2) + '%',
    avgOmcoHits: (totalOmcoHits / runCount).toFixed(2),
    avgCamSec: (totalCamTime / runCount).toFixed(1) + 's',
    avgDoorSec: ((totalLeftDoorTime + totalRightDoorTime) / runCount).toFixed(1) + 's',
    avgLightSec: (totalLightTime / runCount).toFixed(1) + 's',
    avgSessionsCount: (totalSessions / runCount).toFixed(1),
    avgSessionLength: (totalAvgSessionDur / runCount).toFixed(2) + 's',
    avgMaxTimeAway: (totalMaxAway / runCount).toFixed(1) + 's',
    sprintDuringTape: (totalSprintDuringTape / runCount).toFixed(2),
    doorAttackDuringTape: (totalDoorDuringTape / runCount).toFixed(2),
    rightDoorStacks: (totalStackCount / runCount).toFixed(1)
  };
}

// ----------------------------------------------------------------------------
// STRATEGIES DEFINITIONS
// ----------------------------------------------------------------------------
// S1: Frequent short door checks (every 2.0s), standard tape winding
const stratS1_FrequentDoorChecks = {
  name: 'S1: Česte provjere vrata (svake 2s)',
  omcoReactTime: 0.55,
  doorCheckInterval: 2.0,
  tapeLowThreshold: 45.0,
  tapeTargetCharge: 92.0,
  verifiesRightDoorBeforeOpening: false
};

// S2: Micro-winding (winds tape frequently in short <= 1.2s bursts, threshold 70%)
const stratS2_MicroWinding = {
  name: 'S2: Mikro-punjenja (kratki skokovi na kameru <= 1.2s)',
  omcoReactTime: 0.55,
  doorCheckInterval: 3.0,
  tapeLowThreshold: 70.0,
  tapeTargetCharge: 95.0,
  maxSessionDuration: 1.2,
  verifiesRightDoorBeforeOpening: false
};

// S3: Deep winding (lets tape drop to 28% warning, winds deeply in ~2.5s sessions)
const stratS3_DeepWinding = {
  name: 'S3: Duboko punjenje (tek na upozorenje 28%, do 95%)',
  omcoReactTime: 0.55,
  doorCheckInterval: 3.5,
  tapeLowThreshold: 28.0,
  tapeTargetCharge: 95.0,
  verifiesRightDoorBeforeOpening: false
};

// S4: Cue-Adaptive & Safety Verifying (reacts to cues, verifies right door before opening)
const stratS4_CueAdaptiveVerifying = {
  name: 'S4: Znakovno-adaptivna + provjera desnih vrata prije otvaranja',
  omcoReactTime: 0.55,
  doorCheckInterval: 3.0,
  tapeLowThreshold: 50.0,
  tapeTargetCharge: 90.0,
  maxSessionDuration: 1.8,
  verifiesRightDoorBeforeOpening: true // Crucial: checks light before reopening door!
};

// ----------------------------------------------------------------------------
// CONFIGURATION VARIANTS DEFINITIONS
// ----------------------------------------------------------------------------
// C0: Baseline (Current game)
const configC0 = {
  name: 'C0: Trenutačni balans (množitelj 0.06, Omčo penal 3.5, Omčo ne staje na CAM 5)',
  nightMultiplierStep: 0.06,
  omcoPenalty: 3.5,
  omcoPauseOnAnyCam: false
};

// C1: Omco paused on ANY cam (Option A) with current power
const configC1_OmcoPauseAnyCam = {
  name: 'C1: Omčo pauzira na bilo kojoj kameri (uklj. CAM 5), trenutna potrošnja',
  nightMultiplierStep: 0.06,
  omcoPenalty: 3.5,
  omcoPauseOnAnyCam: true
};

// C2: Omco paused on ANY cam + Omco penal 2.5%
const configC2_OmcoPause_Penal25 = {
  name: 'C2: Omčo pauzira na kameri + penal 2.5%, množitelj 0.06',
  nightMultiplierStep: 0.06,
  omcoPenalty: 2.5,
  omcoPauseOnAnyCam: true
};

// C3: Omco paused on ANY cam + Omco penal 2.5% + blaži množitelj (0.03)
const configC3_OmcoPause_Penal25_Mult03 = {
  name: 'C3: Omčo pauzira na kameri + penal 2.5% + množitelj 0.03',
  nightMultiplierStep: 0.03,
  omcoPenalty: 2.5,
  omcoPauseOnAnyCam: true
};

// C4: Per-Night Tuned Multipliers (Keeps Night 1-3 100% UNTOUCHED, adjusts Night 4-6)
// Night 1: 1.00, Night 2: 1.06, Night 3: 1.12 (identično postojećem!)
// Night 4: 1.15 (umjesto 1.18), Night 5: 1.18 (umjesto 1.24), Night 6: 1.22 (umjesto 1.30)
const configC4_PerNightTuned = {
  name: 'C4: Podešavanje po noćima (Noći 1-3 netaknute! Noć 4: 1.15, Noć 5: 1.18) + Omčo na kameri + penal 2.5',
  nightMultipliers: [1.00, 1.06, 1.12, 1.15, 1.18, 1.22],
  omcoPenalty: 2.5,
  omcoPauseOnAnyCam: true
};

// Execute all test suites and output structured JSON and markdown
console.log('Pokrećem simulaciju hibridnog sustava...');
const results = {
  timestamp: new Date().toISOString(),
  cassetteBudgetAnalysis: {},
  strategyComparisonNight5: [],
  omcoOptionsComparisonNight5: [],
  fullProgressionPerVariant: {}
};

// 1. Analiza budžeta kazetofona za sve noći (1-6)
for (let n = 1; n <= 6; n++) {
  const p = NIGHT_AI_PRESETS[n];
  const drainRate = 1.1 + p.puppet * 0.19;
  const totalDrain = drainRate * 360;
  const requiredCamSec = totalDrain / 28.0;
  const timeFrom100ToZero = 100 / drainRate;
  const timeFrom100ToWarn = (100 - 28) / drainRate;

  results.cassetteBudgetAnalysis[n] = {
    puppetAI: p.puppet,
    drainRatePerSec: drainRate.toFixed(2) + '%/s',
    totalDrain360s: totalDrain.toFixed(1) + '%',
    requiredCamSec: requiredCamSec.toFixed(1) + 's (' + ((requiredCamSec / 360) * 100).toFixed(1) + '%)',
    safeAbsenceToZero: timeFrom100ToZero.toFixed(1) + 's',
    safeAbsenceToWarning: timeFrom100ToWarn.toFixed(1) + 's'
  };
}

// 2. Usporedba 4 strategije na Noći 5 (trenutačni balans C0)
[stratS1_FrequentDoorChecks, stratS2_MicroWinding, stratS3_DeepWinding, stratS4_CueAdaptiveVerifying].forEach(st => {
  const res = runAuditBatch(5, configC0, st, 500);
  results.strategyComparisonNight5.push({ strategy: st.name, ...res });
});

// 3. Usporedba mehanike Omče na Noći 5 uz S4 strategiju
[configC0, configC1_OmcoPauseAnyCam, configC2_OmcoPause_Penal25, configC3_OmcoPause_Penal25_Mult03, configC4_PerNightTuned].forEach(cfg => {
  const res = runAuditBatch(5, cfg, stratS4_CueAdaptiveVerifying, 500);
  results.omcoOptionsComparisonNight5.push({ config: cfg.name, ...res });
});

// 4. Puna progresija noći 1 do 6 za odabrane ključne konfiguracije uz S4 strategiju
const keyConfigs = [
  { id: 'C0_Trenutacni', cfg: configC0 },
  { id: 'C1_OmcoPause', cfg: configC1_OmcoPauseAnyCam },
  { id: 'C3_Mult03_Penal25', cfg: configC3_OmcoPause_Penal25_Mult03 },
  { id: 'C4_PerNightTuned', cfg: configC4_PerNightTuned }
];

keyConfigs.forEach(({ id, cfg }) => {
  results.fullProgressionPerVariant[id] = [];
  for (let n = 1; n <= 6; n++) {
    const res = runAuditBatch(n, cfg, stratS4_CueAdaptiveVerifying, 500);
    results.fullProgressionPerVariant[id].push(res);
  }
});

fs.writeFileSync('simulate_hybrid_results.json', JSON.stringify(results, null, 2));
console.log('Simulacija dovršena i spremljena u simulate_hybrid_results.json!');
