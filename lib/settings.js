'use strict';

const fs = require('fs');
const path = require('path');
const { clampCps } = require('./click-engine');
const { isLanguage } = require('./i18n');

const DEFAULTS = {
    cps: 12,
    button: 'left',
    mode: 'toggle',
    bind: 0x04,
    // Пустой язык означает первый запуск: окно спрашивает, на каком говорить.
    language: null,
    x: null,
    y: null
};

function normalize(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const bind = Number.isInteger(source.bind) && source.bind > 0 && source.bind <= 0xfe
        ? source.bind
        : DEFAULTS.bind;

    return {
        cps: clampCps(source.cps ?? DEFAULTS.cps),
        button: source.button === 'right' ? 'right' : 'left',
        mode: source.mode === 'hold' ? 'hold' : 'toggle',
        bind,
        language: isLanguage(source.language) ? source.language : null,
        x: Number.isFinite(source.x) ? Math.round(source.x) : null,
        y: Number.isFinite(source.y) ? Math.round(source.y) : null
    };
}

// Ползунок скорости меняет настройку десятки раз за одно движение, поэтому
// запись на диск откладывается до паузы.
const WRITE_DELAY = 400;

function createSettingsStore(directory, { writeDelay = WRITE_DELAY } = {}) {
    const file = path.join(directory, 'settings.json');
    let current = DEFAULTS;
    let writeTimer = null;

    try {
        current = normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (error) {
        current = { ...DEFAULTS };
    }

    function write() {
        writeTimer = null;
        try {
            fs.mkdirSync(directory, { recursive: true });
            fs.writeFileSync(file, JSON.stringify(current, null, 2), 'utf8');
        } catch (error) {
            console.error('Failed to save settings:', error.message);
        }
    }

    return {
        get() {
            return { ...current };
        },
        update(patch) {
            current = normalize({ ...current, ...patch });
            if (writeTimer === null) writeTimer = setTimeout(write, writeDelay);
            return { ...current };
        },
        flush() {
            if (writeTimer === null) return;
            clearTimeout(writeTimer);
            write();
        }
    };
}

module.exports = { createSettingsStore, normalize, DEFAULTS };
