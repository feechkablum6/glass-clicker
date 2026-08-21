'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSettingsStore, normalize, DEFAULTS } = require('../lib/settings');
const { describeKey, capturableKeys, buttonCode, isMouseButton, isValidCode, KEY } = require('../lib/keys');

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
    const restored = normalize({ cps: 900, button: 'middle', mode: 'что-то', bind: -3, x: 'нет', y: 40 });

    assert.equal(restored.cps, 100);
    assert.equal(restored.button, 'left');
    assert.equal(restored.mode, 'toggle');
    assert.equal(restored.bind, DEFAULTS.bind);
    assert.equal(restored.x, null);
    assert.equal(restored.y, 40);
});

test('бинд с чужой платформы не пролезает в настройки', () => {
    // Коды Windows выходят за верхнюю границу клавиатуры macOS.
    assert.equal(normalize({ bind: 0x100 + 0x40 }).bind, DEFAULTS.bind);
    assert.equal(normalize({ bind: KEY.MOUSE_X2 }).bind, KEY.MOUSE_X2);
    assert.equal(normalize({ bind: 0 }).bind, 0, 'нулевой код — это клавиша A, а не пустое место');
});

test('невыбранный язык остаётся пустым, а выбранный сохраняется', () => {
    assert.equal(DEFAULTS.language, null);
    assert.equal(normalize({}).language, null);
    assert.equal(normalize({ language: 'de' }).language, null);
    assert.equal(normalize({ language: 'ru' }).language, 'ru');

    const store = createSettingsStore(tempDirectory(), { writeDelay: 5 });
    assert.equal(store.update({ language: 'en' }).language, 'en');
});

test('кнопки мыши подписаны в обоих языках', () => {
    assert.equal(describeKey(KEY.MOUSE_MIDDLE, 'ru'), 'Колесо мыши');
    assert.equal(describeKey(KEY.MOUSE_LEFT, 'ru'), 'Левая кнопка мыши');
    assert.equal(describeKey(KEY.MOUSE_X2, 'ru'), 'Боковая кнопка 2');

    assert.equal(describeKey(KEY.MOUSE_MIDDLE, 'en'), 'Mouse wheel');
    assert.equal(describeKey(KEY.MOUSE_X2, 'en'), 'Side button 2');
});

test('буква получает слово, а составная подпись остаётся как есть', () => {
    assert.equal(describeKey(0x00, 'ru'), 'Клавиша A');
    assert.equal(describeKey(0x00, 'en'), 'A key');
    assert.equal(describeKey(0x7a, 'ru'), 'F1');
    assert.equal(describeKey(0x52, 'en'), 'Num 0');
    assert.equal(describeKey(0x30, 'ru'), 'Tab');
});

test('клавиша без подписи показывается кодом', () => {
    assert.equal(describeKey(0x46, 'ru'), 'Код 70');
    assert.equal(describeKey(0x46, 'en'), 'Key code 70');
});

test('переводимые клавиши меняют подпись вместе с языком', () => {
    assert.equal(describeKey(0x31, 'ru'), 'Пробел');
    assert.equal(describeKey(0x31, 'en'), 'Space');
    assert.equal(describeKey(0x3b, 'ru'), 'Control слева');
    assert.equal(describeKey(0x37, 'en'), 'Left Command');
    assert.equal(describeKey(0x7e, 'ru'), 'Стрелка вверх');
});

test('служебные клавиши не попадают в захват бинда', () => {
    const keys = new Set(capturableKeys());

    assert.equal(keys.has(KEY.ESCAPE), false, 'Escape зарезервирован под остановку');
    assert.equal(keys.has(0x39), false, 'Caps Lock залипает');
    assert.equal(keys.has(0x3f), false, 'fn система обрабатывает сама');
    assert.equal(keys.has(0x4a), false, 'клавиша звука меняет громкость, а не бинд');
    assert.equal(keys.has(KEY.MOUSE_MIDDLE), true);
    assert.equal(keys.has(KEY.COMMAND_RIGHT), true);
});

test('по умолчанию кликер стоит на клавише, а не на кнопке мыши', () => {
    assert.equal(DEFAULTS.bind, KEY.COMMAND_RIGHT);
    assert.equal(isMouseButton(DEFAULTS.bind), false);
    assert.equal(describeKey(DEFAULTS.bind, 'ru'), 'Command справа');
});

test('кнопка кликов и кнопка в бинде сравнимы между собой', () => {
    assert.equal(buttonCode('left'), KEY.MOUSE_LEFT);
    assert.equal(buttonCode('right'), KEY.MOUSE_RIGHT);
    assert.equal(isMouseButton(KEY.MOUSE_RIGHT), true);
    assert.equal(isMouseButton(KEY.F6), false);
});

test('границы кодов бинда проверяются', () => {
    assert.equal(isValidCode(0), true);
    assert.equal(isValidCode(KEY.MOUSE_X2), true);
    assert.equal(isValidCode(-1), false);
    assert.equal(isValidCode(0x400), false);
    assert.equal(isValidCode(1.5), false);
});
