/**
 * ============================================================================
 * FIVE NIGHTS AT BALKAN: STREAMER EDITION
 * Kompletan Engine: Web Audio API Sinteza + Panorama Ured + 11 Kamera + AI
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. WEB AUDIO API SINTETIZATOR ZVUKA (Bez vanjskih datoteka)
// ----------------------------------------------------------------------------
class BalkanAudioEngine {
  constructor() {
    this.ctx = null;
    this.ambientGain = null;
    this.fanOsc = null;
    this.staticGain = null;
    this.lightHumGain = null;
    this.toreadorInterval = null;
    this.phoneBeepTimer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    // Kreiraj bijeli/ružičasti šum buffer za ventilator i CCTV statiku
    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 0.35;
    }

    this.setupContinuousLoops();
  }

  setupContinuousLoops() {
    if (!this.ctx) return;

    // 1. Zujanje stolnog ventilatora
    const fanSource = this.ctx.createBufferSource();
    fanSource.buffer = this.noiseBuffer;
    fanSource.loop = true;

    const fanFilter = this.ctx.createBiquadFilter();
    fanFilter.type = 'lowpass';
    fanFilter.frequency.value = 240;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.0;

    fanSource.connect(fanFilter);
    fanFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);
    fanSource.start();

    // 2. Šum CCTV statike
    const staticSource = this.ctx.createBufferSource();
    staticSource.buffer = this.noiseBuffer;
    staticSource.loop = true;

    const staticFilter = this.ctx.createBiquadFilter();
    staticFilter.type = 'bandpass';
    staticFilter.frequency.value = 1400;

    this.staticGain = this.ctx.createGain();
    this.staticGain.gain.value = 0.0;

    staticSource.connect(staticFilter);
    staticFilter.connect(this.staticGain);
    this.staticGain.connect(this.ctx.destination);
    staticSource.start();

    // 3. Zujanje hodničke rasvjete (60Hz + 120Hz hum)
    this.lightOsc = this.ctx.createOscillator();
    this.lightOsc.type = 'sawtooth';
    this.lightOsc.frequency.value = 100;

    const lightFilter = this.ctx.createBiquadFilter();
    lightFilter.type = 'lowpass';
    lightFilter.frequency.value = 320;

    this.lightHumGain = this.ctx.createGain();
    this.lightHumGain.gain.value = 0.0;

    this.lightOsc.connect(lightFilter);
    lightFilter.connect(this.lightHumGain);
    this.lightHumGain.connect(this.ctx.destination);
    this.lightOsc.start();
  }

  updateContinuousAudio(inGame, powerOut, camOpen, lightActive) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const fanVol = (inGame && !powerOut) ? (camOpen ? 0.08 : 0.22) : 0.0;
    const statVol = (inGame && !powerOut && camOpen) ? 0.14 : 0.0;
    const lightVol = (inGame && !powerOut && lightActive && !camOpen) ? 0.06 : 0.0;

    this.ambientGain.gain.setTargetAtTime(fanVol, now, 0.05);
    this.staticGain.gain.setTargetAtTime(statVol, now, 0.05);
    this.lightHumGain.gain.setTargetAtTime(lightVol, now, 0.04);
  }

  // Metalni udarac spuštanja/dizanja roletne
  playDoorSlam(closed) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(closed ? 140 : 95, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.28);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.31);

    // Metalni šum roletne
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.value = 600;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.3, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    nSrc.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.ctx.destination);
    nSrc.start(now);
    nSrc.stop(now + 0.23);
  }

  // Tupi udarac u zatvorenu roletnu kad streamer poljubi vrata
  playDoorBang() {
    if (!this.ctx) return;
    for (let i = 0; i < 2; i++) {
      const t = this.ctx.currentTime + i * 0.22;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(22, t + 0.18);
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.21);
    }
  }

  // Klik kamere / monitora
  playCamBlip() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.setValueAtTime(1320, now + 0.03);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Smiješni HONK zvuk na klik nosa na posteru
  playHonk() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(340, now);
    osc1.frequency.linearRampToValueAtTime(430, now + 0.09);
    osc1.frequency.linearRampToValueAtTime(310, now + 0.24);

    osc2.frequency.setValueAtTime(685, now);
    osc2.frequency.linearRampToValueAtTime(860, now + 0.09);
    osc2.frequency.linearRampToValueAtTime(620, now + 0.24);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.27);
    osc2.stop(now + 0.27);
  }

  // Premotavanje kazetofona / donacijske trake
  playTapeWind() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.linearRampToValueAtTime(780, now + 0.06);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Koraci i sprint Omče kroz lijevi hodnik
  playFootsteps(isSprint = false) {
    if (!this.ctx) return;
    const count = isSprint ? 8 : 2;
    const stepGap = isSprint ? 0.09 : 0.32;
    for (let i = 0; i < count; i++) {
      const t = this.ctx.currentTime + i * stepGap;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isSprint ? 95 : 68, t);
      osc.frequency.exponentialRampToValueAtTime(24, t + 0.08);
      gain.gain.setValueAtTime(isSprint ? 0.42 : 0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  }

  // Zveckanje lonaca i tava u Kuhinji (CAM 6)
  playKitchenPots() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [820, 1290, 1640, 2120];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f + Math.random() * 150, now + idx * 0.04);
      gain.gain.setValueAtTime(0.08, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.17);
    });
  }

  // Zvuk upozorenja kad netko stoji pred vratima i upališ svjetlo
  playWindowStinger() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.45);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // Nestanak struje + "Balkanski Toreador / Kolo" 8-bit glazbena kutija
  playPowerDownAndToreador() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 1.4);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 1.5);

    // Melodija: Balkanski Toreador u 8-bit harmonika/music-box stilu
    const notes = [
      { f: 523.25, d: 0.35 }, { f: 587.33, d: 0.35 }, { f: 523.25, d: 0.35 },
      { f: 440.00, d: 0.35 }, { f: 440.00, d: 0.35 }, { f: 415.30, d: 0.25 },
      { f: 440.00, d: 0.25 }, { f: 493.88, d: 0.35 }, { f: 440.00, d: 0.45 },
      { f: 349.23, d: 0.45 }, { f: 392.00, d: 0.45 }, { f: 329.63, d: 0.65 }
    ];
    let step = 0;
    clearInterval(this.toreadorInterval);
    this.toreadorInterval = setInterval(() => {
      if (!this.ctx) return;
      const n = notes[step % notes.length];
      const t = this.ctx.currentTime;
      const boxOsc = this.ctx.createOscillator();
      const boxGain = this.ctx.createGain();
      boxOsc.type = 'square';
      boxOsc.frequency.setValueAtTime(n.f, t);
      boxGain.gain.setValueAtTime(0.16, t);
      boxGain.gain.exponentialRampToValueAtTime(0.001, t + n.d);
      boxOsc.connect(boxGain);
      boxGain.connect(this.ctx.destination);
      boxOsc.start(t);
      boxOsc.stop(t + n.d + 0.02);
      step++;
    }, 390);
  }

  stopToreador() {
    clearInterval(this.toreadorInterval);
    this.toreadorInterval = null;
  }

  // Retro govor Gazde preko telefona
  startPhoneSpeech() {
    this.stopPhoneSpeech();
    if (!this.ctx) return;
    // Prvo 2 kratka zvona telefona
    for (let r = 0; r < 2; r++) {
      const t = this.ctx.currentTime + r * 0.45;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1120, t + 0.08);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    }

    this.phoneBeepTimer = setInterval(() => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190 + Math.random() * 140, t);
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    }, 110);
  }

  stopPhoneSpeech() {
    if (this.phoneBeepTimer) {
      clearInterval(this.phoneBeepTimer);
      this.phoneBeepTimer = null;
    }
  }

  // Glasan sintetizirani horor JUMPSCARE vrisak
  playJumpscareScream(basePitch = 420) {
    this.stopToreador();
    this.stopPhoneSpeech();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Višeslojna FM distorzija + bijeli šum
    const freqs = [basePitch, basePitch * 1.37, basePitch * 1.83, 145];
    freqs.forEach((f) => {
      const osc = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const master = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.72, now + 1.2);

      mod.type = 'square';
      mod.frequency.value = 48;
      modGain.gain.value = 180;

      master.gain.setValueAtTime(0.32, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 1.35);

      mod.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(master);
      master.connect(this.ctx.destination);

      mod.start(now);
      osc.start(now);
      mod.stop(now + 1.36);
      osc.stop(now + 1.36);
    });

    // Eksplozija šuma
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.65, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 1.25);
    nSrc.connect(nGain);
    nGain.connect(this.ctx.destination);
    nSrc.start(now);
    nSrc.stop(now + 1.3);
  }

  // Veseli jingle za pobjedu u 06:00 AM
  playSixAmChime() {
    this.stopToreador();
    this.stopPhoneSpeech();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
    notes.forEach((f, idx) => {
      const t = this.ctx.currentTime + idx * 0.28;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.58);
    });
  }
}

const audio = new BalkanAudioEngine();

// ----------------------------------------------------------------------------
// 2. DEFINICIJA SVIH 11 ORIGINALNIH KAMERA I LIKOVA
// ----------------------------------------------------------------------------
const CAMERAS = {
  '1A': { id: '1A', name: 'CAM 1A - Glavni Studio / Bina', x: 1030, y: 375, key: '1' },
  '1B': { id: '1B', name: 'CAM 1B - Sala Kafane sa Stolovima', x: 1015, y: 430, key: null },
  '1C': { id: '1C', name: 'CAM 1C - Green Screen Kutak', x: 960, y: 485, key: '2' },
  '2A': { id: '2A', name: 'CAM 2A - Lijevi Hodnik', x: 1000, y: 555, key: '3' },
  '2B': { id: '2B', name: 'CAM 2B - Lijevi Kut pred Uredom', x: 1000, y: 605, key: null },
  '3':  { id: '3',  name: 'CAM 3 - Špajza s Gajbama Piva', x: 935, y: 545, key: null },
  '4A': { id: '4A', name: 'CAM 4A - Desni Hodnik', x: 1090, y: 555, key: '4' },
  '4B': { id: '4B', name: 'CAM 4B - Desni Kut pred Uredom', x: 1090, y: 605, key: null },
  '5':  { id: '5',  name: 'CAM 5 - Backstage & Kazetofon', x: 935, y: 425, key: '6' },
  '6':  { id: '6',  name: 'CAM 6 - Kuhinja & Roštilj [AUDIO]', x: 1165, y: 525, key: '5' },
  '7':  { id: '7',  name: 'CAM 7 - Toaleti Kafane', x: 1165, y: 435, key: null }
};

const DEFAULT_CHARACTERS = [
  {
    id: 'mudja',
    role: 'FREDDY TIP (Glavni Šef)',
    defaultName: 'Šef Muđa',
    defaultCry: 'ĐESTE LJUDI, GASIMO STRUJU!',
    color: '#c87d32',
    hatColor: '#222222',
    pitch: 280,
    path: ['1A', '1B', '7', '6', '4A', '4B', 'RIGHT_DOOR']
  },
  {
    id: 'baka',
    role: 'BONNIE TIP (Lijevi Agresivac)',
    defaultName: 'Baka Svinja',
    defaultCry: 'REŠI MODERATORA! IDE GAS!',
    color: '#8844cc',
    hatColor: '#ffaa00',
    pitch: 440,
    path: ['1A', '5', '1B', '3', '2A', '2B', 'LEFT_DOOR']
  },
  {
    id: 'choda',
    role: 'CHICA TIP (Gastro & Roštilj)',
    defaultName: 'Gastro Choda',
    defaultCry: 'GDJE SU MOJI ĆEVAPI?!',
    color: '#e6b800',
    hatColor: '#ffffff',
    pitch: 520,
    path: ['1A', '1B', '7', '6', '4A', '4B', 'RIGHT_DOOR']
  },
  {
    id: 'omco',
    role: 'FOXY TIP (Green Screen Sprinter)',
    defaultName: 'Ludi Omčo',
    defaultCry: 'KUKU MENI, OTVARAJ VRATA!',
    color: '#cc3333',
    hatColor: '#3366cc',
    pitch: 610,
    path: ['1C', '2A', 'LEFT_DOOR']
  },
  {
    id: 'puppet',
    role: 'PUPPET TIP (Kazetofon / Donacije)',
    defaultName: 'Tajni Donator',
    defaultCry: 'NISI PREMOTAO TRAKU, NEMA PLAĆE!',
    color: '#eeeeee',
    hatColor: '#aa0000',
    pitch: 740,
    path: ['5']
  }
];

// Poruke Gazde Mileta ("Balkanski Phone Guy") za svih 5 noći
const PHONE_MESSAGES = {
  1: 'Alo majstore, gazda Mile ovdje! Dobrodošao u noćnu smjenu. Pazi mi na kilovate, agregat nam je star, popravljao ga je kum prošlog utorka. Ovi naši streameri vole hodati noću kad pukne internet... Ako čuješ da netko trči kroz lijevi hodnik, spuštaj roletnu odmah!',
  2: 'Alo legendo, preživio si prvu noć! Nego, pazi sad na dvije stvari: u Backstageu (CAM 5) imamo stari kazetofon s donacijama. Moraš redovito držati gumb PREMATAJ TRAKU inače izlazi Tajni Donator kojem ni čelična roletna ništa ne može! I provjeravaj Omču iza zavjese na CAM 1C!',
  3: 'E majstore, večeras su popili po tri turske kave i gajbu piva iz špajze. Choda stalno lupa tavama u kuhinji na CAM 6 – kamera tamo ne radi, ali čut ćeš roštilj kad je blizu desnog hodnika. Štedi struju!',
  4: 'Alo! Samo kratko, agregat nam troši ko Golf dvojka uzbrdo! Šef Muđa se večeras aktivno šulja kroz mrak. Ako ga vidiš na CAM 4B pred desnim vratima, spusti desnu roletnu prije nego što otvorim monitor!',
  5: 'Majstore... zadnja noć prije isplate! Svi su u punom gasu. Drži jedno oko na kazetofonu (CAM 5), drugo na zavjesi (CAM 1C) i slušaj korake. Ako preživiš do 06:00 ujutro, ide plaća i topli ćevapi u somunu!'
};

// AI Težine po noćima (1-5)
const NIGHT_AI_PRESETS = {
  1: { mudja: 0, baka: 3, choda: 2, omco: 1, puppet: 1 },
  2: { mudja: 2, baka: 5, choda: 4, omco: 4, puppet: 4 },
  3: { mudja: 5, baka: 8, choda: 7, omco: 6, puppet: 7 },
  4: { mudja: 9, baka: 11, choda: 10, omco: 9, puppet: 10 },
  5: { mudja: 13, baka: 14, choda: 14, omco: 13, puppet: 13 }
};

// ----------------------------------------------------------------------------
// 3. STANJE IGRE I KONFIGURACIJA
// ----------------------------------------------------------------------------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let charConfigs = DEFAULT_CHARACTERS.map(c => ({
  ...c,
  name: c.defaultName,
  cry: c.defaultCry,
  customImg: null,
  aiLevel: 5
}));

let state = {
  screen: 'MENU', // MENU, PLAYING, JUMPSCARE, VICTORY, GAMEOVER
  selectedNight: 1,
  hourDurationSec: 60, // 60 sekundi po satu (6 minuta noć)
  nightTimeElapsed: 0,
  currentHour: 0, // 0 = 12 AM ... 6 = 6 AM

  // Ured i Panorama (širina ureda 1800px na 1280px platnu)
  officeWidth: 1800,
  panX: 260, // Trenutni pomak kamere ureda (0 do 520)
  mouseX: 640,
  mouseY: 360,
  fanAngle: 0,
  posterHonkTimer: 0,

  // Vrata, svjetla i monitor
  leftDoorClosed: false,
  rightDoorClosed: false,
  leftDoorAnim: 0, // 0 = otvoreno, 1 = spuštena roletna
  rightDoorAnim: 0,
  leftLightOn: false,
  rightLightOn: false,
  camOpen: false,
  currentCam: '1A',

  // Agregat i struja
  power: 100.0,
  usageLevel: 1,
  powerOut: false,
  powerOutTimer: 0,
  powerOutEyesBlink: false,

  // Kazetofon / Donacijska traka (Puppet mehanika na CAM 5)
  tapeCharge: 100.0,
  windingTape: false,

  // Pozicije i stanja likova
  entities: {
    mudja: { loc: '1A', moveTimer: 0, doorWait: 0 },
    baka:  { loc: '1A', moveTimer: 0, doorWait: 0 },
    choda: { loc: '1A', moveTimer: 0, doorWait: 0, kitchenNoiseTimer: 0 },
    omco:  { stage: 0, progress: 0, sprinting: false, sprintTimer: 0 }, // 0: zavjesa, 1: viri, 2: vani, 3: SPRINT!
    puppet: { released: false, attackTimer: 0 }
  },

  // Jumpscare i završnica
  jumpscareChar: null,
  jumpscareTimer: 0,
  endReason: '',
  earnedPay: '125,00 €'
};

// ----------------------------------------------------------------------------
// 4. INICIJALIZACIJA UI MODALA (CUSTOM CREATOR & CUSTOM NIGHT)
// ----------------------------------------------------------------------------
function buildCreatorUI() {
  const grid = document.getElementById('creator-grid');
  grid.innerHTML = '';

  charConfigs.forEach((ch, index) => {
    const card = document.createElement('div');
    card.className = 'char-card';

    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 80;
    previewCanvas.height = 80;
    previewCanvas.className = 'char-preview';
    drawCharacterPortrait(previewCanvas.getContext('2d'), ch, 40, 46, 30);

    card.innerHTML = `
      <h4>${ch.role}</h4>
      <div class="char-role">ID: ${ch.id.toUpperCase()}</div>
      <div class="preview-slot"></div>
      <label>Ime Streamera:</label>
      <input type="text" data-idx="${index}" class="inp-name" value="${ch.name}" maxlength="22">
      <label>Jumpscare Krik:</label>
      <input type="text" data-idx="${index}" class="inp-cry" value="${ch.cry}" maxlength="42">
      <label>Vlastita slika lica (opcionalno):</label>
      <input type="file" data-idx="${index}" class="inp-file" accept="image/*">
    `;

    card.querySelector('.preview-slot').appendChild(previewCanvas);
    grid.appendChild(card);
  });

  grid.querySelectorAll('.inp-name').forEach(inp => {
    inp.addEventListener('input', e => {
      const idx = +e.target.dataset.idx;
      charConfigs[idx].name = e.target.value || charConfigs[idx].defaultName;
    });
  });

  grid.querySelectorAll('.inp-cry').forEach(inp => {
    inp.addEventListener('input', e => {
      const idx = +e.target.dataset.idx;
      charConfigs[idx].cry = e.target.value || charConfigs[idx].defaultCry;
    });
  });

  grid.querySelectorAll('.inp-file').forEach(inp => {
    inp.addEventListener('change', e => {
      const idx = +e.target.dataset.idx;
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          charConfigs[idx].customImg = img;
          buildCreatorUI();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  });
}

function buildCustomNightUI() {
  const grid = document.getElementById('cn-grid');
  grid.innerHTML = '';

  charConfigs.forEach((ch, index) => {
    const card = document.createElement('div');
    card.className = 'char-card';

    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 72;
    previewCanvas.height = 72;
    previewCanvas.className = 'char-preview';
    drawCharacterPortrait(previewCanvas.getContext('2d'), ch, 36, 42, 26);

    card.innerHTML = `
      <h4>${ch.name}</h4>
      <div class="char-role">${ch.role}</div>
      <div class="preview-slot"></div>
      <label>AI Težina: <b id="cn-val-${index}" style="color:var(--crt-amber);">${ch.aiLevel}</b> / 20</label>
      <input type="range" min="0" max="20" value="${ch.aiLevel}" data-idx="${index}" class="cn-slider">
    `;

    card.querySelector('.preview-slot').appendChild(previewCanvas);
    grid.appendChild(card);
  });

  grid.querySelectorAll('.cn-slider').forEach(sl => {
    sl.addEventListener('input', e => {
      const idx = +e.target.dataset.idx;
      charConfigs[idx].aiLevel = +e.target.value;
      document.getElementById(`cn-val-${idx}`).textContent = charConfigs[idx].aiLevel;
    });
  });
}

// Event Listeneri za Meni
document.querySelectorAll('.night-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.night-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    state.selectedNight = +pill.dataset.night;
    document.getElementById('btn-start-night').textContent = `▶ POKRENI SMJENU (NOĆ ${state.selectedNight})`;
  });
});

document.getElementById('btn-start-night').addEventListener('click', () => {
  audio.init();
  startNight(state.selectedNight, false);
});

document.getElementById('btn-custom-creator').addEventListener('click', () => {
  buildCreatorUI();
  document.getElementById('creator-modal').classList.remove('hidden');
});

document.getElementById('btn-close-creator').addEventListener('click', () => {
  document.getElementById('creator-modal').classList.add('hidden');
});

document.getElementById('btn-reset-chars').addEventListener('click', () => {
  charConfigs.forEach(c => {
    c.name = c.defaultName;
    c.cry = c.defaultCry;
    c.customImg = null;
  });
  buildCreatorUI();
});

document.getElementById('btn-custom-night').addEventListener('click', () => {
  buildCustomNightUI();
  document.getElementById('custom-night-modal').classList.remove('hidden');
});

document.getElementById('btn-close-cn').addEventListener('click', () => {
  document.getElementById('custom-night-modal').classList.add('hidden');
});

document.getElementById('btn-20202020').addEventListener('click', () => {
  charConfigs.forEach(c => c.aiLevel = 20);
  buildCustomNightUI();
});

document.getElementById('btn-start-cn').addEventListener('click', () => {
  audio.init();
  document.getElementById('custom-night-modal').classList.add('hidden');
  startNight(6, true);
});

document.getElementById('btn-speed-toggle').addEventListener('click', e => {
  state.hourDurationSec = state.hourDurationSec === 60 ? 30 : 60;
  e.target.textContent = state.hourDurationSec === 60
    ? '⏱️ TRAJANJE SATA: 60s (REALNO)'
    : '⏱️ TRAJANJE SATA: 30s (BRZI MOD)';
});

document.getElementById('btn-mute-call').addEventListener('click', () => {
  audio.stopPhoneSpeech();
  document.getElementById('phone-box').classList.add('hidden');
});

document.getElementById('cam-toggle-bar').addEventListener('click', () => {
  toggleCameraMonitor();
});

// ----------------------------------------------------------------------------
// 5. POKRETANJE NOĆI I UPRAVLJANJE AI-JEM
// ----------------------------------------------------------------------------
function getCharById(id) {
  return charConfigs.find(c => c.id === id);
}

function startNight(nightNum, isCustomNight = false) {
  state.screen = 'PLAYING';
  state.selectedNight = nightNum;
  state.nightTimeElapsed = 0;
  state.currentHour = 0;
  state.panX = 260;

  state.leftDoorClosed = false;
  state.rightDoorClosed = false;
  state.leftDoorAnim = 0;
  state.rightDoorAnim = 0;
  state.leftLightOn = false;
  state.rightLightOn = false;
  state.camOpen = false;
  state.currentCam = '1A';

  state.power = 100.0;
  state.usageLevel = 1;
  state.powerOut = false;
  state.powerOutTimer = 0;

  state.tapeCharge = 100.0;
  state.windingTape = false;

  // Postavi AI razine ako nije Custom Night
  if (!isCustomNight) {
    const preset = NIGHT_AI_PRESETS[nightNum] || NIGHT_AI_PRESETS[5];
    charConfigs.forEach(c => {
      c.aiLevel = preset[c.id];
    });
  }

  // Resetiraj pozicije streamera
  state.entities = {
    mudja:  { loc: '1A', moveTimer: 0, doorWait: 0 },
    baka:   { loc: '1A', moveTimer: 0, doorWait: 0 },
    choda:  { loc: '1A', moveTimer: 0, doorWait: 0, kitchenNoiseTimer: 0 },
    omco:   { stage: 0, progress: 0, sprinting: false, sprintTimer: 0 },
    puppet: { released: false, attackTimer: 0 }
  };

  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('hud-layer').classList.remove('hidden');
  document.getElementById('hud-night').textContent = nightNum === 6 ? 'CUSTOM NIGHT' : `NOĆ ${nightNum}`;
  document.getElementById('tape-warning').classList.add('hidden');

  // Pokreni poziv Gazde Mileta
  const msg = PHONE_MESSAGES[nightNum] || 'Alo majstore! Custom Night je u tijeku – svi streameri su na maksimumu, nek ti je sa srećom!';
  document.getElementById('phone-text').textContent = msg;
  document.getElementById('phone-box').classList.remove('hidden');
  audio.startPhoneSpeech();
}

function toggleCameraMonitor() {
  if (state.screen !== 'PLAYING' || state.powerOut) return;
  state.camOpen = !state.camOpen;
  state.windingTape = false;
  if (state.camOpen) {
    state.leftLightOn = false;
    state.rightLightOn = false;
  }
  audio.playCamBlip();
}

function toggleLeftDoor() {
  if (state.screen !== 'PLAYING' || state.powerOut) return;
  state.leftDoorClosed = !state.leftDoorClosed;
  audio.playDoorSlam(state.leftDoorClosed);
}

function toggleRightDoor() {
  if (state.screen !== 'PLAYING' || state.powerOut) return;
  state.rightDoorClosed = !state.rightDoorClosed;
  audio.playDoorSlam(state.rightDoorClosed);
}

function toggleLeftLight() {
  if (state.screen !== 'PLAYING' || state.powerOut || state.camOpen) return;
  state.leftLightOn = !state.leftLightOn;
  if (state.leftLightOn) {
    state.rightLightOn = false;
    if (state.entities.baka.loc === 'LEFT_DOOR') audio.playWindowStinger();
  }
}

function toggleRightLight() {
  if (state.screen !== 'PLAYING' || state.powerOut || state.camOpen) return;
  state.rightLightOn = !state.rightLightOn;
  if (state.rightLightOn) {
    state.leftLightOn = false;
    if (state.entities.choda.loc === 'RIGHT_DOOR' || state.entities.mudja.loc === 'RIGHT_DOOR') {
      audio.playWindowStinger();
    }
  }
}

function triggerJumpscare(charId, reasonText) {
  if (state.screen === 'JUMPSCARE') return;
  state.screen = 'JUMPSCARE';
  state.camOpen = false;
  state.windingTape = false;
  state.jumpscareChar = getCharById(charId);
  state.jumpscareTimer = 0;
  state.endReason = reasonText;

  document.getElementById('hud-layer').classList.add('hidden');
  audio.updateContinuousAudio(false, false, false, false);
  audio.playJumpscareScream(state.jumpscareChar.pitch);
}

function triggerVictory() {
  state.screen = 'VICTORY';
  state.camOpen = false;
  state.windingTape = false;
  document.getElementById('hud-layer').classList.add('hidden');
  audio.updateContinuousAudio(false, false, false, false);
  audio.playSixAmChime();

  const bonuses = ['120,00 € + Bon za 10 ćevapa', '150,00 € + Gajba piva', '185,50 € + Novi mikrofon', '240,00 € + Bakšiš od donacija', '500,00 € + Titula Glavnog Moda', '999,99 € + Vlasništvo nad Kafanom'];
  state.earnedPay = bonuses[(state.selectedNight - 1) % bonuses.length];
}

// ----------------------------------------------------------------------------
// 6. UPDATE PETLJA (Fizika, Potrošnja Struje, AI Streamera)
// ----------------------------------------------------------------------------
function updateGame(dt) {
  state.fanAngle = (state.fanAngle + dt * 18) % (Math.PI * 2);
  if (state.posterHonkTimer > 0) state.posterHonkTimer -= dt;

  // Animacija roletni
  const doorSpeed = 6.5 * dt;
  state.leftDoorAnim = state.leftDoorClosed
    ? Math.min(1, state.leftDoorAnim + doorSpeed)
    : Math.max(0, state.leftDoorAnim - doorSpeed);
  state.rightDoorAnim = state.rightDoorClosed
    ? Math.min(1, state.rightDoorAnim + doorSpeed)
    : Math.max(0, state.rightDoorAnim - doorSpeed);

  if (state.screen === 'JUMPSCARE') {
    state.jumpscareTimer += dt;
    if (state.jumpscareTimer >= 2.1) {
      state.screen = 'GAMEOVER';
    }
    return;
  }

  if (state.screen !== 'PLAYING') {
    audio.updateContinuousAudio(false, false, false, false);
    return;
  }

  // Panoramsko pomicanje pogleda mišem u uredu (kad monitor nije podignut)
  if (!state.camOpen) {
    const maxPan = state.officeWidth - canvas.width; // 520px
    if (state.mouseX < 340) {
      const factor = (340 - state.mouseX) / 340;
      state.panX = Math.max(0, state.panX - factor * 520 * dt);
    } else if (state.mouseX > canvas.width - 340) {
      const factor = (state.mouseX - (canvas.width - 340)) / 340;
      state.panX = Math.min(maxPan, state.panX + factor * 520 * dt);
    }
  }

  // Prolazak vremena (00:00 -> 06:00)
  state.nightTimeElapsed += dt;
  state.currentHour = Math.floor(state.nightTimeElapsed / state.hourDurationSec);

  if (state.currentHour >= 6) {
    triggerVictory();
    return;
  }

  // Automatski ugasi telefonski poziv nakon 32 sekunde
  if (state.nightTimeElapsed > 32 && !document.getElementById('phone-box').classList.contains('hidden')) {
    audio.stopPhoneSpeech();
    document.getElementById('phone-box').classList.add('hidden');
  }

  // Ako je nestalo struje -> sekvenca "Power Outage" s Balkanskim Toreadorom
  if (state.powerOut) {
    state.powerOutTimer += dt;
    state.powerOutEyesBlink = Math.sin(state.powerOutTimer * 14) > -0.2;
    audio.updateContinuousAudio(true, true, false, false);

    if (state.powerOutTimer > 9.5) {
      audio.stopToreador();
    }
    if (state.powerOutTimer > 11.5) {
      triggerJumpscare('mudja', 'NESTALO JE STRUJE U AGREGATU!');
    }
    return;
  }

  // Izračun potrošnje struje (1 do 5 crtica)
  let usage = 1; // Bazna potrošnja (ured + ventilator)
  if (state.camOpen) usage++;
  if (state.leftLightOn) usage++;
  if (state.rightLightOn) usage++;
  if (state.leftDoorClosed) usage++;
  if (state.rightDoorClosed) usage++;
  state.usageLevel = Math.min(5, usage);

  // Brzina trošenja struje ovisno o crticama i noći
  const nightDrainMultiplier = 1 + (state.selectedNight - 1) * 0.06;
  const drainPerSec = (0.14 + (state.usageLevel - 1) * 0.24) * nightDrainMultiplier;
  state.power = Math.max(0, state.power - drainPerSec * dt);

  if (state.power <= 0) {
    state.power = 0;
    state.powerOut = true;
    state.leftDoorClosed = false;
    state.rightDoorClosed = false;
    state.leftLightOn = false;
    state.rightLightOn = false;
    state.camOpen = false;
    state.windingTape = false;
    audio.playDoorSlam(false);
    audio.playPowerDownAndToreador();
    updateHUD();
    return;
  }

  audio.updateContinuousAudio(true, false, state.camOpen, state.leftLightOn || state.rightLightOn);

  // --------------------------------------------------------------------------
  // AI 1: KAZETOFON / PUPPET MEHANIKA (CAM 5)
  // --------------------------------------------------------------------------
  const puppetAI = getCharById('puppet').aiLevel;
  if (puppetAI > 0 && !state.entities.puppet.released) {
    if (state.windingTape && state.camOpen && state.currentCam === '5') {
      state.tapeCharge = Math.min(100, state.tapeCharge + 28 * dt);
      if (Math.random() < 0.25) audio.playTapeWind();
    } else {
      const tapeDrain = (1.1 + puppetAI * 0.19) * dt;
      state.tapeCharge = Math.max(0, state.tapeCharge - tapeDrain);
    }

    const warnEl = document.getElementById('tape-warning');
    if (state.tapeCharge < 28) {
      warnEl.classList.remove('hidden');
    } else {
      warnEl.classList.add('hidden');
    }

    if (state.tapeCharge <= 0) {
      state.entities.puppet.released = true;
      warnEl.textContent = '💀 TAJNI DONATOR JE PUŠTEN!';
    }
  }

  if (state.entities.puppet.released) {
    state.entities.puppet.attackTimer += dt;
    if (state.entities.puppet.attackTimer >= 4.5) {
      triggerJumpscare('puppet', 'NISI PREMOTAO DONACIJSKU TRAKU NA CAM 5!');
      return;
    }
  }

  // --------------------------------------------------------------------------
  // AI 2: OMČO (Foxy tip - Green Screen CAM 1C -> Sprint CAM 2A -> Lijeva vrata)
  // --------------------------------------------------------------------------
  const omcoAI = getCharById('omco').aiLevel;
  const omcoEnt = state.entities.omco;
  if (omcoAI > 0) {
    if (!omcoEnt.sprinting) {
      const watchingOmco = state.camOpen && state.currentCam === '1C';
      if (!watchingOmco) {
        omcoEnt.progress += (0.55 + omcoAI * 0.16) * dt;
        if (omcoEnt.progress > 33 && omcoEnt.stage === 0) omcoEnt.stage = 1;
        if (omcoEnt.progress > 66 && omcoEnt.stage === 1) omcoEnt.stage = 2;
        if (omcoEnt.progress >= 100 && omcoEnt.stage === 2) {
          omcoEnt.stage = 3;
          omcoEnt.sprinting = true;
          omcoEnt.sprintTimer = 0;
          audio.playFootsteps(true);
        }
      }
    } else {
      // Omčo trči kroz lijevi hodnik! Igrač ima ~2.2 sekunde da spusti lijevu roletnu
      omcoEnt.sprintTimer += dt;
      const sprintLimit = (state.camOpen && state.currentCam === '2A') ? 1.75 : 2.35;
      if (omcoEnt.sprintTimer >= sprintLimit) {
        if (state.leftDoorClosed) {
          // Odbio se od zatvorena vrata!
          audio.playDoorBang();
          state.power = Math.max(0, state.power - 3.5);
          omcoEnt.sprinting = false;
          omcoEnt.stage = 0;
          omcoEnt.progress = Math.random() * 20;
        } else {
          triggerJumpscare('omco', 'OMČO TE UHVATIO U SPRINTU KROZ LIJEVI HODNIK!');
          return;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // AI 3: BAKA, CHODA I MUĐA (Standardno kretanje po kamerama i vratima)
  // --------------------------------------------------------------------------
  ['baka', 'choda', 'mudja'].forEach(id => {
    const cfg = getCharById(id);
    const ent = state.entities[id];
    if (cfg.aiLevel <= 0) return;

    // Zvuk posuđa i roštilja kad je Choda ili Muđa u kuhinji (CAM 6)
    if (ent.loc === '6') {
      ent.kitchenNoiseTimer = (ent.kitchenNoiseTimer || 0) + dt;
      if (ent.kitchenNoiseTimer > 4.2) {
        ent.kitchenNoiseTimer = 0;
        if (state.camOpen && state.currentCam === '6') {
          audio.playKitchenPots();
        } else if (Math.random() < 0.45) {
          audio.playKitchenPots();
        }
      }
    }

    // Ako stoji pred vratima ureda
    if (ent.loc === 'LEFT_DOOR' || ent.loc === 'RIGHT_DOOR') {
      ent.doorWait += dt;
      const isLeft = ent.loc === 'LEFT_DOOR';
      const doorClosed = isLeft ? state.leftDoorClosed : state.rightDoorClosed;

      if (ent.doorWait >= 4.8) {
        if (doorClosed) {
          // Vrata su zatvorena – streamer udara u roletnu i vraća se na početak hodnika
          audio.playDoorBang();
          ent.loc = isLeft ? '1B' : '1B';
          ent.doorWait = 0;
          ent.moveTimer = 0;
        } else {
          // Vrata su otvorena – napad kad igrač digne monitor ili nakon 7.5s
          if (state.camOpen || ent.doorWait >= 7.5) {
            triggerJumpscare(id, `${cfg.name.toUpperCase()} JE UŠAO KROZ ${isLeft ? 'LIJEVA' : 'DESNA'} VRATA!`);
          }
        }
      }
      return;
    }

    // Interval pokušaja pomicanja
    ent.moveTimer += dt;
    const interval = id === 'mudja' ? 5.2 : 4.4;
    if (ent.moveTimer >= interval) {
      ent.moveTimer = 0;
      // Muđa se sporije kreće ako ga gledaš na kameri
      const watchedOnCam = state.camOpen && state.currentCam === ent.loc;
      if (id === 'mudja' && watchedOnCam) return;

      const roll = Math.floor(Math.random() * 20) + 1;
      if (roll <= cfg.aiLevel) {
        const idx = cfg.path.indexOf(ent.loc);
        if (idx >= 0 && idx < cfg.path.length - 1) {
          ent.loc = cfg.path[idx + 1];
          ent.doorWait = 0;
          audio.playFootsteps(false);
        }
      }
    }
  });

  updateHUD();
}

function updateHUD() {
  const displayHour = state.currentHour === 0 ? 12 : state.currentHour;
  document.getElementById('hud-clock').textContent = `${String(displayHour).padStart(2, '0')}:00 AM`;
  document.getElementById('hud-power').textContent = `${Math.ceil(state.power)}%`;

  const bars = document.querySelectorAll('#hud-usage-bars .u-bar');
  const colors = ['#22dd44', '#88ee22', '#ffbb00', '#ff6600', '#ff1111'];
  bars.forEach((b, idx) => {
    if (idx < state.usageLevel) {
      b.style.background = colors[idx];
      b.style.boxShadow = `0 0 6px ${colors[idx]}`;
    } else {
      b.style.background = '#1a1a1a';
      b.style.boxShadow = 'none';
    }
  });
}

// ----------------------------------------------------------------------------
// 7. CRTANJE LIKOVA (Vektorske karikature ili učitana custom slika lica)
// ----------------------------------------------------------------------------
function drawCharacterPortrait(g, charCfg, cx, cy, radius, isJumpscare = false) {
  g.save();

  // Tijelo / ramena
  g.fillStyle = charCfg.color;
  g.strokeStyle = '#111';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(cx, cy + radius * 1.15, radius * 1.15, radius * 0.75, 0, Math.PI, 0, false);
  g.fill();
  g.stroke();

  // Zlatni lanac ili kravata ovisno o liku
  if (charCfg.id === 'baka') {
    g.strokeStyle = '#ffd700';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy + radius * 0.65, radius * 0.55, 0.2, Math.PI - 0.2);
    g.stroke();
  } else if (charCfg.id === 'choda') {
    // Podbradak / pregača "VOLIM ĆEVAPE"
    g.fillStyle = '#fff';
    g.fillRect(cx - radius * 0.6, cy + radius * 0.55, radius * 1.2, radius * 0.5);
  }

  // Glava (ili učitana custom slika ili vektorska karikatura)
  if (charCfg.customImg) {
    g.save();
    g.beginPath();
    g.arc(cx, cy, radius, 0, Math.PI * 2);
    g.closePath();
    g.clip();
    g.drawImage(charCfg.customImg, cx - radius, cy - radius, radius * 2, radius * 2);
    g.restore();

    g.strokeStyle = isJumpscare ? '#ff0000' : '#222';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, radius, 0, Math.PI * 2);
    g.stroke();
  } else {
    // Vektorska glava
    g.fillStyle = charCfg.color;
    g.beginPath();
    g.arc(cx, cy, radius, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // Slušalice (svi su streameri!)
    g.strokeStyle = '#181818';
    g.lineWidth = Math.max(4, radius * 0.16);
    g.beginPath();
    g.arc(cx, cy, radius * 1.06, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
    g.fillStyle = '#cc2222';
    g.fillRect(cx - radius * 1.16, cy - radius * 0.25, radius * 0.22, radius * 0.55);
    g.fillRect(cx + radius * 0.94, cy - radius * 0.25, radius * 0.22, radius * 0.55);

    // Oči (horor animatronik stil)
    const eyeOffX = radius * 0.36;
    const eyeY = cy - radius * 0.14;
    g.fillStyle = isJumpscare ? '#000' : '#111';
    g.beginPath();
    g.arc(cx - eyeOffX, eyeY, radius * 0.24, 0, Math.PI * 2);
    g.arc(cx + eyeOffX, eyeY, radius * 0.24, 0, Math.PI * 2);
    g.fill();

    // Zjenice koje svijetle
    g.fillStyle = isJumpscare ? '#ff2222' : '#ffffff';
    g.beginPath();
    g.arc(cx - eyeOffX, eyeY, radius * 0.09, 0, Math.PI * 2);
    g.arc(cx + eyeOffX, eyeY, radius * 0.09, 0, Math.PI * 2);
    g.fill();

    // Obrve
    g.strokeStyle = '#111';
    g.lineWidth = Math.max(3, radius * 0.1);
    g.beginPath();
    g.moveTo(cx - eyeOffX - radius * 0.2, eyeY - radius * 0.32);
    g.lineTo(cx - eyeOffX + radius * 0.2, eyeY - radius * 0.2);
    g.moveTo(cx + eyeOffX + radius * 0.2, eyeY - radius * 0.32);
    g.lineTo(cx + eyeOffX - radius * 0.2, eyeY - radius * 0.2);
    g.stroke();

    // Usta / Čeljust
    const mouthOpen = isJumpscare ? radius * 0.45 : radius * 0.24;
    g.fillStyle = '#1a0505';
    g.fillRect(cx - radius * 0.45, cy + radius * 0.24, radius * 0.9, mouthOpen);
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    for (let t = -3; t <= 3; t++) {
      const tx = cx + t * (radius * 0.12);
      g.fillStyle = '#eee';
      g.fillRect(tx - 3, cy + radius * 0.24, 5, 6);
    }
  }

  // Šilterica / Šubara / Kuharska kapa
  g.fillStyle = charCfg.hatColor;
  g.fillRect(cx - radius * 0.7, cy - radius * 1.15, radius * 1.4, radius * 0.32);
  g.restore();
}

// ----------------------------------------------------------------------------
// 8. RENDERIRANJE PANORAMSKOG UREDA
// ----------------------------------------------------------------------------
function renderOffice() {
  ctx.save();
  ctx.translate(-state.panX, 0);

  const W = state.officeWidth; // 1800
  const H = canvas.height;     // 720

  // Pozadina zidova i poda ureda
  const wallGrad = ctx.createLinearGradient(0, 0, 0, H);
  wallGrad.addColorStop(0, '#14151c');
  wallGrad.addColorStop(0.72, '#1f2029');
  wallGrad.addColorStop(0.73, '#101014');
  wallGrad.addColorStop(1, '#08080b');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, W, H);

  // Tapete / crveno-crna traka po sredini zida (FNaF stil + balkanski štih)
  ctx.fillStyle = '#4a1212';
  ctx.fillRect(0, 310, W, 38);
  for (let x = 0; x < W; x += 40) {
    ctx.fillStyle = (x / 40) % 2 === 0 ? '#ddd' : '#111';
    ctx.fillRect(x, 310, 20, 12);
    ctx.fillStyle = (x / 40) % 2 === 0 ? '#111' : '#ddd';
    ctx.fillRect(x, 322, 20, 12);
  }

  // --------------------------------------------------------------------------
  // LIJEVA VRATA, PROZOR I PREKIDAČI (x: 110..350)
  // --------------------------------------------------------------------------
  drawDoorwayAndControls(true);

  // --------------------------------------------------------------------------
  // DESNA VRATA, PROZOR I PREKIDAČI (x: 1450..1690)
  // --------------------------------------------------------------------------
  drawDoorwayAndControls(false);

  // --------------------------------------------------------------------------
  // SREDINA UREDA: POSTER S KLIKABILNIM NOSOM (x: 740, y: 75)
  // --------------------------------------------------------------------------
  ctx.fillStyle = '#0d0f14';
  ctx.strokeStyle = '#aa8833';
  ctx.lineWidth = 4;
  ctx.fillRect(730, 65, 340, 215);
  ctx.strokeRect(730, 65, 340, 215);

  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 17px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('★ BALKAN STREAM SQUAD ★', 900, 92);

  // Likovi na posteru
  drawCharacterPortrait(ctx, getCharById('baka'), 805, 165, 34);
  drawCharacterPortrait(ctx, getCharById('mudja'), 900, 155, 42);
  drawCharacterPortrait(ctx, getCharById('choda'), 995, 165, 34);

  // Crveni klaunski nos na srednjem liku (klik na njega radi HONK!)
  const noseScale = state.posterHonkTimer > 0 ? 1.45 : 1.0;
  ctx.fillStyle = '#ff1111';
  ctx.beginPath();
  ctx.arc(900, 158, 8 * noseScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ccc';
  ctx.font = 'bold 12px Courier New';
  ctx.fillText('SLUŽBENI SPONZOR: ĆEVABDŽINICA "KOD MILETA"', 900, 266);

  // Paučina i kablovi po plafonu
  ctx.strokeStyle = '#070709';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(520, 0);
  ctx.quadraticCurveTo(690, 110, 880, 0);
  ctx.moveTo(980, 0);
  ctx.quadraticCurveTo(1180, 95, 1340, 0);
  ctx.stroke();

  // --------------------------------------------------------------------------
  // RADNI STOL S CRT MONITOROM, VENTILATOROM, HEKLANIM MILJEOM I TURSKOM KAVOM
  // --------------------------------------------------------------------------
  // Ploča stola
  ctx.fillStyle = '#2d1c10';
  ctx.strokeStyle = '#180e07';
  ctx.lineWidth = 4;
  ctx.fillRect(510, 470, 780, 250);
  ctx.strokeRect(510, 470, 780, 250);

  // Bakin heklani milje na sredini stola (ispod monitora i kave!)
  ctx.save();
  ctx.translate(900, 505);
  ctx.strokeStyle = '#f2efe6';
  ctx.fillStyle = 'rgba(245, 242, 230, 0.88)';
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const r1 = 155;
    const r2 = 135;
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.28);
    ctx.lineTo(Math.cos(a + Math.PI / 24) * r2, Math.sin(a + Math.PI / 24) * r2 * 0.28);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Stari CRT Monitor na stolu (x: 610, y: 345)
  ctx.fillStyle = '#3a3b3c';
  ctx.strokeStyle = '#191a1c';
  ctx.lineWidth = 3;
  ctx.fillRect(600, 340, 175, 140);
  ctx.strokeRect(600, 340, 175, 140);
  ctx.fillStyle = state.powerOut ? '#050505' : '#122618';
  ctx.fillRect(615, 355, 145, 105);
  if (!state.powerOut) {
    ctx.fillStyle = '#33ff55';
    ctx.font = '11px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('BALKAN-OS v1.9', 624, 376);
    ctx.fillText(`CAM: ${state.currentCam}`, 624, 396);
    ctx.fillText(`BATERIJA: ${Math.ceil(state.power)}%`, 624, 416);
    ctx.fillText('STATUS: AKTIVAN', 624, 436);
  }

  // Stolni ventilator u sredini (x: 900, y: 410)
  ctx.fillStyle = '#222629';
  ctx.fillRect(882, 455, 36, 40);
  ctx.fillRect(855, 488, 90, 14);
  ctx.beginPath();
  ctx.arc(900, 395, 58, 0, Math.PI * 2);
  ctx.fillStyle = '#15171a';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#444';
  ctx.stroke();

  // Lopatice ventilatora koje se vrte
  ctx.save();
  ctx.translate(900, 395);
  if (!state.powerOut) ctx.rotate(state.fanAngle);
  ctx.fillStyle = '#5c646d';
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -28, 12, 24, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Džezva i šalica (fildžan) turske kave s parom (x: 1030, y: 465)
  // Bakrena džezva
  ctx.fillStyle = '#b85d28';
  ctx.beginPath();
  ctx.moveTo(1015, 500);
  ctx.lineTo(1025, 452);
  ctx.lineTo(1055, 452);
  ctx.lineTo(1065, 500);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#331505';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Drška džezve
  ctx.beginPath();
  ctx.moveTo(1022, 460);
  ctx.lineTo(990, 442);
  ctx.stroke();

  // Fildžan (šalica kave)
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.arc(1090, 488, 16, 0, Math.PI);
  ctx.fill();
  ctx.stroke();
  // Para iz kave
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  const steamOffset = Math.sin(Date.now() * 0.005) * 4;
  ctx.moveTo(1090, 470);
  ctx.quadraticCurveTo(1085 + steamOffset, 450, 1092, 432);
  ctx.stroke();

  // Retro crveni telefon za Gazdu Mileta (x: 1175, y: 465)
  ctx.fillStyle = '#991111';
  ctx.fillRect(1145, 462, 78, 38);
  ctx.fillStyle = '#cc2222';
  ctx.fillRect(1135, 448, 98, 16);
  ctx.fillStyle = '#eee';
  ctx.beginPath();
  ctx.arc(1184, 482, 12, 0, Math.PI * 2);
  ctx.fill();

  // Ako je nestalo struje, zamrači cijeli ured!
  if (state.powerOut) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.93)';
    ctx.fillRect(0, 0, W, H);

    // Treperave Muđine oči na lijevim vratima uz Balkanski Toreador
    if (state.powerOutEyesBlink && state.powerOutTimer < 9.5) {
      drawCharacterPortrait(ctx, getCharById('mudja'), 230, 340, 58, true);
    }
  }

  ctx.restore();
}

function drawDoorwayAndControls(isLeft) {
  const doorX = isLeft ? 120 : 1460;
  const doorW = 220;
  const doorY = 95;
  const doorH = 560;

  const winX = isLeft ? 375 : 1285;
  const winW = 135;
  const winY = 175;
  const winH = 235;

  const panelX = isLeft ? 45 : 1705;
  const panelY = 290;

  const lightOn = isLeft ? state.leftLightOn : state.rightLightOn;
  const doorAnim = isLeft ? state.leftDoorAnim : state.rightDoorAnim;

  // Unutrašnjost vrata (hodnik u mraku ili osvijetljen)
  ctx.fillStyle = lightOn ? '#353945' : '#050508';
  ctx.fillRect(doorX, doorY, doorW, doorH);

  // Prozor pored vrata
  ctx.fillStyle = lightOn ? '#2c303a' : '#07070b';
  ctx.fillRect(winX, winY, winW, winH);

  // Ako je upaljeno svjetlo i streamer je pred vratima – prikaži ga!
  if (lightOn && !state.powerOut) {
    if (isLeft && state.entities.baka.loc === 'LEFT_DOOR') {
      drawCharacterPortrait(ctx, getCharById('baka'), doorX + 110, doorY + 240, 68);
      drawCharacterPortrait(ctx, getCharById('baka'), winX + 68, winY + 130, 48);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 15px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('"OTVARAJ, IDE GAS!"', doorX + 110, doorY + 130);
    }
    if (!isLeft && (state.entities.choda.loc === 'RIGHT_DOOR' || state.entities.mudja.loc === 'RIGHT_DOOR')) {
      const chId = state.entities.mudja.loc === 'RIGHT_DOOR' ? 'mudja' : 'choda';
      drawCharacterPortrait(ctx, getCharById(chId), winX + 68, winY + 125, 55);
      drawCharacterPortrait(ctx, getCharById(chId), doorX + 110, doorY + 240, 68);
    }
  }

  // Metalna roletna (spušta se od vrha prema dnu)
  if (doorAnim > 0) {
    const currentH = doorH * doorAnim;
    ctx.fillStyle = '#484d56';
    ctx.fillRect(doorX, doorY, doorW, currentH);

    // Rebra roletne
    ctx.strokeStyle = '#26292e';
    ctx.lineWidth = 3;
    for (let y = doorY + 20; y < doorY + currentH; y += 28) {
      ctx.beginPath();
      ctx.moveTo(doorX, y);
      ctx.lineTo(doorX + doorW, y);
      ctx.stroke();
    }

    // Žuto-crne trake upozorenja na dnu roletne
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(doorX, doorY + currentH - 22, doorW, 22);
  }

  // Okviri vrata i prozora
  ctx.strokeStyle = '#2d313b';
  ctx.lineWidth = 10;
  ctx.strokeRect(doorX, doorY, doorW, doorH);
  ctx.strokeRect(winX, winY, winW, winH);

  // Kontrolni panel s tipkama DOOR i LIGHT
  ctx.fillStyle = '#1b1d24';
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 3;
  ctx.fillRect(panelX, panelY, 58, 155);
  ctx.strokeRect(panelX, panelY, 58, 155);

  // Gumb DOOR (Roletna)
  const doorClosed = isLeft ? state.leftDoorClosed : state.rightDoorClosed;
  ctx.fillStyle = doorClosed ? '#22cc44' : '#cc2222';
  ctx.fillRect(panelX + 9, panelY + 14, 40, 52);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('DOOR', panelX + 29, panelY + 42);
  ctx.fillText(isLeft ? '[A]' : '[D]', panelX + 29, panelY + 56);

  // Gumb LIGHT (Svjetlo)
  ctx.fillStyle = lightOn ? '#ffee55' : '#444b58';
  ctx.fillRect(panelX + 9, panelY + 84, 40, 52);
  ctx.fillStyle = lightOn ? '#000' : '#fff';
  ctx.fillText('LIGHT', panelX + 29, panelY + 112);
  ctx.fillText(isLeft ? '[Z]' : '[C]', panelX + 29, panelY + 126);
}

// ----------------------------------------------------------------------------
// 9. RENDERIRANJE CCTV MONITORA I SVIH 11 KAMERA
// ----------------------------------------------------------------------------
function renderCCTV() {
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#080b0a';
  ctx.fillRect(0, 0, W, H);

  const camId = state.currentCam;

  // --------------------------------------------------------------------------
  // POSEBNA KAMERA: CAM 6 (Kuhinja & Roštilj - VIDEO ISKLJUČEN / SAMO AUDIO)
  // --------------------------------------------------------------------------
  if (camId === '6') {
    // Intenzivni šum jer je video isključen
    for (let i = 0; i < 450; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#222' : '#090909';
      ctx.fillRect(Math.random() * W, Math.random() * H, 45, 4);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('📵 KAMERA ISKLJUČENA - SAMO AUDIO FEED', W * 0.42, H * 0.44);
    ctx.font = '18px Courier New';
    ctx.fillStyle = '#ffaa00';
    ctx.fillText('(Kuhinja & Roštilj kod Mileta)', W * 0.42, H * 0.50);

    const someoneInKitchen = state.entities.choda.loc === '6' || state.entities.mudja.loc === '6';
    if (someoneInKitchen) {
      ctx.fillStyle = '#33ff55';
      ctx.font = 'bold 20px Courier New';
      ctx.fillText('🔊 [ZVEKET LONACA, TANJURA I CVRČANJE ĆEVAPA!]', W * 0.42, H * 0.58);
    } else {
      ctx.fillStyle = '#777';
      ctx.font = '16px Courier New';
      ctx.fillText('🔇 [Tišina u kuhinji...]', W * 0.42, H * 0.58);
    }
  } else {
    // ------------------------------------------------------------------------
    // VIZUALNI PRIKAZ OSTALIH 10 KAMERA
    // ------------------------------------------------------------------------
    drawCameraRoomBackground(camId);
    drawCharactersOnCamera(camId);
  }

  // --------------------------------------------------------------------------
  // MEHANIKA KAZETOFONA / DONACIJSKE TRAKE (uvijek prikazana na CAM 5 + brzi bar)
  // --------------------------------------------------------------------------
  drawTapeMechanicUI();

  // --------------------------------------------------------------------------
  // INTERAKTIVNI TLOCRT SVIH 11 KAMERA (Desni donji kut)
  // --------------------------------------------------------------------------
  drawCCTVMap();

  // Zelena/Bijela CRT statika i okvir kamere
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 90, 2);
  }

  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  // Crvena REC točka i naziv aktivne kamere
  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillStyle = '#ff2222';
    ctx.beginPath();
    ctx.arc(52, 54, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(`REC // ${CAMERAS[camId].name}`, 75, 62);
}

function drawCameraRoomBackground(camId) {
  ctx.save();
  // Osnovna prostorija u perspektivi
  ctx.fillStyle = '#111518';
  ctx.fillRect(0, 0, 900, 720);

  ctx.strokeStyle = '#252d33';
  ctx.lineWidth = 3;
  ctx.strokeRect(120, 90, 660, 460);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(120, 90);
  ctx.moveTo(900, 0); ctx.lineTo(780, 90);
  ctx.moveTo(0, 720); ctx.lineTo(120, 550);
  ctx.moveTo(900, 720); ctx.lineTo(780, 550);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px Courier New';
  ctx.fillStyle = '#55666e';

  switch (camId) {
    case '1A': // Glavni Studio / Bina
      ctx.fillStyle = '#3b1515';
      ctx.fillRect(140, 100, 620, 190);
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('★ GLAVNA STREAMING BINA & HARMONIKA ★', 450, 135);
      break;

    case '1B': // Sala kafane sa stolovima
      for (let i = 0; i < 3; i++) {
        const tx = 200 + i * 210;
        ctx.fillStyle = '#772222';
        ctx.fillRect(tx, 380, 130, 80);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(tx, 380, 130, 80);
      }
      ctx.fillStyle = '#8899aa';
      ctx.fillText('SALA KAFANE - STOLOVI S KARIRANIM STOLNJACIMA', 450, 140);
      break;

    case '1C': // Green Screen Kutak (Omčo i zavjesa u 3 faze)
      ctx.fillStyle = '#115522';
      ctx.fillRect(210, 110, 480, 390);
      ctx.fillStyle = '#662288';
      const st = state.entities.omco.stage;
      if (st === 0) {
        // Zavjesa potpuno zatvorena
        ctx.fillRect(210, 110, 480, 390);
        ctx.fillStyle = '#fff';
        ctx.fillText('ZAVJESA ZATVORENA - "NE OMETAJ SNIMANJE"', 450, 300);
      } else if (st === 1) {
        // Zavjesa malo razmaknuta, Omčo viri
        ctx.fillRect(210, 110, 190, 390);
        ctx.fillRect(500, 110, 190, 390);
        drawCharacterPortrait(ctx, getCharById('omco'), 450, 300, 62);
      } else if (st === 2) {
        // Omčo izašao pred zavjesu, spreman za sprint!
        ctx.fillRect(210, 110, 90, 390);
        ctx.fillRect(600, 110, 90, 390);
        drawCharacterPortrait(ctx, getCharById('omco'), 450, 330, 95, true);
        ctx.fillStyle = '#ff3333';
        ctx.fillText('⚠️ SPREMAN ZA SPRINT!', 450, 165);
      } else {
        // Prazno - TRČI!
        ctx.fillStyle = '#ff2222';
        ctx.font = 'bold 28px Courier New';
        ctx.fillText('⚠️ POBJJJEGAO JE! SPUŠTAJ LIJEVU ROLETNU!', 450, 310);
      }
      break;

    case '2A': // Lijevi hodnik (animacija sprinta!)
      ctx.fillText('LIJEVI HODNIK PREMA UREDU', 450, 130);
      if (state.entities.omco.sprinting) {
        const p = Math.min(1, state.entities.omco.sprintTimer / 1.8);
        const r = 40 + p * 95;
        const y = 220 + p * 180;
        drawCharacterPortrait(ctx, getCharById('omco'), 450, y, r, true);
        ctx.fillStyle = '#ff2222';
        ctx.font = 'bold 26px Courier New';
        ctx.fillText('🏃💨 SPRINTA PREMA LIJEVIM VRATIMA! [A]', 450, 560);
      }
      break;

    case '3': // Špajza s gajbama piva
      for (let g = 0; g < 4; g++) {
        ctx.fillStyle = '#aa7711';
        ctx.fillRect(160 + g * 120, 410, 95, 75);
        ctx.fillStyle = '#fff';
        ctx.fillText('PIVO', 207 + g * 120, 452);
      }
      ctx.fillText('ŠPAJZA S GAJBAMA PIVA I AJVAROM', 450, 135);
      break;

    case '5': // Backstage & Kazetofon
      ctx.fillStyle = '#222830';
      ctx.fillRect(260, 340, 380, 160);
      ctx.fillStyle = '#ffaa00';
      ctx.fillText('📻 STARI KAZETOFON ZA DONACIJE', 450, 375);
      break;

    case '7': // Toaleti kafane
      ctx.fillText('TOALETI KAFANE', 450, 135);
      break;
  }
  ctx.restore();
}

function drawCharactersOnCamera(camId) {
  const present = [];
  ['mudja', 'baka', 'choda'].forEach(id => {
    if (state.entities[id].loc === camId) present.push(id);
  });

  present.forEach((id, index) => {
    const ch = getCharById(id);
    const cx = 310 + index * 165;
    const cy = (camId === '2B' || camId === '4B') ? 340 : 295;
    const rad = (camId === '2B' || camId === '4B') ? 92 : 66;
    drawCharacterPortrait(ctx, ch, cx, cy, rad);

    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 15px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name, cx, cy + rad * 1.9);
  });
}

function drawTapeMechanicUI() {
  const boxX = 45;
  const boxY = 535;
  const boxW = 390;
  const boxH = 115;

  ctx.fillStyle = 'rgba(12, 16, 22, 0.92)';
  ctx.strokeStyle = state.tapeCharge < 30 ? '#ff2222' : '#33ff55';
  ctx.lineWidth = 2;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(`📻 DONACIJSKA TRAKA (${getCharById('puppet').name}): ${Math.ceil(state.tapeCharge)}%`, boxX + 14, boxY + 26);

  // Progress bar trake
  ctx.fillStyle = '#222';
  ctx.fillRect(boxX + 14, boxY + 36, boxW - 28, 18);
  ctx.fillStyle = state.tapeCharge < 30 ? '#ff2222' : '#33ff55';
  ctx.fillRect(boxX + 14, boxY + 36, (boxW - 28) * (state.tapeCharge / 100), 18);

  // Gumb za premotavanje (radi na CAM 5, ili prebacuje na CAM 5 kad se klikne)
  const onCam5 = state.currentCam === '5';
  ctx.fillStyle = onCam5 ? (state.windingTape ? '#ffaa00' : '#1b4d26') : '#333842';
  ctx.fillRect(boxX + 14, boxY + 64, boxW - 28, 38);
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(boxX + 14, boxY + 64, boxW - 28, 38);

  ctx.fillStyle = onCam5 && state.windingTape ? '#000' : '#fff';
  ctx.font = 'bold 13px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(
    onCam5 ? '⏪ DRŽI MIŠ OVDJE: PREMATAJ TRAKU / BACAJ DONACIJU' : '👉 KLIKNI ZA PREBACIVANJE NA CAM 5 (KAZETOFON)',
    boxX + boxW / 2,
    boxY + 88
  );
}

function drawCCTVMap() {
  // Pozadina tlocrta
  ctx.fillStyle = 'rgba(10, 18, 14, 0.85)';
  ctx.strokeStyle = '#33ff55';
  ctx.lineWidth = 2;
  ctx.fillRect(905, 340, 345, 330);
  ctx.strokeRect(905, 340, 345, 330);

  // Centralno označen URED (YOU)
  ctx.fillStyle = '#224429';
  ctx.strokeStyle = '#fff';
  ctx.fillRect(1022, 610, 62, 42);
  ctx.strokeRect(1022, 610, 62, 42);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('URED', 1053, 635);

  // Crtanje svih 11 kamera na tlocrtu
  Object.values(CAMERAS).forEach(cam => {
    const isSelected = state.currentCam === cam.id;
    ctx.fillStyle = isSelected ? '#33ff55' : '#1c2420';
    ctx.strokeStyle = isSelected ? '#fff' : '#33ff55';
    ctx.lineWidth = 2;
    ctx.fillRect(cam.x - 24, cam.y - 14, 48, 28);
    ctx.strokeRect(cam.x - 24, cam.y - 14, 48, 28);

    ctx.fillStyle = isSelected ? '#000' : '#fff';
    ctx.font = 'bold 11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`CAM ${cam.id}`, cam.x, cam.y + 4);
  });
}

// ----------------------------------------------------------------------------
// 10. GLAVNA RENDER PETLJA (Jumpscare, Victory, Game Over, Menu)
// ----------------------------------------------------------------------------
function renderScreen() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.screen === 'MENU') {
    // Pozadinska animacija streamera u sjeni na glavnom meniju
    ctx.fillStyle = '#08080c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const twitchX = Math.random() < 0.08 ? (Math.random() - 0.5) * 18 : 0;
    drawCharacterPortrait(ctx, getCharById('mudja'), 980 + twitchX, 390, 145, Math.random() < 0.05);
    return;
  }

  if (state.screen === 'PLAYING') {
    if (state.camOpen) {
      renderCCTV();
    } else {
      renderOffice();
    }
    return;
  }

  if (state.screen === 'JUMPSCARE') {
    // Ekstremna trešnja ekrana i krik lika
    ctx.fillStyle = Math.floor(state.jumpscareTimer * 28) % 2 === 0 ? '#2b0000' : '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const shakeX = (Math.random() - 0.5) * 48;
    const shakeY = (Math.random() - 0.5) * 48;
    drawCharacterPortrait(ctx, state.jumpscareChar, canvas.width / 2 + shakeX, canvas.height / 2 + shakeY, 210, true);

    ctx.fillStyle = '#ff2222';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`"${state.jumpscareChar.cry}"`, canvas.width / 2, canvas.height - 65);
    return;
  }

  if (state.screen === 'GAMEOVER') {
    ctx.fillStyle = '#070303';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(255, 40, 40, ${Math.random() * 0.14})`;
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 60, 3);
    }

    ctx.fillStyle = '#ff2222';
    ctx.font = 'bold 64px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER // BANOVAN SI', canvas.width / 2, 230);

    ctx.fillStyle = '#eee';
    ctx.font = 'bold 22px Courier New';
    ctx.fillText(state.endReason, canvas.width / 2, 310);

    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 20px Courier New';
    ctx.fillText('[ KLIKNI BILO GDJE ZA POVRATAK NA GLAVNI MENI ]', canvas.width / 2, 470);
    return;
  }

  if (state.screen === 'VICTORY') {
    ctx.fillStyle = '#061209';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#33ff55';
    ctx.font = 'bold 76px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('06:00 AM', canvas.width / 2, 210);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Courier New';
    ctx.fillText('SMJENA USPJEŠNO PREŽIVLJENA!', canvas.width / 2, 285);

    // Ček / Isplata od donacija
    ctx.fillStyle = '#f5eedc';
    ctx.strokeStyle = '#aa8833';
    ctx.lineWidth = 4;
    ctx.fillRect(360, 330, 560, 175);
    ctx.strokeRect(360, 330, 560, 175);

    ctx.fillStyle = '#111';
    ctx.font = 'bold 20px Courier New';
    ctx.fillText('BALKANSKA STREAMING KAFANA D.O.O.', 640, 370);
    ctx.font = '18px Courier New';
    ctx.fillText(`ISPLATA ZA NOĆ ${state.selectedNight}:`, 640, 412);
    ctx.fillStyle = '#157728';
    ctx.font = 'bold 24px Courier New';
    ctx.fillText(state.earnedPay, 640, 452);
    ctx.fillStyle = '#444';
    ctx.font = 'italic 14px Courier New';
    ctx.fillText('Potpis: Gazda Mile', 640, 488);

    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 20px Courier New';
    ctx.fillText('[ KLIKNI ZA NASTAVAK NA SLJEDEĆU NOĆ / MENI ]', canvas.width / 2, 595);
  }
}

// ----------------------------------------------------------------------------
// 11. KONTROLE MIŠA I TIPKOVNICE
// ----------------------------------------------------------------------------
function getCanvasMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

canvas.addEventListener('mousemove', e => {
  const pos = getCanvasMousePos(e);
  state.mouseX = pos.x;
  state.mouseY = pos.y;
});

canvas.addEventListener('mousedown', e => {
  audio.init();
  const pos = getCanvasMousePos(e);

  if (state.screen === 'GAMEOVER') {
    state.screen = 'MENU';
    document.getElementById('menu-screen').classList.remove('hidden');
    return;
  }

  if (state.screen === 'VICTORY') {
    if (state.selectedNight < 5) state.selectedNight++;
    document.querySelectorAll('.night-pill').forEach(p => {
      p.classList.toggle('active', +p.dataset.night === state.selectedNight);
    });
    document.getElementById('btn-start-night').textContent = `▶ POKRENI SMJENU (NOĆ ${state.selectedNight})`;
    state.screen = 'MENU';
    document.getElementById('menu-screen').classList.remove('hidden');
    return;
  }

  if (state.screen !== 'PLAYING') return;

  if (state.camOpen) {
    // Provjeri klik na gumb kazetofona (CAM 5)
    if (pos.x >= 59 && pos.x <= 421 && pos.y >= 599 && pos.y <= 637) {
      if (state.currentCam !== '5') {
        state.currentCam = '5';
        audio.playCamBlip();
      } else {
        state.windingTape = true;
      }
      return;
    }

    // Provjeri klik na kamere na tlocrtu
    for (const cam of Object.values(CAMERAS)) {
      if (pos.x >= cam.x - 26 && pos.x <= cam.x + 26 && pos.y >= cam.y - 16 && pos.y <= cam.y + 16) {
        state.currentCam = cam.id;
        state.windingTape = false;
        audio.playCamBlip();
        return;
      }
    }
  } else {
    // U uredu: prilagodi klik za panoramski pomak (worldX)
    const worldX = pos.x + state.panX;
    const worldY = pos.y;

    // 1. Klik na nos na posteru ("HONK" Easter Egg!)
    if (Math.hypot(worldX - 900, worldY - 158) <= 28) {
      state.posterHonkTimer = 0.25;
      audio.playHonk();
      return;
    }

    // 2. Lijevi panel (DOOR & LIGHT)
    if (worldX >= 45 && worldX <= 103 && worldY >= 304 && worldY <= 356) {
      toggleLeftDoor();
      return;
    }
    if (worldX >= 45 && worldX <= 103 && worldY >= 374 && worldY <= 426) {
      toggleLeftLight();
      return;
    }

    // 3. Desni panel (DOOR & LIGHT)
    if (worldX >= 1705 && worldX <= 1763 && worldY >= 304 && worldY <= 356) {
      toggleRightDoor();
      return;
    }
    if (worldX >= 1705 && worldX <= 1763 && worldY >= 374 && worldY <= 426) {
      toggleRightLight();
      return;
    }
  }
});

window.addEventListener('mouseup', () => {
  state.windingTape = false;
});

window.addEventListener('keydown', e => {
  if (state.screen !== 'PLAYING') return;
  const key = e.key.toLowerCase();

  if (e.code === 'Space') {
    e.preventDefault();
    toggleCameraMonitor();
  } else if (key === 'a') {
    toggleLeftDoor();
  } else if (key === 'd') {
    toggleRightDoor();
  } else if (key === 'z') {
    toggleLeftLight();
  } else if (key === 'c') {
    toggleRightLight();
  } else if (['1', '2', '3', '4', '5', '6'].includes(key)) {
    const found = Object.values(CAMERAS).find(c => c.key === key);
    if (found) {
      if (!state.camOpen) state.camOpen = true;
      state.currentCam = found.id;
      audio.playCamBlip();
    }
  }
});

// ----------------------------------------------------------------------------
// 12. POKRETANJE GLAVNE PETLJE IGRE
// ----------------------------------------------------------------------------
let lastTimestamp = performance.now();
function gameLoop(timestamp) {
  const dt = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;

  updateGame(dt);
  renderScreen();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
