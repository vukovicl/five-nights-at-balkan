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

  // Zastrašujući višeslojni JUMPSCARE krik (Sub-bass udarac + FNaF 1 FM shriek + crunch)
  playJumpscareScream(basePitch = 420) {
    this.stopToreador();
    this.stopPhoneSpeech();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Visceralni Sub-Bass udarac (65 Hz -> 22 Hz drop) koji trese zvučnike
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(65, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.85);
    subGain.gain.setValueAtTime(0.85, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.9);

    // 2. Piercing visoki metalni vrisak (FNaF 1 screech: 2100Hz & 2550Hz sa 72Hz FM modulacijom)
    [2100, 2550].forEach(f => {
      const osc = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const master = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.68, now + 1.4);

      mod.type = 'square';
      mod.frequency.value = 72; // brza frekvencijska modulacija za agresivno deranje
      modGain.gain.value = 450;

      master.gain.setValueAtTime(0.42, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

      mod.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(master);
      master.connect(this.ctx.destination);

      mod.start(now);
      osc.start(now);
      mod.stop(now + 1.45);
      osc.stop(now + 1.45);
    });

    // 3. Kaotično grleno režanje (srednji sloj glasa)
    const midOsc = this.ctx.createOscillator();
    const midMod = this.ctx.createOscillator();
    const midModGain = this.ctx.createGain();
    const midMaster = this.ctx.createGain();
    midOsc.type = 'sawtooth';
    midOsc.frequency.setValueAtTime(basePitch, now);
    midOsc.frequency.linearRampToValueAtTime(basePitch * 0.6, now + 1.5);
    midMod.type = 'sawtooth';
    midMod.frequency.value = 38;
    midModGain.gain.value = 220;
    midMaster.gain.setValueAtTime(0.55, now);
    midMaster.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    midMod.connect(midModGain);
    midModGain.connect(midOsc.frequency);
    midOsc.connect(midMaster);
    midMaster.connect(this.ctx.destination);
    midMod.start(now);
    midOsc.start(now);
    midMod.stop(now + 1.5);
    midOsc.stop(now + 1.5);

    // 4. Eksplozija drobljenja i bijelog šuma (crunch filter)
    if (this.noiseBuffer) {
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const nFilter = this.ctx.createBiquadFilter();
      nFilter.type = 'bandpass';
      nFilter.frequency.setValueAtTime(1200, now);
      nFilter.Q.value = 1.8;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.85, now);
      nGain.gain.exponentialRampToValueAtTime(0.01, now + 1.4);
      nSrc.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.ctx.destination);
      nSrc.start(now);
      nSrc.stop(now + 1.45);
    }
  }

  // Uvodni elektronski digitalni sat i gong (12:00 AM - FNaF Night Intro)
  playNightIntroChime() {
    this.stopToreador();
    this.stopPhoneSpeech();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const beeps = [880, 1174, 1318];
    beeps.forEach((freq, idx) => {
      const t = now + idx * 0.32;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(110, now);
    subOsc.frequency.linearRampToValueAtTime(55, now + 2.2);
    subGain.gain.setValueAtTime(0.32, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 2.2);
  }

  // Mehanički zvuk podizanja i spuštanja CCTV monitora
  playMonitorSwoosh(isOpen) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    if (isOpen) {
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.18);
    } else {
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.18);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.19);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.20);
  }

  // Kratki CRT glitch/static burst kad se promijeni kamera
  playCamStaticBurst() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.15);
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

  // Zastrašujući sablasni smijeh kada se Zlatni Muđa pojavi u uredu
  playGoldenLaugh() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 1.8);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 2.0);
  }

  // Zloglasni usporeni demonski jumpscare urlik Golden Freddyja
  playGoldenJumpscareScream() {
    this.stopToreador();
    this.stopPhoneSpeech();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const freqs = [82, 110, 148, 58];
    freqs.forEach((f) => {
      const osc = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const master = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.65, now + 2.2);

      mod.type = 'square';
      mod.frequency.value = 22;
      modGain.gain.value = 140;

      master.gain.setValueAtTime(0.52, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 2.3);

      mod.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(master);
      master.connect(this.ctx.destination);

      mod.start(now);
      osc.start(now);
      mod.stop(now + 2.3);
      osc.stop(now + 2.3);
    });
  }
}

const audio = new BalkanAudioEngine();

// ----------------------------------------------------------------------------
// 2. DEFINICIJA SVIH 11 ORIGINALNIH KAMERA I LIKOVA
// ----------------------------------------------------------------------------
const CAMERAS = {
  '1A': { id: '1A', name: 'CAM 1A - Glavni Studio / Bina', x: 1045, y: 378, key: '1' },
  '1B': { id: '1B', name: 'CAM 1B - Sala Kafane sa Stolovima', x: 1045, y: 444, key: null },
  '1C': { id: '1C', name: 'CAM 1C - Green Screen Kutak', x: 955, y: 480, key: '2' },
  '2A': { id: '2A', name: 'CAM 2A - Lijevi Hodnik', x: 1007, y: 512, key: '3' },
  '2B': { id: '2B', name: 'CAM 2B - Lijevi Kut pred Uredom', x: 1007, y: 574, key: null },
  '3':  { id: '3',  name: 'CAM 3 - Špajza s Gajbama Piva', x: 945, y: 556, key: null },
  '4A': { id: '4A', name: 'CAM 4A - Desni Hodnik', x: 1091, y: 512, key: '4' },
  '4B': { id: '4B', name: 'CAM 4B - Desni Kut pred Uredom', x: 1091, y: 574, key: null },
  '5':  { id: '5',  name: 'CAM 5 - Backstage & Kazetofon', x: 945, y: 420, key: '6' },
  '6':  { id: '6',  name: 'CAM 6 - Kuhinja & Roštilj [AUDIO]', x: 1175, y: 494, key: '5' },
  '7':  { id: '7',  name: 'CAM 7 - Toaleti Kafane', x: 1175, y: 430, key: null }
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
  },
  {
    id: 'golden',
    role: 'GOLDEN FREDDY (Zlatni Misterij)',
    defaultName: 'Zlatni Muđa',
    defaultCry: 'TO SAM JA! (IT\'S ME)',
    color: '#d4af37',
    hatColor: '#0a0b12',
    pitch: 110,
    path: []
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
// ============================================================================
// BALANS I ENERGETSKI MODEL IGRE (USKLAĐENA HIBRIDNA KONFIGURACIJA)
// ============================================================================
const OLD_BALANCE_CONFIG = {
  // Arhivirano radi usporedbe:
  baseDrainRate: 0.14,
  devDrainRate: 0.24,
  omcoDoorPenalty: 3.5,
  nightMultiplierFormula: '1 + (night - 1) * 0.06',
  omcoPausedOnlyOnCam1c: true
};

const BALANCE_CONFIG = {
  // 1. Potrošnja struje ureda i uređaja
  baseDrainRate: 0.11, // Bazna potrošnja agregata (1 crtica - ured i ventilator)
  devDrainRate: 0.20,  // Potrošnja po dodatnom uređaju (vrata, svjetlo, kamera)

  // 2. Množitelji potrošnje po noćima (Noć 1 do Noć 5, Noć 6 / Custom Night)
  // Noć 1: 1.00, Noć 2: 1.03, Noć 3: 1.06, Noć 4: 1.09, Noć 5: 1.12, Noć 6 (Custom): 1.15
  nightMultipliers: [1.00, 1.03, 1.06, 1.09, 1.12, 1.15],

  // 3. Omčo mehanika
  omcoDoorPenalty: 1.5,   // Gubitak energije pri blokiranom udarcu u lijeva vrata (-1.5%)
  omcoPauseOnAnyCam: true // Monitor otvoren na bilo kojoj kameri pauzira Omčin normalni napredak
};

function getNightMultiplier(nightNum) {
  const mults = BALANCE_CONFIG.nightMultipliers;
  const idx = Math.max(1, Math.min(mults.length, nightNum)) - 1;
  return mults[idx] !== undefined ? mults[idx] : 1.0;
}

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
  earnedPay: '125,00 €',

  // Golden Freddy (Zlatni Muđa - autentične FNaF 1 mehanike)
  goldenFreddy: {
    posterActive: false,      // Je li plakat na CAM 2B zamijenjen Zlatnim Muđom
    inOffice: false,          // Sjedi li Zlatni Muđa sklupčan na podu ureda
    timer: 0,                 // Koliko dugo sjedi u uredu (nakon 2.6s -> jumpscare)
    hallucinationTimer: 0,    // Tajmer za "IT'S ME / TO SAM JA" i brze negativne bljeskove
    checkCooldown: 0          // Cooldown između provjera plakata na CAM 2B
  },

  // Noćni intro & animacije monitora
  nightIntroTimer: 0,
  nightIntroMax: 2.4,
  monitorAnim: 0,         // 0.0 = ured, 1.0 = CCTV monitor potpuno podignut
  monitorState: 'CLOSED', // 'CLOSED', 'OPENING', 'OPEN', 'CLOSING'
  camStaticTimer: 0,      // CRT glitch/wipe kad se prebaci kamera
  radarScanY: 0           // Scanline radar na minimapi
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

  // Prikazujemo 5 glavnih aktivnih animatronika (Golden Freddy je skriveni misterij)
  charConfigs.filter(ch => ch.id !== 'golden').forEach((ch, index) => {
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

  // FNaF 1 EASTER EGG: 1-9-8-7 triggerira Golden Freddy jumpscare!
  const mAI = charConfigs.find(c => c.id === 'mudja')?.aiLevel || 0;
  const bAI = charConfigs.find(c => c.id === 'baka')?.aiLevel || 0;
  const cAI = charConfigs.find(c => c.id === 'choda')?.aiLevel || 0;
  const oAI = charConfigs.find(c => c.id === 'omco')?.aiLevel || 0;

  document.getElementById('custom-night-modal').classList.add('hidden');

  if (mAI === 1 && bAI === 9 && cAI === 8 && oAI === 7) {
    startNight(6, true);
    triggerGoldenJumpscare();
    return;
  }

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


let lastCamToggleTime = 0;
document.getElementById('cam-toggle-bar').addEventListener('mouseenter', () => {
  const now = Date.now();
  if (now - lastCamToggleTime > 320 && state.screen === 'PLAYING') {
    lastCamToggleTime = now;
    toggleCameraMonitor();
  }
});

document.getElementById('cam-toggle-bar').addEventListener('click', () => {
  const now = Date.now();
  if (now - lastCamToggleTime > 150) {
    lastCamToggleTime = now;
    toggleCameraMonitor();
  }
});

// ----------------------------------------------------------------------------
// 5. POKRETANJE NOĆI I UPRAVLJANJE AI-JEM
// ----------------------------------------------------------------------------
function getCharById(id) {
  return charConfigs.find(c => c.id === id);
}

function startNight(nightNum, isCustomNight = false) {
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

  // Resetiraj stanje Golden Freddyja
  state.goldenFreddy = {
    posterActive: false,
    inOffice: false,
    timer: 0,
    hallucinationTimer: 0,
    checkCooldown: 0
  };

  // Resetiraj animacije monitora i intro ekrana
  state.screen = 'NIGHT_INTRO';
  state.nightIntroTimer = 0;
  state.nightIntroMax = 2.4;
  state.monitorAnim = 0;
  state.monitorState = 'CLOSED';
  state.camStaticTimer = 0;

  // Razvojna statistika smjene
  const isDevUrl = typeof window !== 'undefined' && window.location && new URLSearchParams(window.location.search).get('dev') === '1';
  state.devStats = {
    enabled: state.devStats ? state.devStats.enabled : isDevUrl,
    camSeconds: 0,
    leftDoorSeconds: 0,
    rightDoorSeconds: 0,
    leftLightSeconds: 0,
    rightLightSeconds: 0,
    basePowerDrained: 0,
    devicesPowerDrained: 0,
    omcoHits: 0,
    omcoPenalTotal: 0,
    powerOutTime: null,
    remainingPower: 100.0,
    outcome: null
  };

  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('hud-layer').classList.add('hidden');
  document.getElementById('phone-box').classList.add('hidden');
  document.getElementById('tape-warning').classList.add('hidden');

  audio.playNightIntroChime(nightNum);
}

function toggleCameraMonitor() {
  if (state.screen !== 'PLAYING' || state.powerOut) return;
  state.windingTape = false;

  if (state.camOpen || state.monitorState === 'OPENING') {
    // SPUŠTANJE MONITORA
    state.monitorState = 'CLOSING';
    state.camOpen = false;
    audio.playMonitorSwoosh(false);

    // Ako je plakat na CAM 2B bio viđen, stvara se u uredu!
    if (state.goldenFreddy && state.goldenFreddy.posterActive) {
      state.goldenFreddy.posterActive = false;
      state.goldenFreddy.inOffice = true;
      state.goldenFreddy.timer = 0;
      state.goldenFreddy.hallucinationTimer = 0;
      audio.playGoldenLaugh();
    }
  } else {
    // PODIZANJE MONITORA
    state.monitorState = 'OPENING';
    state.leftLightOn = false;
    state.rightLightOn = false;
    audio.playMonitorSwoosh(true);

    // DEFENSE PROTIV GOLDEN FREDDYJA: Podizanje monitora odmah ga tjera iz ureda!
    if (state.goldenFreddy && state.goldenFreddy.inOffice) {
      state.goldenFreddy.inOffice = false;
      state.goldenFreddy.timer = 0;
    }
    if (state.currentCam === '2B') checkGoldenFreddyPoster();
  }
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
  // Pravilo 4: Kada ishod postane pobjeda ili poraz, drugi ishod se više ne može aktivirati
  if (state.screen !== 'PLAYING') return;
  state.screen = 'JUMPSCARE';
  state.camOpen = false;
  state.windingTape = false;
  state.jumpscareChar = getCharById(charId);
  state.jumpscareTimer = 0;
  state.endReason = reasonText;

  document.getElementById('hud-layer').classList.add('hidden');
  audio.updateContinuousAudio(false, false, false, false);
  audio.playJumpscareScream(state.jumpscareChar.pitch);

  if (state.devStats) {
    state.devStats.outcome = `PORAZ (JUMPSCARE): ${reasonText}`;
    state.devStats.remainingPower = state.power;
    if (state.devStats.enabled) printDevSummary();
  }
}

function triggerVictory() {
  // Pravilo 4: Ako je već nastupio jumpscare, pobjeda se ne može naknadno aktivirati
  if (state.screen !== 'PLAYING') return;
  state.screen = 'VICTORY';
  state.camOpen = false;
  state.windingTape = false;
  document.getElementById('hud-layer').classList.add('hidden');
  audio.updateContinuousAudio(false, false, false, false);
  audio.playSixAmChime();

  const bonuses = ['120,00 € + Bon za 10 ćevapa', '150,00 € + Gajba piva', '185,50 € + Novi mikrofon', '240,00 € + Bakšiš od donacija', '500,00 € + Titula Glavnog Moda', '999,99 € + Vlasništvo nad Kafanom'];
  state.earnedPay = bonuses[(state.selectedNight - 1) % bonuses.length];

  if (state.devStats) {
    state.devStats.outcome = 'POBJEDA (06:00 AM)';
    state.devStats.remainingPower = state.power;
    if (state.devStats.enabled) printDevSummary();
  }
}

function printDevSummary() {
  if (!state.devStats) return;
  const s = state.devStats;
  const nightMult = getNightMultiplier(state.selectedNight);
  console.group('%c📊 RAZVOJNA STATISTIKA SMJENE (DEV STATS)', 'color: #ffaa00; font-size: 13px; font-weight: bold;');
  console.log(`Noć: ${state.selectedNight === 6 ? 'CUSTOM NIGHT' : 'NOĆ ' + state.selectedNight}`);
  console.log(`Ishod: %c${s.outcome}`, s.outcome && s.outcome.startsWith('POBJEDA') ? 'color:#22dd44;font-weight:bold;' : 'color:#ff3333;font-weight:bold;');
  console.log(`Preostala energija agregata: ${Math.max(0, s.remainingPower).toFixed(2)}%`);
  console.log(`Vrijeme nestanka struje: ${s.powerOutTime !== null ? s.powerOutTime.toFixed(1) + 's' : 'Struja izdržala (nije nestalo)'}`);
  console.log(`Broj Omčinih blokiranih udaraca: ${s.omcoHits} (ukupni penal: -${s.omcoPenalTotal.toFixed(1)}%)`);
  console.table({
    'Osnovno napajanje (Baza)': { 'Vrijeme': '360.0s', 'Potrošeno': s.basePowerDrained.toFixed(2) + '%' },
    'CCTV Monitor (Kamere)': { 'Vrijeme': s.camSeconds.toFixed(1) + 's', 'Potrošeno': ((s.camSeconds * BALANCE_CONFIG.devDrainRate) * nightMult).toFixed(2) + '%' },
    'Lijeva roletna (Vrata)': { 'Vrijeme': s.leftDoorSeconds.toFixed(1) + 's', 'Potrošeno': ((s.leftDoorSeconds * BALANCE_CONFIG.devDrainRate) * nightMult).toFixed(2) + '%' },
    'Desna roletna (Vrata)': { 'Vrijeme': s.rightDoorSeconds.toFixed(1) + 's', 'Potrošeno': ((s.rightDoorSeconds * BALANCE_CONFIG.devDrainRate) * nightMult).toFixed(2) + '%' },
    'Lijevo hodničko svjetlo': { 'Vrijeme': s.leftLightSeconds.toFixed(1) + 's', 'Potrošeno': ((s.leftLightSeconds * BALANCE_CONFIG.devDrainRate) * nightMult).toFixed(2) + '%' },
    'Desno hodničko svjetlo': { 'Vrijeme': s.rightLightSeconds.toFixed(1) + 's', 'Potrošeno': ((s.rightLightSeconds * BALANCE_CONFIG.devDrainRate) * nightMult).toFixed(2) + '%' },
    'Omčo udarci u vrata': { 'Vrijeme': '-', 'Potrošeno': '-' + s.omcoPenalTotal.toFixed(1) + '%' }
  });
  console.groupEnd();
}

window.getDevReport = () => printDevSummary();
window.toggleDevStats = (enable) => {
  if (!state.devStats) state.devStats = { enabled: true };
  state.devStats.enabled = enable !== undefined ? enable : !state.devStats.enabled;
  console.log('Dev stats logging is now:', state.devStats.enabled ? 'ENABLED' : 'DISABLED');
  return state.devStats.enabled;
};

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

  if (state.screen === 'NIGHT_INTRO') {
    state.nightIntroTimer += dt;
    if (state.nightIntroTimer >= state.nightIntroMax) {
      state.screen = 'PLAYING';
      document.getElementById('hud-layer').classList.remove('hidden');
      document.getElementById('hud-night').textContent = state.selectedNight === 6 ? 'CUSTOM NIGHT' : `NOĆ ${state.selectedNight}`;
      const msg = PHONE_MESSAGES[state.selectedNight] || 'Alo majstore! Custom Night je u tijeku – svi streameri su na maksimumu, nek ti je sa srećom!';
      document.getElementById('phone-text').textContent = msg;
      document.getElementById('phone-box').classList.remove('hidden');
      audio.startPhoneSpeech();
    }
    return;
  }

  if (state.screen === 'JUMPSCARE') {
    state.jumpscareTimer += dt;
    const isGolden = state.jumpscareChar && state.jumpscareChar.id === 'golden';
    const limit = isGolden ? 2.3 : 2.1;
    if (state.jumpscareTimer >= limit) {
      if (isGolden) {
        state.screen = 'CRASH';
      } else {
        state.screen = 'GAMEOVER';
      }
    }
    return;
  }

  if (state.screen !== 'PLAYING') {
    audio.updateContinuousAudio(false, false, false, false);
    return;
  }

  // Animacija podizanja i spuštanja CCTV monitora
  if (state.monitorState === 'OPENING') {
    state.monitorAnim = Math.min(1.0, (state.monitorAnim || 0) + dt * 5.2);
    if (state.monitorAnim >= 1.0) {
      state.monitorAnim = 1.0;
      state.monitorState = 'OPEN';
      state.camOpen = true;
    }
  } else if (state.monitorState === 'CLOSING') {
    state.monitorAnim = Math.max(0.0, (state.monitorAnim || 0) - dt * 5.2);
    if (state.monitorAnim <= 0.0) {
      state.monitorAnim = 0.0;
      state.monitorState = 'CLOSED';
      state.camOpen = false;
    }
  }

  if (state.camStaticTimer > 0) {
    state.camStaticTimer -= dt;
  }

  // Panoramsko pomicanje pogleda mišem u uredu (brže što je miš bliže rubu ekrana)
  if (!state.camOpen) {
    const maxPan = state.officeWidth - canvas.width; // 520px
    const leftThreshold = 520;
    const rightThreshold = canvas.width - leftThreshold; // 760

    if (state.mouseX < leftThreshold) {
      // Što je miš bliže lijevom rubu ekrana (0px), to je proximity veći (0.0 do 1.0)
      const proximity = Math.min(1.0, Math.max(0, (leftThreshold - state.mouseX) / leftThreshold));
      // Nelinearna krivulja ubrzanja: lagano uz sredinu (100 px/s) do munjevito brzo uz rub (1500 px/s)
      const speed = 100 + 1400 * Math.pow(proximity, 1.55);
      state.panX = Math.max(0, state.panX - speed * dt);
    } else if (state.mouseX > rightThreshold) {
      // Što je miš bliže desnom rubu ekrana (1280px), to je proximity veći (0.0 do 1.0)
      const proximity = Math.min(1.0, Math.max(0, (state.mouseX - rightThreshold) / (canvas.width - rightThreshold)));
      // Nelinearna krivulja ubrzanja
      const speed = 100 + 1400 * Math.pow(proximity, 1.55);
      state.panX = Math.min(maxPan, state.panX + speed * dt);
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
  const nightDrainMultiplier = getNightMultiplier(state.selectedNight);
  const baseDrain = BALANCE_CONFIG.baseDrainRate * nightDrainMultiplier * dt;
  const devDrain = ((state.usageLevel - 1) * BALANCE_CONFIG.devDrainRate) * nightDrainMultiplier * dt;
  const drainPerSec = (BALANCE_CONFIG.baseDrainRate + (state.usageLevel - 1) * BALANCE_CONFIG.devDrainRate) * nightDrainMultiplier;
  state.power = Math.max(0, state.power - drainPerSec * dt);

  // Akumulacija razvojne statistike
  if (state.devStats) {
    if (state.camOpen) state.devStats.camSeconds += dt;
    if (state.leftDoorClosed) state.devStats.leftDoorSeconds += dt;
    if (state.rightDoorClosed) state.devStats.rightDoorSeconds += dt;
    if (state.leftLightOn) state.devStats.leftLightSeconds += dt;
    if (state.rightLightOn) state.devStats.rightLightSeconds += dt;
    state.devStats.basePowerDrained += baseDrain;
    state.devStats.devicesPowerDrained += devDrain;
  }

  if (state.power <= 0) {
    state.power = 0;
    state.powerOut = true;
    if (state.devStats && state.devStats.powerOutTime === null) {
      state.devStats.powerOutTime = state.nightTimeElapsed;
    }
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
      // Monitor otvoren na bilo kojoj kameri pauzira Omčin normalni napredak
      const watchingOmco = BALANCE_CONFIG.omcoPauseOnAnyCam ? state.camOpen : (state.camOpen && state.currentCam === '1C');
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
          state.power = Math.max(0, state.power - BALANCE_CONFIG.omcoDoorPenalty);
          if (state.devStats) {
            state.devStats.omcoHits++;
            state.devStats.omcoPenalTotal += BALANCE_CONFIG.omcoDoorPenalty;
          }
          omcoEnt.sprinting = false;
          omcoEnt.stage = 0;
          omcoEnt.progress = Math.random() * 20;
          state.officeShake = 1.0;
          state.doorImpactNoticeTimer = 2.5;
          state.doorImpactNotice = `⚡ OMČO JE UDARIO U LIJEVA VRATA! (-${BALANCE_CONFIG.omcoDoorPenalty.toFixed(1)}% STRUJE)`;
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

  // Povremena provjera plakata Zlatnog Muđe dok je igrač na CAM 2B
  if (state.camOpen && state.currentCam === '2B' && state.goldenFreddy) {
    state.goldenFreddy.checkCooldown = (state.goldenFreddy.checkCooldown || 0) + dt;
    if (state.goldenFreddy.checkCooldown >= 3.0) {
      state.goldenFreddy.checkCooldown = 0;
      checkGoldenFreddyPoster();
    }
  }

  // AI 4: GOLDEN FREDDY (Zlatni Muđa u uredu - igrač mora dići monitor unutar 2.6s)
  if (state.goldenFreddy && state.goldenFreddy.inOffice) {
    if (!state.camOpen) {
      state.goldenFreddy.timer += dt;
      state.goldenFreddy.hallucinationTimer += dt;

      // Ako igrač gleda u njega dulje od 2.6 sekundi bez dizanja monitora -> JUMPSCARE!
      if (state.goldenFreddy.timer >= 2.6) {
        triggerGoldenJumpscare();
        return;
      }
    } else {
      // Čim je monitor podignut, Zlatni Muđa nestaje!
      state.goldenFreddy.inOffice = false;
      state.goldenFreddy.timer = 0;
    }
  }

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
    const isGolden = charCfg.id === 'golden';
    g.fillStyle = (isJumpscare || isGolden) ? '#000' : '#111';
    g.beginPath();
    g.arc(cx - eyeOffX, eyeY, radius * 0.24, 0, Math.PI * 2);
    g.arc(cx + eyeOffX, eyeY, radius * 0.24, 0, Math.PI * 2);
    g.fill();

    // Zjenice koje svijetle (Zlatni Muđa ima sablasne sićušne bijele točke)
    g.fillStyle = isGolden ? '#ffffff' : (isJumpscare ? '#ff2222' : '#ffffff');
    const pupilRad = isGolden ? radius * 0.05 : (isJumpscare ? radius * 0.09 : radius * 0.09);
    g.beginPath();
    g.arc(cx - eyeOffX, eyeY, pupilRad, 0, Math.PI * 2);
    g.arc(cx + eyeOffX, eyeY, pupilRad, 0, Math.PI * 2);
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

  // 3D POZADINA UREDA: ZIDOVI, STROP I KARIRANI POD U PERSPEKTIVI
  // 1. Zidovi ureda
  const wallGrad = ctx.createLinearGradient(0, 0, 0, H);
  wallGrad.addColorStop(0, '#111218');
  wallGrad.addColorStop(0.65, '#1a1b24');
  wallGrad.addColorStop(0.68, '#14151e');
  wallGrad.addColorStop(1, '#090a0d');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Strop sa 3D panelima i visećom neonskom lampom (y: 0..100)
  ctx.strokeStyle = '#0d0e13';
  ctx.lineWidth = 2;
  for (let cx = 0; cx < W; cx += 120) {
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx + (cx - 900) * 0.08, 100);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, 100); ctx.lineTo(W, 100);
  ctx.stroke();

  // Viseća industrijska neonska svjetiljka u sredini stropa
  ctx.fillStyle = '#22252a';
  ctx.fillRect(780, 26, 240, 18);
  ctx.strokeStyle = '#3d434d';
  ctx.lineWidth = 2;
  ctx.strokeRect(780, 26, 240, 18);
  // Cijevi neona
  const neonHum = state.powerOut ? '#0a0a0c' : '#eaf8ff';
  ctx.fillStyle = neonHum;
  ctx.fillRect(790, 32, 220, 6);
  if (!state.powerOut) {
    // Diskretno fluorescentno osvjetljenje prema dolje
    const tubeGlow = ctx.createRadialGradient(900, 35, 10, 900, 35, 240);
    tubeGlow.addColorStop(0, 'rgba(210, 235, 255, 0.14)');
    tubeGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = tubeGlow;
    ctx.fillRect(660, 35, 480, 220);
  }

  // 3. Karirani industrijski pod ureda u 3D perspektivi (y: 480..720)
  const floorY0 = 480;
  const numFloorRows = 6;
  const numFloorCols = 30;
  for (let fr = 0; fr < numFloorRows; fr++) {
    const t0 = Math.pow(fr / numFloorRows, 1.35);
    const t1 = Math.pow((fr + 1) / numFloorRows, 1.35);
    const fy0 = floorY0 + (H - floorY0) * t0;
    const fy1 = floorY0 + (H - floorY0) * t1;

    for (let fc = 0; fc < numFloorCols; fc++) {
      const u0 = fc / numFloorCols;
      const u1 = (fc + 1) / numFloorCols;

      const isAlt = (fc + fr) % 2 === 0;
      ctx.fillStyle = isAlt ? '#16171d' : '#0d0e12';

      ctx.beginPath();
      ctx.moveTo(u0 * W, fy0);
      ctx.lineTo(u1 * W, fy0);
      ctx.lineTo(u1 * W, fy1);
      ctx.lineTo(u0 * W, fy1);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#08080a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Masivna lajsna na spoju zida i poda
  ctx.fillStyle = '#221510';
  ctx.fillRect(0, floorY0 - 4, W, 8);

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
  // RADNI STOL U 3D PERSPEKTIVI S CRT MONITOROM, VENTILATOROM, MILJEOM I KAVOM
  // --------------------------------------------------------------------------
  // 1. Sjena stola na podu ureda
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.beginPath();
  ctx.ellipse(900, 695, 440, 25, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Prednja okomita fronta / ladice stola (apron & drawers: y 585..720)
  ctx.fillStyle = '#1c110a';
  ctx.fillRect(495, 585, 810, 135);
  ctx.strokeStyle = '#100905';
  ctx.lineWidth = 3;
  ctx.strokeRect(495, 585, 810, 135);

  // Lijevi ormarić s ladicama (x: 510..680)
  ctx.fillStyle = '#25160e';
  ctx.fillRect(510, 595, 170, 120);
  for (let d = 0; d < 3; d++) {
    ctx.strokeStyle = '#120b06';
    ctx.strokeRect(515, 600 + d * 38, 160, 32);
    // Mesingana ručkica ladice
    ctx.fillStyle = '#c99e28';
    ctx.fillRect(580, 613 + d * 38, 30, 6);
  }

  // Desni ormarić s ladicama (x: 1120..1290)
  ctx.fillStyle = '#25160e';
  ctx.fillRect(1120, 595, 170, 120);
  for (let d = 0; d < 3; d++) {
    ctx.strokeStyle = '#120b06';
    ctx.strokeRect(1125, 600 + d * 38, 160, 32);
    // Mesingana ručkica ladice
    ctx.fillStyle = '#c99e28';
    ctx.fillRect(1190, 613 + d * 38, 30, 6);
  }

  // Srednji prostor za noge (kneehole) u dubokoj sjeni
  ctx.fillStyle = '#080503';
  ctx.fillRect(690, 595, 420, 125);

  // 3. Gornja ploha radnog stola u 3D perspektivi (trapezoid: y 470..585)
  const deskTopPoly = new Path2D();
  deskTopPoly.moveTo(535, 470);
  deskTopPoly.lineTo(1265, 470);
  deskTopPoly.lineTo(1310, 585);
  deskTopPoly.lineTo(490, 585);
  deskTopPoly.closePath();

  ctx.save();
  ctx.clip(deskTopPoly);

  const deskGrad = ctx.createLinearGradient(0, 470, 0, 585);
  deskGrad.addColorStop(0, '#23140b');
  deskGrad.addColorStop(0.6, '#382012');
  deskGrad.addColorStop(1, '#492b19');
  ctx.fillStyle = deskGrad;
  ctx.fillRect(480, 470, 840, 120);

  // Fina tekstura godova drveta
  ctx.strokeStyle = 'rgba(255, 190, 130, 0.08)';
  ctx.lineWidth = 2;
  for (let dw = 510; dw < 1290; dw += 45) {
    ctx.beginPath();
    ctx.moveTo(dw, 470);
    ctx.lineTo(dw + (dw - 900) * 0.15, 585);
    ctx.stroke();
  }
  ctx.restore();

  // Prednji zaobljeni masivni drveni rub ploče stola (lip highlight)
  ctx.fillStyle = '#5c361f';
  ctx.fillRect(488, 582, 824, 7);
  ctx.fillStyle = '#221209';
  ctx.fillRect(488, 589, 824, 3);

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

  // Zlatni Muđa (Golden Freddy) sklupčan na podu ureda
  if (state.goldenFreddy && state.goldenFreddy.inOffice && !state.powerOut) {
    drawGoldenFreddySlumped(ctx, 640, 575, 1.15);
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

  // 3D Podni svjetlosni snop kad je upaljeno hodničko svjetlo
  if (lightOn && !state.powerOut) {
    ctx.save();
    const beamFloor = new Path2D();
    if (isLeft) {
      beamFloor.moveTo(doorX, doorY + doorH);
      beamFloor.lineTo(doorX + doorW, doorY + doorH);
      beamFloor.lineTo(doorX + doorW + 110, 720);
      beamFloor.lineTo(doorX - 50, 720);
    } else {
      beamFloor.moveTo(doorX, doorY + doorH);
      beamFloor.lineTo(doorX + doorW, doorY + doorH);
      beamFloor.lineTo(doorX + doorW + 50, 720);
      beamFloor.lineTo(doorX - 110, 720);
    }
    beamFloor.closePath();

    const lightFloorGrad = ctx.createLinearGradient(0, doorY + doorH, 0, 720);
    lightFloorGrad.addColorStop(0, 'rgba(255, 235, 170, 0.35)');
    lightFloorGrad.addColorStop(0.5, 'rgba(255, 220, 140, 0.16)');
    lightFloorGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = lightFloorGrad;
    ctx.fill(beamFloor);
    ctx.restore();
  }

  // 3D Betonski okvir vrata (Armirani bunker profil s dubinom zida)
  ctx.fillStyle = '#1e2129';
  ctx.fillRect(doorX - 12, doorY - 14, doorW + 24, doorH + 14);
  ctx.strokeStyle = '#0e1014';
  ctx.lineWidth = 3;
  ctx.strokeRect(doorX - 12, doorY - 14, doorW + 24, doorH + 14);

  // Unutrašnjost vrata (hodnik u mraku ili osvijetljen)
  ctx.fillStyle = lightOn ? '#353945' : '#050508';
  ctx.fillRect(doorX, doorY, doorW, doorH);

  // 3D Zidni špalet (dubina betonskog zida unutar prolaza)
  if (isLeft) {
    const jambGrad = ctx.createLinearGradient(doorX + doorW - 30, 0, doorX + doorW, 0);
    jambGrad.addColorStop(0, 'transparent');
    jambGrad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = jambGrad;
    ctx.fillRect(doorX + doorW - 30, doorY, 30, doorH);
  } else {
    const jambGrad = ctx.createLinearGradient(doorX, 0, doorX + 30, 0);
    jambGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    jambGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = jambGrad;
    ctx.fillRect(doorX, doorY, 30, doorH);
  }

  // 3D Okvir prozora s metalnim kosim lajsnama
  ctx.fillStyle = '#1c1e24';
  ctx.fillRect(winX - 8, winY - 8, winW + 16, winH + 16);
  ctx.strokeStyle = '#0e1014';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(winX - 8, winY - 8, winW + 16, winH + 16);

  // Staklo prozora
  ctx.fillStyle = lightOn ? '#2c303a' : '#07070b';
  ctx.fillRect(winX, winY, winW, winH);

  // Dijagonalni stakleni odsjaj na prozoru
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.beginPath();
  ctx.moveTo(winX + 15, winY);
  ctx.lineTo(winX + 45, winY);
  ctx.lineTo(winX + 20, winY + winH);
  ctx.lineTo(winX - 10, winY + winH);
  ctx.closePath();
  ctx.fill();

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

  // Ako je upaljeno svjetlo i streamer je pred vratima – prikaži realistični model na ulazu!
  if (lightOn && !state.powerOut) {
    if (isLeft && state.entities.baka.loc === 'LEFT_DOOR') {
      drawFullBodyAnimatronic(ctx, getCharById('baka'), doorX + 110, doorY + doorH - 25, 410, 'door', 1.0);
      drawCharacterPortrait(ctx, getCharById('baka'), winX + 68, winY + 130, 48);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 15px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('"OTVARAJ, IDE GAS!"', doorX + 110, doorY + 80);
    }
    if (!isLeft && (state.entities.choda.loc === 'RIGHT_DOOR' || state.entities.mudja.loc === 'RIGHT_DOOR')) {
      const chId = state.entities.mudja.loc === 'RIGHT_DOOR' ? 'mudja' : 'choda';
      drawFullBodyAnimatronic(ctx, getCharById(chId), doorX + 110, doorY + doorH - 25, 410, 'door', 1.0);
      drawCharacterPortrait(ctx, getCharById(chId), winX + 68, winY + 125, 55);
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
  ctx.font = 'bold 12px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('DOOR', panelX + 29, panelY + 45);

  // Gumb LIGHT (Svjetlo)
  ctx.fillStyle = lightOn ? '#ffee55' : '#444b58';
  ctx.fillRect(panelX + 9, panelY + 84, 40, 52);
  ctx.fillStyle = lightOn ? '#000' : '#fff';
  ctx.font = 'bold 12px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('LIGHT', panelX + 29, panelY + 115);
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
  '1A': [ // Show Stage: tri izvođača stoje na drvenoj bini pod reflektorima
    { id: 'mudja', groundX: 450, groundY: 465, height: 235 },
    { id: 'baka',  groundX: 295, groundY: 475, height: 220 },
    { id: 'choda', groundX: 605, groundY: 475, height: 220 }
  ],
  '1B': [ // Sala kafane: stoje među stolovima u perspektivi
    { groundX: 285, groundY: 475, height: 180 },
    { groundX: 450, groundY: 385, height: 140 },
    { groundX: 615, groundY: 475, height: 180 }
  ],
  '2A': [ // Lijevi hodnik kad Baka vreba
    { groundX: 450, groundY: 535, height: 215 }
  ],
  '2B': [ // Lijevi slijepi kut - stoji pred samim vratima ureda
    { groundX: 380, groundY: 575, height: 285 }
  ],
  '3': [ // Špajza s pivom - stoji pod njihajućom žaruljom među gajbama
    { groundX: 450, groundY: 545, height: 215 }
  ],
  '4A': [ // Desni hodnik
    { groundX: 430, groundY: 425, height: 150 },
    { groundX: 535, groundY: 535, height: 215 }
  ],
  '4B': [ // Desni kut - krupni plan pred desnim vratima
    { groundX: 500, groundY: 575, height: 285 }
  ],
  '7': [ // Toaleti kafane
    { groundX: 345, groundY: 485, height: 195 },
    { groundX: 550, groundY: 475, height: 190 }
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
  if (camId === '1C' || camId === '5' || camId === '6') return;

  const present = [];
  ['mudja', 'baka', 'choda'].forEach(id => {
    if (state.entities[id].loc === camId) present.push(id);
  });
  if (present.length === 0) return;

  if (camId === '1A') {
    // Glavna bina - tri izvođača stoje uspravno na bini u 3D perspektivi
    // Dubinsko sortiranje (Z-sort) prema udaljenosti od kamere
    const sorted = present.map(id => ({
      id,
      ch: getCharById(id),
      slot: ROOM_SLOTS_3D['1A'].find(s => s.id === id)
    })).filter(item => item.slot).sort((a, b) => a.slot.groundY - b.slot.groundY);

    sorted.forEach(({ ch, slot }) => {
      // Kontaktna 3D eliptična sjena pod nogama na drvenom podu bine
      ctx.save();
      const shadowGrad = ctx.createRadialGradient(slot.groundX, slot.groundY - 3, 6, slot.groundX, slot.groundY - 3, slot.height * 0.28);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
      shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
      shadowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(slot.groundX, slot.groundY - 3, slot.height * 0.28, slot.height * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawFullBodyAnimatronic(ctx, ch, slot.groundX, slot.groundY, slot.height, 'stage', 1.0);
    });
    return;
  }

  // Ostale sobe - prirodna visina i položaj na podu u 3D perspektivi
  const slots = ROOM_SLOTS_3D[camId] || [{ groundX: 450, groundY: 480, height: 200 }];
  present.forEach((id, index) => {
    const ch = getCharById(id);
    const slot = slots[Math.min(index, slots.length - 1)];
    const ambient = (camId === '3' || camId === '2B' || camId === '4B') ? 0.78 : 0.92;

    // Kontaktna sjena na podu
    ctx.save();
    const shadowGrad = ctx.createRadialGradient(slot.groundX, slot.groundY - 3, 5, slot.groundX, slot.groundY - 3, slot.height * 0.25);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
    shadowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(slot.groundX, slot.groundY - 3, slot.height * 0.25, slot.height * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawFullBodyAnimatronic(ctx, ch, slot.groundX, slot.groundY, slot.height, 'room', ambient);
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
  const mapX = 905;
  const mapY = 340;
  const mapW = 345;
  const mapH = 326;

  ctx.save();

  // 1. CRT Radar pozadina sa suptilnom mrežom
  ctx.fillStyle = 'rgba(5, 14, 10, 0.92)';
  ctx.fillRect(mapX, mapY, mapW, mapH);
  ctx.strokeStyle = '#22cc44';
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapW, mapH);

  // Mreža (Blueprint Grid)
  ctx.strokeStyle = 'rgba(40, 180, 80, 0.08)';
  ctx.lineWidth = 1;
  for (let gx = mapX + 20; gx < mapX + mapW; gx += 20) {
    ctx.beginPath(); ctx.moveTo(gx, mapY); ctx.lineTo(gx, mapY + mapH); ctx.stroke();
  }
  for (let gy = mapY + 20; gy < mapY + mapH; gy += 20) {
    ctx.beginPath(); ctx.moveTo(mapX, gy); ctx.lineTo(mapX + mapW, gy); ctx.stroke();
  }

  // 2. TLOCRTNI HODNICI (Povezuju sobe i pokazuju smjer kretanja animatronika)
  ctx.strokeStyle = '#2ee860';
  ctx.lineWidth = 2.5;
  ctx.fillStyle = 'rgba(16, 50, 30, 0.55)';

  // Prolaz 1A (Bina) -> 1B (Sala)
  ctx.fillRect(1028, 396, 34, 18);
  ctx.beginPath();
  ctx.moveTo(1028, 396); ctx.lineTo(1028, 414);
  ctx.moveTo(1062, 396); ctx.lineTo(1062, 414);
  ctx.stroke();

  // Prolaz 1B (Sala) <-> 5 (Backstage)
  ctx.fillRect(974, 408, 14, 24);
  ctx.beginPath();
  ctx.moveTo(974, 408); ctx.lineTo(988, 408);
  ctx.moveTo(974, 432); ctx.lineTo(988, 432);
  ctx.stroke();

  // Prolaz 1B (Sala) <-> 1C (Pirate Cove)
  ctx.fillRect(974, 466, 14, 20);
  ctx.beginPath();
  ctx.moveTo(974, 466); ctx.lineTo(988, 466);
  ctx.moveTo(974, 486); ctx.lineTo(988, 486);
  ctx.stroke();

  // Prolaz 1B (Sala) <-> 7 (Toaleti)
  ctx.fillRect(1102, 418, 42, 22);
  ctx.beginPath();
  ctx.moveTo(1102, 418); ctx.lineTo(1144, 418);
  ctx.moveTo(1102, 440); ctx.lineTo(1144, 440);
  ctx.stroke();

  // Prolaz 7 (Toaleti) <-> 6 (Kuhinja)
  ctx.fillRect(1160, 452, 30, 18);
  ctx.beginPath();
  ctx.moveTo(1160, 452); ctx.lineTo(1160, 470);
  ctx.moveTo(1190, 452); ctx.lineTo(1190, 470);
  ctx.stroke();

  // Spoj 6 (Kuhinja) <-> 4A (Desni hodnik)
  ctx.fillRect(1114, 484, 30, 20);
  ctx.beginPath();
  ctx.moveTo(1114, 484); ctx.lineTo(1144, 484);
  ctx.moveTo(1114, 504); ctx.lineTo(1144, 504);
  ctx.stroke();

  // LIJEVI HODNIK (West Hall - 2A & 2B)
  // 1B -> 2A
  ctx.fillRect(984, 468, 46, 20);
  ctx.beginPath();
  ctx.moveTo(984, 468); ctx.lineTo(984, 488);
  ctx.moveTo(1030, 468); ctx.lineTo(1030, 488);
  ctx.stroke();

  // Spoj 2A <-> 3 (Špajza)
  ctx.fillRect(974, 544, 10, 22);
  ctx.beginPath();
  ctx.moveTo(974, 544); ctx.lineTo(984, 544);
  ctx.moveTo(974, 566); ctx.lineTo(984, 566);
  ctx.stroke();

  // Prolaz 2A -> 2B (kontinuirani hodnik)
  ctx.fillRect(984, 536, 46, 16);
  ctx.beginPath();
  ctx.moveTo(984, 536); ctx.lineTo(984, 552);
  ctx.moveTo(1030, 536); ctx.lineTo(1030, 552);
  ctx.stroke();

  // Spoj 2B -> URED (Lijeva vrata sa skretanjem)
  ctx.fillRect(1004, 598, 20, 18);
  ctx.beginPath();
  ctx.moveTo(984, 598); ctx.lineTo(984, 616); ctx.lineTo(1022, 616);
  ctx.moveTo(1030, 584); ctx.lineTo(1030, 602); ctx.lineTo(1022, 602);
  ctx.stroke();

  // DESNI HODNIK (East Hall - 4A & 4B)
  // 1B -> 4A
  ctx.fillRect(1068, 468, 46, 20);
  ctx.beginPath();
  ctx.moveTo(1068, 468); ctx.lineTo(1068, 488);
  ctx.moveTo(1114, 468); ctx.lineTo(1114, 488);
  ctx.stroke();

  // Prolaz 4A -> 4B (kontinuirani hodnik)
  ctx.fillRect(1068, 536, 46, 16);
  ctx.beginPath();
  ctx.moveTo(1068, 536); ctx.lineTo(1068, 552);
  ctx.moveTo(1114, 536); ctx.lineTo(1114, 552);
  ctx.stroke();

  // Spoj 4B -> URED (Desna vrata sa skretanjem)
  ctx.fillRect(1068, 598, 20, 18);
  ctx.beginPath();
  ctx.moveTo(1114, 598); ctx.lineTo(1114, 616); ctx.lineTo(1076, 616);
  ctx.moveTo(1068, 584); ctx.lineTo(1068, 602); ctx.lineTo(1076, 602);
  ctx.stroke();

  // 3. SOBE (Blueprint zidovi s jasnim nazivima)
  const rooms = [
    { id: '1A', name: 'BINA',       x: 1005, y: 355, w: 80,  h: 42 },
    { id: '1B', name: 'SALA',       x: 986,  y: 412, w: 118, h: 56 },
    { id: '5',  name: 'BACKSTAGE',  x: 916,  y: 394, w: 58,  h: 48 },
    { id: '1C', name: 'COVE',       x: 924,  y: 456, w: 58,  h: 44 },
    { id: '7',  name: 'TOALETI',    x: 1144, y: 404, w: 62,  h: 48 },
    { id: '6',  name: 'KUHINJA',    x: 1144, y: 470, w: 62,  h: 48 },
    { id: '3',  name: 'ŠPAJZA',     x: 916,  y: 532, w: 58,  h: 44 },
    { id: '2A', name: 'LIJEVI',     x: 984,  y: 486, w: 46,  h: 52 },
    { id: '2B', name: 'KUT LIJEVO', x: 984,  y: 550, w: 46,  h: 48 },
    { id: '4A', name: 'DESNI',      x: 1068, y: 486, w: 46,  h: 52 },
    { id: '4B', name: 'KUT DESNO',  x: 1068, y: 550, w: 46,  h: 48 }
  ];

  rooms.forEach(r => {
    ctx.fillStyle = 'rgba(10, 32, 20, 0.65)';
    ctx.fillRect(r.x, r.y, r.w, r.h);

    ctx.strokeStyle = '#2ee860';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = 'rgba(130, 255, 160, 0.8)';
    ctx.font = 'bold 8px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(r.name, r.x + r.w / 2, r.y + 9);
  });

  // 4. URED (YOU / VI) - Centralna pozicija igrača s otvorima za vrata
  const uX = 1022, uY = 602, uW = 54, uH = 42;
  ctx.fillStyle = '#143820';
  ctx.fillRect(uX, uY, uW, uH);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  // Gornji i donji zid
  ctx.moveTo(uX, uY); ctx.lineTo(uX + uW, uY);
  ctx.moveTo(uX, uY + uH); ctx.lineTo(uX + uW, uY + uH);
  // Lijevi zid s otvorom za vrata
  ctx.moveTo(uX, uY); ctx.lineTo(uX, uY + 6);
  ctx.moveTo(uX, uY + 28); ctx.lineTo(uX, uY + uH);
  // Desni zid s otvorom za vrata
  ctx.moveTo(uX + uW, uY); ctx.lineTo(uX + uW, uY + 6);
  ctx.moveTo(uX + uW, uY + 28); ctx.lineTo(uX + uW, uY + uH);
  ctx.stroke();

  // Status roletni ureda na tlocrtu (crvena blokada ako su spuštene!)
  if (state.leftDoorClosed) {
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(uX, uY + 7); ctx.lineTo(uX, uY + 27); ctx.stroke();
  }
  if (state.rightDoorClosed) {
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(uX + uW, uY + 7); ctx.lineTo(uX + uW, uY + 27); ctx.stroke();
  }

  // Pulsirajući indikator "VI / YOU"
  const pulse = (Math.sin(Date.now() * 0.007) + 1) * 0.5;
  ctx.fillStyle = `rgba(50, 255, 90, ${0.4 + pulse * 0.5})`;
  ctx.beginPath();
  ctx.arc(uX + uW / 2, uY + 18, 4 + pulse * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('URED', uX + uW / 2, uY + 34);

  // 5. RADARSKI SCANLINE
  state.radarScanY = ((state.radarScanY || 0) + 0.6) % mapH;
  const scanGrad = ctx.createLinearGradient(mapX, mapY + state.radarScanY, mapX, mapY + state.radarScanY + 16);
  scanGrad.addColorStop(0, 'rgba(51, 255, 85, 0.16)');
  scanGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = scanGrad;
  ctx.fillRect(mapX, mapY + state.radarScanY, mapW, 16);

  // 6. DUGMAD KAMERA (Interaktivni gumbi s jasnim statusom)
  Object.values(CAMERAS).forEach(cam => {
    const isSelected = state.currentCam === cam.id;
    const bW = 44;
    const bH = 22;
    const bx = cam.x - bW / 2;
    const by = cam.y - bH / 2 + 5;

    if (isSelected) {
      ctx.fillStyle = '#33ff55';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#33ff55';
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = '#102218';
      ctx.strokeStyle = '#28a846';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
    }

    ctx.fillRect(bx, by, bW, bH);
    ctx.strokeRect(bx, by, bW, bH);
    ctx.shadowBlur = 0;

    ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
    ctx.font = 'bold 10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`CAM ${cam.id}`, cam.x, by + 15);
  });

  ctx.restore();
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

  if (state.screen === 'NIGHT_INTRO') {
    renderNightIntro(ctx);
    return;
  }

  if (state.screen === 'PLAYING') {
    if (state.monitorAnim >= 1.0) {
      renderCCTV();
      if (state.camStaticTimer > 0) renderCamStaticGlitch(ctx);
    } else if (state.monitorAnim <= 0.0) {
      renderOffice();
      if (state.goldenFreddy && state.goldenFreddy.inOffice && !state.powerOut) {
        renderGoldenHallucinations(ctx);
      }
    } else {
      // Prijelazna animacija podizanja/spuštanja CCTV monitora
      renderOffice();
      renderMonitorFlip(ctx);
    }
    return;
  }

  if (state.screen === 'JUMPSCARE') {
    if (state.jumpscareChar && state.jumpscareChar.id === 'golden') {
      drawGoldenJumpscare(ctx);
      return;
    }
    drawHorrorJumpscare(ctx);
    return;
  }

  if (state.screen === 'CRASH') {
    renderCrashScreen(ctx);
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
// 10.A ANIMACIJE: NOĆNI INTRO (12:00 AM), MONITOR FLIP I HOROR JUMPSCAREOVI
// ----------------------------------------------------------------------------
function renderNightIntro(ctx) {
  const W = canvas.width;
  const H = canvas.height;
  const t = state.nightIntroTimer;

  // Duboka crna CRT pozadina
  ctx.fillStyle = '#020305';
  ctx.fillRect(0, 0, W, H);

  // Retro horizontalne CRT scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 2);
  }

  // Fade alpha: 0..0.4s fade-in, 0.4..1.8s full, 1.8..2.4s fade-out
  let alpha = 1.0;
  if (t < 0.4) {
    alpha = t / 0.4;
  } else if (t > 1.8) {
    alpha = Math.max(0, (2.4 - t) / 0.6);
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  // Digitalni sat 12:00 AM sa suptilnim neonskim sjajem
  const showColon = Math.floor(t * 3.5) % 2 === 0;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#66ccff';
  ctx.shadowBlur = 14;
  ctx.font = 'bold 76px "Courier New", Courier, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(showColon ? '12:00 AM' : '12 00 AM', W / 2, H / 2 - 35);
  ctx.shadowBlur = 0;

  // Naziv noći (1. Noć, 2. Noć...)
  let nightTitle = `${state.selectedNight}. NOĆ`;
  let engSub = `${state.selectedNight}st Night`;
  if (state.selectedNight === 2) engSub = '2nd Night';
  else if (state.selectedNight === 3) engSub = '3rd Night';
  else if (state.selectedNight === 4) engSub = '4th Night';
  else if (state.selectedNight === 5) engSub = '5th Night (FINAL SHIFT)';
  else if (state.selectedNight === 6) { nightTitle = 'CUSTOM NIGHT'; engSub = 'Custom Night'; }

  ctx.fillStyle = '#dddddd';
  ctx.font = 'bold 32px "Courier New", Courier, monospace';
  ctx.fillText(nightTitle, W / 2, H / 2 + 35);

  ctx.fillStyle = '#778899';
  ctx.font = '16px "Courier New", Courier, monospace';
  ctx.fillText(`[ ${engSub} ]`, W / 2, H / 2 + 70);

  // Donja diskretna uputa za nestrpljive igrače
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '12px "Courier New", Courier, monospace';
  ctx.fillText('[ KLIKNI MIŠEM ZA PRESKAKANJE ]', W / 2, H - 42);

  ctx.restore();
}

function renderMonitorFlip(ctx) {
  const W = canvas.width;
  const H = canvas.height;
  const anim = state.monitorAnim || 0;
  const flipY = (1.0 - anim) * H;

  ctx.save();
  ctx.translate(0, flipY);

  // Monitor feed u pokretu
  renderCCTV();

  // Metalno oklopljeno kućište CRT monitora
  ctx.strokeStyle = '#14161b';
  ctx.lineWidth = 16;
  ctx.strokeRect(0, 0, W, H);

  ctx.fillStyle = '#242830';
  ctx.fillRect(0, 0, W, 22);
  ctx.fillRect(0, H - 22, W, 22);
  ctx.fillStyle = '#0a0c0f';
  ctx.fillRect(W / 2 - 90, 4, 180, 14);

  // Statički bljesak tijekom podizanja
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(51,255,85,0.18)';
    ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 200, 2.5);
  }

  ctx.restore();
}

function renderCamStaticGlitch(ctx) {
  const W = canvas.width;
  const H = canvas.height;
  for (let i = 0; i < 75; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255, 255, 255, 0.45)' : 'rgba(51, 255, 85, 0.35)';
    ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 260, Math.random() * 5 + 1);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(0, 0, W, H);
}

function drawHorrorJumpscare(ctx) {
  const W = canvas.width;
  const H = canvas.height;
  const t = state.jumpscareTimer;
  const ch = state.jumpscareChar || getCharById('mudja');

  // 1. Ekstremni stroboskop (crno, tamno crveno, krvavo crveno, povremena bijela munja)
  const flashCycle = Math.floor(t * 34) % 4;
  const colors = ['#050000', '#2d0004', '#000000', '#550008'];
  if (Math.sin(t * 50) > 0.94) {
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.fillStyle = colors[flashCycle];
  }
  ctx.fillRect(0, 0, W, H);

  // 2. VHS film grain i scanlines
  for (let i = 0; i < 35; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255, 30, 30, 0.28)' : 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(0, Math.random() * H, W, Math.random() * 4 + 1);
  }

  // 3. Agresivni lunge (animatronik juri ravno u kameru prema licu igrača)
  const lunge = 1.15 + Math.min(1.25, t * 1.7);
  const shakeIntensity = 38 + t * 24;
  const shakeX = (Math.random() - 0.5) * shakeIntensity;
  const shakeY = (Math.random() - 0.5) * shakeIntensity;

  const headAngle = Math.sin(t * 40) * 0.22;
  const jawDrop = Math.abs(Math.sin(t * 34)) * 36; // 17 Hz snapping jaw!

  const cx = W / 2 + shakeX;
  const cy = H / 2 + shakeY - 15;
  const baseRadius = 140 * lunge;

  // 4. CHROMATIC ABERRATION (RGB 3D Split - crveni i cijan pomak)
  ctx.save();
  ctx.globalAlpha = 0.38;
  drawJumpscareFace(ctx, ch, cx - 18, cy, baseRadius, jawDrop, headAngle, '#ff1111');
  drawJumpscareFace(ctx, ch, cx + 18, cy, baseRadius, jawDrop, headAngle, '#00ffff');
  ctx.restore();

  // 5. Glavni visokodeteljan horor animatronik
  drawJumpscareFace(ctx, ch, cx, cy, baseRadius, jawDrop, headAngle, null);

  // 6. Subliminalni horor flash tekst
  if (Math.sin(t * 44) > 0.82) {
    ctx.save();
    ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#ff0000';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    const subWords = ['TO JE KRAJ!', 'NEMA SPAVANJA!', '1987', 'BANOVAN!', 'KAFANA'];
    ctx.fillText(subWords[Math.floor(Math.random() * subWords.length)], W / 2, 85);
    ctx.restore();
  }

  // 7. Krik lika na dnu
  ctx.fillStyle = '#ff2222';
  ctx.font = 'bold 34px Courier New';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 10;
  ctx.fillText(`"${ch.cry}"`, W / 2 + shakeX * 0.3, H - 55);
  ctx.shadowBlur = 0;
}

function drawJumpscareFace(ctx, ch, cx, cy, radius, jawDrop, headAngle, tintColor) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(headAngle);

  const mainColor = tintColor || ch.color;
  const hatColor = tintColor || ch.hatColor;

  // 1. Endoskeleton vrat i hidraulične cijevi
  ctx.fillStyle = tintColor || '#1a1c22';
  ctx.fillRect(-radius * 0.22, radius * 0.6, radius * 0.44, radius * 0.6);
  ctx.strokeStyle = tintColor || '#444b55';
  ctx.lineWidth = 3;
  ctx.strokeRect(-radius * 0.22, radius * 0.6, radius * 0.44, radius * 0.6);

  // Viseće žice na vratu
  if (!tintColor) {
    const wireColors = ['#ff2222', '#ffbb00', '#00ccff'];
    wireColors.forEach((wc, wi) => {
      ctx.strokeStyle = wc;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.15 + wi * (radius * 0.15), radius * 0.7);
      ctx.quadraticCurveTo(-radius * 0.2 + wi * (radius * 0.2), radius * 1.1, -radius * 0.1 + wi * (radius * 0.1), radius * 1.2);
      ctx.stroke();
    });
  }

  // 2. DONJA ČELJUST KOJA SE OTVARA I GRIZE (Snapping Jaw)
  ctx.save();
  ctx.translate(0, jawDrop * (radius / 140));

  // Šupljina otvorenih usta / ponor grla
  ctx.fillStyle = tintColor || '#020101';
  ctx.fillRect(-radius * 0.52, radius * 0.18, radius * 1.04, radius * 0.55);

  // Oštri donji endoskeleton zubi
  ctx.fillStyle = tintColor || '#d8dbe2';
  ctx.strokeStyle = tintColor || '#111';
  ctx.lineWidth = 1.5;
  const toothW = radius * 0.11;
  for (let tx = -radius * 0.44; tx <= radius * 0.35; tx += toothW) {
    ctx.beginPath();
    ctx.moveTo(tx, radius * 0.62);
    ctx.lineTo(tx + toothW / 2, radius * 0.38);
    ctx.lineTo(tx + toothW, radius * 0.62);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  // Metalna vilica / brada
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(-radius * 0.5, radius * 0.55, radius * 1.0, radius * 0.35, 12);
  } else {
    ctx.rect(-radius * 0.5, radius * 0.55, radius * 1.0, radius * 0.35);
  }
  ctx.fill();
  ctx.strokeStyle = tintColor || '#0a0a0f';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // 3. GORNJA GLAVA
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.arc(0, -radius * 0.05, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = tintColor || '#0a0a0f';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Oštri gornji endoskeleton zubi
  ctx.fillStyle = tintColor || '#e8ecf2';
  ctx.strokeStyle = tintColor || '#111';
  ctx.lineWidth = 1.5;
  for (let tx = -radius * 0.44; tx <= radius * 0.35; tx += toothW) {
    ctx.beginPath();
    ctx.moveTo(tx, radius * 0.22);
    ctx.lineTo(tx + toothW / 2, radius * 0.42);
    ctx.lineTo(tx + toothW, radius * 0.22);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  // 4. OČNE ŠUPLJINE I TITRAJUĆE HOROR OČI
  const eyeOffX = radius * 0.38;
  const eyeY = -radius * 0.18;
  const eyeR = radius * 0.28;

  // Crne duboke šupljine
  ctx.fillStyle = tintColor || '#000000';
  ctx.beginPath();
  ctx.arc(-eyeOffX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(eyeOffX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = tintColor || '#181010';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Krvave kapilare oko očiju
  if (!tintColor) {
    ctx.strokeStyle = 'rgba(255, 30, 30, 0.55)';
    ctx.lineWidth = 1.5;
    [-eyeOffX, eyeOffX].forEach(ex => {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * eyeR * 0.4, eyeY + Math.sin(a) * eyeR * 0.4);
        ctx.lineTo(ex + Math.cos(a) * eyeR * 0.95, eyeY + Math.sin(a) * eyeR * 0.95);
        ctx.stroke();
      }
    });
  }

  // Zjenice koje gore u tami
  const jitterX = (Math.random() - 0.5) * 4;
  const jitterY = (Math.random() - 0.5) * 4;
  const pupilR = radius * 0.08;

  if (tintColor) {
    ctx.fillStyle = tintColor;
  } else if (ch.id === 'golden') {
    ctx.fillStyle = '#ffffff';
  } else if (ch.id === 'omco') {
    ctx.fillStyle = '#ff0000';
  } else {
    ctx.fillStyle = Math.random() < 0.2 ? '#ffffff' : '#ff2222';
  }

  ctx.beginPath();
  ctx.arc(-eyeOffX + jitterX, eyeY + jitterY, pupilR, 0, Math.PI * 2);
  ctx.arc(eyeOffX + jitterX, eyeY + jitterY, pupilR, 0, Math.PI * 2);
  ctx.fill();

  // Sićušne bijele jezgre u zjenicama
  if (!tintColor) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-eyeOffX + jitterX, eyeY + jitterY, pupilR * 0.4, 0, Math.PI * 2);
    ctx.arc(eyeOffX + jitterX, eyeY + jitterY, pupilR * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. OBRVE / MRŠTENJE
  ctx.strokeStyle = tintColor || '#0a0a0d';
  ctx.lineWidth = radius * 0.1;
  ctx.beginPath();
  ctx.moveTo(-eyeOffX - eyeR * 0.8, eyeY - eyeR * 0.8);
  ctx.lineTo(-eyeOffX + eyeR * 0.7, eyeY - eyeR * 0.25);
  ctx.moveTo(eyeOffX + eyeR * 0.8, eyeY - eyeR * 0.8);
  ctx.lineTo(eyeOffX - eyeR * 0.7, eyeY - eyeR * 0.25);
  ctx.stroke();

  // 6. SPECIFIČNI DETALJI LIKOVA
  if (ch.id === 'mudja') {
    ctx.fillStyle = hatColor;
    ctx.fillRect(-radius * 0.32, -radius * 1.48, radius * 0.64, radius * 0.5);
    ctx.fillRect(-radius * 0.46, -radius * 1.02, radius * 0.92, radius * 0.12);
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(-radius * 0.75, -radius * 0.75, radius * 0.3, 0, Math.PI * 2);
    ctx.arc(radius * 0.75, -radius * 0.75, radius * 0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else if (ch.id === 'baka') {
    const earWiggle = Math.sin(Date.now() * 0.04) * 0.15;
    ctx.save();
    ctx.rotate(earWiggle);
    ctx.fillStyle = mainColor;
    ctx.fillRect(-radius * 0.65, -radius * 1.85, radius * 0.28, radius * 0.95);
    ctx.fillRect(radius * 0.37, -radius * 1.85, radius * 0.28, radius * 0.95);
    ctx.fillStyle = tintColor || '#ff99cc';
    ctx.fillRect(-radius * 0.57, -radius * 1.75, radius * 0.12, radius * 0.75);
    ctx.fillRect(radius * 0.45, -radius * 1.75, radius * 0.12, radius * 0.75);
    ctx.restore();
  } else if (ch.id === 'choda') {
    ctx.fillStyle = tintColor || '#ff8800';
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.15, radius * 0.36, radius * 0.22, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else if (ch.id === 'omco') {
    ctx.fillStyle = tintColor || '#111';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.8, -radius * 0.6);
    ctx.lineTo(radius * 0.8, -radius * 0.6);
    ctx.lineTo(0, -radius * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = tintColor || '#d0d0d8';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(radius * 0.85, radius * 0.4, radius * 0.35, 0, Math.PI * 1.5);
    ctx.stroke();
  } else if (ch.id === 'puppet') {
    ctx.fillStyle = tintColor || '#7b1fa2';
    ctx.fillRect(-eyeOffX - 6, eyeY + 14, 12, radius * 0.7);
    ctx.fillRect(eyeOffX - 6, eyeY + 14, 12, radius * 0.7);
    ctx.fillStyle = tintColor || '#dd2c00';
    ctx.beginPath();
    ctx.arc(-radius * 0.65, radius * 0.25, radius * 0.18, 0, Math.PI * 2);
    ctx.arc(radius * 0.65, radius * 0.25, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ----------------------------------------------------------------------------
// 10.B AUTENTIČNE MEHANIKE I VIZUALI ZA GOLDEN FREDDYJA (ZLATNI MUĐA)
// ----------------------------------------------------------------------------
function checkGoldenFreddyPoster() {
  if (!state.goldenFreddy || state.goldenFreddy.inOffice || state.goldenFreddy.posterActive) return;
  // Šansa za pojavu plakata Zlatnog Muđe na CAM 2B (~3.5% po prebacivanju, 6% na Noći 5 i Custom)
  const chance = state.selectedNight >= 5 ? 0.06 : 0.035;
  if (Math.random() < chance) {
    state.goldenFreddy.posterActive = true;
  }
}

function triggerGoldenJumpscare() {
  if (state.screen !== 'PLAYING') return;
  state.screen = 'JUMPSCARE';
  state.camOpen = false;
  state.windingTape = false;
  state.jumpscareChar = getCharById('golden') || {
    id: 'golden',
    name: 'Zlatni Muđa',
    cry: 'TO SAM JA! (IT\'S ME)',
    color: '#d4af37',
    hatColor: '#0a0b12',
    pitch: 110
  };
  state.jumpscareTimer = 0;
  state.endReason = 'ZLATNI MUĐA TE PREUZEO (NISI DIGAO MONITOR NA VRIJEME)';
  document.getElementById('hud-layer').classList.add('hidden');
  document.getElementById('phone-box').classList.add('hidden');
  audio.stopPhoneSpeech();
  audio.updateContinuousAudio(false, false, false, false);
  audio.playGoldenJumpscareScream();

  if (state.devStats) {
    state.devStats.outcome = 'PORAZ: ZLATNI MUĐA (GOLDEN FREDDY)';
    state.devStats.remainingPower = state.power;
    if (state.devStats.enabled) printDevSummary();
  }
}

function drawGoldenFreddySlumped(ctx, x, y, scale = 1.0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Kontaktna sjena na podu
  const shadowGrad = ctx.createRadialGradient(0, 10, 10, 0, 10, 110);
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
  shadowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(0, 10, 110, 42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Noge sklupčane na podu
  ctx.fillStyle = '#b38f26';
  ctx.strokeStyle = '#221a00';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(-55, 0, 38, 22, -0.3, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(55, 0, 38, 22, 0.3, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Torzo nagnut prema naprijed
  const torsoGrad = ctx.createLinearGradient(0, -90, 0, 0);
  torsoGrad.addColorStop(0, '#e6b800');
  torsoGrad.addColorStop(0.7, '#c99700');
  torsoGrad.addColorStop(1, '#8a6800');
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.moveTo(-50, 0);
  ctx.lineTo(-44, -85);
  ctx.quadraticCurveTo(0, -100, 44, -85);
  ctx.lineTo(50, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#221a00';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Trbuh
  ctx.fillStyle = '#f5cc33';
  ctx.beginPath();
  ctx.ellipse(0, -38, 30, 36, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crna mašna na vratu
  ctx.fillStyle = '#0c0d12';
  ctx.beginPath();
  ctx.moveTo(0, -78);
  ctx.lineTo(-18, -88);
  ctx.lineTo(-18, -68);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -78);
  ctx.lineTo(18, -88);
  ctx.lineTo(18, -68);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -78, 5, 0, Math.PI * 2);
  ctx.fill();

  // Ruke položene mlohavo na pod
  ctx.fillStyle = '#c99700';
  ctx.strokeStyle = '#221a00';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(-65, -35, 16, 45, 0.45, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(65, -35, 16, 45, -0.45, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Šape
  ctx.beginPath();
  ctx.arc(-82, 5, 15, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.arc(82, 5, 15, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Mikrofon kraj desne šape
  ctx.fillStyle = '#666';
  ctx.fillRect(88, -2, 22, 6);
  ctx.fillStyle = '#999';
  ctx.beginPath();
  ctx.arc(114, 1, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glava nagnuta u stranu
  ctx.save();
  ctx.translate(6, -112);
  ctx.rotate(0.38);

  // Uši
  ctx.fillStyle = '#c99700';
  ctx.strokeStyle = '#221a00';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-42, -45, 16, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#181200';
  ctx.beginPath();
  ctx.arc(-42, -45, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c99700';
  ctx.beginPath();
  ctx.arc(42, -45, 16, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#181200';
  ctx.beginPath();
  ctx.arc(42, -45, 9, 0, Math.PI * 2);
  ctx.fill();

  // Lubanja
  const headGrad = ctx.createRadialGradient(0, -10, 10, 0, 0, 52);
  headGrad.addColorStop(0, '#f2ca38');
  headGrad.addColorStop(0.7, '#d4a017');
  headGrad.addColorStop(1, '#8f6800');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#221a00';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Njuška
  ctx.fillStyle = '#fce268';
  ctx.beginPath();
  ctx.ellipse(-16, 12, 18, 14, 0, 0, Math.PI * 2);
  ctx.ellipse(16, 12, 18, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Nos
  ctx.fillStyle = '#0a0a0f';
  ctx.beginPath();
  ctx.ellipse(0, 6, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Čeljust
  ctx.fillStyle = '#060608';
  ctx.fillRect(-22, 24, 44, 18);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  for (let z = -16; z <= 16; z += 8) {
    ctx.fillStyle = '#ddd';
    ctx.fillRect(z - 2, 25, 5, 6);
  }

  // Crne očne šupljine
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(-20, -12, 14, 0, Math.PI * 2);
  ctx.arc(20, -12, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1400';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Sićušne svijetleće bijele točke
  const eyeFlicker = Math.sin(Date.now() * 0.03) > -0.7;
  if (eyeFlicker) {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(-20, -12, 2.5, 0, Math.PI * 2);
    ctx.arc(20, -12, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Crni cilindar
  ctx.fillStyle = '#0a0b10';
  ctx.fillRect(-28, -50, 56, 7);
  ctx.fillRect(-18, -78, 36, 28);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(-18, -54, 36, 4);

  ctx.restore();
  ctx.restore();
}

function renderGoldenHallucinations(ctx) {
  const W = canvas.width;
  const H = canvas.height;
  const t = Date.now() * 0.001;

  // Brzi bljeskovi teksta "IT'S ME" / "TO SAM JA!"
  const showText = Math.sin(t * 22) > 0.05;
  if (showText) {
    ctx.save();
    const words = ["IT'S ME", "TO SAM JA!", "1987", "IT'S ME", "TO SAM JA!"];
    const w = words[Math.floor(Math.random() * words.length)];
    ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#ff2222';
    ctx.font = `bold ${Math.floor(32 + Math.random() * 32)}px Courier New`;
    ctx.textAlign = 'center';
    const rx = 150 + Math.random() * (W - 300);
    const ry = 100 + Math.random() * (H - 200);
    ctx.fillText(w, rx, ry);
    ctx.restore();
  }

  // Negativni kratki bljesak
  if (Math.sin(t * 37) > 0.88) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawGoldenJumpscare(ctx) {
  const W = canvas.width;
  const H = canvas.height;
  const shakeX = (Math.random() - 0.5) * 45;
  const shakeY = (Math.random() - 0.5) * 45;

  ctx.fillStyle = Math.floor(state.jumpscareTimer * 24) % 2 === 0 ? '#1f1500' : '#050200';
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,215,0' : '255,0,0'}, ${Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 200, Math.random() * 12);
  }

  const gfChar = getCharById('golden') || { color: '#d4af37', hatColor: '#0a0b12' };
  drawCharacterPortrait(ctx, gfChar, W / 2 + shakeX, H / 2 + shakeY - 10, 310, true);

  ctx.fillStyle = Math.random() < 0.5 ? '#ffff00' : '#ff1111';
  ctx.font = 'bold 44px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('IT\'S ME // TO SAM JA!', W / 2 + (Math.random() - 0.5) * 16, H - 45);
}

function renderCrashScreen(ctx) {
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#000005';
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 400; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(255,0,0,0.18)';
    ctx.fillRect(x, y, Math.random() * 80, 2);
  }

  ctx.fillStyle = '#ff2222';
  ctx.font = 'bold 36px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('FATAL EXCEPTION 1987: KAFANA.EXE CRASHED', W / 2, 260);

  ctx.fillStyle = '#eeddbb';
  ctx.font = '24px Courier New';
  ctx.fillText('*** TO SAM JA! (IT\'S ME) ***', W / 2, 330);

  ctx.fillStyle = '#888';
  ctx.font = '16px Courier New';
  ctx.fillText('A supernatural anomaly was detected in Office memory.', W / 2, 400);
  ctx.fillText('Nisi podigao monitor na vrijeme i Zlatni Muđa je srušio igru.', W / 2, 430);

  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 18px Courier New';
  ctx.fillText('[ KLIKNI BILO GDJE ZA POVRATAK U GLAVNI MENI ]', W / 2, 540);
}

window.triggerGoldenFreddy = () => {
  if (state.screen !== 'PLAYING') return 'Moraš pokrenuti smjenu (PLAYING)!';
  state.goldenFreddy.posterActive = false;
  state.goldenFreddy.inOffice = true;
  state.goldenFreddy.timer = 0;
  audio.playGoldenLaugh();
  return '⚠️ Zlatni Muđa (Golden Freddy) se stvorio u uredu! Podigni monitor za obranu.';
};
window.triggerGoldenPoster = () => {
  if (!state.goldenFreddy) return 'Igra nije pokrenuta!';
  state.goldenFreddy.posterActive = true;
  return '⚠️ Plakat Zlatnog Muđe je aktivan na CAM 2B! Spusti monitor nakon gledanja za pojavu u uredu.';
};

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

  // Promijeni kursor u 'pointer' kad je miš iznad klikabilnih tipki
  if (state.screen === 'PLAYING') {
    let isClickable = false;
    if (state.camOpen) {
      if (pos.x >= 59 && pos.x <= 421 && pos.y >= 599 && pos.y <= 637) isClickable = true;
      if (state.currentCam === '2B' && pos.x >= 170 && pos.x <= 285 && pos.y >= 180 && pos.y <= 325) isClickable = true;
      for (const cam of Object.values(CAMERAS)) {
        if (pos.x >= cam.x - 24 && pos.x <= cam.x + 24 && pos.y >= cam.y - 12 && pos.y <= cam.y + 18) {
          isClickable = true;
          break;
        }
      }
    } else {
      const worldX = pos.x + state.panX;
      const worldY = pos.y;
      if (Math.hypot(worldX - 900, worldY - 158) <= 28) isClickable = true;
      // Lijevi i desni paneli (DOOR i LIGHT)
      if ((worldX >= 45 && worldX <= 103 && worldY >= 304 && worldY <= 426) ||
          (worldX >= 1705 && worldX <= 1763 && worldY >= 304 && worldY <= 426)) {
        isClickable = true;
      }
    }
    canvas.style.cursor = isClickable ? 'pointer' : 'default';
  } else {
    canvas.style.cursor = 'default';
  }
});

canvas.addEventListener('mousedown', e => {
  audio.init();
  const pos = getCanvasMousePos(e);

  if (state.screen === 'NIGHT_INTRO') {
    state.nightIntroTimer = state.nightIntroMax;
    return;
  }

  if (state.screen === 'GAMEOVER' || state.screen === 'CRASH') {
    state.screen = 'MENU';
    document.getElementById('menu-screen').classList.remove('hidden');
    document.getElementById('hud-layer').classList.add('hidden');
    document.getElementById('phone-box').classList.add('hidden');
    audio.updateContinuousAudio(false, false, false, false);
    audio.stopPhoneSpeech();
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
    // Klik na plakat na CAM 2B ("HONK" Easter Egg + promjena plakata)
    if (state.currentCam === '2B' && pos.x >= 170 && pos.x <= 285 && pos.y >= 180 && pos.y <= 325) {
      audio.playHonk();
      if (state.goldenFreddy) {
        state.goldenFreddy.posterActive = !state.goldenFreddy.posterActive;
      }
      return;
    }

    // Provjeri klik na gumb kazetofona (CAM 5)
    if (pos.x >= 59 && pos.x <= 421 && pos.y >= 599 && pos.y <= 637) {
      if (state.currentCam !== '5') {
        state.currentCam = '5';
        state.camStaticTimer = 0.16;
        audio.playCamStaticBurst();
        audio.playCamBlip();
      } else {
        state.windingTape = true;
      }
      return;
    }

    // Provjeri klik na kamere na tlocrtu
    for (const cam of Object.values(CAMERAS)) {
      if (pos.x >= cam.x - 24 && pos.x <= cam.x + 24 && pos.y >= cam.y - 12 && pos.y <= cam.y + 18) {
        state.currentCam = cam.id;
        state.camStaticTimer = 0.16;
        state.windingTape = false;
        if (cam.id === '2B') checkGoldenFreddyPoster();
        audio.playCamStaticBurst();
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

    // 2. Lijevi panel (DOOR & LIGHT) - SAMO PUTEM KLIKA
    if (worldX >= 45 && worldX <= 103 && worldY >= 304 && worldY <= 356) {
      toggleLeftDoor();
      return;
    }
    if (worldX >= 45 && worldX <= 103 && worldY >= 374 && worldY <= 426) {
      toggleLeftLight();
      return;
    }

    // 3. Desni panel (DOOR & LIGHT) - SAMO PUTEM KLIKA
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

// Tipkovnica: UKLONJENI klikovi na [A], [D], [Z], [C] i [F] test
window.addEventListener('keydown', e => {
  if (state.screen !== 'PLAYING') return;
  const key = e.key.toLowerCase();

  if (e.code === 'Space') {
    e.preventDefault();
    toggleCameraMonitor();
  } else if (['1', '2', '3', '4', '5', '6'].includes(key)) {
    const found = Object.values(CAMERAS).find(c => c.key === key);
    if (found) {
      if (!state.camOpen) toggleCameraMonitor();
      state.currentCam = found.id;
      state.camStaticTimer = 0.16;
      if (found.id === '2B') checkGoldenFreddyPoster();
      audio.playCamStaticBurst();
      audio.playCamBlip();
    }
  }
});



// ============================================================================
// 3D PERSPEKTIVNE PROSTORIJE (SVIH 11 KAMERA)
// ============================================================================


// ============================================================================
// REALISTIČNO 3D RENDERIRANJE CIJELOG TIJELA ANIMATRONIKA U SOBAMA
// ============================================================================

function drawFullBodyAnimatronic(ctx, charCfg, groundX, groundY, totalHeight, pose = 'room', ambient = 1.0) {
  const H = totalHeight;
  const X = groundX;
  const Y = groundY;

  ctx.save();

  // 1. SJENA POD NOGAMA NA 3D PODU
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.beginPath();
  ctx.ellipse(X, Y, H * 0.22, H * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Dimenzije dijelova tijela u prirodnim animatronik omjerima
  const legH = H * 0.40;
  const hipSep = H * 0.085;
  const pelvisY = Y - legH;
  const torsoH = H * 0.32;
  const chestW = H * 0.25;
  const chestY = pelvisY - torsoH * 0.52;
  const shoulderY = pelvisY - torsoH * 0.95;
  const neckH = H * 0.055;
  const headR = H * 0.135;
  const headY = shoulderY - neckH - headR * 0.82;

  // Boje animatronika prilagođene ambijentalnom svjetlu prostorije
  const suitColor = charCfg.color || '#aa5522';
  const darkMetal = '#20242b';
  const jointMetal = '#6b7482';

  // Mikro-mehanički titraj glave i tijela
  const microTwitch = Math.sin(Date.now() * 0.003 + groundX * 0.05) * 0.02;

  // 2. ANIMATRONIK STOPALA I NOGE
  const drawAnimatronicLeg = (legX, isLeft) => {
    const kneeY = Y - legH * 0.50;
    const footY = Y - 4;

    // A. Metalno stopalo s 3 zglobna prsta
    ctx.fillStyle = darkMetal;
    ctx.beginPath();
    ctx.ellipse(legX, footY, H * 0.065, H * 0.025, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3 prsta na stopalu
    for (let t = -1; t <= 1; t++) {
      ctx.fillStyle = '#444c59';
      ctx.beginPath();
      ctx.arc(legX + t * (H * 0.038), footY + 2, H * 0.016, 0, Math.PI * 2);
      ctx.fill();
    }

    // B. Potkoljenica (Suit casing + metalni zglob)
    ctx.fillStyle = suitColor;
    ctx.beginPath();
    ctx.roundRect(legX - H * 0.036, kneeY + 4, H * 0.072, footY - kneeY - 8, 4);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Koljenski zglob (okrugla metalna šarka)
    ctx.fillStyle = jointMetal;
    ctx.beginPath();
    ctx.arc(legX, kneeY, H * 0.024, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.stroke();

    // C. Natkoljenica (Suit casing prema zdjelici)
    ctx.fillStyle = suitColor;
    ctx.beginPath();
    ctx.roundRect(legX - H * 0.040, pelvisY + 6, H * 0.080, kneeY - pelvisY - 8, 5);
    ctx.fill();
    ctx.stroke();
  };

  drawAnimatronicLeg(X - hipSep, true);
  drawAnimatronicLeg(X + hipSep, false);

  // 3. ZDJELICA I HIDRAULIČNA KRALJEŽNICA
  ctx.fillStyle = darkMetal;
  ctx.beginPath();
  ctx.roundRect(X - H * 0.09, pelvisY - 2, H * 0.18, H * 0.065, 4);
  ctx.fill();

  // Kralježnica od hidrauličnih cilindara s vidljivim žicama
  ctx.fillStyle = jointMetal;
  ctx.fillRect(X - H * 0.025, pelvisY - torsoH * 0.22, H * 0.05, torsoH * 0.25);

  // Žice na struku
  ctx.strokeStyle = '#cc2222';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X - H * 0.05, pelvisY);
  ctx.quadraticCurveTo(X - H * 0.08, pelvisY - torsoH * 0.12, X - H * 0.02, pelvisY - torsoH * 0.2);
  ctx.stroke();

  // 4. PRSA I TORZO (KARAKTERISTIČAN ZA SVAKOG STREAMAERA)
  ctx.save();
  ctx.fillStyle = suitColor;
  ctx.beginPath();
  ctx.ellipse(X, chestY, chestW * 0.5, torsoH * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Specifični detalji na trbuhu i prsima
  if (charCfg.id === 'mudja') {
    // Muđa (Freddy stil): Svjetliji trbuh i crna leptir-mašna
    ctx.fillStyle = '#ba7e44';
    ctx.beginPath();
    ctx.ellipse(X, chestY + torsoH * 0.06, chestW * 0.36, torsoH * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dva crna gumba na trbuhu
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(X, chestY, 3.5, 0, Math.PI * 2);
    ctx.arc(X, chestY + torsoH * 0.14, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Crna satenska leptir mašna
    ctx.fillStyle = '#151515';
    ctx.beginPath();
    ctx.moveTo(X - H * 0.055, shoulderY + H * 0.03);
    ctx.lineTo(X + H * 0.055, shoulderY + H * 0.065);
    ctx.lineTo(X + H * 0.055, shoulderY + H * 0.03);
    ctx.lineTo(X - H * 0.055, shoulderY + H * 0.065);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X, shoulderY + H * 0.048, 4.5, 0, Math.PI * 2);
    ctx.fill();

  } else if (charCfg.id === 'baka') {
    // Baka (Bonnie stil): Svijetloplavi trbuh + MASIVNI ZLATNI BALKANSKI LANAC
    ctx.fillStyle = '#737bd4';
    ctx.beginPath();
    ctx.ellipse(X, chestY + torsoH * 0.06, chestW * 0.36, torsoH * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Zlatni lanac i medaljon
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(X, shoulderY + H * 0.08, chestW * 0.32, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(X, shoulderY + H * 0.16, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Crvena leptir mašna
    ctx.fillStyle = '#cc1122';
    ctx.beginPath();
    ctx.moveTo(X - H * 0.045, shoulderY + H * 0.03);
    ctx.lineTo(X + H * 0.045, shoulderY + H * 0.055);
    ctx.lineTo(X + H * 0.045, shoulderY + H * 0.03);
    ctx.lineTo(X - H * 0.045, shoulderY + H * 0.055);
    ctx.closePath();
    ctx.fill();

  } else if (charCfg.id === 'choda') {
    // Choda (Chica stil): Žuti trbuh + BIJELI PODBRADAK "VOLIM ĆEVAPE!"
    ctx.fillStyle = '#f0cc35';
    ctx.beginPath();
    ctx.ellipse(X, chestY + torsoH * 0.06, chestW * 0.36, torsoH * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bijeli trokutasti podbradak
    ctx.fillStyle = '#f7f7f7';
    ctx.beginPath();
    ctx.moveTo(X - chestW * 0.42, shoulderY + H * 0.02);
    ctx.lineTo(X + chestW * 0.42, shoulderY + H * 0.02);
    ctx.lineTo(X, chestY + torsoH * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ccaa22';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Natpis na podbratku
    ctx.fillStyle = '#cc1122';
    ctx.font = 'bold 9px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('VOLIM', X, chestY - torsoH * 0.02);
    ctx.fillStyle = '#9911aa';
    ctx.fillText('ĆEVAPE!', X, chestY + torsoH * 0.12);

  } else if (charCfg.id === 'omco') {
    // Omčo (Foxy stil): Poderano krzno i vidljiva metalna rebra
    ctx.fillStyle = '#181b20';
    ctx.fillRect(X - chestW * 0.3, chestY - torsoH * 0.15, chestW * 0.6, torsoH * 0.32);
    ctx.strokeStyle = jointMetal;
    ctx.lineWidth = 2.5;
    for (let rib = -2; rib <= 2; rib++) {
      ctx.beginPath();
      ctx.moveTo(X - chestW * 0.26, chestY + rib * 7);
      ctx.lineTo(X + chestW * 0.26, chestY + rib * 7);
      ctx.stroke();
    }
  }
  ctx.restore();

  // 5. RUKE I REKVIZITI (MIKROFON, GITARA, PLJESKAVICA, KUKA)
  const drawArm = (armX, isLeft) => {
    const sX = armX;
    const sY = shoulderY + H * 0.03;
    const elbowX = isLeft ? (sX - H * 0.07) : (sX + H * 0.07);
    const elbowY = sY + H * 0.14;
    const handX = isLeft ? (elbowX + H * 0.02) : (elbowX - H * 0.02);
    const handY = elbowY + H * 0.12;

    // Nadlaktica
    ctx.strokeStyle = suitColor;
    ctx.lineWidth = H * 0.055;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sX, sY); ctx.lineTo(elbowX, elbowY);
    ctx.stroke();

    // Zglob lakta
    ctx.fillStyle = jointMetal;
    ctx.beginPath();
    ctx.arc(elbowX, elbowY, H * 0.022, 0, Math.PI * 2);
    ctx.fill();

    // Podlaktica
    ctx.beginPath();
    ctx.moveTo(elbowX, elbowY); ctx.lineTo(handX, handY);
    ctx.stroke();

    // Šaka s animatronik prstima
    ctx.fillStyle = darkMetal;
    ctx.beginPath();
    ctx.arc(handX, handY, H * 0.024, 0, Math.PI * 2);
    ctx.fill();

    return { handX, handY };
  };

  const leftArm = drawArm(X - chestW * 0.44, true);
  const rightArm = drawArm(X + chestW * 0.44, false);

  // Rekviziti u rukama likova:
  if (charCfg.id === 'mudja') {
    // Vintage kromirani mikrofon u desnoj ruci
    const mX = rightArm.handX + 4;
    const mY = rightArm.handY - 8;
    ctx.fillStyle = '#111';
    ctx.fillRect(mX - 2, mY, 4, 18);
    ctx.fillStyle = '#d5dde8';
    ctx.beginPath();
    ctx.arc(mX, mY - 4, 6, 0, Math.PI * 2);
    ctx.fill();

  } else if (charCfg.id === 'baka') {
    // Crvena električna rock gitara u rukama
    ctx.save();
    const gX = X - H * 0.02;
    const gY = chestY + H * 0.08;
    ctx.translate(gX, gY);
    ctx.rotate(-0.35);

    // Tijelo gitare
    ctx.fillStyle = '#cc1122';
    ctx.beginPath();
    ctx.roundRect(-24, -14, 48, 28, 8);
    ctx.fill();

    // Bijeli pickguard
    ctx.fillStyle = '#fff';
    ctx.fillRect(-10, -8, 20, 16);

    // Vrat gitare
    ctx.fillStyle = '#d9a76a';
    ctx.fillRect(20, -4, 42, 8);
    ctx.fillStyle = '#222';
    ctx.fillRect(60, -6, 10, 12);
    ctx.restore();

  } else if (charCfg.id === 'choda') {
    // Tanjur s balkanskom pljeskavicom i svijećicom (Chica cupcake stil)
    const pX = rightArm.handX + 12;
    const pY = rightArm.handY - 6;
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath();
    ctx.ellipse(pX, pY, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pljeskavica
    ctx.fillStyle = '#5c2d12';
    ctx.beginPath();
    ctx.ellipse(pX, pY - 5, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Plamičak svijeće
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(pX, pY - 14, 3, 0, Math.PI * 2);
    ctx.fill();

  } else if (charCfg.id === 'omco') {
    // Metalna gusarska kuka
    const hX = rightArm.handX;
    const hY = rightArm.handY;
    ctx.strokeStyle = '#d5dde8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(hX + 4, hY - 6, 9, 0.4, Math.PI * 1.5, false);
    ctx.stroke();
  }

  // 6. VRAT I GLAVA ANIMATRONIKA
  ctx.save();
  ctx.translate(X, headY);
  ctx.rotate(microTwitch);

  // Metalni vrat s prstenovima
  ctx.fillStyle = jointMetal;
  ctx.fillRect(-H * 0.024, headR * 0.65, H * 0.048, neckH * 1.3);

  // UŠI / ŠEŠIR
  if (charCfg.id === 'mudja') {
    // Medvjeđe uši na metalnim nosačima
    ctx.fillStyle = suitColor;
    ctx.beginPath();
    ctx.arc(-headR * 0.85, -headR * 0.82, headR * 0.34, 0, Math.PI * 2);
    ctx.arc(headR * 0.85, -headR * 0.82, headR * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.stroke();

    // Crni cilindar (Top Hat) s crvenom vrpcom
    ctx.fillStyle = '#111';
    ctx.fillRect(-headR * 0.55, -headR * 1.05, headR * 1.1, headR * 0.18); // Obod
    ctx.fillRect(-headR * 0.36, -headR * 1.85, headR * 0.72, headR * 0.82); // Klobuk
    ctx.fillStyle = '#cc2222';
    ctx.fillRect(-headR * 0.36, -headR * 1.18, headR * 0.72, headR * 0.14); // Vrpca

  } else if (charCfg.id === 'baka') {
    // Zglobne zečje uši s metalnim šarkama
    const drawRabbitEar = (earX, angle, bent) => {
      ctx.save();
      ctx.translate(earX, -headR * 0.8);
      ctx.rotate(angle);

      // Donji segment uha
      ctx.fillStyle = suitColor;
      ctx.beginPath();
      ctx.roundRect(-headR * 0.18, -headR * 0.75, headR * 0.36, headR * 0.75, 8);
      ctx.fill();

      // Metalni zglob uha
      ctx.fillStyle = jointMetal;
      ctx.beginPath();
      ctx.arc(0, -headR * 0.75, 4, 0, Math.PI * 2);
      ctx.fill();

      // Gornji segment uha
      ctx.translate(0, -headR * 0.75);
      if (bent) ctx.rotate(0.3);
      ctx.fillStyle = suitColor;
      ctx.beginPath();
      ctx.roundRect(-headR * 0.16, -headR * 0.75, headR * 0.32, headR * 0.75, 8);
      ctx.fill();
      ctx.restore();
    };
    drawRabbitEar(-headR * 0.55, -0.1, false);
    drawRabbitEar(headR * 0.55, 0.15, true); // Desno uho malo nagnuto

  } else if (charCfg.id === 'choda') {
    // Tri animatronik pera na vrhu glave
    ctx.fillStyle = suitColor;
    for (let f = -1; f <= 1; f++) {
      ctx.beginPath();
      ctx.ellipse(f * 8, -headR * 1.15, 4, 16, f * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (charCfg.id === 'omco') {
    // Lisičje uši
    ctx.fillStyle = suitColor;
    ctx.beginPath();
    ctx.moveTo(-headR * 0.8, -headR * 0.4);
    ctx.lineTo(-headR * 1.3, -headR * 1.4);
    ctx.lineTo(-headR * 0.3, -headR * 0.9);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(headR * 0.8, -headR * 0.4);
    ctx.lineTo(headR * 1.3, -headR * 1.4);
    ctx.lineTo(headR * 0.3, -headR * 0.9);
    ctx.closePath();
    ctx.fill();
  }

  // GLAVA / LICE (CUSTOM SLIKA ILI HOROR VEKTORSKA GLAVA)
  if (charCfg.customImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(charCfg.customImg, -headR, -headR, headR * 2, headR * 2);
    ctx.restore();

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, Math.PI * 2);
    ctx.stroke();

  } else {
    // Vektorska animatronik glava
    ctx.fillStyle = suitColor;
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Slušalice (svi su streameri!)
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = Math.max(3, headR * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, headR * 1.05, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    ctx.fillStyle = '#cc1111';
    ctx.fillRect(-headR * 1.15, -headR * 0.25, headR * 0.22, headR * 0.5);
    ctx.fillRect(headR * 0.93, -headR * 0.25, headR * 0.22, headR * 0.5);

    // OČNE DUPLJE I UŽARENE ZJENICE
    const eyeSep = headR * 0.38;
    const eyeY = -headR * 0.15;

    // Crne animatronik duplje
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.arc(-eyeSep, eyeY, headR * 0.26, 0, Math.PI * 2);
    ctx.arc(eyeSep, eyeY, headR * 0.26, 0, Math.PI * 2);
    ctx.fill();

    // Užarene oči koje sjaje u tami
    const eyePulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.007);
    ctx.fillStyle = `rgba(255, 255, 255, ${eyePulse})`;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(-eyeSep, eyeY, headR * 0.09, 0, Math.PI * 2);
    ctx.arc(eyeSep, eyeY, headR * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Specifični detalji lica:
    if (charCfg.id === 'mudja') {
      // Smeđa njuška
      ctx.fillStyle = '#ba7e44';
      ctx.beginPath();
      ctx.ellipse(0, headR * 0.25, headR * 0.44, headR * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(0, headR * 0.16, 5, 0, Math.PI * 2);
      ctx.fill();

    } else if (charCfg.id === 'baka') {
      // Sunčane naočale
      ctx.fillStyle = 'rgba(10, 10, 12, 0.9)';
      ctx.beginPath();
      ctx.roundRect(-headR * 0.65, -headR * 0.28, headR * 0.55, headR * 0.32, 4);
      ctx.roundRect(headR * 0.10, -headR * 0.28, headR * 0.55, headR * 0.32, 4);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();

    } else if (charCfg.id === 'choda') {
      // Narančasti kljun i zubi
      ctx.fillStyle = '#e87313';
      ctx.beginPath();
      ctx.moveTo(-headR * 0.32, headR * 0.15);
      ctx.lineTo(headR * 0.32, headR * 0.15);
      ctx.lineTo(0, headR * 0.52);
      ctx.closePath();
      ctx.fill();

    } else if (charCfg.id === 'omco') {
      // Crni povez preko oka
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(eyeSep, eyeY, headR * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-headR, -headR * 0.4);
      ctx.lineTo(headR, headR * 0.1);
      ctx.stroke();
    }

    // Čeljust s animatronik zubima
    ctx.fillStyle = '#110505';
    ctx.fillRect(-headR * 0.38, headR * 0.48, headR * 0.76, headR * 0.24);
    ctx.fillStyle = '#eee';
    for (let t = -3; t <= 3; t++) {
      ctx.fillRect(t * 6 - 2, headR * 0.49, 4, 6);
    }
  }

  ctx.restore(); // restore glava
  ctx.restore(); // restore cijelo tijelo

  // Oznaka imena lika ispod nogu
  ctx.fillStyle = '#ffaa00';
  ctx.font = 'bold 13px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(charCfg.name, X, Y + 18);
}

// 1. CAM 1A: GLAVNI STUDIO / BINA (SHOW STAGE) - 3D MASTER PERSPECTIVE
function drawStageCAM1A(ctx) {
  const W = 900, H = 720;
  const vx = 450, vy = 240; // Glavna točka nedogleda (Vanishing Point)

  ctx.save();
  // 1. Duboka tamna atmosfera kafane
  ctx.fillStyle = '#060407';
  ctx.fillRect(0, 0, W, H);

  // --------------------------------------------------------------------------
  // 3D BOČNI ZIDOVI KAFANE I STROP U PERSPEKTIVI
  // --------------------------------------------------------------------------
  // Lijevi bočni zid u dubokoj perspektivi (od lijevog ruba ekrana prema bini)
  const leftWallGrad = ctx.createLinearGradient(0, 0, 180, 0);
  leftWallGrad.addColorStop(0, '#1c1015');
  leftWallGrad.addColorStop(0.6, '#130a0d');
  leftWallGrad.addColorStop(1, '#090507');
  ctx.fillStyle = leftWallGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(180, 100);
  ctx.lineTo(180, 530);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Vrata za backstage na lijevom zidu u perspektivi
  ctx.fillStyle = '#10080c';
  ctx.beginPath();
  ctx.moveTo(35, 230);
  ctx.lineTo(115, 210);
  ctx.lineTo(115, 470);
  ctx.lineTo(35, 520);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2d1822';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Znak za hitni izlaz (IZLAZ / EXIT) iznad bekstejdž vrata
  ctx.fillStyle = '#112211';
  ctx.fillRect(45, 178, 60, 20);
  ctx.strokeStyle = '#225522';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(45, 178, 60, 20);
  ctx.fillStyle = '#33ff55';
  ctx.font = 'bold 9px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ IZLAZ ⚡', 75, 192);

  // Jezoviti crveni odsjaj ispod poluotvorenih bekstejdž vrata
  const doorGlow = ctx.createRadialGradient(75, 490, 5, 75, 490, 60);
  doorGlow.addColorStop(0, 'rgba(255, 30, 30, 0.35)');
  doorGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = doorGlow;
  ctx.beginPath();
  ctx.ellipse(75, 490, 55, 20, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Desni bočni zid u perspektivi
  const rightWallGrad = ctx.createLinearGradient(W, 0, 720, 0);
  rightWallGrad.addColorStop(0, '#1c1015');
  rightWallGrad.addColorStop(0.6, '#130a0d');
  rightWallGrad.addColorStop(1, '#090507');
  ctx.fillStyle = rightWallGrad;
  ctx.beginPath();
  ctx.moveTo(W, 0);
  ctx.lineTo(720, 100);
  ctx.lineTo(720, 530);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Industrijski razvodni ormar sa strujom na desnom zidu
  ctx.fillStyle = '#22252a';
  ctx.beginPath();
  ctx.moveTo(780, 240);
  ctx.lineTo(845, 255);
  ctx.lineTo(845, 420);
  ctx.lineTo(780, 395);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#3a3f47';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Upozorenje na ormaru (žuti trokut)
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.moveTo(812, 290);
  ctx.lineTo(824, 310);
  ctx.lineTo(800, 310);
  ctx.closePath();
  ctx.fill();
  // Treptajuća crvena lampica napajanja
  const redBlink = Math.sin(Date.now() * 0.005) > 0.2;
  ctx.fillStyle = redBlink ? '#ff2222' : '#550808';
  ctx.beginPath();
  ctx.arc(812, 272, 4, 0, Math.PI * 2);
  ctx.fill();

  // Gornji strop u 3D perspektivi
  const ceilingGrad = ctx.createLinearGradient(0, 0, 0, 100);
  ceilingGrad.addColorStop(0, '#100c14');
  ceilingGrad.addColorStop(1, '#060408');
  ctx.fillStyle = ceilingGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(720, 100);
  ctx.lineTo(180, 100);
  ctx.closePath();
  ctx.fill();

  // --------------------------------------------------------------------------
  // STRAŽNJI ZID BINE SA SVODOM I ZLATNIM NATPISOM
  // --------------------------------------------------------------------------
  ctx.fillStyle = '#12070c';
  ctx.fillRect(180, 100, 540, 245);

  // Zidne letvice / drvene akustične ploče u pozadini
  ctx.strokeStyle = '#1d0b13';
  ctx.lineWidth = 2;
  for (let wx = 195; wx < 710; wx += 24) {
    ctx.beginPath();
    ctx.moveTo(wx, 100);
    ctx.lineTo(wx, 345);
    ctx.stroke();
  }

  // Zlatni drveni reljefni okvir i natpis bine
  ctx.fillStyle = '#0a0407';
  ctx.fillRect(230, 115, 440, 52);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.strokeRect(230, 115, 440, 52);
  ctx.strokeStyle = '#8a6e1c';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(234, 119, 432, 44);

  ctx.fillStyle = '#ffea77';
  ctx.shadowColor = '#ffbb00';
  ctx.shadowBlur = 10;
  ctx.font = 'bold 20px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('★ BALKAN SHOW STAGE ★', vx, 142);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 11px Courier New';
  ctx.fillText('KAFANA LIVE  •  MUĐA, BAKA & CHODA', vx, 158);

  // Viseće zvjezdice na nevidljivim žicama koje svjetlucaju
  const starGlowTime = Date.now() * 0.003;
  const stars = [
    { x: 220, y: 195, size: 7, phase: 0 },
    { x: 275, y: 180, size: 9, phase: 1.2 },
    { x: 350, y: 205, size: 6, phase: 2.5 },
    { x: 550, y: 200, size: 7, phase: 3.8 },
    { x: 625, y: 180, size: 9, phase: 4.7 },
    { x: 680, y: 195, size: 6, phase: 5.4 }
  ];
  stars.forEach(st => {
    // Žica s plafona
    ctx.strokeStyle = '#332211';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(st.x, 100);
    ctx.lineTo(st.x, st.y);
    ctx.stroke();

    const twinkle = 0.5 + 0.5 * Math.sin(starGlowTime + st.phase);
    ctx.fillStyle = twinkle > 0.4 ? '#ffe566' : '#997722';
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.size * (0.8 + 0.3 * twinkle), 0, Math.PI * 2);
    ctx.fill();
  });

  // --------------------------------------------------------------------------
  // 3D POVIŠENA DRVENA BINA (ELEVATED WOODEN STAGE IN PERSPECTIVE)
  // --------------------------------------------------------------------------
  const stageBackY = 345;
  const stageFrontY = 520;
  const stageRiserH = 95; // Visina prednjeg čela bine (od 520 do 615)

  // Poligon gornje plohe drvene bine u perspektivi
  const stageDeckPoly = new Path2D();
  stageDeckPoly.moveTo(190, stageBackY);
  stageDeckPoly.lineTo(710, stageBackY);
  stageDeckPoly.lineTo(825, stageFrontY);
  stageDeckPoly.lineTo(75, stageFrontY);
  stageDeckPoly.closePath();

  ctx.save();
  ctx.clip(stageDeckPoly);

  // Temeljna drvena boja daski
  const deckBaseGrad = ctx.createLinearGradient(0, stageBackY, 0, stageFrontY);
  deckBaseGrad.addColorStop(0, '#241209');
  deckBaseGrad.addColorStop(0.5, '#3a1f11');
  deckBaseGrad.addColorStop(1, '#4e2a17');
  ctx.fillStyle = deckBaseGrad;
  ctx.fillRect(50, stageBackY, 800, stageFrontY - stageBackY);

  // 3D Daske bine koje se šire iz točke nedogleda (vx, vy)
  const numDeckRays = 16;
  ctx.lineWidth = 2;
  for (let r = 0; r <= numDeckRays; r++) {
    const t = r / numDeckRays;
    const topX = 190 + (710 - 190) * t;
    const botX = 75 + (825 - 75) * t;

    // Sjena između daski
    ctx.strokeStyle = '#1b0d06';
    ctx.beginPath();
    ctx.moveTo(topX, stageBackY);
    ctx.lineTo(botX, stageFrontY);
    ctx.stroke();

    // Odsjaj / highlight na rubu svake daske
    ctx.strokeStyle = 'rgba(255, 180, 110, 0.12)';
    ctx.beginPath();
    ctx.moveTo(topX + 1.5, stageBackY);
    ctx.lineTo(botX + 2, stageFrontY);
    ctx.stroke();
  }

  // Poprečne linije spajanja daski u perspektivi
  const numHorizontalPlanks = 8;
  for (let p = 1; p < numHorizontalPlanks; p++) {
    const t = Math.pow(p / numHorizontalPlanks, 1.5);
    const py = stageBackY + (stageFrontY - stageBackY) * t;
    const px0 = 190 + (75 - 190) * t;
    const px1 = 710 + (825 - 710) * t;

    ctx.strokeStyle = '#150904';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px0, py);
    ctx.lineTo(px1, py);
    ctx.stroke();
  }

  ctx.restore();

  // --------------------------------------------------------------------------
  // PREDNJE ČELO / VERTIKALNA FRONTA BINE U PERSPEKTIVI (y: 520 -> 615)
  // --------------------------------------------------------------------------
  const riserPoly = new Path2D();
  riserPoly.moveTo(75, stageFrontY);
  riserPoly.lineTo(825, stageFrontY);
  riserPoly.lineTo(838, stageFrontY + stageRiserH);
  riserPoly.lineTo(62, stageFrontY + stageRiserH);
  riserPoly.closePath();

  ctx.save();
  ctx.clip(riserPoly);

  // Bogata tamna lakirana fronta s gradijentom
  const riserGrad = ctx.createLinearGradient(0, stageFrontY, 0, stageFrontY + stageRiserH);
  riserGrad.addColorStop(0, '#1c0e07');
  riserGrad.addColorStop(0.7, '#2c160b');
  riserGrad.addColorStop(1, '#150a04');
  ctx.fillStyle = riserGrad;
  ctx.fillRect(50, stageFrontY, 800, stageRiserH);

  // Vertikalne dekorativne letvice (wainscot) na čelu bine
  ctx.strokeStyle = '#120703';
  ctx.lineWidth = 3;
  for (let x = 70; x <= 830; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, stageFrontY);
    ctx.lineTo(x + (x - vx) * 0.04, stageFrontY + stageRiserH);
    ctx.stroke();
    // Svjetliji rub letvice
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 2, stageFrontY);
    ctx.lineTo(x + 2 + (x - vx) * 0.04, stageFrontY + stageRiserH);
    ctx.stroke();
    ctx.strokeStyle = '#120703';
    ctx.lineWidth = 3;
  }

  // Sjena koju gornja ploha bine baca na prednje čelo
  const lipShadow = ctx.createLinearGradient(0, stageFrontY, 0, stageFrontY + 22);
  lipShadow.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  lipShadow.addColorStop(1, 'transparent');
  ctx.fillStyle = lipShadow;
  ctx.fillRect(50, stageFrontY, 800, 22);

  ctx.restore();

  // Zlatna masivna lajsna na vrhu ruba bine
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(70, stageFrontY - 4, 760, 6);
  ctx.fillStyle = '#5c4510';
  ctx.fillRect(70, stageFrontY + 2, 760, 3);

  // Donja mesingana lajsna na spoju sa podom sale
  ctx.fillStyle = '#8a6e1c';
  ctx.fillRect(58, stageFrontY + stageRiserH - 4, 784, 6);

  // --------------------------------------------------------------------------
  // POD SALE U PRVOM PLANU ISPRED BINE (CHECKERBOARD TILES)
  // --------------------------------------------------------------------------
  const foreFloorY = stageFrontY + stageRiserH; // 615
  const forePoly = new Path2D();
  forePoly.moveTo(0, foreFloorY);
  forePoly.lineTo(W, foreFloorY);
  forePoly.lineTo(W, H);
  forePoly.lineTo(0, H);
  forePoly.closePath();

  ctx.save();
  ctx.clip(forePoly);

  ctx.fillStyle = '#0c0a0f';
  ctx.fillRect(0, foreFloorY, W, H - foreFloorY);

  // Karirane pločice u 3D perspektivi
  const numTileCols = 18;
  const numTileRows = 5;
  for (let tr = 0; tr < numTileRows; tr++) {
    const t0 = Math.pow(tr / numTileRows, 1.4);
    const t1 = Math.pow((tr + 1) / numTileRows, 1.4);
    const y0 = foreFloorY + (H - foreFloorY) * t0;
    const y1 = foreFloorY + (H - foreFloorY) * t1;

    for (let tc = 0; tc < numTileCols; tc++) {
      const u0 = tc / numTileCols;
      const u1 = (tc + 1) / numTileCols;

      const x0Top = u0 * W;
      const x1Top = u1 * W;
      const x0Bot = u0 * W;
      const x1Bot = u1 * W;

      const isWhite = (tc + tr) % 2 === 0;
      ctx.fillStyle = isWhite ? '#3a3835' : '#141315';

      ctx.beginPath();
      ctx.moveTo(x0Top, y0);
      ctx.lineTo(x1Top, y0);
      ctx.lineTo(x1Bot, y1);
      ctx.lineTo(x0Bot, y1);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#09080b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // Teški debeli audio kabel koji zmijoliko ide preko prednjeg poda
  ctx.strokeStyle = '#08080a';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(140, foreFloorY);
  ctx.bezierCurveTo(240, 640, 200, 690, 340, 720);
  ctx.stroke();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Drugi kabel s desne strane
  ctx.strokeStyle = '#0a0a0c';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(760, foreFloorY);
  ctx.bezierCurveTo(680, 650, 720, 690, 610, 720);
  ctx.stroke();

  ctx.restore();

  // --------------------------------------------------------------------------
  // 3D RAMPA SA REFLEKTORIMA NA PLAFONU (OVERHEAD LIGHTING TRUSS & PAR CANS)
  // --------------------------------------------------------------------------
  const trussY = 62;
  // Glavne horizontalne cijevi aluminijske rešetke
  ctx.strokeStyle = '#5a626d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(60, trussY);
  ctx.lineTo(840, trussY);
  ctx.moveTo(60, trussY + 22);
  ctx.lineTo(840, trussY + 22);
  ctx.stroke();

  // Dijagonalne prečke rešetke (truss webbing)
  ctx.strokeStyle = '#414852';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let tx = 60; tx < 840; tx += 28) {
    ctx.moveTo(tx, trussY);
    ctx.lineTo(tx + 14, trussY + 22);
    ctx.lineTo(tx + 28, trussY);
  }
  ctx.stroke();

  // Čelične sajle koje drže rampu s plafona
  ctx.strokeStyle = '#2a2f38';
  ctx.lineWidth = 2;
  [120, 300, 600, 780].forEach(cx => {
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, trussY);
    ctx.stroke();
  });

  // 4 Masivna PAR 64 reflektora montirana na rampu
  const parSpots = [
    { x: 220, angle: 0.18, targetX: 295, color: 'rgba(255, 175, 45, ' }, // Za Baku
    { x: 410, angle: 0.06, targetX: 440, color: 'rgba(255, 235, 160, ' }, // Za Muđu
    { x: 490, angle: -0.06, targetX: 460, color: 'rgba(255, 235, 160, ' }, // Za Muđu
    { x: 680, angle: -0.18, targetX: 605, color: 'rgba(255, 195, 50, ' }  // Za Chodu
  ];

  parSpots.forEach(par => {
    // Stezaljka i kućište reflektora
    ctx.save();
    ctx.translate(par.x, trussY + 22);
    ctx.rotate(par.angle);

    ctx.fillStyle = '#1c1f24';
    ctx.fillRect(-10, 0, 20, 26);
    ctx.strokeStyle = '#3e444f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-10, 0, 20, 26);

    // Otvor leće
    ctx.fillStyle = '#ffeaa0';
    ctx.fillRect(-8, 24, 16, 4);

    ctx.restore();
  });

  // Disko kugla / zrcalna kugla u sredini
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(vx, 0);
  ctx.lineTo(vx, 98);
  ctx.stroke();

  ctx.fillStyle = '#8f9baa';
  ctx.beginPath();
  ctx.arc(vx, 108, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c5d1e0';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Iskre sa zrcalne kugle
  const sparklePhase = Date.now() * 0.005;
  for (let sp = 0; sp < 3; sp++) {
    const sx = vx + Math.cos(sparklePhase + sp * 2.1) * 11;
    const sy = 108 + Math.sin(sparklePhase + sp * 2.1) * 11;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
  }

  // --------------------------------------------------------------------------
  // VOLUMETRIJSKI 3D KONUSI SVJETLA I DUBINA ATMOSFERE
  // --------------------------------------------------------------------------
  const drawVolumetricCone = (sourceX, sourceY, floorX, floorY, radiusX, radiusY, baseColor) => {
    ctx.save();

    // 1. Osvijetljena elipsa na drvenom podu
    const floorGlow = ctx.createRadialGradient(floorX, floorY, 10, floorX, floorY, radiusX);
    floorGlow.addColorStop(0, baseColor + '0.42)');
    floorGlow.addColorStop(0.5, baseColor + '0.22)');
    floorGlow.addColorStop(0.85, baseColor + '0.08)');
    floorGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = floorGlow;
    ctx.beginPath();
    ctx.ellipse(floorX, floorY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Volumetrijski stožac svjetlosti kroz maglu/prašinu
    const beamGrad = ctx.createLinearGradient(sourceX, sourceY, floorX, floorY);
    beamGrad.addColorStop(0, baseColor + '0.28)');
    beamGrad.addColorStop(0.4, baseColor + '0.12)');
    beamGrad.addColorStop(0.85, baseColor + '0.04)');
    beamGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = beamGrad;

    ctx.beginPath();
    ctx.moveTo(sourceX - 9, sourceY);
    ctx.lineTo(sourceX + 9, sourceY);
    ctx.lineTo(floorX + radiusX * 0.9, floorY);
    ctx.lineTo(floorX - radiusX * 0.9, floorY);
    ctx.closePath();
    ctx.fill();

    // 3. Plutajuće čestice scenske prašine u zraku (drift dust motes)
    const timeMote = Date.now() * 0.001;
    ctx.fillStyle = baseColor + '0.55)';
    for (let m = 0; m < 5; m++) {
      const mx = floorX + Math.sin(timeMote * 1.5 + m * 1.7) * (radiusX * 0.55);
      const my = sourceY + 40 + ((m * 65 + timeMote * 20) % (floorY - sourceY - 50));
      ctx.beginPath();
      ctx.arc(mx, my, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // Tri velika scenska reflektora
  drawVolumetricCone(220, 86, 295, 475, 125, 45, 'rgba(255, 175, 45, ');  // Baka
  drawVolumetricCone(450, 86, 450, 465, 140, 50, 'rgba(255, 235, 160, '); // Muđa
  drawVolumetricCone(680, 86, 605, 475, 125, 45, 'rgba(255, 195, 50, ');  // Choda

  // --------------------------------------------------------------------------
  // 3D BOGATI CRVENI BARŠUNASTI ZASTORI SA ZLATNIM RESAMA (THEATRE CURTAINS)
  // --------------------------------------------------------------------------
  // Gornji ukrasni nabor (Valance / pelmet)
  const drawValanceSwag = (x1, x2, depth) => {
    const midX = (x1 + x2) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, 75);
    ctx.quadraticCurveTo(midX, 75 + depth, x2, 75);
    ctx.lineTo(x2, 60);
    ctx.lineTo(x1, 60);
    ctx.closePath();

    const swagGrad = ctx.createLinearGradient(0, 60, 0, 75 + depth);
    swagGrad.addColorStop(0, '#4a0b14');
    swagGrad.addColorStop(0.5, '#781524');
    swagGrad.addColorStop(1, '#32060d');
    ctx.fillStyle = swagGrad;
    ctx.fill();

    // Zlatna bordura / resice na dnu nabora
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, 75);
    ctx.quadraticCurveTo(midX, 75 + depth, x2, 75);
    ctx.stroke();
    ctx.restore();
  };

  drawValanceSwag(60, 320, 45);
  drawValanceSwag(310, 590, 52);
  drawValanceSwag(580, 840, 45);

  // 3D Bočni zastori s valovitim naborima i zlatnim užetom
  const draw3DCurtainWing = (startX, archX, bottomX, isLeft) => {
    ctx.save();

    // Tijelo zastora
    const curtainGrad = ctx.createLinearGradient(isLeft ? 0 : W, 0, archX, 0);
    curtainGrad.addColorStop(0, '#2e060d');
    curtainGrad.addColorStop(0.4, '#5c0f1b');
    curtainGrad.addColorStop(0.7, '#7b1424');
    curtainGrad.addColorStop(1, '#3b0810');

    ctx.fillStyle = curtainGrad;
    ctx.beginPath();
    ctx.moveTo(startX, 60);
    ctx.lineTo(archX, 60);
    // Skriveni nabor uvezan zlatnim užetom
    const cinchX = isLeft ? 155 : 745;
    const cinchY = 370;
    ctx.quadraticCurveTo(isLeft ? archX - 10 : archX + 10, 220, cinchX, cinchY);
    ctx.quadraticCurveTo(isLeft ? cinchX - 15 : cinchX + 15, 450, bottomX, stageFrontY);
    ctx.lineTo(startX, stageFrontY + 60);
    ctx.closePath();
    ctx.fill();

    // Vertikalni nabori i sjene
    ctx.lineWidth = 4;
    const foldCount = 6;
    for (let f = 1; f <= foldCount; f++) {
      const fxTop = startX + (archX - startX) * (f / (foldCount + 1));
      const fxCinch = startX + (cinchX - startX) * (f / (foldCount + 1));
      const fxBot = startX + (bottomX - startX) * (f / (foldCount + 1));

      // Sjena nabora
      ctx.strokeStyle = '#1d0307';
      ctx.beginPath();
      ctx.moveTo(fxTop, 60);
      ctx.quadraticCurveTo(fxCinch - (isLeft ? 8 : -8), cinchY, fxBot, stageFrontY);
      ctx.stroke();

      // Svjetliji greben nabora
      ctx.strokeStyle = 'rgba(235, 110, 130, 0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fxTop + (isLeft ? 4 : -4), 60);
      ctx.quadraticCurveTo(fxCinch + (isLeft ? 3 : -3), cinchY, fxBot + (isLeft ? 4 : -4), stageFrontY);
      ctx.stroke();
    }

    // Zlatno pleteno uže i viseća kićanka (Tassel)
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cinchX, cinchY, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Kićanka koja visi
    ctx.fillStyle = '#ffea77';
    ctx.beginPath();
    ctx.moveTo(cinchX - 6, cinchY + 16);
    ctx.lineTo(cinchX + 6, cinchY + 16);
    ctx.lineTo(cinchX + 11, cinchY + 48);
    ctx.lineTo(cinchX - 11, cinchY + 48);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#aa851c';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  };

  draw3DCurtainWing(0, 190, 95, true);
  draw3DCurtainWing(W, 710, 805, false);

  // --------------------------------------------------------------------------
  // FOOTLIGHTS NA RUBU BINE (MESINGANA SVJETLA U NIZU)
  // --------------------------------------------------------------------------
  const numFootlights = 13;
  for (let fl = 0; fl <= numFootlights; fl++) {
    const fx = 105 + (795 - 105) * (fl / numFootlights);
    const fy = stageFrontY - 2;

    // Mesingani oklop
    ctx.fillStyle = '#2b2108';
    ctx.beginPath();
    ctx.arc(fx, fy + 4, 7, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Svijetleća žaruljica
    const bulbPulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.007 + fl);
    ctx.fillStyle = fl % 3 === 0 ? `rgba(255, 230, 150, ${bulbPulse})` : `rgba(255, 170, 50, ${bulbPulse})`;
    ctx.beginPath();
    ctx.arc(fx, fy - 1, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // --------------------------------------------------------------------------
  // 3D SCENSKI REKVIZITI (POJAČALO, HARMONIKA, MIKROFON, ZVUČNICI)
  // --------------------------------------------------------------------------
  // 1. Marshall / Balkan Stack pojačalo s lijeve strane bine u 3D perspektivi
  ctx.save();
  const ampX = 115, ampY = 415, ampW = 60, ampH = 90;
  // Prednja strana pojačala
  ctx.fillStyle = '#18181b';
  ctx.fillRect(ampX, ampY, ampW, ampH);
  ctx.strokeStyle = '#383b42';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(ampX, ampY, ampW, ampH);

  // Zvučnička tkanina s rešetkom
  ctx.fillStyle = '#252528';
  ctx.fillRect(ampX + 5, ampY + 22, ampW - 10, ampH - 28);
  ctx.strokeStyle = '#151517';
  ctx.lineWidth = 1;
  for (let ay = ampY + 26; ay < ampY + ampH - 8; ay += 7) {
    ctx.beginPath();
    ctx.moveTo(ampX + 6, ay);
    ctx.lineTo(ampX + ampW - 6, ay);
    ctx.stroke();
  }
  // Zlatni natpis pojačala "BALKAN"
  ctx.fillStyle = '#e5c052';
  ctx.font = 'bold 8px Courier New';
  ctx.fillText('BALKAN', ampX + 30, ampY + 15);
  // Crvena LED lampica napajanja
  ctx.fillStyle = '#ff2222';
  ctx.beginPath();
  ctx.arc(ampX + ampW - 10, ampY + 12, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 3D bočna stranica pojačala u perspektivi
  ctx.fillStyle = '#0f0f11';
  ctx.beginPath();
  ctx.moveTo(ampX + ampW, ampY);
  ctx.lineTo(ampX + ampW + 15, ampY - 8);
  ctx.lineTo(ampX + ampW + 15, ampY + ampH - 8);
  ctx.lineTo(ampX + ampW, ampY + ampH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#28282e';
  ctx.stroke();

  // 2. Harmonika naslonjena uz pojačalo
  const harmX = 175, harmY = 445;
  ctx.fillStyle = '#9e1422';
  ctx.fillRect(harmX, harmY, 44, 62);
  ctx.strokeStyle = '#220306';
  ctx.lineWidth = 2;
  ctx.strokeRect(harmX, harmY, 44, 62);
  // Tipke harmonike
  ctx.fillStyle = '#f8f8f8';
  for (let k = 0; k < 6; k++) {
    ctx.fillRect(harmX + 3 + k * 6, harmY + 38, 5, 21);
    if (k < 5) {
      ctx.fillStyle = '#111';
      ctx.fillRect(harmX + 7 + k * 6, harmY + 38, 3, 12);
      ctx.fillStyle = '#f8f8f8';
    }
  }
  // Mjeh harmonike s naborima
  ctx.strokeStyle = '#e0d8c8';
  ctx.lineWidth = 2;
  for (let m = 0; m < 5; m++) {
    ctx.strokeRect(harmX + 6 + m * 5, harmY + 6, 4, 26);
  }
  ctx.restore();

  // 3. Desni scenski monitor zvučnik (wedge monitor)
  ctx.save();
  ctx.fillStyle = '#16181c';
  ctx.beginPath();
  ctx.moveTo(715, 510);
  ctx.lineTo(775, 465);
  ctx.lineTo(805, 505);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#323740';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#23272e';
  ctx.beginPath();
  ctx.ellipse(755, 488, 14, 9, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Scenski mikrofoni na stalcima
  const draw3DMicStand = (x, y) => {
    ctx.save();
    // Okrugla teška baza mikrofona
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(x, y + 25, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Kromirani okomiti stalak
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 25);
    ctx.lineTo(x, y - 45);
    ctx.stroke();

    // Vintage Shure 55SH stil mikrofona
    ctx.fillStyle = '#ddd';
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - 6, y - 62, 12, 18, 4) : ctx.rect(x - 6, y - 62, 12, 18);
    ctx.fill();
    ctx.stroke();

    // Horizontalne rešetke mikrofona
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let my = y - 58; my < y - 46; my += 3) {
      ctx.beginPath();
      ctx.moveTo(x - 5, my);
      ctx.lineTo(x + 5, my);
      ctx.stroke();
    }

    // Kabel mikrofona koji ide po podu
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 25);
    ctx.quadraticCurveTo(x + 25, y + 35, x + 45, stageFrontY);
    ctx.stroke();

    ctx.restore();
  };

  // Prikazuj mikrofone kad izvođač nije na bini (ili kao scenski detalj)
  if (state.entities.baka.loc !== '1A') draw3DMicStand(295, 445);
  if (state.entities.mudja.loc !== '1A') draw3DMicStand(450, 435);
  if (state.entities.choda.loc !== '1A') draw3DMicStand(605, 445);

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

  // Plakat na zidu CAM 2B (FNaF 1 Golden Freddy trigger)
  if (state.goldenFreddy && state.goldenFreddy.posterActive) {
    ctx.save();
    ctx.fillStyle = '#0a0800';
    ctx.fillRect(175, 185, 105, 135);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.strokeRect(175, 185, 105, 135);

    const gfChar = getCharById('golden') || { color: '#d4af37', hatColor: '#111' };
    drawCharacterPortrait(ctx, gfChar, 227, 245, 36, true);

    ctx.fillStyle = '#ff2222';
    ctx.font = 'bold 12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText("IT'S ME", 227, 305);
    ctx.restore();
  } else {
    // Normalni plakat upozorenja
    ctx.fillStyle = '#eeddbb';
    ctx.fillRect(180, 190, 95, 125);
    ctx.fillStyle = '#990000';
    ctx.font = 'bold 11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('PAZI!', 227, 215);
    ctx.fillStyle = '#111';
    ctx.font = '8px Courier New';
    ctx.fillText('LIJEVA VRATA', 227, 238);
    ctx.fillText('UREDA SU', 227, 252);
    ctx.fillText('ODMAH TU!', 227, 266);
  }

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
    drawFullBodyAnimatronic(ctx, omcoChar, 450, 480, 225, 'stage', 0.9);
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 18px Courier New';
    ctx.fillText('⚠️ ZAVJESA RAZMAKNUTA - OMCO VIRI!', 450, 140);

  } else if (st === 2) {
    ctx.fillStyle = '#5c1b6e';
    ctx.fillRect(170, 90, 90, 420);
    ctx.fillRect(640, 90, 90, 420);
    drawFullBodyAnimatronic(ctx, omcoChar, 450, 490, 235, 'stage', 1.0);
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
    ctx.fillText('🏃💨 JURI PREMA LIJEVIM VRATIMA! ZATVORI ROLETNU!', 450, 140);
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
    ctx.fillText('🚨 UZBUNA: SPRINT KROZ LIJEVI HODNIK! ZATVORI LIJEVA VRATA! 🚨', vx, H - 45);
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
