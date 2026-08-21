'use strict';

const { translate } = require('./i18n');

// Клавиатура и мышь живут в одной нумерации бинда: коды клавиш macOS занимают
// 0x00–0x7E, кнопки мыши начинаются выше этого диапазона.
const MOUSE_BASE = 0x100;
const MAX_CODE = MOUSE_BASE + 0x1f;

const KEY = {
    ESCAPE: 0x35,
    COMMAND_RIGHT: 0x36,
    F6: 0x61,
    MOUSE_LEFT: MOUSE_BASE,
    MOUSE_RIGHT: MOUSE_BASE + 1,
    MOUSE_MIDDLE: MOUSE_BASE + 2,
    MOUSE_X1: MOUSE_BASE + 3,
    MOUSE_X2: MOUSE_BASE + 4
};

const MOUSE_KEYS = new Map([
    [KEY.MOUSE_LEFT, 'key.mouseLeft'],
    [KEY.MOUSE_RIGHT, 'key.mouseRight'],
    [KEY.MOUSE_MIDDLE, 'key.mouseMiddle'],
    [KEY.MOUSE_X1, 'key.mouseX1'],
    [KEY.MOUSE_X2, 'key.mouseX2']
]);

// Подписи, одинаковые в любом языке: так они и напечатаны на клавише.
const LITERAL_NAMES = new Map([
    [0x00, 'A'], [0x01, 'S'], [0x02, 'D'], [0x03, 'F'], [0x04, 'H'], [0x05, 'G'],
    [0x06, 'Z'], [0x07, 'X'], [0x08, 'C'], [0x09, 'V'], [0x0b, 'B'], [0x0c, 'Q'],
    [0x0d, 'W'], [0x0e, 'E'], [0x0f, 'R'], [0x10, 'Y'], [0x11, 'T'], [0x1f, 'O'],
    [0x20, 'U'], [0x22, 'I'], [0x23, 'P'], [0x25, 'L'], [0x26, 'J'], [0x28, 'K'],
    [0x2d, 'N'], [0x2e, 'M'],
    [0x12, '1'], [0x13, '2'], [0x14, '3'], [0x15, '4'], [0x16, '6'], [0x17, '5'],
    [0x19, '9'], [0x1a, '7'], [0x1c, '8'], [0x1d, '0'],
    [0x18, '='], [0x1b, '-'], [0x1e, ']'], [0x21, '['], [0x27, '\''], [0x29, ';'],
    [0x2a, '\\'], [0x2b, ','], [0x2c, '/'], [0x2f, '.'], [0x32, '`'], [0x0a, '§'],
    [0x30, 'Tab'], [0x35, 'Escape'], [0x39, 'Caps Lock'],
    [0x72, 'Help'], [0x73, 'Home'], [0x74, 'Page Up'], [0x77, 'End'], [0x79, 'Page Down'],
    [0x5d, '¥'], [0x5e, '_']
]);

for (const [code, digit] of [
    [0x52, '0'], [0x53, '1'], [0x54, '2'], [0x55, '3'], [0x56, '4'],
    [0x57, '5'], [0x58, '6'], [0x59, '7'], [0x5b, '8'], [0x5c, '9']
]) {
    LITERAL_NAMES.set(code, `Num ${digit}`);
}
for (const [code, sign] of [
    [0x41, '.'], [0x43, '*'], [0x45, '+'], [0x4b, '/'], [0x4e, '−'], [0x51, '='], [0x5f, ',']
]) {
    LITERAL_NAMES.set(code, `Num ${sign}`);
}

// Ряд F идёт вразнобой по кодам, поэтому перечислен целиком.
for (const [code, number] of [
    [0x7a, 1], [0x78, 2], [0x63, 3], [0x76, 4], [0x60, 5], [0x61, 6], [0x62, 7],
    [0x64, 8], [0x65, 9], [0x6d, 10], [0x67, 11], [0x6f, 12], [0x69, 13], [0x6b, 14],
    [0x71, 15], [0x6a, 16], [0x40, 17], [0x4f, 18], [0x50, 19], [0x5a, 20]
]) {
    LITERAL_NAMES.set(code, `F${number}`);
}

// Клавиши, у которых подпись читается словом, а слово в каждом языке своё.
const TRANSLATED_NAMES = new Map([
    [0x24, 'key.return'],
    [0x31, 'key.space'],
    [0x33, 'key.delete'],
    [0x75, 'key.deleteForward'],
    [0x4c, 'key.numEnter'],
    [0x47, 'key.numClear'],
    [0x36, 'key.commandRight'],
    [0x37, 'key.commandLeft'],
    [0x38, 'key.shiftLeft'],
    [0x3a, 'key.optionLeft'],
    [0x3b, 'key.controlLeft'],
    [0x3c, 'key.shiftRight'],
    [0x3d, 'key.optionRight'],
    [0x3e, 'key.controlRight'],
    [0x3f, 'key.fn'],
    [0x48, 'key.volumeUp'],
    [0x49, 'key.volumeDown'],
    [0x4a, 'key.mute'],
    [0x6e, 'key.menu'],
    [0x7b, 'key.arrowLeft'],
    [0x7c, 'key.arrowRight'],
    [0x7d, 'key.arrowDown'],
    [0x7e, 'key.arrowUp'],
    [0x66, 'key.eisu'],
    [0x68, 'key.kana']
]);

// Коды, которые опрашиваются при захвате бинда. Escape отменяет захват, Caps
// Lock залипает, громкость и fn система обрабатывает сама.
const EXCLUDED_FROM_CAPTURE = new Set([0x35, 0x39, 0x3f, 0x48, 0x49, 0x4a]);

// Дыры в таблице кодов: под ними нет клавиш, и опрашивать их незачем.
const UNUSED_CODES = new Set([
    0x0a, 0x42, 0x44, 0x46, 0x4d, 0x5d, 0x5e, 0x5f, 0x66, 0x68, 0x70
]);

// Список перебирается в цикле опроса, поэтому строится один раз.
const CAPTURABLE_KEYS = Object.freeze([
    ...Array.from({ length: 0x7f }, (value, index) => index)
        .filter(code => !EXCLUDED_FROM_CAPTURE.has(code) && !UNUSED_CODES.has(code)),
    ...MOUSE_KEYS.keys()
]);

function capturableKeys() {
    return CAPTURABLE_KEYS;
}

function isMouseButton(code) {
    return code >= MOUSE_BASE;
}

// Кнопка, которой кликает кликер, и кнопка мыши в бинде — одно и то же
// пространство кодов: так их можно сравнить между собой.
function buttonCode(button) {
    return button === 'right' ? KEY.MOUSE_RIGHT : KEY.MOUSE_LEFT;
}

function isValidCode(code) {
    return Number.isInteger(code) && code >= 0 && code <= MAX_CODE;
}

function describeKey(code, language) {
    const mouseKey = MOUSE_KEYS.get(code);
    if (mouseKey) return translate(language, mouseKey);

    const literal = LITERAL_NAMES.get(code);
    // Буква на клавише сама по себе не читается как название, поэтому к ней
    // добавляется слово: «Клавиша F», а не просто «F».
    if (literal) {
        return literal.length === 1 ? translate(language, 'key.named', { name: literal }) : literal;
    }

    const translated = TRANSLATED_NAMES.get(code);
    if (translated) return translate(language, translated);

    return translate(language, 'key.code', { code });
}

module.exports = {
    KEY,
    MOUSE_BASE,
    MAX_CODE,
    buttonCode,
    capturableKeys,
    describeKey,
    isMouseButton,
    isValidCode
};
