// Analyze exactly where power goes on Night 5
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
  5: { mudja: 13, baka: 14, choda: 14, omco: 13, puppet: 13 }
};

const PATH_BAKA = ['1A', '5', '1B', '3', '2A', '2B', 'LEFT_DOOR'];
const PATH_CHODA = ['1A', '1B', '7', '6', '4A', '4B', 'RIGHT_DOOR'];
const PATH_MUDJA = ['1A', '1B', '7', '6', '4A', '4B', 'RIGHT_DOOR'];

const config = {
  baseDrainRate: 0.11,
  devDrainRate: 0.20,
  nightMultiplierStep: 0.03, // 1 + 4 * 0.03 = 1.12
  omcoPenalty: 2.0,
  omcoPauseOnCam: true
};

const nightMult = 1 + 4 * config.nightMultiplierStep; // 1.12

let totalBaseDrain = 0;
let totalDoorDrain = 0;
let totalCamDrain = 0;
let totalLightDrain = 0;
let totalOmcoHits = 0;
let deathTimes = [];
let wins = 0;

for (let i = 0; i < 100; i++) {
  const rng = mulberry32(600000 + i * 13);
  const preset = NIGHT_AI_PRESETS[5];

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

  let runBaseDrain = 0;
  let runDoorDrain = 0;
  let runCamDrain = 0;
  let runLightDrain = 0;
  let runOmcoHits = 0;

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
      wins++;
      break;
    }

    if (powerOut) {
      powerOutTimer += dt;
      if (powerOutTimer >= 11.5) {
        deathTimes.push(time);
        break;
      }
      continue;
    }

    // Power drain breakdown
    let baseD = config.baseDrainRate * nightMult * dt;
    runBaseDrain += baseD;

    let devCount = 0;
    if (camOpen) devCount++;
    if (leftLightOn) devCount++;
    if (rightLightOn) devCount++;
    if (leftDoorClosed) devCount++;
    if (rightDoorClosed) devCount++;
    let effectiveDevs = Math.min(4, devCount);

    if (leftDoorClosed) runDoorDrain += config.devDrainRate * nightMult * dt;
    if (rightDoorClosed) runDoorDrain += config.devDrainRate * nightMult * dt;
    if (camOpen) runCamDrain += config.devDrainRate * nightMult * dt;
    if (leftLightOn || rightLightOn) runLightDrain += config.devDrainRate * nightMult * dt;

    const drainPerSec = (config.baseDrainRate + effectiveDevs * config.devDrainRate) * nightMult;
    power = Math.max(0, power - drainPerSec * dt);

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
        deathTimes.push(time);
        break;
      }
    }

    // Omco
    if (preset.omco > 0 || omco.sprinting) {
      if (!omco.sprinting) {
        const paused = (config.omcoPauseOnCam && camOpen) || (camOpen && currentCam === '1C');
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
            power = Math.max(0, power - config.omcoPenalty);
            omco.sprinting = false;
            omco.stage = 0;
            omco.progress = rng() * 20;
            runOmcoHits++;
            if (!leftDoorHasEnemy) leftDoorClosed = false;
          } else {
            deathTimes.push(time);
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
            deathTimes.push(time);
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
            const otherEnemyStillThere = (id === 'choda' && mudja.loc === 'RIGHT_DOOR') ||
                                         (id === 'mudja' && choda.loc === 'RIGHT_DOOR');
            if (otherEnemyStillThere) {
              rightDoorClosed = true;
              rightDoorHasEnemy = true;
            } else {
              rightDoorClosed = false;
              rightDoorHasEnemy = false;
            }
          } else {
            if (camOpen || ent.doorWait >= 7.5) {
              deathTimes.push(time);
            }
          }
        }
      }
    });

    // Move intervals
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

    // Player action
    if (omco.sprinting) continue;

    stateTimer += dt;
    if (playerSubstate === 'OFFICE_PATROL') {
      patrolTimer += dt;
      const needsTape = tapeCharge <= 65.0;

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

  totalBaseDrain += runBaseDrain;
  totalDoorDrain += runDoorDrain;
  totalCamDrain += runCamDrain;
  totalLightDrain += runLightDrain;
  totalOmcoHits += runOmcoHits;
}

const n = 100;
console.log('--- NIGHT 5 DETAILED POWER BREAKDOWN (100 runs) ---');
console.log(`Wins: ${wins}%`);
console.log(`Avg Death Time: ${(deathTimes.reduce((a,b)=>a+b,0)/deathTimes.length).toFixed(1)}s`);
console.log(`Avg Base Drain: ${(totalBaseDrain/n).toFixed(1)}%`);
console.log(`Avg Door Drain: ${(totalDoorDrain/n).toFixed(1)}%`);
console.log(`Avg Cam Drain: ${(totalCamDrain/n).toFixed(1)}%`);
console.log(`Avg Light Drain: ${(totalLightDrain/n).toFixed(1)}%`);
console.log(`Avg Omco Hits: ${(totalOmcoHits/n).toFixed(2)} (Penalty: ${((totalOmcoHits/n)*config.omcoPenalty).toFixed(1)}%)`);
console.log(`Sum of all power drains: ${((totalBaseDrain + totalDoorDrain + totalCamDrain + totalLightDrain + totalOmcoHits*config.omcoPenalty)/n).toFixed(1)}%`);
