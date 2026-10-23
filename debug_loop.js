// Test what happens when the bot checks doors BEFORE opening the camera
// (the standard, competent human player habit in all FNaF games)
const fs = require('fs');

// We test 1 run of Night 5 with detailed logging
const { spawn } = require('child_process');
console.log('Testing player loop hypothesis...');
