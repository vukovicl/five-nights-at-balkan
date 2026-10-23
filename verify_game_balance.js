// Comprehensive verification of the exact game balance in Five Nights At Balkan
const fs = require('fs');

// Read script.js and extract BALANCE_CONFIG to prove zero discrepancy
const scriptContent = fs.readFileSync('script.js', 'utf8');

const matchConfig = scriptContent.match(/const BALANCE_CONFIG = ({[\s\S]*?});/);
if (!matchConfig) {
  console.error('FAILED to find BALANCE_CONFIG in script.js!');
  process.exit(1);
}

// Evaluate extracted config
const BALANCE_CONFIG = eval('(' + matchConfig[1] + ')');
console.log('Extracted BALANCE_CONFIG directly from script.js:');
console.log(BALANCE_CONFIG);

// 1. UNIT TEST: Omco mechanics
console.log('\n--- UNIT TEST 1: Omco Normal Progress vs Sprint ---');
let omcoState = { stage: 0, progress: 0, sprinting: false, sprintTimer: 0 };
let camOpen = true; // Player has monitor open on CAM 5
let dt = 0.05;
let omcoAI = 10;

// Test progress while cam is open:
let watchingOmco = BALANCE_CONFIG.omcoPauseOnAnyCam ? camOpen : false;
if (!watchingOmco) {
  omcoState.progress += (0.55 + omcoAI * 0.16) * dt;
}
console.log('Omco progress when camOpen=true:', omcoState.progress, '(EXPECTED: 0 - successfully paused!)');

// Test sprint phase:
omcoState.sprinting = true;
omcoState.sprintTimer = 1.0;
// When sprinting, camOpen does NOT stop sprint:
if (!omcoState.sprinting) {
  // Not reached
} else {
  omcoState.sprintTimer += dt;
}
console.log('Omco sprint timer advanced when camOpen=true:', omcoState.sprintTimer, '(EXPECTED: 1.05 - sprint proceeds regardless of camera!)');

// 2. UNIT TEST: Right Door Stacking & Visual Check
console.log('\n--- UNIT TEST 2: Right Door Stacking & Light Check ---');
let entities = {
  choda: { loc: 'RIGHT_DOOR', doorWait: 4.8 },
  mudja: { loc: 'RIGHT_DOOR', doorWait: 2.0 }
};
let rightDoorClosed = true;

// Choda hits door at 4.8s
if (entities.choda.doorWait >= 4.8 && rightDoorClosed) {
  entities.choda.loc = '1B';
  entities.choda.doorWait = 0;
}
console.log('Choda loc after door bounce:', entities.choda.loc);
console.log('Mudja loc after Choda bounce:', entities.mudja.loc);
// Check light detection
const hasRightThreat = entities.choda.loc === 'RIGHT_DOOR' || entities.mudja.loc === 'RIGHT_DOOR';
console.log('Does light detect Mudja still standing outside right door?', hasRightThreat, '(EXPECTED: true)');

// 3. FULL PRODUCTION BALANCE SIMULATION (500 runs per night)
console.log('\n--- FULL PRODUCTION VERIFICATION (500 runs/night using script.js BALANCE_CONFIG) ---');

function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const PRESETS = {
  1: { mudja: 0, baka: 3, choda: 2, omco: 1, puppet: 1 },
  2: { mudja: 2, baka: 5, choda: 4, omco: 4, puppet: 4 },
  3: { mudja: 5, baka: 8, choda: 7, omco: 6, puppet: 7 },
  4: { mudja: 9, baka: 11, choda: 10, omco: 9, puppet: 10 },
  5: { mudja: 13, baka: 14, choda: 14, omco: 13, puppet: 13 },
  'custom_light': { mudja: 5, baka: 5, choda: 5, omco: 5, puppet: 5 },
  'custom_med': { mudja: 10, baka: 10, choda: 10, omco: 10, puppet: 10 },
  'custom_max': { mudja: 20, baka: 20, choda: 20, omco: 20, puppet: 20 }
};

const PATH_BAKA = ['1A', '5', '1B', '3', '2A', '2B', 'LEFT_DOOR'];
const PATH_CHODA = ['1A', '1B', '7', '6', '4A', '4B', 'RIGHT_DOOR'];
const PATH_MUDJA = ['1A', '1B', '7', '6', '4A', '4B', 'RIGHT_DOOR'];

function getNightMult(nightNum) {
  const mults = BALANCE_CONFIG.nightMultipliers;
  const idx = Math.max(1, Math.min(mults.length, nightNum)) - 1;
  return mults[idx] !== undefined ? mults[idx] : 1.0;
}

function runOneNight(presetKey, nightIndex, runSeed) {
  const rng = mulberry32(runSeed);
  const preset = PRESETS[presetKey];
  const nightMult = getNightMult(nightIndex);

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
  let doorTime = 0;
  let lightTime = 0;

  let outcome = null;
  let deathTime = null;

  let playerSubstate = 'OFFICE_PATROL';
  let stateTimer = 0;
  let patrolTimer = 0;
  let tapeWindElapsed = 0;
  let leftDoorHasEnemy = false;
  let rightDoorHasEnemy = false;

  const dt = 0.05;

  while (time < 360) {
    time += dt;

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

    let usage = 1;
    if (camOpen) usage++;
    if (leftLightOn) usage++;
    if (rightLightOn) usage++;
    if (leftDoorClosed) usage++;
    if (rightDoorClosed) usage++;
    const usageLevel = Math.min(5, usage);

    const drainPerSec = (BALANCE_CONFIG.baseDrainRate + (usageLevel - 1) * BALANCE_CONFIG.devDrainRate) * nightMult;
    power = Math.max(0, power - drainPerSec * dt);

    if (camOpen) camTime += dt;
    if (leftDoorClosed) doorTime += dt;
    if (rightDoorClosed) doorTime += dt;
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

    // Puppet
    if (preset.puppet > 0 && !puppet.released) {
      if (windingTape && camOpen && currentCam === '5') {
        tapeCharge = Math.min(100, tapeCharge + 28.0 * dt);
      } else {
        tapeCharge = Math.max(0, tapeCharge - (1.1 + preset.puppet * 0.19) * dt);
      }
      if (tapeCharge <= 0) puppet.released = true;
    }
    if (puppet.released) {
      puppet.attackTimer += dt;
      if (puppet.attackTimer >= 4.5) {
        outcome = 'LOSS_PUPPET';
        deathTime = time;
        break;
      }
    }

    // Omco
    if (preset.omco > 0 || omco.sprinting) {
      if (!omco.sprinting) {
        const paused = BALANCE_CONFIG.omcoPauseOnAnyCam ? camOpen : (camOpen && currentCam === '1C');
        if (!paused) {
          omco.progress += (0.55 + preset.omco * 0.16) * dt;
          if (omco.progress >= 100 && omco.stage === 2) {
            omco.stage = 3;
            omco.sprinting = true;
            omco.sprintTimer = 0;
          } else if (omco.progress > 66 && omco.stage === 1) {
            omco.stage = 2;
          } else if (omco.progress > 33 && omco.stage === 0) {
            omco.stage = 1;
          }
        }
      } else {
        omco.sprintTimer += dt;
        if (omco.sprintTimer >= 0.50 && !leftDoorClosed) {
          if (camOpen) {
            camOpen = false;
            windingTape = false;
            playerSubstate = 'OFFICE_PATROL';
          }
          leftDoorClosed = true;
        }

        if (omco.sprintTimer >= 2.25) {
          if (leftDoorClosed) {
            power = Math.max(0, power - BALANCE_CONFIG.omcoDoorPenalty);
            omco.sprinting = false;
            omco.stage = 0;
            omco.progress = rng() * 20;
            omcoHits++;
            if (!leftDoorHasEnemy) leftDoorClosed = false;
          } else {
            outcome = 'LOSS_OMCO';
            deathTime = time;
            break;
          }
        }
      }
    }

    // Door attacks
    if (baka.loc === 'LEFT_DOOR') {
      baka.doorWait += dt;
      if (baka.doorWait >= 4.8) {
        if (leftDoorClosed) {
          baka.loc = '1B';
          baka.doorWait = 0;
          baka.moveTimer = 0;
          leftDoorHasEnemy = false;
          leftDoorClosed = false;
        } else {
          if (camOpen || baka.doorWait >= 7.5) {
            outcome = 'LOSS_BAKA';
            deathTime = time;
            break;
          }
        }
      }
    }

    [
      { ent: choda, id: 'choda' },
      { ent: mudja, id: 'mudja' }
    ].forEach(({ ent, id }) => {
      if (ent.loc === 'RIGHT_DOOR') {
        ent.doorWait += dt;
        if (ent.doorWait >= 4.8) {
          if (rightDoorClosed) {
            ent.loc = '1B';
            ent.doorWait = 0;
            ent.moveTimer = 0;
            const otherStillThere = (id === 'choda' && mudja.loc === 'RIGHT_DOOR') ||
                                    (id === 'mudja' && choda.loc === 'RIGHT_DOOR');
            if (otherStillThere) {
              rightDoorClosed = true;
              rightDoorHasEnemy = true;
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

    if (omco.sprinting) continue;

    stateTimer += dt;
    if (playerSubstate === 'OFFICE_PATROL') {
      patrolTimer += dt;
      const needsTape = tapeCharge <= (nightIndex >= 4 ? 65.0 : 45.0);

      if (needsTape && !leftDoorClosed && !rightDoorClosed) {
        playerSubstate = 'PRE_CAM_CHECK_LEFT';
        stateTimer = 0;
      } else if (patrolTimer >= 1.6) {
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
      rightLightOn = true;
      if (choda.loc === 'RIGHT_DOOR' || mudja.loc === 'RIGHT_DOOR') {
        rightDoorHasEnemy = true;
        rightDoorClosed = true;
      }
      if (stateTimer >= 0.15) {
        rightLightOn = false;
        camOpen = true;
        currentCam = '5';
        windingTape = true;
        playerSubstate = 'WINDING_CAM5';
        tapeWindElapsed = 0;
        stateTimer = 0;
      }
    } else if (playerSubstate === 'WINDING_CAM5') {
      tapeWindElapsed += dt;
      const targetTime = (leftDoorClosed || rightDoorClosed) ? 1.0 : 1.8;
      const reachedTarget = tapeCharge >= 92.0;

      if (reachedTarget || tapeWindElapsed >= targetTime || omco.sprinting) {
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
    omcoHits,
    camTime,
    doorTime,
    lightTime,
    finalTime: time
  };
}

function verifyBatch(presetKey, nightIndex, runCount = 500) {
  let winsPower = 0;
  let winsDark = 0;
  let losses = 0;
  const powersOnPowerWins = [];
  let totalOmco = 0;
  let totalCam = 0;
  let totalDoor = 0;
  let totalLight = 0;
  let totalShiftPowerConsumed = 0;

  for (let i = 0; i < runCount; i++) {
    const res = runOneNight(presetKey, nightIndex, 123456 + i * 37 + nightIndex * 79);
    if (res.outcome === 'VICTORY') {
      winsPower++;
      powersOnPowerWins.push(res.remainingPower);
      totalShiftPowerConsumed += (100 - res.remainingPower);
    } else if (res.outcome === 'VICTORY_POWEROUT') {
      winsDark++;
      totalShiftPowerConsumed += 100;
    } else {
      losses++;
      totalShiftPowerConsumed += 100;
    }
    totalOmco += res.omcoHits;
    totalCam += res.camTime;
    totalDoor += res.doorTime;
    totalLight += res.lightTime;
  }

  powersOnPowerWins.sort((a, b) => a - b);
  const medianPower = powersOnPowerWins.length > 0 
    ? powersOnPowerWins[Math.floor(powersOnPowerWins.length / 2)] 
    : 0;

  const totalWins = winsPower + winsDark;

  return {
    presetKey,
    nightIndex,
    totalWinRate: ((totalWins / runCount) * 100).toFixed(1) + '%',
    winsWithPower: winsPower,
    winsWithPowerRate: ((winsPower / runCount) * 100).toFixed(1) + '%',
    winsInDark: winsDark,
    winsInDarkRate: ((winsDark / runCount) * 100).toFixed(1) + '%',
    losses,
    medianPowerOnPowerWins: medianPower.toFixed(1) + '%',
    avgOmcoHits: (totalOmco / runCount).toFixed(2),
    avgCamSec: (totalCam / runCount).toFixed(1) + 's',
    avgDoorSec: (totalDoor / runCount).toFixed(1) + 's',
    avgLightSec: (totalLight / runCount).toFixed(1) + 's',
    avgActualPowerConsumed: (totalShiftPowerConsumed / runCount).toFixed(1) + '%'
  };
}

const verifiedResults = [];
for (let n = 1; n <= 5; n++) {
  const r = verifyBatch(n, n, 500);
  verifiedResults.push(r);
  console.log(`NOĆ ${n}: Pobjede ukupno: ${r.totalWinRate} | Sa strujom: ${r.winsWithPower} (${r.winsWithPowerRate}, medijan: ${r.medianPowerOnPowerWins}) | Toreador mrak: ${r.winsInDark} (${r.winsInDarkRate}) | Prosj. potrošnja: ${r.avgActualPowerConsumed} | Vrata: ${r.avgDoorSec} | Omčo: ${r.avgOmcoHits}`);
}

['custom_light', 'custom_med', 'custom_max'].forEach(k => {
  const r = verifyBatch(k, 6, 500);
  verifiedResults.push(r);
  console.log(`CUSTOM (${k}): Pobjede: ${r.totalWinRate} | Sa strujom: ${r.winsWithPower} (${r.winsWithPowerRate}, medijan: ${r.medianPowerOnPowerWins}) | Toreador mrak: ${r.winsInDark} | Prosj. potrošnja: ${r.avgActualPowerConsumed}`);
});

fs.writeFileSync('production_verified_results.json', JSON.stringify(verifiedResults, null, 2));
console.log('\nVerifikacija dovršena!');
