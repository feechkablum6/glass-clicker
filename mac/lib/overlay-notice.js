'use strict';

const { createTranslator, clicksWord } = require('./i18n');

const BUTTON_KEYS = {
    left: 'notice.buttonLeft',
    right: 'notice.buttonRight'
};

/**
 * Что показывает плашка поверх окон. Широкий вид объявляет включение и итог
 * захода, сжатый висит всё время работы и считает клики.
 */
function createNoticeSource({ now = () => Date.now(), language } = {}) {
    let translator = createTranslator(language);
    let running = false;
    let clicksAtStart = 0;
    let startedAt = 0;

    const t = (key, values) => translator.t(key, values);
    const number = value => translator.number(value);

    function describeSpan(elapsed) {
        const total = Math.max(1, Math.round(elapsed / 1000));
        if (total < 60) return t('span.seconds', { seconds: total });

        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return seconds
            ? t('span.minutesSeconds', { minutes, seconds })
            : t('span.minutes', { minutes });
    }

    function describeResult(clicks, elapsed) {
        if (clicks <= 0) return t('notice.noClicks');
        return t('notice.result', {
            clicks: number(clicks),
            word: clicksWord(clicks, translator.language),
            span: describeSpan(elapsed)
        });
    }

    // Счётчик кликов общий и живёт между заходами, а на плашке интереснее
    // клики текущего захода: сколько сделал именно этот запуск.
    function sessionClicks(state) {
        return Math.max(0, state.clicks - clicksAtStart);
    }

    function pill(state) {
        return t('notice.pill', { cps: state.cps, clicks: number(sessionClicks(state)) });
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
                    title: state.mode === 'hold' ? t('notice.hold') : t('notice.started'),
                    detail: t('notice.detail', { cps: state.cps, button: t(BUTTON_KEYS[state.button]) }),
                    pill: pill(state)
                };
            }

            return {
                kind: 'stop',
                title: t('notice.stopped'),
                detail: describeResult(sessionClicks(state), now() - startedAt)
            };
        },

        progress: state => pill(state),

        // Язык меняют на ходу, а заход при этом продолжается: счёт кликов и
        // время старта переживают смену.
        setLanguage(next) {
            translator = createTranslator(next);
        }
    };
}

module.exports = { createNoticeSource };
