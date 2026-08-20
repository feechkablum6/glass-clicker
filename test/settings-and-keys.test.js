'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSettingsStore, normalize, DEFAULTS } = require('../lib/settings');
const { describeKey, capturableKeys, isExtendedKey, VK } = require('../lib/keys');

function tempDirectory() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'glass-clicker-'));
}

test('повреждённый файл настроек не мешает запуску', () => {
    const directory = tempDirectory();
    fs.writeFileSync(path.join(directory, 'settings.json'), '{ это не json', 'utf8');

    const store = createSettingsStore(directory);
    assert.deepEqual(store.get(), DEFAULTS);
});

test('настройки записываются одной пачкой после паузы', async () => {
    const directory = tempDirectory();
    const file = path.join(directory, 'settings.json');
    const store = createSettingsStore(directory, { writeDelay: 5 });

    store.update({ cps: 30 });
    store.update({ cps: 45 });
    assert.equal(fs.existsSync(file), false);

    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).cps, 45);
});

test('выход сохраняет настройки, не дожидаясь паузы', () => {
    const directory = tempDirectory();
    const store = createSettingsStore(directory, { writeDelay: 10000 });

    store.update({ mode: 'hold' });
    store.flush();
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'settings.json'), 'utf8')).mode, 'hold');
});

test('чужие значения в настройках заменяются безопасными', () => {
    const restored = normalize({ cps: 900, button: 'middle', mode: 'что-то', bind: 0, x: 'нет', y: 40 });

    assert.equal(restored.cps, 100);
    assert.equal(restored.button, 'left');
    assert.equal(restored.mode, 'toggle');
    assert.equal(restored.bind, DEFAULTS.bind);
    assert.equal(restored.x, null);
    assert.equal(restored.y, 40);
});

test('кнопки мыши подписаны по-русски без обращения к системе', () => {
    assert.equal(describeKey(VK.MBUTTON), 'Колесо мыши');
    assert.equal(describeKey(VK.LBUTTON), 'Левая кнопка мыши');
    assert.equal(describeKey(VK.XBUTTON2), 'Боковая кнопка 2');
});

test('имя клавиши берётся из системной раскладки', () => {
    assert.equal(describeKey(0x41, () => 'Ф'), 'Клавиша Ф');
    assert.equal(describeKey(0x70, () => 'F1'), 'F1');
});

test('кнопки игровых мышей на F13-F24 подписаны, а не показаны кодом', () => {
    assert.equal(describeKey(0x7c, () => null), 'F13');
    assert.equal(describeKey(0x87, () => null), 'F24');
});

test('клавиша без системного имени всё равно получает подпись', () => {
    assert.equal(describeKey(0x42, () => null), 'Клавиша B');
    assert.equal(describeKey(0xff, () => null), 'Код 255');
});

test('служебные клавиши не попадают в захват бинда', () => {
    const keys = new Set(capturableKeys());

    assert.equal(keys.has(VK.ESCAPE), false, 'Escape зарезервирован под остановку');
    assert.equal(keys.has(0x2c), false, 'Print Screen не даёт стабильного состояния');
    assert.equal(keys.has(0x14), false, 'Caps Lock залипает');
    assert.equal(keys.has(VK.MBUTTON), true);
});

test('расширенные клавиши помечены для правильного имени', () => {
    assert.equal(isExtendedKey(0x25), true);
    assert.equal(isExtendedKey(0xa3), true);
    assert.equal(isExtendedKey(0x41), false);
});
