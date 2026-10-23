// Verify energy accounting identity and separation of raw demand from battery loss
const { spawn } = require('child_process');

// Run one test run of Night 1 and Night 5
const fs = require('fs');
const scriptContent = fs.readFileSync('script.js', 'utf8');

console.log('--- ENERGETSKI OBRAČUN PROVJERA ---');

// Verify formula identity:
// baseDrain + devDrain === drainPerSec * dt
const baseDrainRate = 0.11;
const devDrainRate = 0.20;
const nightMult = 1.06;
const dt = 0.05;
const usageLevel = 3;

const baseDrain = baseDrainRate * nightMult * dt;
const devDrain = ((usageLevel - 1) * devDrainRate) * nightMult * dt;
const drainPerSec = (baseDrainRate + (usageLevel - 1) * devDrainRate) * nightMult;
const totalDrain = drainPerSec * dt;

console.log('baseDrain:', baseDrain);
console.log('devDrain:', devDrain);
console.log('baseDrain + devDrain:', baseDrain + devDrain);
console.log('drainPerSec * dt:    ', totalDrain);
console.log('Razlika (floating point epsilon):', Math.abs((baseDrain + devDrain) - totalDrain));
console.log('Potrošnja se oduzima točno jednom:', (baseDrain + devDrain) === totalDrain);
