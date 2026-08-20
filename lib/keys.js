'use strict';

const { translate } = require('./i18n');

// Виртуальные коды, которые участвуют в биндах и в логике кликов.
const VK = {
    LBUTTON: 0x01,
    RBUTTON: 0x02,
    CANCEL: 0x03,
    MBUTTON: 0x04,
    XBUTTON1: 0x05,
    XBUTTON2: 0x06,
    ESCAPE: 0x1b
};

const MOUSE_KEYS = new Map([
    [VK.LBUTTON, 'key.mouseLeft'],
    [VK.RBUTTON, 'key.mouseRight'],
    [VK.MBUTTON, 'key.mouseMiddle'],
    [VK.XBUTTON1, 'key.mouseX1'],
    [VK.XBUTTON2, 'key.mouseX2']
]);

// Подписи, одинаковые в любом языке: так они и напечатаны на клавише.
const LITERAL_NAMES = new Map([
    [0x08, 'Backspace'],
    [0x09, 'Tab'],
    [0x0d, 'Enter'],
    [0x13, 'Pause'],
    [0x14, 'Caps Lock'],
    [0x1b, 'Escape'],
    [0x21, 'Page Up'],
    [0x22, 'Page Down'],
    [0x23, 'End'],
    [0x24, 'Home'],
    [0x2d, 'Insert'],
    [0x2e, 'Delete'],
    [0x5b, 'Win'],
    [0x90, 'Num Lock'],
    [0x91, 'Scroll Lock']
]);

// F13-F24 нет на клавиатуре, но на них часто висят кнопки игровых мышей.
for (let index = 0; index < 12; index += 1) {
    LITERAL_NAMES.set(0x7c + index, `F${13 + index}`);
}

// Windows не даёт имён для этих кодов через GetKeyNameText либо возвращает
// невнятные строки, поэтому они подписаны вручную и переводятся.
const TRANSLATED_NAMES = new Map([
    [0x20, 'key.space'],
    [0x25, 'key.arrowLeft'],
    [0x26, 'key.arrowUp'],
    [0x27, 'key.arrowRight'],
    [0x28, 'key.arrowDown'],
    [0x5c, 'key.winRight'],
    [0x5d, 'key.menu'],
    [0xa0, 'key.shiftLeft'],
    [0xa1, 'key.shiftRight'],
    [0xa2, 'key.ctrlLeft'],
    [0xa3, 'key.ctrlRight'],
    [0xa4, 'key.altLeft'],
    [0xa5, 'key.altRight']
]);

// Расширенные клавиши: без этого бита GetKeyNameText путает стрелки с
// цифровым блоком, а правые модификаторы с левыми.
const EXTENDED_KEYS = new Set([
    0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28,
    0x2d, 0x2e, 0x5b, 0x5c, 0x5d, 0x90, 0xa1, 0xa3, 0xa5
]);

// Коды, которые опрашиваются при захвате бинда. Служебные и залипающие
// клавиши (Escape, Num Lock, Caps Lock, Print Screen) исключены.
const EXCLUDED_FROM_CAPTURE = new Set([0x00, 0x03, 0x07, 0x0a, 0x0b, 0x0e, 0x0f, 0x1b, 0x2c, 0x14, 0x90, 0x91]);

// Список перебирается в цикле опроса, поэтому строится один раз.
const CAPTURABLE_KEYS = Object.freeze(
    Array.from({ length: 0xfe }, (value, index) => index + 1)
        .filter(code => !EXCLUDED_FROM_CAPTURE.has(code))
);

function capturableKeys() {
    return CAPTURABLE_KEYS;
}

function isMouseButton(code) {
    return MOUSE_KEYS.has(code);
}

function isExtendedKey(code) {
    return EXTENDED_KEYS.has(code);
}

function isPrintableKeyCode(code) {
    return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a);
}

// Имя из системы приходит на языке раскладки Windows, поэтому оно
// предпочтительнее собственной таблицы: пользователь видит ту же подпись,
// что и на клавише.
function describeKey(code, readSystemName, language) {
    const mouseKey = MOUSE_KEYS.get(code);
    if (mouseKey) return translate(language, mouseKey);

    const literal = LITERAL_NAMES.get(code);
    if (literal) return literal;

    const translated = TRANSLATED_NAMES.get(code);
    if (translated) return translate(language, translated);

    const systemName = typeof readSystemName === 'function'
        ? readSystemName(code, isExtendedKey(code))
        : null;
    if (systemName) {
        return isPrintableKeyCode(code) ? translate(language, 'key.named', { name: systemName }) : systemName;
    }

    if (isPrintableKeyCode(code)) {
        return translate(language, 'key.named', { name: String.fromCharCode(code) });
    }
    return translate(language, 'key.code', { code });
}

module.exports = {
    VK,
    capturableKeys,
    describeKey,
    isExtendedKey,
    isMouseButton
};
