'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    LANGUAGES,
    DEFAULT_LANGUAGE,
    isLanguage,
    normalizeLanguage,
    translate,
    formatNumber,
    clicksWord,
    dictionary
} = require('../lib/i18n');

// Русских форм больше, поэтому дословное равенство наборов не годится:
// у английского нет отдельной формы для «клика».
const RUSSIAN_ONLY = new Set(['notice.clickFew']);

test('у языков совпадает набор строк', () => {
    const en = new Set(Object.keys(dictionary('en')));
    const ru = new Set(Object.keys(dictionary('ru')));

    const missingInRu = [...en].filter(key => !ru.has(key));
    const missingInEn = [...ru].filter(key => !en.has(key) && !RUSSIAN_ONLY.has(key));

    assert.deepEqual(missingInRu, [], 'нет русского перевода');
    assert.deepEqual(missingInEn, [], 'нет английского перевода');
});

test('ни одна строка не осталась пустой', () => {
    for (const language of LANGUAGES) {
        for (const [key, value] of Object.entries(dictionary(language))) {
            assert.equal(typeof value, 'string', `${language}: ${key}`);
            // Разделитель разрядов — сам по себе пробел, остальное должно быть текстом.
            const expected = key === 'number.group' ? value : value.trim();
            assert.notEqual(expected, '', `${language}: ${key}`);
        }
    }
});

test('подстановки заполняются, а лишние скобки не остаются', () => {
    assert.equal(translate('en', 'hint.hold', { key: 'Mouse wheel' }), 'Clicks while you hold Mouse wheel');
    assert.equal(translate('ru', 'hint.hold', { key: 'Колесо мыши' }), 'Кликает, пока удерживаете: Колесо мыши');
    assert.equal(translate('ru', 'speed.interval', { ms: 83 }), 'Пауза между кликами 83 мс');
});

test('незнакомый язык откатывается к языку по умолчанию', () => {
    assert.equal(normalizeLanguage('de'), DEFAULT_LANGUAGE);
    assert.equal(normalizeLanguage(null), DEFAULT_LANGUAGE);
    assert.equal(isLanguage('ru'), true);
    assert.equal(isLanguage('de'), false);
    assert.equal(translate('de', 'app.title'), translate(DEFAULT_LANGUAGE, 'app.title'));
});

test('пропущенный ключ виден, а не превращается в пустое место', () => {
    assert.equal(translate('en', 'нет.такого.ключа'), 'нет.такого.ключа');
});

test('разряды разделяются по правилам языка', () => {
    assert.equal(formatNumber(1247, 'ru'), '1 247');
    assert.equal(formatNumber(1247, 'en'), '1,247');
    assert.equal(formatNumber(999, 'ru'), '999');
    assert.equal(formatNumber(1234567, 'en'), '1,234,567');
});

test('слово «клик» согласуется с числом', () => {
    assert.equal(clicksWord(1, 'ru'), 'клик');
    assert.equal(clicksWord(2, 'ru'), 'клика');
    assert.equal(clicksWord(5, 'ru'), 'кликов');
    assert.equal(clicksWord(112, 'ru'), 'кликов');
    assert.equal(clicksWord(1, 'en'), 'click');
    assert.equal(clicksWord(2, 'en'), 'clicks');
});

test('словарь отдаётся копией, а не общим объектом', () => {
    const copy = dictionary('en');
    copy['app.title'] = 'Broken';

    assert.equal(translate('en', 'app.title'), 'Clicker');
});
