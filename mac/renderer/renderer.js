'use strict';

const ui = {
    body: document.body,
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
    language: document.getElementById('language'),
    welcome: document.getElementById('welcome'),
    gate: document.getElementById('gate'),
    gateAction: document.getElementById('gate-action'),
    minimize: document.getElementById('minimize'),
    close: document.getElementById('close')
};

const WELCOME_LEAVE = 220;

// Словарь приходит из главного процесса вместе с состоянием: у окна и у
// плашки поверх игр один и тот же источник строк.
let strings = {};
let state = null;
let noteTimer = null;
let sendTimer = null;
// У каждого слоя поверх окна свой отсчёт ухода: язык выбирают один раз, а
// разрешение может пропасть и вернуться в любой момент.
const layerTimers = new WeakMap();

function t(key, values = {}) {
    const template = strings[key];
    if (template === undefined) return key;
    return template.replace(/\{(\w+)\}/g, (match, name) => (
        name in values ? String(values[name]) : match
    ));
}

function formatNumber(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, strings['number.group'] ?? ' ');
}

// Подписи, которые не зависят от состояния кликера, переставляются одним
// проходом: так ни одна не может остаться на прежнем языке.
function applyStrings() {
    document.title = t('app.title');
    document.documentElement.lang = state?.language ?? 'en';

    document.querySelectorAll('[data-i18n]').forEach(node => {
        node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(node => {
        node.title = t(node.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(node => {
        node.setAttribute('aria-label', t(node.dataset.i18nAria));
    });
}

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

function describeHint(current) {
    return current.mode === 'hold'
        ? t('hint.hold', { key: current.bindLabel })
        : t('hint.toggle', { key: current.bindLabel });
}

function renderSpeed(cps) {
    ui.cpsValue.textContent = formatNumber(cps);
    ui.intervalNote.textContent = t('speed.interval', { ms: formatNumber(Math.round(1000 / cps)) });
    setSliderFill(cps);
}

function setLayer(layer, visible) {
    clearTimeout(layerTimers.get(layer));

    if (visible) {
        layer.classList.remove('leaving');
        if (!layer.hidden) return;
        layer.hidden = false;
        layer.querySelector('.choice')?.focus();
        return;
    }

    if (layer.hidden) return;
    layer.classList.add('leaving');
    layerTimers.set(layer, setTimeout(() => {
        layer.hidden = true;
        layer.classList.remove('leaving');
    }, WELCOME_LEAVE));
}

function render(next) {
    const languageChanged = !state || state.language !== next.language;
    state = next;
    if (next.strings) strings = next.strings;
    if (languageChanged || next.strings) applyStrings();

    setLayer(ui.welcome, !next.languageChosen);
    // Вопрос о языке идёт первым: разрешение спрашивают уже на понятном языке.
    setLayer(ui.gate, next.languageChosen && !next.access);
    ui.language.textContent = next.language.toUpperCase();

    ui.body.classList.toggle('running', next.running);
    ui.body.classList.toggle('capturing', next.capturing);

    ui.power.setAttribute('aria-pressed', String(next.running));
    ui.status.textContent = next.running ? t('status.running') : t('status.idle');
    ui.hint.textContent = describeHint(next);

    if (document.activeElement !== ui.cps) ui.cps.value = String(next.cps);
    renderSpeed(next.cps);

    setSegment(ui.buttonSegment, next.button);
    setSegment(ui.modeSegment, next.mode);

    ui.bindName.textContent = next.capturing ? t('bind.waiting') : next.bindLabel;
    ui.bindAction.textContent = next.capturing ? t('bind.cancel') : t('bind.change');
    if (!ui.bindNote.classList.contains('warning')) {
        ui.bindNote.textContent = next.capturing ? t('bind.noteCapturing') : t('bind.note');
    }

    ui.clicks.textContent = formatNumber(next.clicks);
}

function showNote(message) {
    clearTimeout(noteTimer);
    ui.bindNote.textContent = message;
    ui.bindNote.classList.add('warning');
    noteTimer = setTimeout(() => {
        ui.bindNote.classList.remove('warning');
        ui.bindNote.textContent = t('bind.note');
    }, 2600);
}

async function applyConfig(patch) {
    const result = await window.clicker.updateConfig(patch);
    if (result.ok) return;

    if (result.reason === 'same-as-bind') {
        showNote(t('bind.takenByHotkey', { key: result.label }));
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

ui.language.addEventListener('click', () => {
    window.clicker.setLanguage(state?.language === 'ru' ? 'en' : 'ru');
});

ui.welcome.addEventListener('click', event => {
    const choice = event.target.closest('.choice');
    if (!choice) return;
    window.clicker.setLanguage(choice.dataset.language);
});

ui.gateAction.addEventListener('click', () => window.clicker.requestAccess());

ui.reset.addEventListener('click', () => window.clicker.resetCounter());
ui.minimize.addEventListener('click', () => window.clicker.minimize());
ui.close.addEventListener('click', () => window.clicker.close());

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !state?.capturing) return;
    window.clicker.cancelCapture();
});

window.clicker.onState(render);

window.clicker.onClicks(clicks => {
    ui.clicks.textContent = formatNumber(clicks);
    if (state) state.clicks = clicks;
});

window.clicker.onBindRejected(info => {
    ui.bind.classList.remove('rejected');
    void ui.bind.offsetWidth;
    ui.bind.classList.add('rejected');
    showNote(t('bind.takenByClick', { key: info.label }));
});

window.clicker.getState().then(render);
