'use strict';

// Пользователь запускает кликер из «Программ», поэтому сборка сразу заменяет
// установленную копию: старой версии в системе не остаётся.

const { execFileSync, spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = 'Glass Clicker.app';
const BUNDLE_ID = 'com.akashi.glass-clicker';
const root = path.join(__dirname, '..');
const source = path.join(root, 'dist', 'mac-arm64', APP);
const target = path.join('/Applications', APP);

function run(command, args) {
    execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

function isRunning() {
    return spawnSync('pgrep', ['-f', `${APP}/Contents/MacOS`]).status === 0;
}

function stopApp() {
    spawnSync('osascript', ['-e', `quit app id "${BUNDLE_ID}"`]);
    for (let attempt = 0; attempt < 20 && isRunning(); attempt += 1) {
        spawnSync('sleep', ['0.25']);
    }
    // Приложение могло зависнуть на выходе, а заменять его на ходу нельзя.
    if (isRunning()) spawnSync('pkill', ['-f', `${APP}/Contents/MacOS`]);
}

const wasRunning = isRunning();

run('npx', ['electron-builder', '--mac', 'dir']);
if (!fs.existsSync(source)) {
    console.error(`Сборка не найдена: ${source}`);
    process.exit(1);
}

// Сборщик оставляет подпись, доставшуюся от самого Electron: она называет
// приложение чужим именем и не покрывает его файлы. Своя подпись без
// сертификата даёт системе постоянное имя, по которому она помнит разрешение.
run('codesign', ['--force', '--deep', '--sign', '-', '--identifier', BUNDLE_ID, source]);
run('codesign', ['--verify', '--strict', source]);

if (wasRunning) stopApp();
fs.rmSync(target, { recursive: true, force: true });
run('ditto', [source, target]);

console.log(`Установлено: ${target}`);
if (wasRunning) spawn('open', [target], { detached: true, stdio: 'ignore' }).unref();
