'use strict';

const BUTTON_NAMES = {
    left: 'левая кнопка',
    right: 'правая кнопка'
};

function pluralClicks(count) {
    const tail100 = count % 100;
    if (tail100 >= 11 && tail100 <= 14) return 'кликов';

    const tail10 = count % 10;
    if (tail10 === 1) return 'клик';
    if (tail10 >= 2 && tail10 <= 4) return 'клика';
    return 'кликов';
}

// Разряды разделены пробелом: в пилюле счёт растёт на глазах, и сплошное
// число из шести цифр читается хуже, чем «12 480».
function formatCount(count) {
    return String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function describeSpan(elapsed) {
    const seconds = Math.max(1, Math.round(elapsed / 1000));
    if (seconds < 60) return `${seconds} с`;

    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest ? `${minutes} мин ${rest} с` : `${minutes} мин`;
}

function describeResult(clicks, elapsed) {
    if (clicks <= 0) return 'Кликов не было';
    return `${formatCount(clicks)} ${pluralClicks(clicks)} за ${describeSpan(elapsed)}`;
}

/**
 * Что показывает плашка поверх окон. Широкий вид объявляет включение и итог
 * захода, сжатый висит всё время работы и считает клики.
 */
function createNoticeSource({ now = () => Date.now() } = {}) {
    let running = false;
    let clicksAtStart = 0;
    let startedAt = 0;

    // Счётчик кликов общий и живёт между заходами, а на плашке интереснее
    // клики текущего захода: сколько сделал именно этот запуск.
    function sessionClicks(state) {
        return Math.max(0, state.clicks - clicksAtStart);
    }

    function pill(state) {
        return `${state.cps} кл/с · ${formatCount(sessionClicks(state))}`;
    }

    return {
        update(state) {
            if (state.running === running) return null;
            running = state.running;

            if (running) {
                clicksAtStart = state.clicks;
                startedAt = now();
                return {
                    kind: 'start',
                    title: state.mode === 'hold' ? 'Удержание' : 'Автокликер включён',
                    detail: `${state.cps} кл/с, ${BUTTON_NAMES[state.button]}`,
                    pill: pill(state)
                };
            }

            return {
                kind: 'stop',
                title: 'Автокликер выключен',
                detail: describeResult(sessionClicks(state), now() - startedAt)
            };
        },

        progress: state => pill(state)
    };
}

module.exports = { createNoticeSource };
