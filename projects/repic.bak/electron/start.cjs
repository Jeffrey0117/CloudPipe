// Wrapper script to properly clear ELECTRON_RUN_AS_NODE before starting Electron
const { spawn } = require('child_process');
const path = require('path');

const electronPath = require('electron');
const mainPath = path.join(__dirname, '..');

// Create a clean env without ELECTRON_RUN_AS_NODE
const cleanEnv = { ...process.env };
delete cleanEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [mainPath], {
    stdio: 'inherit',
    env: cleanEnv
});

child.on('close', (code) => {
    process.exit(code);
});
