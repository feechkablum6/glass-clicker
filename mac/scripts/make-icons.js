'use strict';

// Иконки собираются из тех же контуров, что нарисованы в окне: значок в Dock —
// стеклянная плитка из build/icon.svg, значок в строке меню — один курсор,
// который система перекрашивает сама.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const BUILD = path.join(__dirname, '..', 'build');
// Все значки рисуются в одном окне: второе окно этого размера система создать
// уже не даёт, а снимок можно взять по частям.
const CANVAS = 1024;
// Курсор для строки меню рисуется крупно и уменьшается: в 16 пикселях
// браузер не сохранил бы толщину линий.
const GLYPH = 256;

const CURSOR = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${GLYPH}" height="${GLYPH}">
    <g fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9">
        <path d="M3.6 12h2.3" stroke-opacity="0.55"/>
        <path d="M12 3.6v2.3" stroke-opacity="0.55"/>
        <path d="M6.1 6.1l1.6 1.6" stroke-opacity="0.55"/>
        <path d="M17.9 6.1l-1.6 1.6" stroke-opacity="0.55"/>
        <path d="M6.1 17.9l1.6-1.6" stroke-opacity="0.55"/>
        <path d="M12 12l8.8 3-3.9 1.9-1.9 3.9z" fill="#000000"/>
    </g>
</svg>`;

let window = null;

async function draw(markup, crop) {
    const page = `<!DOCTYPE html><html><body style="margin:0;background:transparent">${markup}</body></html>`;
    const file = path.join(os.tmpdir(), 'glass-clicker-icon.html');
    fs.writeFileSync(file, page, 'utf8');

    await window.loadFile(file);
    // Первый кадр офскрин-окна приходит не мгновенно.
    await new Promise(resolve => setTimeout(resolve, 300));

    const shot = await window.webContents.capturePage({ x: 0, y: 0, width: crop, height: crop });
    fs.unlinkSync(file);
    return shot;
}

function save(name, image, size) {
    // Экран может быть ретиновым, и снимок выходит крупнее запрошенной области.
    const exact = image.getSize().width === size
        ? image
        : image.resize({ width: size, height: size, quality: 'best' });
    fs.writeFileSync(path.join(BUILD, name), exact.toPNG());
    console.log(`${name}: ${exact.getSize().width}px`);
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    window = new BrowserWindow({
        width: CANVAS,
        height: CANVAS,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: { offscreen: true }
    });

    const source = fs.readFileSync(path.join(BUILD, 'icon.svg'), 'utf8');
    const scaled = source
        .replace('width="256"', `width="${CANVAS}"`)
        .replace('height="256"', `height="${CANVAS}"`);
    save('icon.png', await draw(scaled, CANVAS), CANVAS);

    const cursor = await draw(CURSOR, GLYPH);
    save('trayTemplate.png', cursor, 16);
    save('trayTemplate@2x.png', cursor, 32);

    window.destroy();
    app.quit();
});
