/**
 * Post-build script to set correct icon and product info
 * Run after electron-builder completes, then rebuild installer
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const RCEDIT_URL = 'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe';
const RCEDIT_PATH = path.join(__dirname, 'rcedit.exe');
const EXE_PATH = path.join(__dirname, '..', 'release', 'win-unpacked', 'Repic.exe');
const ICO_PATH = path.join(__dirname, '..', 'release', '.icon-ico', 'icon.ico');
const PROJECT_ROOT = path.join(__dirname, '..');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                https.get(response.headers.location, (res) => {
                    res.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
            }
        }).on('error', reject);
    });
}

async function main() {
    try {
        // Check if exe exists
        if (!fs.existsSync(EXE_PATH)) {
            console.error('Repic.exe not found. Run electron-builder first.');
            process.exit(1);
        }

        // Download rcedit if needed
        if (!fs.existsSync(RCEDIT_PATH)) {
            console.log('Downloading rcedit...');
            await downloadFile(RCEDIT_URL, RCEDIT_PATH);
        }

        // Apply icon and product info to exe
        console.log('Setting icon and product info...');
        execSync(`"${RCEDIT_PATH}" "${EXE_PATH}" --set-icon "${ICO_PATH}" --set-version-string "ProductName" "Repic" --set-version-string "FileDescription" "Repic Image Viewer" --set-version-string "CompanyName" "Repic" --set-version-string "LegalCopyright" "Copyright 2025" --set-file-version "1.0.0" --set-product-version "1.0.0"`, {
            stdio: 'inherit'
        });

        // Delete old installer
        const oldInstaller = path.join(PROJECT_ROOT, 'release', 'Repic Setup 0.0.0.exe');
        if (fs.existsSync(oldInstaller)) {
            console.log('Removing old installer...');
            fs.unlinkSync(oldInstaller);
        }

        // Rebuild NSIS installer with modified exe
        console.log('Rebuilding installer...');
        execSync('npx electron-builder --win nsis --prepackaged release/win-unpacked', {
            cwd: PROJECT_ROOT,
            stdio: 'inherit'
        });

        console.log('Done! Installer has been rebuilt with correct icon and info.');
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

main();
