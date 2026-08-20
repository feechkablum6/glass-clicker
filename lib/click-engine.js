'use strict';

const MIN_CPS = 1;
const MAX_CPS = 100;
// Отставание больше этого порога означает, что процесс подвис или система
// уснула. Догонять пропущенные клики нельзя: пользователь получил бы залп.
const MAX_CATCH_UP = 250;

function clampCps(value) {
    const cps = Number(value);
    if (!Number.isFinite(cps)) return MIN_CPS;
    return Math.min(MAX_CPS, Math.max(MIN_CPS, Math.round(cps)));
}

/**
 * Расписание кликов и переключение режимов. Всё, что касается Windows,
 * приходит извне: движок только решает, когда кликать и когда остановиться.
 */
class ClickEngine {
    constructor({ click, now, schedule, cancel, onChange, onLoadStart, onLoadEnd }) {
        this.click = click;
        this.now = now;
        this.schedule = schedule;
        this.cancel = cancel;
        this.onChange = onChange || (() => {});
        this.onLoadStart = onLoadStart || (() => {});
        this.onLoadEnd = onLoadEnd || (() => {});

        this.cps = 12;
        this.button = 'left';
        this.mode = 'toggle';
        this.running = false;
        this.clicks = 0;
        this.bindWasDown = false;
        this.timer = null;
        this.nextClickAt = 0;
    }

    configure(patch = {}) {
        if (patch.cps !== undefined) this.cps = clampCps(patch.cps);
        if (patch.button === 'left' || patch.button === 'right') this.button = patch.button;
        if (patch.mode === 'toggle' || patch.mode === 'hold') this.mode = patch.mode;

        // Переключатель держит кликер включённым сам по себе, удержание — нет:
        // при смене режима на удержание с отпущенным биндом кликер обязан встать.
        if (this.running && this.mode === 'hold' && !this.bindWasDown) this.stop();
        this.emit();
    }

    getState() {
        return {
            running: this.running,
            clicks: this.clicks,
            cps: this.cps,
            button: this.button,
            mode: this.mode
        };
    }

    // Бинд назначают нажатием, то есть клавиша в этот момент зажата. Движок
    // запоминает её состояние, но не считает это нажатием: иначе кликер
    // стартовал бы прямо на выборе горячей клавиши.
    adoptBind(isDown) {
        this.bindWasDown = isDown;
    }

    // Состояние бинда приходит с каждого опроса; движок сам ищет фронт нажатия.
    updateBind(isDown) {
        const pressed = isDown && !this.bindWasDown;
        const released = !isDown && this.bindWasDown;
        this.bindWasDown = isDown;

        if (this.mode === 'hold') {
            if (pressed) this.start();
            if (released) this.stop();
            return;
        }
        if (pressed) this.toggle();
    }

    toggle() {
        if (this.running) this.stop();
        else this.start();
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.nextClickAt = this.now();
        this.onLoadStart();
        // Состояние объявляется до первого клика: подписчики успевают
        // запомнить счётчик на старте и показать клики этого захода.
        this.emit();
        this.tick();
    }

    stop() {
        if (!this.running) return;
        this.running = false;
        if (this.timer !== null) {
            this.cancel(this.timer);
            this.timer = null;
        }
        this.onLoadEnd();
        this.emit();
    }

    resetCounter() {
        this.clicks = 0;
        this.emit();
    }

    tick() {
        if (!this.running) return;

        this.click(this.button);
        this.clicks += 1;

        const interval = 1000 / this.cps;
        const current = this.now();
        this.nextClickAt += interval;
        if (this.nextClickAt < current - MAX_CATCH_UP) this.nextClickAt = current + interval;

        const delay = Math.max(0, this.nextClickAt - current);
        this.timer = this.schedule(() => {
            this.timer = null;
            this.tick();
        }, delay);
    }

    emit() {
        this.onChange(this.getState());
    }
}

module.exports = { ClickEngine, clampCps, MIN_CPS, MAX_CPS };
