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

test('невыбранный язык остаётся пустым, а выбранный сохраняется', () => {
    assert.equal(DEFAULTS.language, null);
    assert.equal(normalize({}).language, null);
    assert.equal(normalize({ language: 'de' }).language, null);
    assert.equal(normalize({ language: 'ru' }).language, 'ru');

    const store = createSettingsStore(tempDirectory(), { writeDelay: 5 });
    assert.equal(store.update({ language: 'en' }).language, 'en');
});

test('кнопки мыши подписаны без обращения к системе', () => {
    assert.equal(describeKey(VK.MBUTTON, null, 'ru'), 'Колесо мыши');
    assert.equal(describeKey(VK.LBUTTON, null, 'ru'), 'Левая кнопка мыши');
    assert.equal(describeKey(VK.XBUTTON2, null, 'ru'), 'Боковая кнопка 2');

    assert.equal(describeKey(VK.MBUTTON, null, 'en'), 'Mouse wheel');
    assert.equal(describeKey(VK.XBUTTON2, null, 'en'), 'Side button 2');
});

test('имя клавиши берётся из системной раскладки', () => {
    assert.equal(describeKey(0x41, () => 'Ф', 'ru'), 'Клавиша Ф');
    assert.equal(describeKey(0x41, () => 'Ф', 'en'), 'Ф key');
    assert.equal(describeKey(0x70, () => 'F1', 'ru'), 'F1');
});

test('кнопки игровых мышей на F13-F24 подписаны, а не показаны кодом', () => {
    assert.equal(describeKey(0x7c, () => null, 'ru'), 'F13');
    assert.equal(describeKey(0x87, () => null, 'en'), 'F24');
});

test('клавиша без системного имени всё равно получает подпись', () => {
    assert.equal(describeKey(0x42, () => null, 'ru'), 'Клавиша B');
    assert.equal(describeKey(0xff, () => null, 'ru'), 'Код 255');
    assert.equal(describeKey(0x42, () => null, 'en'), 'B key');
    assert.equal(describeKey(0xff, () => null, 'en'), 'Key code 255');
});

test('переводимые клавиши меняют подпись вместе с языком', () => {
    assert.equal(describeKey(0x20, () => null, 'ru'), 'Пробел');
    assert.equal(describeKey(0x20, () => null, 'en'), 'Space');
    assert.equal(describeKey(0xa2, () => null, 'ru'), 'Ctrl слева');
    assert.equal(describeKey(0xa2, () => null, 'en'), 'Left Ctrl');
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
