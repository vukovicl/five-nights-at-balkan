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

// Paths for Baka, Choda, Mudja (matching script.js)
const PATH_BAKA = ['1A', '5', '1B', '3', '2A', '2B', 'LEFT_DOOR'];
const PATH_CHODA = ['1A', '1B', '7', '6', '4A', '4B', 'RIGHT_DOOR'];
const PATH_MUDJA = ['1A', '1B', '7', '6', '4A', '4B', 'RIGHT_DOOR'];

function runSingleSimulation(nightNum, config, botStrategy, runIndex) {
  const seed = 100000 + runIndex * 17 + nightNum * 31;
  const rng = mulberry32(seed);

  const preset = NIGHT_AI_PRESETS[nightNum];
  const nightMult = 1 + (nightNum - 1) * config.nightMultiplierStep;

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

  let outcome = null; // 'VICTORY', 'VICTORY_POWEROUT', 'LOSS_POWEROUT', 'LOSS_OMCO', 'LOSS_BAKA', 'LOSS_CHODA', 'LOSS_MUDJA', 'LOSS_PUPPET'

  // Bot timers and reaction state
  let lightCycleTimer = 0;
  let lightFlashDuration = 0;
  let lightSide = 'left'; // 'left' or 'right'
  let bakaPendingDoor = false;
  let chodaMudjaPendingDoor = false;
  let bakaDoorCloseReactionTimer = 0;
  let rightDoorCloseReactionTimer = 0;

  const dt = 0.05; // 20 updates per second

  while (time < 360) {
    time += dt;

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

    // 4. Puppet logic
    if (preset.puppet > 0 && !puppet.released) {
      if (windingTape && camOpen && currentCam === '5') {
        tapeCharge = Math.min(100, tapeCharge + 28 * dt);
      } else {
        tapeCharge = Math.max(0, tapeCharge - (1.1 + preset.puppet * 0.19) * dt);
      }
      if (tapeCharge <= 0) {
        puppet.released = true;
      }
    }
    if (puppet.released) {
      puppet.attackTimer += dt;
      if (puppet.attackTimer >= 4.5) {
        outcome = 'LOSS_PUPPET';
        break;
      }
    }

    // 5. Omco logic
    if (preset.omco > 0 || omco.sprinting) {
      if (!omco.sprinting) {
        const watchingOmco = camOpen && currentCam === '1C';
        if (!watchingOmco) {
          omco.progress += (0.55 + preset.omco * 0.16) * dt;
          if (omco.progress > 33 && omco.stage === 0) omco.stage = 1;
          if (omco.progress > 66 && omco.stage === 1) omco.stage = 2;
          if (omco.progress >= 100 && omco.stage === 2) {
            omco.stage = 3;
            omco.sprinting = true;
            omco.sprintTimer = 0;
          }
        } else if (config.cam1cRegresses) {
          // If enabled in test variant: watching 1C regresses progress
          omco.progress = Math.max(0, omco.progress - config.cam1cRegressRate * dt);
          if (omco.progress <= 33) omco.stage = 0;
          else if (omco.progress <= 66) omco.stage = 1;
        }
      } else {
        // Omco is sprinting down West Hall (CAM 2A)
        omco.sprintTimer += dt;
        const sprintLimit = 2.25;

        // Bot reaction to Omco sprint cry (hears audio cue)
        if (omco.sprintTimer >= botStrategy.omcoReactTime && !leftDoorClosed) {
          if (camOpen) { camOpen = false; windingTape = false; }
          leftDoorClosed = true;
        }

        if (omco.sprintTimer >= sprintLimit) {
          if (leftDoorClosed) {
            // Blocked hit!
            power = Math.max(0, power - config.omcoPenalty);
            omco.sprinting = false;
            omco.stage = 0;
            omco.progress = rng() * 20;
            omcoHits++;
            // Bot opens left door after 0.25s reaction to bang
            leftDoorClosed = false;
          } else {
            outcome = 'LOSS_OMCO';
            break;
          }
        }
      }
    }

    // 6. Animatronics at Door: Baka, Choda, Mudja
    // Left Door: Baka
    if (baka.loc === 'LEFT_DOOR') {
      baka.doorWait += dt;
      if (baka.doorWait >= 4.8) {
        if (leftDoorClosed) {
          baka.loc = '1B';
          baka.doorWait = 0;
          baka.moveTimer = 0;
          leftDoorClosed = false; // Bot opens door after bang
          bakaPendingDoor = false;
        } else {
          if (camOpen || baka.doorWait >= 7.5) {
            outcome = 'LOSS_BAKA';
            break;
          }
        }
      }
    }

    // Right Door: Choda and Mudja
    const rightAnimatronic = (choda.loc === 'RIGHT_DOOR') ? choda : (mudja.loc === 'RIGHT_DOOR' ? mudja : null);
    if (rightAnimatronic) {
      rightAnimatronic.doorWait += dt;
      if (rightAnimatronic.doorWait >= 4.8) {
        if (rightDoorClosed) {
          rightAnimatronic.loc = '1B';
          rightAnimatronic.doorWait = 0;
          rightAnimatronic.moveTimer = 0;
          rightDoorClosed = false; // Bot opens door after bang
          chodaMudjaPendingDoor = false;
        } else {
          if (camOpen || rightAnimatronic.doorWait >= 7.5) {
            outcome = (rightAnimatronic === choda) ? 'LOSS_CHODA' : 'LOSS_MUDJA';
            break;
          }
        }
      }
    }

    // 7. Regular path moves
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
        // Mudja paused if watched
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

    // 8. Bot decision-making (Human-like, non-cheating)
    // A) If door was triggered by light check, bot reacts and closes it
    if (bakaPendingDoor && !leftDoorClosed) {
      bakaDoorCloseReactionTimer += dt;
      if (bakaDoorCloseReactionTimer >= botStrategy.doorCloseReactTime) {
        if (camOpen) { camOpen = false; windingTape = false; }
        leftDoorClosed = true;
      }
    }
    if (chodaMudjaPendingDoor && !rightDoorClosed) {
      rightDoorCloseReactionTimer += dt;
      if (rightDoorCloseReactionTimer >= botStrategy.doorCloseReactTime) {
        if (camOpen) { camOpen = false; windingTape = false; }
        rightDoorClosed = true;
      }
    }

    // B) Light flash routine when in office
    if (!camOpen && !leftDoorClosed && !rightDoorClosed) {
      lightCycleTimer += dt;
      if (lightCycleTimer >= botStrategy.lightCheckInterval) {
        // Flash light for 0.25s
        lightFlashDuration += dt;
        if (lightSide === 'left') {
          leftLightOn = true;
          rightLightOn = false;
          // Player sees Baka if present at left door
          if (baka.loc === 'LEFT_DOOR') {
            bakaPendingDoor = true;
            bakaDoorCloseReactionTimer = 0;
          }
        } else {
          rightLightOn = true;
          leftLightOn = false;
          // Player sees Choda or Mudja if present at right door
          if (choda.loc === 'RIGHT_DOOR' || mudja.loc === 'RIGHT_DOOR') {
            chodaMudjaPendingDoor = true;
            rightDoorCloseReactionTimer = 0;
          }
        }

        if (lightFlashDuration >= 0.25) {
          leftLightOn = false;
          rightLightOn = false;
          lightFlashDuration = 0;
          lightCycleTimer = 0;
          lightSide = lightSide === 'left' ? 'right' : 'left';
        }
      }
    }

    // C) Camera Routine: Puppet tape rewind
    // Player checks tape when it gets low (threshold) or warning is visible
    const tapeLowThreshold = botStrategy.tapeThreshold;
    if (tapeCharge <= tapeLowThreshold && !camOpen && !omco.sprinting && !leftDoorClosed && !rightDoorClosed) {
      camOpen = true;
      currentCam = '5';
      windingTape = true;
    }

    // When rewinding tape, finish when charge reaches safe target (e.g. 92%)
    if (camOpen && currentCam === '5') {
      if (tapeCharge >= botStrategy.tapeTargetCharge) {
        camOpen = false;
        windingTape = false;
      }
    }

    // D) Optional CAM 1C strategy (if botStrategy.checksCam1c is true)
    if (botStrategy.checksCam1c && !camOpen && !omco.sprinting && !leftDoorClosed && !rightDoorClosed && tapeCharge > 55) {
      botStrategy.cam1cCycleTimer = (botStrategy.cam1cCycleTimer || 0) + dt;
      if (botStrategy.cam1cCycleTimer >= botStrategy.cam1cInterval) {
        camOpen = true;
        currentCam = '1C';
        windingTape = false;
        botStrategy.cam1cLookTimer = 0;
        botStrategy.cam1cCycleTimer = 0;
      }
    }
    if (botStrategy.checksCam1c && camOpen && currentCam === '1C') {
      botStrategy.cam1cLookTimer = (botStrategy.cam1cLookTimer || 0) + dt;
      if (botStrategy.cam1cLookTimer >= botStrategy.cam1cLookDuration) {
        camOpen = false;
      }
    }
  }

  return {
    outcome,
    survived: outcome === 'VICTORY' || outcome === 'VICTORY_POWEROUT',
    remainingPower: power,
    omcoHits,
    camTime,
    leftDoorTime,
    rightDoorTime,
    lightTime
  };
}

function runBatch(nightNum, config, botStrategy, runCount = 500) {
  let victories = 0;
  let victoriesPowerOut = 0;
  let lossPowerOut = 0;
  let lossBaka = 0;
  let lossChoda = 0;
  let lossMudja = 0;
  let lossOmco = 0;
  let lossPuppet = 0;

  const powersOnVictory = [];
  let totalOmcoHits = 0;
  let totalCamTime = 0;
  let totalLeftDoorTime = 0;
  let totalRightDoorTime = 0;

  for (let i = 0; i < runCount; i++) {
    const res = runSingleSimulation(nightNum, config, botStrategy, i);
    if (res.outcome === 'VICTORY') {
      victories++;
      powersOnVictory.push(res.remainingPower);
    } else if (res.outcome === 'VICTORY_POWEROUT') {
      victories++;
      victoriesPowerOut++;
      powersOnVictory.push(res.remainingPower);
    } else if (res.outcome === 'LOSS_POWEROUT') {
      lossPowerOut++;
    } else if (res.outcome === 'LOSS_BAKA') {
      lossBaka++;
    } else if (res.outcome === 'LOSS_CHODA') {
      lossChoda++;
    } else if (res.outcome === 'LOSS_MUDJA') {
      lossMudja++;
    } else if (res.outcome === 'LOSS_OMCO') {
      lossOmco++;
    } else if (res.outcome === 'LOSS_PUPPET') {
      lossPuppet++;
    }

    totalOmcoHits += res.omcoHits;
    totalCamTime += res.camTime;
    totalLeftDoorTime += res.leftDoorTime;
    totalRightDoorTime += res.rightDoorTime;
  }

  powersOnVictory.sort((a, b) => a - b);
  const medianPower = powersOnVictory.length > 0 
    ? powersOnVictory[Math.floor(powersOnVictory.length / 2)] 
    : 0;

  return {
    nightNum,
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
    medianPower: medianPower.toFixed(2) + '%',
    avgOmcoHits: (totalOmcoHits / runCount).toFixed(2),
    avgCamSec: (totalCamTime / runCount).toFixed(1) + 's',
    avgLeftDoorSec: (totalLeftDoorTime / runCount).toFixed(1) + 's',
    avgRightDoorSec: (totalRightDoorTime / runCount).toFixed(1) + 's',
    avgTotalDoorSec: ((totalLeftDoorTime + totalRightDoorTime) / runCount).toFixed(1) + 's'
  };
}

// Baseline bot strategy (human-like, reacts to lights, sounds, warnings)
const defaultBotStrategy = {
  omcoReactTime: 0.55,       // 0.55s to close door after sprint cry
  doorCloseReactTime: 0.35,  // 0.35s to close door after seeing animatronic with light
  lightCheckInterval: 3.5,   // checks lights every 3.5s
  tapeThreshold: 45.0,       // rewinds tape when it drops below 45%
  tapeTargetCharge: 92.0,    // finishes rewinding when it reaches 92%
  checksCam1c: false         // baseline does not cycle 1C
};

// 1. Variant 0: Trenutacni balans (Baseline)
const configV0 = {
  name: 'V0: Trenutačni balans',
  nightMultiplierStep: 0.06,
  omcoPenalty: 3.5,
  cam1cRegresses: false
};

// 2. Variant 1: Samo množitelj 0.03
const configV1 = {
  name: 'V1: Samo množitelj 0.03',
  nightMultiplierStep: 0.03,
  omcoPenalty: 3.5,
  cam1cRegresses: false
};

// 3. Variant 2: Samo Omčo penal 2.5%
const configV2 = {
  name: 'V2: Samo Omčo penal 2.5%',
  nightMultiplierStep: 0.06,
  omcoPenalty: 2.5,
  cam1cRegresses: false
};

// 4. Variant 3: Samo vraćanje progresa na CAM 1C (4.5%/s) - Isto ponašanje bota (baseline)
const configV3_base = {
  name: 'V3a: CAM 1C vraća progres (Isto ponašanje bota)',
  nightMultiplierStep: 0.06,
  omcoPenalty: 3.5,
  cam1cRegresses: true,
  cam1cRegressRate: 4.5
};

// 5. Variant 3b: CAM 1C vraća progres s prilagođenom strategijom bota (povremeno gleda 1C)
const botStrategyWith1C = {
  ...defaultBotStrategy,
  checksCam1c: true,
  cam1cInterval: 14.0,       // gleda 1C svakih 14 sekundi ako je traka sigurna
  cam1cLookDuration: 2.0     // gleda 2 sekunde
};
const configV3_adapted = {
  name: 'V3b: CAM 1C vraća progres (Prilagođena strategija bota)',
  nightMultiplierStep: 0.06,
  omcoPenalty: 3.5,
  cam1cRegresses: true,
  cam1cRegressRate: 4.5
};

// 6. Variant 4: Kombinacija Množitelj 0.03 + Penal 2.5% (Bez mijenjanja CAM 1C mehanike)
const configV4 = {
  name: 'V4: Množitelj 0.03 + Penal 2.5%',
  nightMultiplierStep: 0.03,
  omcoPenalty: 2.5,
  cam1cRegresses: false
};

// 7. Variant 5: Kombinacija Množitelj 0.03 + Penal 2.0%
const configV5 = {
  name: 'V5: Množitelj 0.03 + Penal 2.0%',
  nightMultiplierStep: 0.03,
  omcoPenalty: 2.0,
  cam1cRegresses: false
};

const allConfigs = [
  { cfg: configV0, strat: defaultBotStrategy },
  { cfg: configV1, strat: defaultBotStrategy },
  { cfg: configV2, strat: defaultBotStrategy },
  { cfg: configV3_base, strat: defaultBotStrategy },
  { cfg: configV3_adapted, strat: botStrategyWith1C },
  { cfg: configV4, strat: defaultBotStrategy },
  { cfg: configV5, strat: defaultBotStrategy }
];

console.log('POKREĆEM TESTIRANJE VARIJANTI (500 POKUŠAJA PO NOĆI, DETERMINISTIČKI SEEDOVI)...');

const results = {};
allConfigs.forEach(({ cfg, strat }) => {
  results[cfg.name] = [];
  for (let n = 1; n <= 6; n++) {
    const res = runBatch(n, cfg, strat, 500);
    results[cfg.name].push(res);
  }
});

fs.writeFileSync('simulation_results.json', JSON.stringify(results, null, 2), 'utf8');
console.log('SIMULACIJA USPJEŠNO ZAVRŠENA! Rezultati spremljeni u simulation_results.json');
