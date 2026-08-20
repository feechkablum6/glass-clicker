'use strict';

const ui = {
    body: document.body,
    titlebar: document.getElementById('titlebar'),
    power: document.getElementById('power'),
    status: document.getElementById('status'),
    hint: document.getElementById('hint'),
    cps: document.getElementById('cps'),
    cpsValue: document.getElementById('cps-value'),
    intervalNote: document.getElementById('interval-note'),
    buttonSegment: document.getElementById('button-segment'),
    modeSegment: document.getElementById('mode-segment'),
    bind: document.getElementById('bind'),
    bindName: document.getElementById('bind-name'),
    bindAction: document.getElementById('bind-action'),
    bindNote: document.getElementById('bind-note'),
    clicks: document.getElementById('clicks'),
    reset: document.getElementById('reset'),
    minimize: document.getElementById('minimize'),
    close: document.getElementById('close')
};

const BIND_NOTE = 'Escape останавливает кликер из любого приложения';
const numbers = new Intl.NumberFormat('ru-RU');

let state = null;
let noteTimer = null;
let sendTimer = null;

function setSegment(segment, value) {
    const buttons = [...segment.querySelectorAll('button')];
    const index = buttons.findIndex(button => button.dataset.value === value);
    segment.dataset.index = index < 0 ? 0 : index;
    buttons.forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.value === value));
    });
}

function setSliderFill(value) {
    const min = Number(ui.cps.min);
    const max = Number(ui.cps.max);
    const ratio = (value - min) / (max - min);
    ui.cps.style.setProperty('--ratio', ratio.toFixed(4));
}

function describeSpeed(cps) {
    const interval = Math.round(1000 / cps);
    return `Пауза между кликами ${numbers.format(interval)} мс`;
}

function describeHint(current) {
    if (current.mode === 'hold') return `Кликает, пока удерживаете: ${current.bindLabel}`;
    return `${current.bindLabel} включает и выключает`;
}

function renderSpeed(cps) {
    ui.cpsValue.textContent = numbers.format(cps);
    ui.intervalNote.textContent = describeSpeed(cps);
    setSliderFill(cps);
}

function render(next) {
    state = next;
    ui.body.classList.toggle('running', next.running);
    ui.body.classList.toggle('capturing', next.capturing);
    ui.body.classList.toggle('no-glass', !next.glass);

    ui.power.setAttribute('aria-pressed', String(next.running));
    ui.status.textContent = next.running ? 'Работает' : 'Выключен';
    ui.hint.textContent = describeHint(next);

    if (document.activeElement !== ui.cps) ui.cps.value = String(next.cps);
    renderSpeed(next.cps);

    setSegment(ui.buttonSegment, next.button);
    setSegment(ui.modeSegment, next.mode);

    ui.bindName.textContent = next.capturing
        ? 'Нажмите клавишу или кнопку мыши'
        : next.bindLabel;
    ui.bindAction.textContent = next.capturing ? 'Отмена' : 'Изменить';
    if (next.capturing) ui.bindNote.textContent = 'Escape отменяет выбор';

    ui.clicks.textContent = numbers.format(next.clicks);
}

function showNote(message) {
    clearTimeout(noteTimer);
    ui.bindNote.textContent = message;
    ui.bindNote.classList.add('warning');
    noteTimer = setTimeout(() => {
        ui.bindNote.classList.remove('warning');
        ui.bindNote.textContent = BIND_NOTE;
    }, 2600);
}

async function applyConfig(patch) {
    const result = await window.clicker.updateConfig(patch);
    if (result.ok) return;

    if (result.reason === 'same-as-bind') {
        showNote(`Эта кнопка уже стоит на горячей клавише: ${result.label}`);
    }
    render(await window.clicker.getState());
}

ui.cps.addEventListener('input', () => {
    const value = Number(ui.cps.value);
    renderSpeed(value);
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => applyConfig({ cps: value }), 40);
});

[ui.buttonSegment, ui.modeSegment].forEach(segment => {
    segment.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button) return;

        const key = segment === ui.buttonSegment ? 'button' : 'mode';
        if (state && state[key] === button.dataset.value) return;

        setSegment(segment, button.dataset.value);
        applyConfig({ [key]: button.dataset.value });
    });
});

ui.power.addEventListener('click', () => window.clicker.toggle());

ui.bind.addEventListener('click', () => {
    if (state?.capturing) {
        window.clicker.cancelCapture();
        return;
    }
    window.clicker.captureBind();
});

ui.reset.addEventListener('click', () => window.clicker.resetCounter());
ui.minimize.addEventListener('click', () => window.clicker.minimize());
ui.close.addEventListener('click', () => window.clicker.close());

ui.titlebar.addEventListener('mousedown', event => {
    if (event.target.closest('button')) return;
    ui.body.classList.add('dragging');
    window.clicker.beginDrag();
});

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !state?.capturing) return;
    window.clicker.cancelCapture();
});

window.clicker.onState(render);

window.clicker.onClicks(clicks => {
    ui.clicks.textContent = numbers.format(clicks);
    if (state) state.clicks = clicks;
});

window.clicker.onBindRejected(info => {
    ui.bind.classList.remove('rejected');
    void ui.bind.offsetWidth;
    ui.bind.classList.add('rejected');
    showNote(`${info.label} уже выбрана для кликов`);
});

window.clicker.onDragEnd(() => ui.body.classList.remove('dragging'));

window.clicker.getState().then(render);
