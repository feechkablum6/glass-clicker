'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createNoticeSource } = require('../lib/overlay-notice');

function state(patch = {}) {
    return { running: false, clicks: 0, cps: 12, button: 'left', mode: 'toggle', ...patch };
}

// Управляемое время: итог захода считается от момента запуска.
function createSource(language = 'ru') {
    let clock = 0;
    const notices = createNoticeSource({ now: () => clock, language });
    return { notices, tick: ms => { clock += ms; } };
}

test('без смены состояния плашка не появляется', () => {
    const { notices } = createSource();

    assert.equal(notices.update(state()), null);
    assert.equal(notices.update(state({ cps: 40 })), null);

    notices.update(state({ running: true }));
    assert.equal(notices.update(state({ running: true, cps: 40, clicks: 12 })), null);
});

test('запуск объявляет скорость и кнопку', () => {
    const { notices } = createSource();
    notices.update(state());

    const notice = notices.update(state({ running: true, cps: 40, button: 'right' }));

    assert.equal(notice.kind, 'start');
    assert.equal(notice.title, 'Автокликер включён');
    assert.equal(notice.detail, '40 кл/с, правая кнопка');
    assert.equal(notice.pill, '40 кл/с · 0');
});

test('режим удержания подписан своим заголовком', () => {
    const { notices } = createSource();
    notices.update(state({ mode: 'hold' }));

    assert.equal(notices.update(state({ running: true, mode: 'hold' })).title, 'Удержание');
});

test('итог захода считает клики и время работы', () => {
    const { notices, tick } = createSource();
    notices.update(state({ clicks: 500 }));
    notices.update(state({ running: true, clicks: 500 }));
    tick(26_400);

    const notice = notices.update(state({ running: false, clicks: 812 }));

    assert.equal(notice.kind, 'stop');
    assert.equal(notice.title, 'Автокликер выключен');
    assert.equal(notice.detail, '312 кликов за 26 с');
});

test('долгий заход считается в минутах', () => {
    const { notices, tick } = createSource();
    notices.update(state());
    notices.update(state({ running: true }));

    tick(126_000);
    assert.equal(notices.update(state({ running: false, clicks: 1500 })).detail, '1 500 кликов за 2 мин 6 с');

    notices.update(state({ running: true, clicks: 1500 }));
    tick(120_000);
    assert.equal(notices.update(state({ running: false, clicks: 1501 })).detail, '1 клик за 2 мин');
});

test('сброс счётчика во время работы не уводит итог в минус', () => {
    const { notices } = createSource();
    notices.update(state({ clicks: 500 }));
    notices.update(state({ running: true, clicks: 500 }));

    assert.equal(notices.update(state({ running: false, clicks: 0 })).detail, 'Кликов не было');
});

test('число кликов склоняется по-русски', () => {
    const { notices } = createSource();

    const stop = clicks => {
        notices.update(state());
        notices.update(state({ running: true }));
        return notices.update(state({ running: false, clicks })).detail;
    };

    assert.match(stop(1), /^1 клик за/);
    assert.match(stop(3), /^3 клика за/);
    assert.match(stop(11), /^11 кликов за/);
    assert.match(stop(21), /^21 клик за/);
});

test('сжатая плашка показывает скорость и клики этого захода', () => {
    const { notices } = createSource();
    notices.update(state({ clicks: 40 }));
    notices.update(state({ running: true, clicks: 40, cps: 25 }));

    assert.equal(notices.progress(state({ running: true, clicks: 1287, cps: 25 })), '25 кл/с · 1 247');
});

test('на английском языке плашка говорит по-английски', () => {
    const { notices, tick } = createSource('en');
    notices.update(state());

    const start = notices.update(state({ running: true, cps: 40, button: 'right' }));
    assert.equal(start.title, 'Autoclicker on');
    assert.equal(start.detail, '40 cps, right button');
    assert.equal(start.pill, '40 cps · 0');

    assert.equal(notices.progress(state({ running: true, clicks: 1247, cps: 40 })), '40 cps · 1,247');

    tick(26_400);
    const stop = notices.update(state({ running: false, clicks: 312 }));
    assert.equal(stop.title, 'Autoclicker off');
    assert.equal(stop.detail, '312 clicks in 26 s');
});

test('английский итог знает единственное число и минуты', () => {
    const { notices, tick } = createSource('en');
    notices.update(state());
    notices.update(state({ running: true }));

    tick(126_000);
    assert.equal(notices.update(state({ running: false, clicks: 1 })).detail, '1 click in 2 min 6 s');

    notices.update(state({ running: true, clicks: 1 }));
    assert.equal(notices.update(state({ running: false, clicks: 1 })).detail, 'No clicks');
});

test('смена языка на ходу не сбивает счёт текущего захода', () => {
    const { notices, tick } = createSource('en');
    notices.update(state({ clicks: 100 }));
    notices.update(state({ running: true, clicks: 100 }));

    notices.setLanguage('ru');
    assert.equal(notices.progress(state({ running: true, clicks: 400, cps: 12 })), '12 кл/с · 300');

    tick(5000);
    assert.equal(notices.update(state({ running: false, clicks: 400 })).detail, '300 кликов за 5 с');
});
