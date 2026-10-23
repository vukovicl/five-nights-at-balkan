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

  // Foxy sprint krik pri kretanju u trk
  playFoxySprintCry() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.16);
    osc.frequency.linearRampToValueAtTime(170, now + 0.52);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    osc.connect(gain);
    if (panner) {
      panner.pan.setValueAtTime(-0.85, now);
      gain.connect(panner);
      panner.connect(this.ctx.destination);
    } else {
      gain.connect(this.ctx.destination);
    }
    osc.start(now);
    osc.stop(now + 0.62);
  }

  // Pojedinacni ritmicki teški korak sprinta kroz hodnik s lijevom stereo panoramom
  playSprintStep(progress = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95 + progress * 55, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.08);

    const vol = 0.28 + progress * 0.45;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    if (panner) {
      panner.pan.setValueAtTime(-0.85 + progress * 0.4, now);
      gain.connect(panner);
      panner.connect(this.ctx.destination);
    } else {
      gain.connect(this.ctx.destination);
    }
    osc.start(now);
    osc.stop(now + 0.1);
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
    omco:  { stage: 0, progress: 0, sprinting: false, sprintTimer: 0, stepTimer: 0 }, // 0: zavjesa, 1: viri, 2: vani, 3: SPRINT!
    puppet: { released: false, attackTimer: 0 }
  },

  // Efekti tresnje i iskri pri udarcu Foxyja u vrata
  officeShake: 0,
  doorSparks: [],
  doorImpactNotice: '',
  doorImpactNoticeTimer: 0,

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

const btnFoxyTest = document.getElementById('btn-foxy-test');
if (btnFoxyTest) {
  btnFoxyTest.addEventListener('click', () => {
    triggerFoxySprintTest();
  });
}

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
    omco:   { stage: 0, progress: 0, sprinting: false, sprintTimer: 0, stepTimer: 0 },
    puppet: { released: false, attackTimer: 0 }
  };
  state.officeShake = 0;
  state.doorSparks = [];
  state.doorImpactNotice = '';
  state.doorImpactNoticeTimer = 0;

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

  // Prigušenje trešnje ureda i obavijesti o udarcu
  if (state.officeShake > 0) {
    state.officeShake = Math.max(0, state.officeShake - dt * 2.8);
  }
  if (state.doorImpactNoticeTimer > 0) {
    state.doorImpactNoticeTimer = Math.max(0, state.doorImpactNoticeTimer - dt);
  }

  // Fizika iskri od udarca na vratima
  if (state.doorSparks && state.doorSparks.length > 0) {
    for (let i = state.doorSparks.length - 1; i >= 0; i--) {
      const sp = state.doorSparks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vy += 620 * dt;
      sp.life -= dt;
      if (sp.life <= 0) state.doorSparks.splice(i, 1);
    }
  }

  // --------------------------------------------------------------------------
  // AI 2: OMČO (Foxy tip - Green Screen CAM 1C -> Sprint CAM 2A -> Lijeva vrata)
  // --------------------------------------------------------------------------
  const omcoAI = getCharById('omco').aiLevel;
  const omcoEnt = state.entities.omco;
  if (omcoAI > 0 || omcoEnt.sprinting) {
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
          omcoEnt.stepTimer = 0;
          audio.playFoxySprintCry();
          audio.playFootsteps(true);
        }
      }
    } else {
      // Omčo trči kroz lijevi hodnik!
      omcoEnt.sprintTimer += dt;
      const sprintLimit = 2.25;

      // Ritmički koraci tijekom sprinta
      omcoEnt.stepTimer = (omcoEnt.stepTimer || 0) + dt;
      const stepInterval = Math.max(0.08, 0.14 - (omcoEnt.sprintTimer / sprintLimit) * 0.05);
      if (omcoEnt.stepTimer >= stepInterval) {
        omcoEnt.stepTimer = 0;
        audio.playSprintStep(omcoEnt.sprintTimer / sprintLimit);
      }

      if (omcoEnt.sprintTimer >= sprintLimit) {
        if (state.leftDoorClosed) {
          // Odbio se od zatvorena vrata!
          audio.playDoorBang();
          state.power = Math.max(0, state.power - 3.5);
          omcoEnt.sprinting = false;
          omcoEnt.stage = 0;
          omcoEnt.progress = Math.random() * 20;
          state.officeShake = 1.0;
          state.doorImpactNoticeTimer = 2.5;
          state.doorImpactNotice = '⚡ OMČO JE UDARIO U LIJEVA VRATA! (-3.5% STRUJE)';
          spawnDoorSparks(230, 320, 32);
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

  // Efekt tresnje ureda pri udarcu Foxyja u metalna vrata
  let offX = -state.panX;
  let offY = 0;
  if (state.officeShake > 0) {
    offX += (Math.random() - 0.5) * state.officeShake * 22;
    offY += (Math.random() - 0.5) * state.officeShake * 18;
  }
  ctx.translate(offX, offY);

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

  // Renderiranje iskri od udarca u metalna lijeva vrata
  if (state.doorSparks && state.doorSparks.length > 0) {
    state.doorSparks.forEach(sp => {
      const alpha = Math.max(0, sp.life / sp.maxLife);
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(sp.x, sp.y, sp.size, sp.size);
      ctx.globalAlpha = 1.0;
    });
  }

  // Obavijest na vrhu ekrana u uredu
  if (state.doorImpactNoticeTimer > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 0, 0, 0.88)';
    ctx.fillRect(state.panX + canvas.width / 2 - 280, 75, 560, 42);
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 2;
    ctx.strokeRect(state.panX + canvas.width / 2 - 280, 75, 560, 42);
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 15px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(state.doorImpactNotice, state.panX + canvas.width / 2, 102);
    ctx.restore();
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

  // Efekt sprinta kroz lijevi prozor dok Omco juri hodnikom
  if (isLeft && state.entities.omco.sprinting) {
    const p = Math.min(1.0, state.entities.omco.sprintTimer / 2.25);
    const flashAlpha = 0.22 + 0.35 * Math.abs(Math.sin(state.entities.omco.sprintTimer * 24));
    ctx.fillStyle = `rgba(255, 30, 30, ${flashAlpha})`;
    ctx.fillRect(winX, winY, winW, winH);

    // Silueta Omce koja projuri pored prozora pred sama vrata (p >= 0.65)
    if (p >= 0.65) {
      const winProg = (p - 0.65) / 0.35;
      const silX = (winX + winW) - winProg * (winW + 70);
      drawFoxySilhouette(ctx, silX, winY + 95, 46);
    }
  }

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
  // VIZUALNI 3D PERSPEKTIVNI PRIKAZ SVIH 11 KAMERA
  // --------------------------------------------------------------------------
  drawCameraRoomBackground(camId);
  drawCharactersOnCamera(camId);

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

// ----------------------------------------------------------------------------
// 3D PERSPEKTIVNE POZICIJE LIKOVA PO SOBAMA
// ----------------------------------------------------------------------------
const ROOM_SLOTS_3D = {
  '1A': [ // Show Stage: fiksni raspored trija na drvenoj bini
    { id: 'mudja', x: 450, y: 350, r: 84 },
    { id: 'baka',  x: 295, y: 365, r: 76 },
    { id: 'choda', x: 605, y: 365, r: 76 }
  ],
  '1B': [ // Sala kafane: stolovi i prolazi u perspektivi
    { x: 285, y: 390, r: 70 },
    { x: 450, y: 340, r: 58 },
    { x: 615, y: 390, r: 70 }
  ],
  '2A': [ // Lijevi hodnik kad Baka vreba
    { x: 450, y: 380, r: 80 }
  ],
  '2B': [ // Lijevi slijepi kut - ekstremni krupni plan pred vratima!
    { x: 390, y: 390, r: 125 }
  ],
  '3': [ // Špajza s pivom - stoji pod njihajućom žaruljom
    { x: 450, y: 405, r: 86 }
  ],
  '4A': [ // Desni hodnik
    { x: 430, y: 345, r: 58 },
    { x: 535, y: 425, r: 86 }
  ],
  '4B': [ // Desni kut - krupni plan pred desnim vratima ureda
    { x: 510, y: 390, r: 125 }
  ],
  '7': [ // Toaleti kafane
    { x: 355, y: 375, r: 74 },
    { x: 555, y: 365, r: 72 }
  ]
};

function drawCameraRoomBackground(camId) {
  switch (camId) {
    case '1A': drawStageCAM1A(ctx); break;
    case '1B': drawDiningHallCAM1B(ctx); break;
    case '1C': drawGreenScreenCAM1C(ctx, getCharById('omco'), state.entities.omco); break;
    case '2A': drawWestHallwayCAM2A(ctx, getCharById('omco'), state.entities.omco); break;
    case '2B': drawWestCornerCAM2B(ctx); break;
    case '3':  drawSupplyClosetCAM3(ctx); break;
    case '4A': drawEastHallwayCAM4A(ctx); break;
    case '4B': drawEastCornerCAM4B(ctx); break;
    case '5':  drawBackstageCAM5(ctx); break;
    case '6':  drawKitchenCAM6(ctx, state.entities.choda.loc === '6' || state.entities.mudja.loc === '6'); break;
    case '7':  drawRestroomsCAM7(ctx); break;
    default:
      ctx.fillStyle = '#0a0d10';
      ctx.fillRect(0, 0, 900, 720);
      break;
  }
}

function drawCharactersOnCamera(camId) {
  // 1C, 5 i 6 imaju integrirano 3D renderiranje likova
  if (camId === '1C' || camId === '5' || camId === '6') return;

  const present = [];
  ['mudja', 'baka', 'choda'].forEach(id => {
    if (state.entities[id].loc === camId) present.push(id);
  });
  if (present.length === 0) return;

  if (camId === '1A') {
    // Glavna bina - svaki streamer ima svoje fiksno mjesto
    present.forEach(id => {
      const ch = getCharById(id);
      const slot = ROOM_SLOTS_3D['1A'].find(s => s.id === id);
      if (!slot) return;

      // 3D sjena na podu bine
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.ellipse(slot.x, slot.y + slot.r * 1.05, slot.r * 0.85, slot.r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawCharacterPortrait(ctx, ch, slot.x, slot.y, slot.r);

      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 15px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(ch.name, slot.x, slot.y + slot.r * 1.8);
    });
    return;
  }

  // Ostale prostorije s 3D perspective slotovima
  const slots = ROOM_SLOTS_3D[camId] || [{ x: 450, y: 350, r: 75 }];
  present.forEach((id, index) => {
    const ch = getCharById(id);
    const slot = slots[Math.min(index, slots.length - 1)];

    // 3D sjena na podu
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    ctx.ellipse(slot.x, slot.y + slot.r * 1.05, slot.r * 0.85, slot.r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawCharacterPortrait(ctx, ch, slot.x, slot.y, slot.r);

    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 15px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name, slot.x, slot.y + slot.r * 1.85);
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
  } else if (key === 'f') {
    triggerFoxySprintTest();
  } else if (['1', '2', '3', '4', '5', '6'].includes(key)) {
    const found = Object.values(CAMERAS).find(c => c.key === key);
    if (found) {
      if (!state.camOpen) state.camOpen = true;
      state.currentCam = found.id;
      audio.playCamBlip();
    }
  }
});



// ============================================================================
// 3D PERSPEKTIVNE PROSTORIJE (SVIH 11 KAMERA)
// ============================================================================

// 1. CAM 1A: GLAVNI STUDIO / BINA (SHOW STAGE)
function drawStageCAM1A(ctx) {
  const W = 900, H = 720;
  const vx = 450, vy = 230;

  ctx.save();
  ctx.fillStyle = '#080507';
  ctx.fillRect(0, 0, W, H);

  // Stražnji zid bine
  ctx.fillStyle = '#14080b';
  ctx.fillRect(180, 80, 540, 240);

  // Zlatni natpis bine i svjetlucave zvijezde
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 22px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('★ BALKAN SHOW STAGE // KAFANA LIVE ★', vx, 115);

  const starTwinkle = Math.sin(Date.now() * 0.006);
  ctx.fillStyle = starTwinkle > 0 ? '#ffea77' : '#aa8800';
  ctx.font = '16px Courier New';
  ctx.fillText('★ ★ ★ MUĐA, BAKA & CHODA ★ ★ ★', vx, 142);

  // Crveni baršunasti zastori na bokovima
  const drawCurtainFolds = (startX, endX, isLeft) => {
    const width = Math.abs(endX - startX);
    ctx.fillStyle = '#4a0c16';
    ctx.fillRect(isLeft ? startX : startX - width, 0, width, H);
    // Nabori zastora
    ctx.strokeStyle = '#2d060c';
    ctx.lineWidth = 5;
    for (let x = Math.min(startX, endX) + 12; x < Math.max(startX, endX); x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x + (isLeft ? 8 : -8), 360, x, H);
      ctx.stroke();
    }
    // Zlatni obrub
    ctx.strokeStyle = '#c99e28';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(isLeft ? endX : startX, 0);
    ctx.lineTo(isLeft ? endX : startX, H);
    ctx.stroke();
  };
  drawCurtainFolds(0, 160, true);
  drawCurtainFolds(900, 740, false);

  // Gornji ukrasni nabor zastora
  ctx.fillStyle = '#5a0f1b';
  ctx.beginPath();
  ctx.moveTo(160, 0);
  ctx.quadraticCurveTo(450, 70, 740, 0);
  ctx.lineTo(740, 0);
  ctx.lineTo(160, 0);
  ctx.closePath();
  ctx.fill();

  // 3D DRVENA BINA U PERSPEKTIVI
  const stageTopY = 320;
  const stageFrontY = 510;
  const stageFrontH = 140;

  // Površina drvenog poda bine
  const stageFloorPoly = new Path2D();
  stageFloorPoly.moveTo(220, stageTopY);
  stageFloorPoly.lineTo(680, stageTopY);
  stageFloorPoly.lineTo(840, stageFrontY);
  stageFloorPoly.lineTo(60, stageFrontY);
  stageFloorPoly.closePath();

  ctx.save();
  ctx.clip(stageFloorPoly);
  ctx.fillStyle = '#3a2012';
  ctx.fillRect(0, stageTopY, W, stageFrontY - stageTopY);

  // Drvene daske u perspektivi
  const numPlanks = 9;
  for (let p = 0; p < numPlanks; p++) {
    const t0 = Math.pow(p / numPlanks, 1.4);
    const t1 = Math.pow((p + 1) / numPlanks, 1.4);
    const y0 = stageTopY + (stageFrontY - stageTopY) * t0;
    const y1 = stageTopY + (stageFrontY - stageTopY) * t1;

    ctx.fillStyle = p % 2 === 0 ? '#452615' : '#331b0e';
    ctx.fillRect(0, y0, W, y1 - y0);
    ctx.strokeStyle = '#201007';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, y0, W, y1 - y0);
  }
  ctx.restore();

  // Prednja vertikalna fronta bine
  ctx.fillStyle = '#221108';
  ctx.fillRect(60, stageFrontY, 780, stageFrontH);
  ctx.strokeStyle = '#110804';
  ctx.lineWidth = 3;
  for (let x = 60; x <= 840; x += 35) {
    ctx.beginPath();
    ctx.moveTo(x, stageFrontY);
    ctx.lineTo(x, stageFrontY + stageFrontH);
    ctx.stroke();
  }
  // Zlatna lajsna na vrhu i dnu fronte bine
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(55, stageFrontY - 6, 790, 8);
  ctx.fillRect(55, stageFrontY + stageFrontH - 6, 790, 8);

  // 3 Konusna reflektora koja osvjetljavaju 3 pozicije izvođača
  const drawSpotlightCone = (floorX, floorY, color) => {
    ctx.save();
    const cone = ctx.createRadialGradient(floorX, floorY, 15, floorX, floorY, 130);
    cone.addColorStop(0, color);
    cone.addColorStop(0.7, color.replace('0.35', '0.12'));
    cone.addColorStop(1, 'transparent');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.ellipse(floorX, floorY, 130, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  drawSpotlightCone(295, 410, 'rgba(255, 180, 50, 0.35)'); // Baka
  drawSpotlightCone(450, 395, 'rgba(255, 230, 160, 0.42)'); // Muđa
  drawSpotlightCone(605, 410, 'rgba(255, 200, 60, 0.35)'); // Choda

  // Scenski rekviziti: Pojačala, zvučnici i harmonika
  // Lijevo koncertno pojačalo
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(90, 410, 68, 95);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(90, 410, 68, 95);
  ctx.fillStyle = '#ff2222';
  ctx.beginPath();
  ctx.arc(105, 422, 3, 0, Math.PI * 2);
  ctx.fill();

  // Balkan harmonika naslonjena na lijevo pojačalo
  ctx.fillStyle = '#aa1122';
  ctx.fillRect(155, 435, 48, 65);
  ctx.fillStyle = '#fff';
  for (let k = 0; k < 6; k++) {
    ctx.fillRect(158 + k * 7, 472, 5, 22);
    if (k < 5) {
      ctx.fillStyle = '#000';
      ctx.fillRect(162 + k * 7, 472, 3, 13);
      ctx.fillStyle = '#fff';
    }
  }
  // Mjeh harmonike
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 2;
  for (let m = 0; m < 5; m++) {
    ctx.strokeRect(162 + m * 5, 442, 4, 24);
  }

  // Desni scenski monitor zvučnik (wedge)
  ctx.fillStyle = '#181818';
  ctx.beginPath();
  ctx.moveTo(710, 500);
  ctx.lineTo(765, 460);
  ctx.lineTo(795, 495);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.stroke();

  // Statični mikrofoni na stalcima
  const drawMicStand = (x, y) => {
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 40); ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = '#bbb';
    ctx.beginPath();
    ctx.arc(x, y - 4, 6, 0, Math.PI * 2);
    ctx.fill();
  };
  // Prikazuj mikrofone ako lik nije na poziciji
  if (state.entities.baka.loc !== '1A') drawMicStand(295, 360);
  if (state.entities.mudja.loc !== '1A') drawMicStand(450, 340);
  if (state.entities.choda.loc !== '1A') drawMicStand(605, 360);

  ctx.restore();
}

// 2. CAM 1B: SALA KAFANE SA STOLOVIMA (DINING HALL)
function drawDiningHallCAM1B(ctx) {
  const W = 900, H = 720;
  const vx = 450, vy = 265;

  ctx.save();
  ctx.fillStyle = '#09080a';
  ctx.fillRect(0, 0, W, H);

  // Stražnji zid sa svodom prema bini
  ctx.fillStyle = '#141217';
  ctx.fillRect(220, 110, 460, 200);

  // Zidovi od cigle i drvene obloge
  const leftGrad = ctx.createLinearGradient(0, 0, 220, 0);
  leftGrad.addColorStop(0, '#211816');
  leftGrad.addColorStop(1, '#110c0b');
  ctx.fillStyle = leftGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(220, 110);
  ctx.lineTo(220, 310); ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  const rightGrad = ctx.createLinearGradient(W, 0, 680, 0);
  rightGrad.addColorStop(0, '#211816');
  rightGrad.addColorStop(1, '#110c0b');
  ctx.fillStyle = rightGrad;
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(680, 110);
  ctx.lineTo(680, 310); ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Uokvirene slike na lijevom zidu
  ctx.fillStyle = '#3d2c1e';
  ctx.fillRect(60, 210, 75, 55);
  ctx.fillStyle = '#aa8855';
  ctx.fillRect(65, 215, 65, 45);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px Courier New';
  ctx.fillText('JANJETINA', 97, 242);

  // Zidne svjetiljke (baklje/fenjeri)
  const drawLantern = (x, y) => {
    ctx.fillStyle = '#e89c38';
    ctx.shadowColor = '#ffaa33';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };
  drawLantern(180, 210);
  drawLantern(720, 210);

  // Karirani pod kafane u 3D perspektivi
  const floorTopY = 310;
  const floorPoly = new Path2D();
  floorPoly.moveTo(220, floorTopY);
  floorPoly.lineTo(680, floorTopY);
  floorPoly.lineTo(W, H);
  floorPoly.lineTo(0, H);
  floorPoly.closePath();

  ctx.save();
  ctx.clip(floorPoly);
  ctx.fillStyle = '#161012';
  ctx.fillRect(0, floorTopY, W, H - floorTopY);

  const numRows = 12;
  const numCols = 8;
  for (let r = 0; r < numRows; r++) {
    const t0 = Math.pow(r / numRows, 2.0);
    const t1 = Math.pow((r + 1) / numRows, 2.0);
    const y0 = floorTopY + (H - floorTopY) * t0;
    const y1 = floorTopY + (H - floorTopY) * t1;

    const rowLX0 = 220 * (1 - t0);
    const rowRX0 = 680 + (W - 680) * t0;
    const rowLX1 = 220 * (1 - t1);
    const rowRX1 = 680 + (W - 680) * t1;

    for (let c = 0; c < numCols; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = '#5c1920'; // Tradicionalna kafanska crvena pločica
        ctx.beginPath();
        ctx.moveTo(rowLX0 + (rowRX0 - rowLX0) * (c / numCols), y0);
        ctx.lineTo(rowLX0 + (rowRX0 - rowLX0) * ((c + 1) / numCols), y0);
        ctx.lineTo(rowLX1 + (rowRX1 - rowLX1) * ((c + 1) / numCols), y1);
        ctx.lineTo(rowLX1 + (rowRX1 - rowLX1) * (c / numCols), y1);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // 3D OKRUGLI STOLOVI S KARIRANIM STOLNJACIMA
  const drawDiningTable = (cx, cy, radius, scale) => {
    // Sjena stola na podu
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius * 0.9, radius * 1.15, radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stolice u pozadini
    ctx.fillStyle = '#3b2214';
    ctx.fillRect(cx - radius * 0.8, cy - radius * 0.9, radius * 0.35, radius * 0.65);
    ctx.fillRect(cx + radius * 0.45, cy - radius * 0.9, radius * 0.35, radius * 0.65);

    // Spušteni rub kariranog stolnjaka
    ctx.fillStyle = '#8f1d24';
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius * 0.4, radius * 0.95, radius * 0.6, 0, 0, Math.PI);
    ctx.fill();

    // Gornja ploha stola sa stolnjakom
    ctx.fillStyle = '#f2ebe4';
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crveno-bijeli karirani uzorak stolnjaka
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(180, 20, 30, 0.65)';
    const gridStep = 10 * scale;
    for (let gx = cx - radius; gx <= cx + radius; gx += gridStep * 2) {
      ctx.fillRect(gx, cy - radius, gridStep, radius * 2);
    }
    for (let gy = cy - radius; gy <= cy + radius; gy += gridStep * 2) {
      ctx.fillRect(cx - radius, gy, radius * 2, gridStep);
    }
    ctx.restore();

    // Predmeti na stolu: Svijeća u čaši i boca piva
    ctx.fillStyle = '#c79134';
    ctx.fillRect(cx - 5 * scale, cy - 28 * scale, 9 * scale, 22 * scale);
    ctx.fillStyle = '#225522';
    ctx.fillRect(cx + 12 * scale, cy - 32 * scale, 7 * scale, 26 * scale);
    ctx.restore();
  };

  // Stražnji stolovi (daljina)
  drawDiningTable(320, 370, 38, 0.6);
  drawDiningTable(580, 370, 38, 0.6);

  // Srednji stolovi
  drawDiningTable(240, 465, 58, 0.85);
  drawDiningTable(660, 465, 58, 0.85);

  // Prednji stolovi (krupni plan u dnu ekrana)
  drawDiningTable(180, 600, 84, 1.15);
  drawDiningTable(720, 600, 84, 1.15);

  // Viseće tvorničke zelene svjetiljke sa stropa
  [280, 450, 620].forEach(lx => {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, 0); ctx.lineTo(lx, 110);
    ctx.stroke();

    ctx.fillStyle = '#1b3b22';
    ctx.beginPath();
    ctx.arc(lx, 115, 20, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Svjetlosni stožac lampe
    const cone = ctx.createRadialGradient(lx, 120, 10, lx, 320, 190);
    cone.addColorStop(0, 'rgba(255, 235, 170, 0.28)');
    cone.addColorStop(1, 'transparent');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(lx, 120);
    ctx.lineTo(lx - 120, 380);
    ctx.lineTo(lx + 120, 380);
    ctx.closePath();
    ctx.fill();
  });

  ctx.restore();
}

// 3. CAM 2B: LIJEVI KUT PRED UREDOM (WEST CORNER)
function drawWestCornerCAM2B(ctx) {
  const W = 900, H = 720;
  const vx = 660, vy = 270;

  ctx.save();
  ctx.fillStyle = '#060709';
  ctx.fillRect(0, 0, W, H);

  // Lijevi zid (glavni armirani beton pred uredom)
  const wallGrad = ctx.createLinearGradient(0, 0, vx, 0);
  wallGrad.addColorStop(0, '#1a1f26');
  wallGrad.addColorStop(1, '#0e1115');
  ctx.fillStyle = wallGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vx, 150);
  ctx.lineTo(vx, 390);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Sigurnosne žuto-crne dijagonalne pruge upozorenja
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 360);
  ctx.lineTo(vx, 310);
  ctx.lineTo(vx, 360);
  ctx.lineTo(0, 420);
  ctx.closePath();
  ctx.clip();
  for (let x = -50; x < vx + 50; x += 32) {
    ctx.fillStyle = (x / 32) % 2 === 0 ? '#ffcc00' : '#111';
    ctx.beginPath();
    ctx.moveTo(x, 280);
    ctx.lineTo(x + 28, 280);
    ctx.lineTo(x - 20, 450);
    ctx.lineTo(x - 48, 450);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Desni hodnik koji bježi iza ugla
  ctx.fillStyle = '#090b0e';
  ctx.beginPath();
  ctx.moveTo(vx, 150);
  ctx.lineTo(W, 80);
  ctx.lineTo(W, 490);
  ctx.lineTo(vx, 390);
  ctx.closePath();
  ctx.fill();

  // Karirani pod s mrljama i kablovima
  const floorPoly = new Path2D();
  floorPoly.moveTo(0, H);
  floorPoly.lineTo(0, 420);
  floorPoly.lineTo(vx, 390);
  floorPoly.lineTo(W, 490);
  floorPoly.lineTo(W, H);
  floorPoly.closePath();

  ctx.save();
  ctx.clip(floorPoly);
  ctx.fillStyle = '#111418';
  ctx.fillRect(0, 390, W, H - 390);
  // Rešetka pločica
  ctx.strokeStyle = '#1d232c';
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 70) {
    ctx.beginPath();
    ctx.moveTo(x, 390); ctx.lineTo(x * 1.6 - 150, H); ctx.stroke();
  }
  for (let y = 390; y < H; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(W, y * 0.95 + 30); ctx.stroke();
  }
  ctx.restore();

  // Prednji lijevi otvor vrata ureda (okvir se vidi na kameri)
  ctx.fillStyle = '#2d333d';
  ctx.fillRect(0, 80, 85, H - 80);
  ctx.strokeStyle = '#12151a';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 80, 85, H - 80);

  // Plakat upozorenja
  ctx.fillStyle = '#eeddbb';
  ctx.fillRect(180, 190, 95, 125);
  ctx.fillStyle = '#990000';
  ctx.font = 'bold 11px Courier New';
  ctx.fillText('PAZI!', 227, 215);
  ctx.fillStyle = '#111';
  ctx.font = '8px Courier New';
  ctx.fillText('LIJEVA VRATA', 227, 238);
  ctx.fillText('UREDA SU', 227, 252);
  ctx.fillText('ODMAH TU!', 227, 266);

  // Viseća žarulja u kavezu koja treperi
  const bulbFlicker = Math.sin(Date.now() * 0.015) > -0.2;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(420, 0); ctx.lineTo(420, 130);
  ctx.stroke();

  ctx.fillStyle = bulbFlicker ? '#ffaa33' : '#443322';
  ctx.shadowColor = bulbFlicker ? '#ff9900' : 'transparent';
  ctx.shadowBlur = bulbFlicker ? 24 : 0;
  ctx.beginPath();
  ctx.arc(420, 135, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

// 4. CAM 3: ŠPAJZA S GAJBAMA PIVA (SUPPLY CLOSET)
function drawSupplyClosetCAM3(ctx) {
  const W = 900, H = 720;
  const vx = 450, vy = 310;

  ctx.save();
  ctx.fillStyle = '#050708';
  ctx.fillRect(0, 0, W, H);

  // Stražnji zid uske špajze
  ctx.fillStyle = '#0e1216';
  ctx.fillRect(340, 160, 220, 240);

  // Cijev sa stropa i kapljica vode
  ctx.strokeStyle = '#4a3319';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(340, 200); ctx.lineTo(560, 200);
  ctx.stroke();

  const dropTime = (Date.now() * 0.4) % 220;
  ctx.fillStyle = '#77ccee';
  ctx.beginPath();
  ctx.arc(450, 205 + dropTime, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Betonski pod s rešetkom odvoda
  const floorPoly = new Path2D();
  floorPoly.moveTo(340, 400);
  floorPoly.lineTo(560, 400);
  floorPoly.lineTo(W, H);
  floorPoly.lineTo(0, H);
  floorPoly.closePath();

  ctx.save();
  ctx.clip(floorPoly);
  ctx.fillStyle = '#181d22';
  ctx.fillRect(0, 400, W, H - 400);
  // Rešetka odvoda
  ctx.fillStyle = '#080a0c';
  ctx.beginPath();
  ctx.ellipse(450, 560, 48, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  for (let l = 415; l <= 485; l += 8) {
    ctx.beginPath();
    ctx.moveTo(l, 545); ctx.lineTo(l, 575); ctx.stroke();
  }
  ctx.restore();

  // Čelične police s gajbama piva i teglama ajvara s obje strane
  const drawShelvingUnit = (isLeft) => {
    const rx = isLeft ? 0 : 620;
    const rw = 280;

    // Stupovi police
    ctx.fillStyle = '#222830';
    ctx.fillRect(isLeft ? 260 : 620, 60, 16, H);
    ctx.fillRect(isLeft ? 50 : 850, 30, 20, H);

    // Vodoravne police
    [240, 360, 480, 600].forEach((sy, idx) => {
      ctx.fillStyle = '#2d3540';
      ctx.fillRect(rx, sy, rw, 14);

      // Gajbe piva na polici
      const crateColors = ['#e6b800', '#228833', '#cc2222', '#e6b800'];
      const crateNames  = ['OŽUJSKO', 'KARLOV', 'JELEN', 'OŽUJSKO'];
      for (let c = 0; c < 2; c++) {
        const cx = isLeft ? (60 + c * 95) : (640 + c * 95);
        ctx.fillStyle = crateColors[(idx + c) % 4];
        ctx.fillRect(cx, sy - 52, 85, 52);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, sy - 52, 85, 52);

        // Grlići boca
        ctx.fillStyle = '#3a2211';
        for (let b = 0; b < 4; b++) {
          ctx.fillRect(cx + 8 + b * 19, sy - 64, 9, 14);
        }

        // Natpis na gajbi
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(crateNames[(idx + c) % 4], cx + 42, sy - 24);
      }

      // Tegle ajvara i kiselih krastavaca na gornjoj polici
      if (idx === 0) {
        for (let j = 0; j < 3; j++) {
          const jx = isLeft ? (80 + j * 50) : (660 + j * 50);
          ctx.fillStyle = j % 2 === 0 ? '#b32400' : '#2b5e28'; // Ajvar ili krastavci
          ctx.fillRect(jx, sy - 34, 28, 34);
          ctx.fillStyle = '#fff';
          ctx.fillRect(jx + 4, sy - 24, 20, 14); // Bijela naljepnica
          ctx.fillStyle = '#eee';
          ctx.fillRect(jx + 2, sy - 40, 24, 7);  // Poklopac
        }
      }
    });
  };
  drawShelvingUnit(true);
  drawShelvingUnit(false);

  // Viseća žarulja koja se lagano njiše u prostoru
  const swingX = Math.sin(Date.now() * 0.002) * 12;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(450, 0);
  ctx.lineTo(450 + swingX, 220);
  ctx.stroke();

  // Svjetleća žarulja
  ctx.fillStyle = '#ffcc44';
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 35;
  ctx.beginPath();
  ctx.arc(450 + swingX, 225, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Stožac svjetla po podu
  const lightCone = ctx.createRadialGradient(450 + swingX, 560, 20, 450 + swingX, 560, 220);
  lightCone.addColorStop(0, 'rgba(255, 210, 100, 0.35)');
  lightCone.addColorStop(1, 'transparent');
  ctx.fillStyle = lightCone;
  ctx.beginPath();
  ctx.ellipse(450 + swingX, 560, 220, 75, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// 5. CAM 4A: DESNI HODNIK (EAST HALLWAY)
function drawEastHallwayCAM4A(ctx) {
  const W = 900, H = 720;
  const vx = 450, vy = 270;

  ctx.save();
  ctx.fillStyle = '#060709';
  ctx.fillRect(0, 0, W, H);

  // Stražnji zid s dvokrilnim vratima za kuhinju
  ctx.fillStyle = '#0f1318';
  ctx.fillRect(360, 180, 180, 180);

  ctx.fillStyle = '#1c242e';
  ctx.fillRect(380, 215, 65, 145);
  ctx.fillRect(455, 215, 65, 145);
  ctx.strokeStyle = '#333f4d';
  ctx.lineWidth = 3;
  ctx.strokeRect(380, 215, 65, 145);
  ctx.strokeRect(455, 215, 65, 145);
  // Prozorčići na vratima
  ctx.fillStyle = '#ffaa33';
  ctx.fillRect(400, 240, 25, 38);
  ctx.fillRect(475, 240, 25, 38);

  // Lijevi zid (ventilacija i instalacije)
  const leftGrad = ctx.createLinearGradient(0, 0, 360, 0);
  leftGrad.addColorStop(0, '#151921');
  leftGrad.addColorStop(1, '#0c0f14');
  ctx.fillStyle = leftGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(360, 180);
  ctx.lineTo(360, 360); ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Velika ventilacijska cijev uzduž lijevog stropa
  ctx.fillStyle = '#2c333d';
  ctx.beginPath();
  ctx.moveTo(0, 45); ctx.lineTo(360, 195);
  ctx.lineTo(360, 225); ctx.lineTo(0, 95);
  ctx.closePath();
  ctx.fill();

  // Desni zid: Zid slave (YouTube Play Buttons i dječji crteži)
  const rightGrad = ctx.createLinearGradient(W, 0, 540, 0);
  rightGrad.addColorStop(0, '#1a1f26');
  rightGrad.addColorStop(1, '#0e1115');
  ctx.fillStyle = rightGrad;
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(540, 180);
  ctx.lineTo(540, 360); ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Silver & Gold Play Button okviri
  const drawPlayButton = (x, y, w, h, isGold) => {
    ctx.fillStyle = isGold ? '#d4af37' : '#c0c0c0';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#050505';
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.fillStyle = isGold ? '#ffd700' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.42, y + h * 0.35);
    ctx.lineTo(x + w * 0.65, y + h * 0.5);
    ctx.lineTo(x + w * 0.42, y + h * 0.65);
    ctx.closePath();
    ctx.fill();
  };
  drawPlayButton(630, 240, 55, 68, true);   // Gold
  drawPlayButton(740, 260, 75, 95, false);  // Silver

  // Dječji crteži s jezivim porukama zalijepljeni na zidu
  ctx.fillStyle = '#fffdf0';
  ctx.fillRect(660, 360, 70, 55);
  ctx.fillStyle = '#cc2222';
  ctx.font = 'bold 9px Courier New';
  ctx.fillText('NEMA STRUJE', 695, 385);
  ctx.fillStyle = '#222';
  ctx.fillText('POMOZI!', 695, 402);

  // Polirani karirani pod u perspektivi
  const floorTopY = 360;
  const floorPoly = new Path2D();
  floorPoly.moveTo(360, floorTopY);
  floorPoly.lineTo(540, floorTopY);
  floorPoly.lineTo(W, H);
  floorPoly.lineTo(0, H);
  floorPoly.closePath();

  ctx.save();
  ctx.clip(floorPoly);
  ctx.fillStyle = '#0e1114';
  ctx.fillRect(0, floorTopY, W, H - floorTopY);

  const numRows = 12;
  const numCols = 8;
  for (let r = 0; r < numRows; r++) {
    const t0 = Math.pow(r / numRows, 2.1);
    const t1 = Math.pow((r + 1) / numRows, 2.1);
    const y0 = floorTopY + (H - floorTopY) * t0;
    const y1 = floorTopY + (H - floorTopY) * t1;

    const rowLX0 = 360 * (1 - t0);
    const rowRX0 = 540 + (W - 540) * t0;
    const rowLX1 = 360 * (1 - t1);
    const rowRX1 = 540 + (W - 540) * t1;

    for (let c = 0; c < numCols; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = '#1c2229';
        ctx.beginPath();
        ctx.moveTo(rowLX0 + (rowRX0 - rowLX0) * (c / numCols), y0);
        ctx.lineTo(rowLX0 + (rowRX0 - rowLX0) * ((c + 1) / numCols), y0);
        ctx.lineTo(rowLX1 + (rowRX1 - rowLX1) * ((c + 1) / numCols), y1);
        ctx.lineTo(rowLX1 + (rowRX1 - rowLX1) * (c / numCols), y1);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // Neonska rasvjeta duž stropa (jedna treperi)
  [0.25, 0.55, 0.85].forEach((t, idx) => {
    const lw = 25 + t * 65;
    const ly = 35 + t * (floorTopY - 180 - 35);
    const flicker = idx === 1 ? Math.sin(Date.now() * 0.02) > 0 : true;
    ctx.fillStyle = flicker ? '#f2fcff' : '#222830';
    ctx.fillRect(vx - lw / 2, ly, lw, 8 + t * 4);
  });

  ctx.restore();
}

// 6. CAM 4B: DESNI KUT PRED UREDOM (EAST CORNER)
function drawEastCornerCAM4B(ctx) {
  const W = 900, H = 720;
  const vx = 240, vy = 270;

  ctx.save();
  ctx.fillStyle = '#050709';
  ctx.fillRect(0, 0, W, H);

  // Desni zid koji vodi ravno pred desna vrata ureda
  const wallGrad = ctx.createLinearGradient(W, 0, vx, 0);
  wallGrad.addColorStop(0, '#1c2129');
  wallGrad.addColorStop(1, '#0e1115');
  ctx.fillStyle = wallGrad;
  ctx.beginPath();
  ctx.moveTo(W, 0);
  ctx.lineTo(vx, 150);
  ctx.lineTo(vx, 390);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Sigurnosna žuto-crna traka
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W, 360);
  ctx.lineTo(vx, 310);
  ctx.lineTo(vx, 360);
  ctx.lineTo(W, 420);
  ctx.closePath();
  ctx.clip();
  for (let x = vx - 50; x < W + 50; x += 32) {
    ctx.fillStyle = (x / 32) % 2 === 0 ? '#ffcc00' : '#111';
    ctx.beginPath();
    ctx.moveTo(x, 280);
    ctx.lineTo(x + 28, 280);
    ctx.lineTo(x + 48, 450);
    ctx.lineTo(x + 20, 450);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Lijevi hodnik koji bježi iza ugla
  ctx.fillStyle = '#080a0c';
  ctx.beginPath();
  ctx.moveTo(vx, 150);
  ctx.lineTo(0, 80);
  ctx.lineTo(0, 490);
  ctx.lineTo(vx, 390);
  ctx.closePath();
  ctx.fill();

  // Karirani pod s perspektivom prema desnim vratima
  const floorPoly = new Path2D();
  floorPoly.moveTo(W, H);
  floorPoly.lineTo(W, 420);
  floorPoly.lineTo(vx, 390);
  floorPoly.lineTo(0, 490);
  floorPoly.lineTo(0, H);
  floorPoly.closePath();

  ctx.save();
  ctx.clip(floorPoly);
  ctx.fillStyle = '#111418';
  ctx.fillRect(0, 390, W, H - 390);
  ctx.strokeStyle = '#1d232c';
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 70) {
    ctx.beginPath();
    ctx.moveTo(x, 390); ctx.lineTo(x * 1.5 - 200, H); ctx.stroke();
  }
  ctx.restore();

  // Prednji desni okvir desnih vrata ureda (vide se na kameri)
  ctx.fillStyle = '#2d333d';
  ctx.fillRect(W - 90, 80, 90, H - 80);
  ctx.strokeStyle = '#12151a';
  ctx.lineWidth = 4;
  ctx.strokeRect(W - 90, 80, 90, H - 80);

  // Vatrogasni aparat na zidu
  ctx.fillStyle = '#cc1111';
  ctx.beginPath();
  ctx.roundRect(580, 220, 34, 90, 10);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(592, 205, 10, 16);
  ctx.fillStyle = '#fff';
  ctx.fillRect(585, 255, 24, 28);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 7px Courier New';
  ctx.fillText('POŽAR', 597, 272);

  // Visokonaponski ormarić
  ctx.fillStyle = '#333b47';
  ctx.fillRect(440, 190, 68, 85);
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 2;
  ctx.strokeRect(440, 190, 68, 85);
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 8px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ 380V ⚡', 474, 215);

  ctx.restore();
}

// 7. CAM 5: BACKSTAGE & KAZETOFON (PUPPET TAPE MEHANIKA)
function drawBackstageCAM5(ctx) {
  const W = 900, H = 720;
  const vx = 450, vy = 250;

  ctx.save();
  ctx.fillStyle = '#08090c';
  ctx.fillRect(0, 0, W, H);

  // Zidovi s piramidalnom zvučnom pjenom
  ctx.fillStyle = '#14181f';
  ctx.fillRect(180, 90, 540, 240);
  // Rešetka zvučne izolacije
  ctx.strokeStyle = '#0e1115';
  ctx.lineWidth = 2;
  for (let x = 180; x < 720; x += 25) {
    ctx.beginPath(); ctx.moveTo(x, 90); ctx.lineTo(x, 330); ctx.stroke();
  }
  for (let y = 90; y < 330; y += 25) {
    ctx.beginPath(); ctx.moveTo(180, y); ctx.lineTo(720, y); ctx.stroke();
  }

  // Veliki koncertni zvučnički stupovi na bokovima
  ctx.fillStyle = '#111';
  ctx.fillRect(40, 180, 110, 290);
  ctx.fillRect(750, 180, 110, 290);
  ctx.fillStyle = '#222';
  for (let s = 0; s < 3; s++) {
    ctx.beginPath(); ctx.arc(95, 230 + s * 85, 34, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(805, 230 + s * 85, 34, 0, Math.PI * 2); ctx.fill();
  }

  // Rezervni dijelovi animatronika na polici u sjeni
  ctx.fillStyle = '#3a2012';
  ctx.fillRect(210, 240, 480, 12);
  ctx.fillStyle = '#666';
  // Prazna glava robota s crnim očnim dupljama
  ctx.beginPath();
  ctx.arc(280, 215, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(274, 212, 5, 0, Math.PI * 2);
  ctx.arc(286, 212, 5, 0, Math.PI * 2);
  ctx.fill();

  // 3D STOL S KAZETOFONOM U PRVOM PLANU
  const tableTopY = 440;
  ctx.fillStyle = '#222832';
  ctx.beginPath();
  ctx.moveTo(160, tableTopY);
  ctx.lineTo(740, tableTopY);
  ctx.lineTo(820, 620);
  ctx.lineTo(80, 620);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#445163';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Prednja fronta stola
  ctx.fillStyle = '#14181f';
  ctx.fillRect(80, 620, 740, 100);

  // RETRO KAZETOFON (BOOMBOX) NA STOLU
  const boxX = 310;
  const boxY = 415;
  const boxW = 280;
  const boxH = 145;

  ctx.fillStyle = '#484f59';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 10);
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Zvučnici kazetofona
  ctx.fillStyle = '#1a1d22';
  ctx.beginPath();
  ctx.arc(boxX + 50, boxY + 75, 38, 0, Math.PI * 2);
  ctx.arc(boxX + boxW - 50, boxY + 75, 38, 0, Math.PI * 2);
  ctx.fill();

  // Prozor kazete sa zupčanicima koji se okreću!
  ctx.fillStyle = '#0a0c0e';
  ctx.fillRect(boxX + 105, boxY + 38, 70, 72);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX + 105, boxY + 38, 70, 72);

  const tapeSpin = state.windingTape ? (Date.now() * 0.035) : (Date.now() * 0.005);
  const drawReel = (rx, ry) => {
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(tapeSpin);
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    for (let sp = 0; sp < 3; sp++) {
      ctx.beginPath();
      ctx.arc(Math.cos(sp * 2.1) * 7, Math.sin(sp * 2.1) * 7, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  drawReel(boxX + 124, boxY + 74);
  drawReel(boxX + 156, boxY + 74);

  // Crveni statusni indikator na kazetofonu
  const tapeWarn = state.tapeCharge < 30;
  ctx.fillStyle = tapeWarn && (Math.sin(Date.now() * 0.015) > 0) ? '#ff2222' : '#33ff55';
  ctx.beginPath();
  ctx.arc(boxX + 140, boxY + 22, 5, 0, Math.PI * 2);
  ctx.fill();

  // PUPPET / TAJNI DONATOR POJAVLJIVANJE IZA STOLA
  if (state.tapeCharge < 55 && !state.entities.puppet.released) {
    const riseProg = Math.min(1.0, (55 - state.tapeCharge) / 45); // 0 do 1
    const pupY = 410 - riseProg * 110;
    const pupR = 52 + riseProg * 35;

    // Bijela maska s ljubičastim suzama
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(vx, pupY, pupR * 0.72, pupR, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Crne prazne oči i suze
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.ellipse(vx - pupR * 0.32, pupY - pupR * 0.15, pupR * 0.18, pupR * 0.28, 0, 0, Math.PI * 2);
    ctx.ellipse(vx + pupR * 0.32, pupY - pupR * 0.15, pupR * 0.18, pupR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ljubičaste pruge suza
    ctx.fillStyle = '#6b1b8a';
    ctx.fillRect(vx - pupR * 0.36, pupY, pupR * 0.1, pupR * 0.7);
    ctx.fillRect(vx + pupR * 0.26, pupY, pupR * 0.1, pupR * 0.7);

    // Crveni ruž / obrazi
    ctx.fillStyle = '#cc1122';
    ctx.beginPath();
    ctx.arc(vx - pupR * 0.48, pupY + pupR * 0.28, pupR * 0.16, 0, Math.PI * 2);
    ctx.arc(vx + pupR * 0.48, pupY + pupR * 0.28, pupR * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Užarene bijele točke u očima kad je kritično (< 20%)
    if (state.tapeCharge < 20) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(vx - pupR * 0.32, pupY - pupR * 0.15, 3, 0, Math.PI * 2);
      ctx.arc(vx + pupR * 0.32, pupY - pupR * 0.15, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  ctx.restore();
}

// 8. CAM 6: KUHINJA & ROŠTILJ (INFRARED NIGHT-VISION 3D KITCHEN)
function drawKitchenCAM6(ctx, someoneInKitchen) {
  const W = 900, H = 720;
  const vx = 450, vy = 270;

  ctx.save();

  // Infracrveni Night-Vision tamnozeleni filter
  ctx.fillStyle = '#030d06';
  ctx.fillRect(0, 0, W, H);

  // Stražnji zid sa zidanim ćevabdžijskim roštiljem
  ctx.fillStyle = '#08170d';
  ctx.fillRect(280, 140, 340, 210);

  // Inox kuhinjski pultovi na lijevoj i desnoj strani u perspektivi
  const drawCounter = (isLeft) => {
    const cx0 = isLeft ? 0 : W;
    const cx1 = isLeft ? 280 : 620;
    ctx.fillStyle = isLeft ? '#0d2b16' : '#0a2412';
    ctx.beginPath();
    ctx.moveTo(cx0, 480);
    ctx.lineTo(cx1, 350);
    ctx.lineTo(cx1, 470);
    ctx.lineTo(cx0, H);
    ctx.closePath();
    ctx.fill();

    // Gornja radna ploha od nehrđajućeg čelika
    ctx.fillStyle = '#154022';
    ctx.beginPath();
    ctx.moveTo(cx0, 430);
    ctx.lineTo(cx1, 320);
    ctx.lineTo(cx1, 350);
    ctx.lineTo(cx0, 480);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#227038';
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  drawCounter(true);
  drawCounter(false);

  // Viseće tave i lonci s metalne rešetke na stropu
  ctx.strokeStyle = '#1b4a27';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(180, 90); ctx.lineTo(720, 90);
  ctx.stroke();

  [240, 340, 560, 660].forEach((px, idx) => {
    ctx.beginPath();
    ctx.moveTo(px, 90); ctx.lineTo(px, 140);
    ctx.stroke();
    ctx.fillStyle = '#0d2b16';
    ctx.beginPath();
    ctx.arc(px, 160, 18 + (idx % 2) * 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // ĆEVABDŽIJSKI ROŠTILJ U SREDINI (UŽARENI UGLJEN I ĆEVAPI)
  const grillX = 330;
  const grillY = 320;
  const grillW = 240;
  const grillH = 110;

  ctx.fillStyle = '#110705';
  ctx.fillRect(grillX, grillY, grillW, grillH);
  ctx.strokeStyle = '#441808';
  ctx.lineWidth = 4;
  ctx.strokeRect(grillX, grillY, grillW, grillH);

  // Užareni ugljen (Orange/Red embers)
  const emberPulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.005);
  ctx.fillStyle = `rgba(255, 60, 10, ${emberPulse * 0.85})`;
  ctx.fillRect(grillX + 10, grillY + 25, grillW - 20, grillH - 35);

  // Rešetka roštilja
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2.5;
  for (let gx = grillX + 16; gx < grillX + grillW - 10; gx += 14) {
    ctx.beginPath();
    ctx.moveTo(gx, grillY + 15); ctx.lineTo(gx, grillY + grillH - 8); ctx.stroke();
  }

  // Ćevapi koji cvrče na roštilju!
  ctx.fillStyle = '#4a2512';
  for (let c = 0; c < 10; c++) {
    const cx = grillX + 22 + (c % 5) * 42;
    const cy = grillY + 35 + Math.floor(c / 5) * 32;
    ctx.beginPath();
    ctx.roundRect(cx, cy, 28, 10, 4);
    ctx.fill();
  }

  // Dim i iskre koje se dižu s roštilja
  for (let s = 0; s < 6; s++) {
    const smokeOffset = ((Date.now() * 0.05 + s * 45) % 160);
    ctx.fillStyle = 'rgba(255, 120, 40, 0.25)';
    ctx.beginPath();
    ctx.arc(grillX + 40 + s * 32, grillY - smokeOffset, 6 + smokeOffset * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // SILUETA LIKA PREKO ROŠTILJA AKO JE U KUHINJI (CHODA ILI MUĐA)
  if (someoneInKitchen) {
    const chId = state.entities.choda.loc === '6' ? 'choda' : 'mudja';
    const ch = getCharById(chId);

    ctx.save();
    // Toplinska / infracrvena fluorescentna silueta
    ctx.fillStyle = '#ffaa33';
    ctx.shadowColor = '#ff5500';
    ctx.shadowBlur = 24;

    // Tijelo
    ctx.beginPath();
    ctx.ellipse(vx, 305, 54, 75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glava
    ctx.beginPath();
    ctx.arc(vx, 205, 44, 0, Math.PI * 2);
    ctx.fill();

    // Užarene oči
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(vx - 14, 198, 5, 0, Math.PI * 2);
    ctx.arc(vx + 14, 198, 5, 0, Math.PI * 2);
    ctx.fill();

    // Hvataljka za ćevape / nož u ruci
    ctx.strokeStyle = '#ffff55';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(vx + 45, 275);
    ctx.lineTo(vx + 85, 345);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();

    // Zvučna notifikacija
    ctx.fillStyle = '#33ff55';
    ctx.font = 'bold 20px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`🔊 [${ch.name.toUpperCase()} CVRČI ĆEVAPE I LUPA LONCIMA!]`, vx, H - 45);
  } else {
    ctx.fillStyle = '#55aa66';
    ctx.font = 'bold 15px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('● INFRACRVENI NIGHT-VISION FEED // KUHINJA PRAZNA', vx, H - 45);
  }

  // Scanlines night-visiona
  ctx.fillStyle = 'rgba(0, 255, 100, 0.04)';
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 2);
  }

  ctx.restore();
}

// 9. CAM 7: TOALETI KAFANE (RESTROOMS)
function drawRestroomsCAM7(ctx) {
  const W = 900, H = 720;
  const vx = 450, vy = 270;

  ctx.save();
  ctx.fillStyle = '#060a08';
  ctx.fillRect(0, 0, W, H);

  // Stražnji zid toaleta
  ctx.fillStyle = '#0d1713';
  ctx.fillRect(320, 160, 260, 200);

  // Prljave bijelo-zelene pločice s fugama na stražnjem zidu
  ctx.strokeStyle = '#08100c';
  ctx.lineWidth = 1.5;
  for (let x = 320; x < 580; x += 26) {
    ctx.beginPath(); ctx.moveTo(x, 160); ctx.lineTo(x, 360); ctx.stroke();
  }
  for (let y = 160; y < 360; y += 26) {
    ctx.beginPath(); ctx.moveTo(320, y); ctx.lineTo(580, y); ctx.stroke();
  }

  // Mokri karirani pod u perspektivi
  const floorTopY = 360;
  const floorPoly = new Path2D();
  floorPoly.moveTo(320, floorTopY);
  floorPoly.lineTo(580, floorTopY);
  floorPoly.lineTo(W, H);
  floorPoly.lineTo(0, H);
  floorPoly.closePath();

  ctx.save();
  ctx.clip(floorPoly);
  ctx.fillStyle = '#0f1a14';
  ctx.fillRect(0, floorTopY, W, H - floorTopY);

  const numRows = 12;
  const numCols = 8;
  for (let r = 0; r < numRows; r++) {
    const t0 = Math.pow(r / numRows, 2.0);
    const t1 = Math.pow((r + 1) / numRows, 2.0);
    const y0 = floorTopY + (H - floorTopY) * t0;
    const y1 = floorTopY + (H - floorTopY) * t1;

    const rowLX0 = 320 * (1 - t0);
    const rowRX0 = 580 + (W - 580) * t0;
    const rowLX1 = 320 * (1 - t1);
    const rowRX1 = 580 + (W - 580) * t1;

    for (let c = 0; c < numCols; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = '#1c3629';
        ctx.beginPath();
        ctx.moveTo(rowLX0 + (rowRX0 - rowLX0) * (c / numCols), y0);
        ctx.lineTo(rowLX0 + (rowRX0 - rowLX0) * ((c + 1) / numCols), y0);
        ctx.lineTo(rowLX1 + (rowRX1 - rowLX1) * ((c + 1) / numCols), y1);
        ctx.lineTo(rowLX1 + (rowRX1 - rowLX1) * (c / numCols), y1);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Vodene lokve na podu
  ctx.fillStyle = 'rgba(100, 255, 180, 0.12)';
  ctx.beginPath();
  ctx.ellipse(450, 520, 110, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // LIJEVA STRANA: 3 WC KABINE U PERSPEKTIVI S GRAFITIMA
  const drawStall = (sx0, sx1, sy0, sy1, label) => {
    ctx.fillStyle = '#3b281c';
    ctx.beginPath();
    ctx.moveTo(sx0, 0); ctx.lineTo(sx1, sy0);
    ctx.lineTo(sx1, sy1); ctx.lineTo(sx0, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1b120c';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Kvaka i indikator
    ctx.fillStyle = '#cc2222';
    ctx.beginPath();
    ctx.arc((sx0 + sx1) / 2, (sy0 + sy1) / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Grafiti
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = 'bold 9px Courier New';
    ctx.fillText(label, (sx0 + sx1) / 2, (sy0 + sy1) / 2 - 35);
  };
  drawStall(0, 150, 80, 480, 'MILE BOG');
  drawStall(150, 240, 120, 410, 'BEŽI!');
  drawStall(240, 320, 160, 360, 'WC 3');

  // DESNA STRANA: UMIVAONICI I NAPUKNUTO OGLEDALO
  ctx.fillStyle = '#112219';
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(580, 160);
  ctx.lineTo(580, 360); ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Veliko napuknuto ogledalo iznad umivaonika
  ctx.fillStyle = '#263b32';
  ctx.beginPath();
  ctx.moveTo(850, 140); ctx.lineTo(620, 190);
  ctx.lineTo(620, 330); ctx.lineTo(850, 380);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#668877';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Paučina pukotina na staklu ogledala
  ctx.strokeStyle = '#aaeedd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(730, 260); ctx.lineTo(690, 220);
  ctx.moveTo(730, 260); ctx.lineTo(790, 230);
  ctx.moveTo(730, 260); ctx.lineTo(740, 320);
  ctx.stroke();

  // Porculanski umivaonici
  [0.35, 0.75].forEach(t => {
    const sinkX = 580 + (W - 580) * t;
    const sinkY = 360 + (H - 360) * t * 0.75;
    ctx.fillStyle = '#e8f0ec';
    ctx.beginPath();
    ctx.ellipse(sinkX - 25, sinkY, 34, 18, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#888';
    ctx.fillRect(sinkX - 28, sinkY - 26, 6, 16); // Slavina
  });

  // Žuti plastični stožac "PAZI: KLIZAV POD" u prvom planu
  ctx.fillStyle = '#e6c300';
  ctx.beginPath();
  ctx.moveTo(480, 520);
  ctx.lineTo(505, 595);
  ctx.lineTo(455, 595);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = 'bold 8px Courier New';
  ctx.fillText('WET FLOOR', 480, 575);

  // Treperava neonska cijev na stropu
  const neonBlink = Math.sin(Date.now() * 0.02) > -0.3;
  ctx.fillStyle = neonBlink ? '#cceeff' : '#1a2924';
  ctx.shadowColor = neonBlink ? '#88ccff' : 'transparent';
  ctx.shadowBlur = neonBlink ? 20 : 0;
  ctx.fillRect(vx - 50, 45, 100, 7);
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ============================================================================
// ANIMACIJA BJEŽANJA / SPRINTA FOXY TIPA (OMČO - CAM 1C & CAM 2A)
// ============================================================================

function triggerFoxySprintTest() {
  if (state.screen !== 'PLAYING') return;
  const omcoEnt = state.entities.omco;
  omcoEnt.stage = 3;
  omcoEnt.sprinting = true;
  omcoEnt.sprintTimer = 0;
  omcoEnt.stepTimer = 0;
  audio.playFoxySprintCry();
  audio.playFootsteps(true);
}

function spawnDoorSparks(x, y, count = 28) {
  if (!state.doorSparks) state.doorSparks = [];
  for (let i = 0; i < count; i++) {
    const angle = (0.15 + Math.random() * 0.7) * Math.PI;
    const speed = 140 + Math.random() * 320;
    state.doorSparks.push({
      x: x + (Math.random() - 0.5) * 45,
      y: y + Math.random() * 60,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 80,
      vy: -Math.sin(angle) * speed * 0.45,
      life: 0.3 + Math.random() * 0.45,
      maxLife: 0.75,
      size: 2.5 + Math.random() * 3.5,
      color: Math.random() > 0.35 ? '#ffee44' : '#ffffff'
    });
  }
}

function drawFoxySilhouette(ctx, x, y, radius) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.35);
  ctx.fillStyle = '#0a0a0e';

  // Glava
  ctx.beginPath();
  ctx.arc(0, -radius * 0.3, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Lisicje uho
  ctx.beginPath();
  ctx.moveTo(-radius * 0.3, -radius * 0.5);
  ctx.lineTo(-radius * 0.7, -radius * 1.1);
  ctx.lineTo(-radius * 0.1, -radius * 0.8);
  ctx.closePath();
  ctx.fill();

  // Otvorena celjust
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.2, radius * 0.45, radius * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crvene uzarene oci
  ctx.fillStyle = '#ff2200';
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(-radius * 0.18, -radius * 0.35, 3.5, 0, Math.PI * 2);
  ctx.arc(radius * 0.18, -radius * 0.35, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawGreenScreenCAM1C(ctx, omcoChar, omcoEnt) {
  const W = 900;
  const H = 720;
  const st = omcoEnt.stage;

  ctx.fillStyle = '#0a100c';
  ctx.fillRect(0, 0, W, H);

  // Zeleno platno
  ctx.fillStyle = '#0d632b';
  ctx.fillRect(170, 90, 560, 420);
  ctx.strokeStyle = '#1b3d24';
  ctx.lineWidth = 4;
  ctx.strokeRect(170, 90, 560, 420);

  // Stativi i softbox rasvjeta
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(195, 510); ctx.lineTo(195, 220);
  ctx.moveTo(705, 510); ctx.lineTo(705, 220);
  ctx.stroke();

  ctx.fillStyle = '#fffae0';
  ctx.fillRect(175, 200, 40, 60);
  ctx.fillRect(685, 200, 40, 60);

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px Courier New';

  if (st === 0) {
    ctx.fillStyle = '#5c1b6e';
    ctx.fillRect(170, 90, 560, 420);
    ctx.strokeStyle = '#3d0e4a';
    ctx.lineWidth = 6;
    for (let x = 200; x < 720; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 90); ctx.lineTo(x, 510); ctx.stroke();
    }
    ctx.fillStyle = '#eedcb2';
    ctx.fillRect(320, 260, 260, 75);
    ctx.strokeStyle = '#664411';
    ctx.lineWidth = 3;
    ctx.strokeRect(320, 260, 260, 75);
    ctx.fillStyle = '#aa1111';
    ctx.font = 'bold 15px Courier New';
    ctx.fillText('NE OMETAJ SNIMANJE!', 450, 292);
    ctx.fillStyle = '#444';
    ctx.font = '12px Courier New';
    ctx.fillText('[ OMCO SPAVA IZA ZAVJESE ]', 450, 316);

  } else if (st === 1) {
    ctx.fillStyle = '#5c1b6e';
    ctx.fillRect(170, 90, 210, 420);
    ctx.fillRect(520, 90, 210, 420);
    drawCharacterPortrait(ctx, omcoChar, 450, 310, 68);
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 18px Courier New';
    ctx.fillText('⚠️ ZAVJESA RAZMAKNUTA - OMCO VIRI!', 450, 140);

  } else if (st === 2) {
    ctx.fillStyle = '#5c1b6e';
    ctx.fillRect(170, 90, 90, 420);
    ctx.fillRect(640, 90, 90, 420);
    drawCharacterPortrait(ctx, omcoChar, 450, 335, 96, true);
    ctx.fillStyle = '#ff2222';
    ctx.font = 'bold 22px Courier New';
    ctx.fillText('🚨 SPREMAN ZA SPRINT! PAZI NA CAM 2A! 🚨', 450, 140);

  } else {
    // Vijorenje zavjese i znak bijega
    const windWiggle = Math.sin(Date.now() / 65) * 35;
    ctx.fillStyle = '#5c1b6e';
    ctx.beginPath();
    ctx.moveTo(170, 90);
    ctx.lineTo(240 + windWiggle, 90);
    ctx.quadraticCurveTo(280 + windWiggle, 300, 200 + windWiggle, 510);
    ctx.lineTo(170, 510);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(730, 90);
    ctx.lineTo(660 - windWiggle, 90);
    ctx.quadraticCurveTo(620 - windWiggle, 300, 700 - windWiggle, 510);
    ctx.lineTo(730, 510);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(370, 470); ctx.lineTo(490, 495);
    ctx.stroke();

    ctx.fillStyle = '#ffe5a3';
    ctx.fillRect(310, 240, 280, 80);
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 4;
    ctx.strokeRect(310, 240, 280, 80);
    ctx.fillStyle = '#ff1111';
    ctx.font = 'bold 20px Courier New';
    ctx.fillText('IT\'S ME // POBJEGAO JE!', 450, 274);
    ctx.font = 'bold 14px Courier New';
    ctx.fillStyle = '#111';
    ctx.fillText('TRCI KROZ CAM 2A PREMA UREDU!', 450, 302);

    ctx.fillStyle = '#ff2222';
    ctx.font = 'bold 24px Courier New';
    ctx.fillText('🏃💨 JURI PREMA LIJEVIM VRATIMA! SPUŠTAJ [A]!', 450, 140);
  }
}

function drawWestHallwayCAM2A(ctx, omcoChar, omcoEnt) {
  const W = 900;
  const H = 720;
  const vx = 450;
  const vy = 265;
  const isSprint = omcoEnt.sprinting;
  const sprintLimit = 2.25;
  const p = isSprint ? Math.min(1.0, omcoEnt.sprintTimer / sprintLimit) : 0;

  ctx.save();

  // Screen shake pri sprintu
  if (isSprint) {
    const shakeAmp = 2.5 + p * 18;
    const sx = (Math.random() - 0.5) * shakeAmp;
    const sy = (Math.random() - 0.5) * shakeAmp;
    ctx.translate(sx, sy);
  }

  // 1. Duboka perspektiva hodnika
  ctx.fillStyle = '#06080b';
  ctx.fillRect(0, 0, W, H);

  // Straznji zid
  const backW = 160;
  const backH = 175;
  const backX = vx - backW / 2;
  const backY = vy - backH / 2;
  ctx.fillStyle = '#10141a';
  ctx.fillRect(backX, backY, backW, backH);

  // Vrata na kraju hodnika
  ctx.fillStyle = '#07090c';
  ctx.fillRect(vx - 35, vy - 45, 70, 132);
  ctx.strokeStyle = '#222933';
  ctx.lineWidth = 3;
  ctx.strokeRect(vx - 35, vy - 45, 70, 132);

  // EXIT znak
  const exitGlow = isSprint && (Math.sin(omcoEnt.sprintTimer * 22) > 0);
  ctx.fillStyle = exitGlow ? '#ff2222' : '#aa1111';
  ctx.fillRect(vx - 28, vy - 65, 56, 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT ➔', vx, vy - 54);

  // 2. Lijevi i desni zidovi
  const leftGrad = ctx.createLinearGradient(0, 0, backX, 0);
  leftGrad.addColorStop(0, '#151921');
  leftGrad.addColorStop(1, '#0c0f14');
  ctx.fillStyle = leftGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(backX, backY);
  ctx.lineTo(backX, backY + backH);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  const rightGrad = ctx.createLinearGradient(W, 0, backX + backW, 0);
  rightGrad.addColorStop(0, '#13171e');
  rightGrad.addColorStop(1, '#0b0d12');
  ctx.fillStyle = rightGrad;
  ctx.beginPath();
  ctx.moveTo(W, 0);
  ctx.lineTo(backX + backW, backY);
  ctx.lineTo(backX + backW, backY + backH);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Strop
  ctx.fillStyle = '#0a0c10';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(backX + backW, backY);
  ctx.lineTo(backX, backY);
  ctx.closePath();
  ctx.fill();

  // 3. Grede i stupovi na zidu
  [0.25, 0.55, 0.85].forEach((t) => {
    const colX = backX * (1 - t);
    const colTopY = backY * (1 - t);
    const colBotY = (backY + backH) + (H - (backY + backH)) * t;
    const beamW = 12 + t * 24;

    ctx.fillStyle = '#1c222b';
    ctx.fillRect(colX, colTopY, beamW, colBotY - colTopY);
    ctx.strokeStyle = '#2d3744';
    ctx.lineWidth = 2;
    ctx.strokeRect(colX, colTopY, beamW, colBotY - colTopY);
  });

  // Plakat na lijevom zidu ("CELEBRATE!")
  const postX = 95;
  const postY = 250;
  const postW = 90;
  const postH = 125;
  ctx.fillStyle = '#dcd5c0';
  ctx.fillRect(postX, postY, postW, postH);
  ctx.fillStyle = '#aa0000';
  ctx.fillRect(postX, postY, postW, 22);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('CELEBRATE!', postX + postW / 2, postY + 15);
  ctx.fillStyle = '#333';
  ctx.fillText('★ BALKAN ★', postX + postW / 2, postY + 50);
  ctx.fillText('STREAMERS', postX + postW / 2, postY + 70);
  ctx.fillStyle = '#ff8800';
  ctx.fillRect(postX + 10, postY + 82, postW - 20, 24);

  // Desni zid - kabeli i kutija
  ctx.strokeStyle = '#08080a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(backX + backW, backY + 40);
  ctx.quadraticCurveTo(620, backY + 110, W, 420);
  ctx.stroke();

  ctx.fillStyle = '#262d36';
  ctx.fillRect(720, 310, 65, 85);
  ctx.strokeStyle = '#3a4552';
  ctx.lineWidth = 2;
  ctx.strokeRect(720, 310, 65, 85);
  ctx.fillStyle = isSprint ? '#ff2222' : '#33ff55';
  ctx.beginPath();
  ctx.arc(740, 330, 4, 0, Math.PI * 2);
  ctx.fill();

  // 4. Karirani pod u perspektivi
  const floorTopY = backY + backH;
  const floorPoly = new Path2D();
  floorPoly.moveTo(backX, floorTopY);
  floorPoly.lineTo(backX + backW, floorTopY);
  floorPoly.lineTo(W, H);
  floorPoly.lineTo(0, H);
  floorPoly.closePath();

  ctx.save();
  ctx.clip(floorPoly);

  ctx.fillStyle = '#0f1216';
  ctx.fillRect(0, floorTopY, W, H - floorTopY);

  const numRows = 14;
  const numCols = 8;
  for (let r = 0; r < numRows; r++) {
    const t0 = Math.pow(r / numRows, 2.1);
    const t1 = Math.pow((r + 1) / numRows, 2.1);
    const y0 = floorTopY + (H - floorTopY) * t0;
    const y1 = floorTopY + (H - floorTopY) * t1;

    const rowLeftX0 = backX * (1 - t0);
    const rowRightX0 = (backX + backW) + (W - (backX + backW)) * t0;
    const rowLeftX1 = backX * (1 - t1);
    const rowRightX1 = (backX + backW) + (W - (backX + backW)) * t1;

    for (let c = 0; c < numCols; c++) {
      if ((r + c) % 2 === 0) {
        const x00 = rowLeftX0 + (rowRightX0 - rowLeftX0) * (c / numCols);
        const x01 = rowLeftX0 + (rowRightX0 - rowLeftX0) * ((c + 1) / numCols);
        const x10 = rowLeftX1 + (rowRightX1 - rowLeftX1) * (c / numCols);
        const x11 = rowLeftX1 + (rowRightX1 - rowLeftX1) * ((c + 1) / numCols);

        ctx.fillStyle = isSprint && (r % 2 === 0) ? '#281216' : '#1c222b';
        ctx.beginPath();
        ctx.moveTo(x00, y0);
        ctx.lineTo(x01, y0);
        ctx.lineTo(x11, y1);
        ctx.lineTo(x10, y1);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Odsjaj poda
  const floorGlow = ctx.createLinearGradient(vx, floorTopY, vx, H);
  floorGlow.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  floorGlow.addColorStop(0.5, isSprint ? 'rgba(255, 30, 30, 0.18)' : 'rgba(100, 255, 180, 0.04)');
  floorGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = floorGlow;
  ctx.fillRect(0, floorTopY, W, H - floorTopY);
  ctx.restore();

  // 5. Neonska rasvjeta i rotirka
  [0.2, 0.5, 0.8].forEach(t => {
    const lightW = 20 + t * 65;
    const lightH = 5 + t * 10;
    const lightY = 40 + t * (backY - 40);
    ctx.fillStyle = isSprint && (Math.sin(omcoEnt.sprintTimer * 26) > 0) ? '#ff4444' : '#e6fff0';
    ctx.fillRect(vx - lightW / 2, lightY, lightW, lightH);
  });

  if (isSprint) {
    const sirenX = 140;
    const sirenY = 160;
    const sirenFlash = Math.sin(omcoEnt.sprintTimer * 24);
    const sirenGrad = ctx.createRadialGradient(sirenX, sirenY, 5, sirenX, sirenY, 140);
    sirenGrad.addColorStop(0, 'rgba(255, 30, 30, 0.7)');
    sirenGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = sirenGrad;
    ctx.beginPath();
    ctx.arc(sirenX, sirenY, 140, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 0, 0, ${0.12 + 0.16 * Math.abs(sirenFlash)})`;
    ctx.fillRect(0, 0, W, H);

    // Brzinske linije
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 2;
    for (let sl = 0; sl < 10; sl++) {
      const angle = (sl / 10) * Math.PI * 2;
      const speedOffset = (omcoEnt.sprintTimer * 850 + sl * 90) % 450;
      const lineLen = 60 + p * 120;
      const lx1 = vx + Math.cos(angle) * speedOffset;
      const ly1 = vy + Math.sin(angle) * (speedOffset * 0.75);
      const lx2 = vx + Math.cos(angle) * (speedOffset + lineLen);
      const ly2 = vy + Math.sin(angle) * ((speedOffset + lineLen) * 0.75);
      ctx.beginPath();
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, ly2);
      ctx.stroke();
    }
  }

  // 6. Animacija Foxy trkaca
  if (isSprint) {
    drawFoxySprinter(ctx, omcoChar, omcoEnt, p, vx, vy, W, H);
  } else {
    ctx.fillStyle = '#33ff55';
    ctx.font = 'bold 16px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('● CAM 2A // LIJEVI HODNIK - MIRNO', vx, 110);
  }

  // 7. VHS Scanlines
  if (isSprint) {
    for (let g = 0; g < 14; g++) {
      const gy = (Math.random() * H);
      const gh = 2 + Math.random() * 8;
      ctx.fillStyle = `rgba(255, 50, 50, ${0.15 + Math.random() * 0.25})`;
      ctx.fillRect(0, gy, W, gh);
    }
    ctx.fillStyle = '#ff2222';
    ctx.font = 'bold 24px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('🚨 UZBUNA: SPRINT KROZ LIJEVI HODNIK! [A] ZA ROLETNU! 🚨', vx, H - 45);
  }

  ctx.restore();
}

function drawFoxySprinter(ctx, omcoChar, omcoEnt, p, vx, vy, W, H) {
  const scale = 0.22 + Math.pow(p, 1.8) * 2.15;
  const runCycle = omcoEnt.sprintTimer * 32;

  const swayX = Math.sin(runCycle) * (26 * scale);
  const runnerX = vx + swayX - (scale * 12);
  const bounceY = Math.abs(Math.sin(runCycle * 2)) * (16 * scale);
  const baseY = (vy + 60) + (H - (vy + 60) - 40) * Math.pow(p, 1.6);
  const runnerY = baseY - bounceY;

  // Motion blur duhovi iza trkaca
  for (let trail = 2; trail >= 1; trail--) {
    const trailP = Math.max(0, p - trail * 0.045);
    const trailScale = 0.22 + Math.pow(trailP, 1.8) * 2.15;
    const trailSway = Math.sin(runCycle - trail * 0.6) * (26 * trailScale);
    const trailX = vx + trailSway - (trailScale * 12);
    const trailBaseY = (vy + 60) + (H - (vy + 60) - 40) * Math.pow(trailP, 1.6);
    const trailBounce = Math.abs(Math.sin((runCycle - trail * 0.6) * 2)) * (16 * trailScale);
    const trailY = trailBaseY - trailBounce;

    ctx.save();
    ctx.globalAlpha = 0.24 / trail;
    renderFoxyFrame(ctx, omcoChar, trailX, trailY, trailScale, runCycle - trail * 0.6, true);
    ctx.restore();
  }

  // Prasina od udarca noge o pod
  if (bounceY < 4 * scale) {
    const dustX = runnerX + (Math.sin(runCycle) > 0 ? -25 * scale : 25 * scale);
    const dustY = runnerY + 68 * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(180, 150, 120, 0.35)';
    ctx.beginPath();
    ctx.arc(dustX, dustY, 14 * scale, 0, Math.PI * 2);
    ctx.arc(dustX + 10 * scale, dustY - 4 * scale, 9 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Glavni model trkaca
  renderFoxyFrame(ctx, omcoChar, runnerX, runnerY, scale, runCycle, false);
}

function renderFoxyFrame(ctx, omcoChar, cx, cy, scale, cycle, isTrail) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const lean = 0.36 + Math.sin(cycle) * 0.08;
  ctx.rotate(lean);

  const stride = Math.sin(cycle);
  const mainColor = isTrail ? '#4a0808' : (omcoChar.color || '#cc3333');
  const metalColor = isTrail ? '#222' : '#777e8a';
  const darkMetal = '#2b3038';

  // 1. Zglobne animatronik noge
  const hipLX = -14;
  const hipLY = 18;
  const lThighAngle = stride * 0.95;
  const lKneeX = hipLX + Math.sin(lThighAngle) * 26;
  const lKneeY = hipLY + Math.cos(lThighAngle) * 26;
  const lShinAngle = lThighAngle - Math.abs(stride) * 0.8;
  const lFootX = lKneeX + Math.sin(lShinAngle) * 28;
  const lFootY = lKneeY + Math.cos(lShinAngle) * 28;

  const hipRX = 14;
  const hipRY = 18;
  const rThighAngle = -stride * 0.95;
  const rKneeX = hipRX + Math.sin(rThighAngle) * 26;
  const rKneeY = hipRY + Math.cos(rThighAngle) * 26;
  const rShinAngle = rThighAngle - Math.abs(-stride) * 0.8;
  const rFootX = rKneeX + Math.sin(rShinAngle) * 28;
  const rFootY = rKneeY + Math.cos(rShinAngle) * 28;

  const drawLeg = (hx, hy, kx, ky, fx, fy, isLeft) => {
    ctx.strokeStyle = isLeft ? mainColor : '#aa2222';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(kx, ky);
    ctx.stroke();

    ctx.fillStyle = metalColor;
    ctx.beginPath();
    ctx.arc(kx, ky, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = metalColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();

    ctx.fillStyle = darkMetal;
    ctx.beginPath();
    ctx.ellipse(fx + 6, fy, 10, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
  };

  if (stride > 0) {
    drawLeg(hipRX, hipRY, rKneeX, rKneeY, rFootX, rFootY, false);
    drawLeg(hipLX, hipLY, lKneeX, lKneeY, lFootX, lFootY, true);
  } else {
    drawLeg(hipLX, hipLY, lKneeX, lKneeY, lFootX, lFootY, true);
    drawLeg(hipRX, hipRY, rKneeX, rKneeY, rFootX, rFootY, false);
  }

  // 2. Zdjelica i prsa
  ctx.fillStyle = darkMetal;
  ctx.fillRect(-16, 10, 32, 12);

  ctx.fillStyle = mainColor;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -6, 26, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Poderano krzno s rebrima endoskeleta
  ctx.fillStyle = '#1a1d22';
  ctx.fillRect(-12, -12, 24, 14);
  ctx.strokeStyle = metalColor;
  ctx.lineWidth = 2.5;
  for (let rib = -10; rib <= 0; rib += 5) {
    ctx.beginPath();
    ctx.moveTo(-10, rib);
    ctx.lineTo(10, rib);
    ctx.stroke();
  }

  // 3. Ruke u trku
  const armSwing = Math.sin(cycle);
  // Lijeva ruka (kandze prema naprijed)
  const lArmAngle = -0.5 + armSwing * 0.9;
  const lElbowX = -24 + Math.sin(lArmAngle) * 22;
  const lElbowY = -12 + Math.cos(lArmAngle) * 22;
  const lHandX = lElbowX + Math.sin(lArmAngle - 1.2) * 20;
  const lHandY = lElbowY + Math.cos(lArmAngle - 1.2) * 20;

  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-22, -14);
  ctx.lineTo(lElbowX, lElbowY);
  ctx.stroke();

  ctx.strokeStyle = metalColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(lElbowX, lElbowY);
  ctx.lineTo(lHandX, lHandY);
  ctx.stroke();

  ctx.fillStyle = darkMetal;
  ctx.beginPath();
  ctx.arc(lHandX, lHandY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Desna ruka s Foxy kukom!
  const rArmAngle = -0.5 - armSwing * 0.9;
  const rElbowX = 24 + Math.sin(rArmAngle) * 22;
  const rElbowY = -12 + Math.cos(rArmAngle) * 22;
  const rHandX = rElbowX + Math.sin(rArmAngle + 1.2) * 20;
  const rHandY = rElbowY + Math.cos(rArmAngle + 1.2) * 20;

  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(22, -14);
  ctx.lineTo(rElbowX, rElbowY);
  ctx.stroke();

  ctx.strokeStyle = metalColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(rElbowX, rElbowY);
  ctx.lineTo(rHandX, rHandY);
  ctx.stroke();

  // Metalna kuka
  ctx.strokeStyle = '#d5dde8';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(rHandX + 4, rHandY - 4, 8, 0.4, Math.PI * 1.5, false);
  ctx.stroke();

  // 4. Glava, usi i skakuca celjust
  const headY = -36 + Math.sin(cycle * 2) * 2;
  const headTilt = Math.sin(cycle) * 0.12;

  ctx.save();
  ctx.translate(0, headY);
  ctx.rotate(headTilt);

  // Lisicje usi
  ctx.fillStyle = mainColor;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, -14);
  ctx.lineTo(-32, -32);
  ctx.lineTo(-10, -22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(16, -14);
  ctx.lineTo(32, -32);
  ctx.lineTo(10, -22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Otkacena celjust (Snapping Jaw)
  const jawDrop = 8 + 14 * Math.abs(Math.sin(cycle * 1.6));
  ctx.fillStyle = '#1a0406';
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 10 + jawDrop / 2, 16, 6 + jawDrop / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ostri animatronik zubi
  ctx.fillStyle = '#eee';
  for (let tooth = -12; tooth <= 12; tooth += 5) {
    ctx.beginPath();
    ctx.moveTo(tooth - 2, 6);
    ctx.lineTo(tooth + 2, 6);
    ctx.lineTo(tooth, 11);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(tooth - 2, 14 + jawDrop);
    ctx.lineTo(tooth + 2, 14 + jawDrop);
    ctx.lineTo(tooth, 9 + jawDrop);
    ctx.closePath();
    ctx.fill();
  }

  // Glava
  if (omcoChar.customImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -6, 22, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(omcoChar.customImg, -22, -28, 44, 44);
    ctx.restore();
  } else {
    ctx.fillStyle = mainColor;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -6, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(0, 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Svjetlece demonske oci
  const eyeX = 8;
  const eyeY = -9;
  ctx.fillStyle = '#050000';
  ctx.beginPath();
  ctx.arc(-eyeX, eyeY, 5.5, 0, Math.PI * 2);
  ctx.arc(eyeX, eyeY, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff2200';
  ctx.shadowColor = '#ff3300';
  ctx.shadowBlur = isTrail ? 0 : 12;
  ctx.beginPath();
  ctx.arc(-eyeX, eyeY, 2.5, 0, Math.PI * 2);
  ctx.arc(eyeX, eyeY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (!isTrail) {
    ctx.strokeStyle = 'rgba(255, 60, 0, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-eyeX, eyeY);
    ctx.lineTo(-eyeX - 18, eyeY);
    ctx.moveTo(eyeX, eyeY);
    ctx.lineTo(eyeX - 18, eyeY);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

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
