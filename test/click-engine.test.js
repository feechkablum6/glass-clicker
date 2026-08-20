'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ClickEngine, clampCps } = require('../lib/click-engine');

// Управляемое время и очередь таймеров: движок проверяется без Windows.
function createHarness(overrides = {}) {
    const clicks = [];
    let currentTime = 0;
    let nextId = 1;
    const timers = new Map();

    const engine = new ClickEngine({
        click: button => clicks.push({ button, at: currentTime }),
        now: () => currentTime,
        schedule: (callback, delay) => {
            const id = nextId++;
            timers.set(id, { callback, at: currentTime + delay });
            return id;
        },
        cancel: id => timers.delete(id),
        ...overrides
    });

    function advance(ms) {
        const target = currentTime + ms;
        while (true) {
            const due = [...timers.entries()]
                .filter(([, timer]) => timer.at <= target)
                .sort((left, right) => left[1].at - right[1].at)[0];
            if (!due) break;
            const [id, timer] = due;
            timers.delete(id);
            currentTime = timer.at;
            timer.callback();
        }
        currentTime = target;
    }

    return { engine, clicks, advance, timers };
}

test('переключатель запускает и останавливает кликер по нажатию бинда', () => {
    const { engine, clicks, advance } = createHarness();
    engine.configure({ cps: 10 });

    engine.updateBind(true);
    engine.updateBind(false);
    advance(1000);
    assert.equal(engine.getState().running, true);
    assert.equal(clicks.length, 11);

    engine.updateBind(true);
    assert.equal(engine.getState().running, false);

    const afterStop = clicks.length;
    advance(1000);
    assert.equal(clicks.length, afterStop);
});

test('удержание кликает только пока бинд зажат', () => {
    const { engine, clicks, advance } = createHarness();
    engine.configure({ cps: 20, mode: 'hold' });

    engine.updateBind(true);
    advance(500);
    const during = clicks.length;
    assert.equal(during, 11);

    engine.updateBind(false);
    advance(500);
    assert.equal(clicks.length, during);
    assert.equal(engine.getState().running, false);
});

test('повторный опрос зажатого бинда не переключает состояние', () => {
    const { engine } = createHarness();

    engine.updateBind(true);
    engine.updateBind(true);
    engine.updateBind(true);
    assert.equal(engine.getState().running, true);
});

// Бинд назначается нажатием, поэтому в момент назначения клавиша зажата.
// Пока её не отпустят, это не считается командой запуска.
test('только что назначенный бинд не запускает кликер, пока его держат', () => {
    const { engine } = createHarness();

    engine.adoptBind(true);
    engine.updateBind(true);
    assert.equal(engine.getState().running, false, 'кликер стартовал прямо на выборе клавиши');

    engine.updateBind(false);
    assert.equal(engine.getState().running, false);

    engine.updateBind(true);
    assert.equal(engine.getState().running, true, 'следующее нажатие должно работать как обычно');
});

test('в режиме удержания назначенная клавиша тоже ждёт отпускания', () => {
    const { engine } = createHarness();
    engine.configure({ mode: 'hold' });

    engine.adoptBind(true);
    engine.updateBind(true);
    assert.equal(engine.getState().running, false);

    engine.updateBind(false);
    engine.updateBind(true);
    assert.equal(engine.getState().running, true);
});

// Уведомление поверх окон считает клики от значения на старте, поэтому
// запуск обязан объявиться раньше, чем движок сделает первый клик.
test('запуск объявляется до первого клика', () => {
    const seen = [];
    const { engine } = createHarness({ onChange: state => seen.push(state.clicks) });

    engine.start();

    assert.equal(seen[0], 0);
    assert.equal(engine.getState().clicks, 1);
});

test('интервал между кликами соответствует выбранной скорости', () => {
    const { engine, clicks, advance } = createHarness();
    engine.configure({ cps: 25 });

    engine.start();
    advance(1000);

    const gaps = clicks.slice(1).map((click, index) => click.at - clicks[index].at);
    assert.ok(gaps.every(gap => Math.abs(gap - 40) < 1), `неровный интервал: ${gaps}`);
});

test('смена скорости на ходу меняет темп без остановки', () => {
    const { engine, clicks, advance } = createHarness();
    engine.configure({ cps: 5 });

    engine.start();
    advance(1000);
    const slow = clicks.length;

    engine.configure({ cps: 50 });
    advance(1000);
    assert.equal(engine.getState().running, true);
    assert.ok(clicks.length - slow > slow * 5, 'скорость не выросла');
});

test('переход в режим удержания с отпущенным биндом останавливает кликер', () => {
    const { engine } = createHarness();

    engine.updateBind(true);
    engine.updateBind(false);
    assert.equal(engine.getState().running, true);

    engine.configure({ mode: 'hold' });
    assert.equal(engine.getState().running, false);
});

test('кликер кликает выбранной кнопкой', () => {
    const { engine, clicks, advance } = createHarness();
    engine.configure({ cps: 10, button: 'right' });

    engine.start();
    advance(300);
    assert.ok(clicks.length > 0);
    assert.ok(clicks.every(click => click.button === 'right'));
});

test('долгий простой процесса не выдаёт залп накопленных кликов', () => {
    let currentTime = 0;
    const clicks = [];
    const timers = new Map();
    let nextId = 1;

    const engine = new ClickEngine({
        click: () => clicks.push(currentTime),
        now: () => currentTime,
        schedule: (callback, delay) => {
            const id = nextId++;
            timers.set(id, { callback, at: currentTime + delay });
            return id;
        },
        cancel: id => timers.delete(id)
    });
    engine.configure({ cps: 50 });
    engine.start();

    // Система ушла в сон на десять секунд, отложенный таймер сработал один раз.
    currentTime = 10000;
    const [id, timer] = [...timers.entries()][0];
    timers.delete(id);
    timer.callback();

    assert.equal(clicks.length, 2);
});

test('точность таймеров поднимается только на время работы', () => {
    const calls = [];
    const { engine } = createHarness({
        onLoadStart: () => calls.push('begin'),
        onLoadEnd: () => calls.push('end')
    });

    engine.start();
    engine.start();
    engine.stop();
    engine.stop();
    assert.deepEqual(calls, ['begin', 'end']);
});

test('скорость держится в допустимых границах', () => {
    assert.equal(clampCps(0), 1);
    assert.equal(clampCps(-40), 1);
    assert.equal(clampCps(1000), 100);
    assert.equal(clampCps('37'), 37);
    assert.equal(clampCps(undefined), 1);
});

test('счётчик кликов сбрасывается', () => {
    const { engine, advance } = createHarness();
    engine.configure({ cps: 10 });

    engine.start();
    advance(500);
    assert.ok(engine.getState().clicks > 0);

    engine.resetCounter();
    assert.equal(engine.getState().clicks, 0);
});
