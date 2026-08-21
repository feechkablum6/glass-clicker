'use strict';

const ui = {
    island: document.getElementById('island'),
    wide: document.getElementById('layer-wide'),
    pill: document.getElementById('layer-pill'),
    title: document.getElementById('wide-title'),
    detail: document.getElementById('wide-detail'),
    pillText: document.getElementById('pill-text')
};

// Широкая карточка держится столько, потом сжимается в пилюлю и висит,
// пока кликер работает.
const WIDE_HOLD = 1400;
// Итог захода читают дольше: он показывается один раз и уходит.
const RESULT_HOLD = 2000;
const MORPH = 460;
const LEAVE = 300;

const WIDE_HEIGHT = 62;
const PILL_HEIGHT = 34;

let currentId = 0;
let holdTimer = null;
let leaveTimer = null;

// Именно offsetWidth: слои постоянно живут под масштабом кроссфейда, и
// измерение с учётом transform давало бы карточку уже собственного текста.
function measure(layer) {
    return layer.offsetWidth;
}

// Форма подгоняется под текст: пилюля растёт, когда счёт кликов прибавляет
// разряд, а широкая карточка — под длину итога.
function fit(kind) {
    const pill = kind === 'pill';
    ui.island.style.setProperty('--w', `${measure(pill ? ui.pill : ui.wide)}px`);
    ui.island.style.setProperty('--h', `${pill ? PILL_HEIGHT : WIDE_HEIGHT}px`);
}

function stopTimers() {
    clearTimeout(holdTimer);
    clearTimeout(leaveTimer);
}

function showWide(notice) {
    ui.title.textContent = notice.title;
    ui.detail.textContent = notice.detail;
    ui.island.dataset.tone = notice.kind === 'start' ? 'on' : 'off';

    const first = ui.island.dataset.state === 'hidden';
    // Плашка появляется сразу нужного размера, а не приезжает из прошлого.
    if (first) ui.island.classList.add('instant');
    fit('wide');
    if (first) {
        void ui.island.offsetWidth;
        ui.island.classList.remove('instant');
    }
    ui.island.dataset.state = 'wide';
}

function start(notice) {
    stopTimers();
    ui.pillText.textContent = notice.pill;
    showWide(notice);

    holdTimer = setTimeout(() => {
        ui.island.dataset.state = 'pill';
        fit('pill');
    }, WIDE_HOLD);
}

function stop(notice) {
    stopTimers();
    showWide(notice);

    holdTimer = setTimeout(() => {
        ui.island.dataset.state = 'leaving';
        leaveTimer = setTimeout(() => {
            ui.island.dataset.state = 'hidden';
            window.overlay.idle(currentId);
        }, LEAVE);
    }, RESULT_HOLD + MORPH);
}

window.overlay.onNotice(notice => {
    currentId = notice.id;
    if (notice.kind === 'start') start(notice);
    else stop(notice);
});

window.overlay.onDetail(update => {
    if (update.id !== currentId) return;
    ui.pillText.textContent = update.detail;
    if (ui.island.dataset.state === 'pill') fit('pill');
});
