'use strict';

// Единственный источник видимых пользователю строк. Окно, плашка поверх игр,
// трей и подписи клавиш берут текст отсюда, поэтому язык переключается везде
// сразу и ни одна надпись не остаётся на чужом языке.

const LANGUAGES = ['en', 'ru'];
const DEFAULT_LANGUAGE = 'en';

const DICTIONARIES = {
    en: {
        'number.group': ',',

        'app.title': 'Clicker',
        'window.minimize': 'Minimize',
        'window.hide': 'Hide window',

        'status.running': 'Running',
        'status.idle': 'Stopped',
        'hint.toggle': '{key} starts and stops clicking',
        'hint.hold': 'Clicks while you hold {key}',

        'speed.title': 'Speed',
        'speed.unit': 'cps',
        'speed.interval': '{ms} ms between clicks',

        'button.title': 'Button',
        'button.left': 'Left',
        'button.right': 'Right',

        'mode.title': 'Mode',
        'mode.toggle': 'Toggle',
        'mode.hold': 'Hold',

        'bind.title': 'Hotkey',
        'bind.change': 'Change',
        'bind.cancel': 'Cancel',
        'bind.waiting': 'Press a key or mouse button',
        'bind.note': 'Escape stops the clicker from any app',
        'bind.noteCapturing': 'Escape cancels the change',
        'bind.takenByClick': '{key} is already used for clicking',
        'bind.takenByHotkey': 'This button is already the hotkey: {key}',

        'counter.label': 'Clicks',
        'counter.reset': 'Reset count',

        'language.title': 'Language',

        'access.title': 'macOS is blocking the clicks',
        'access.text': 'Allow Clicker in System Settings, Privacy & Security, Accessibility.',
        'access.action': 'Open settings',
        'access.waiting': 'Waiting for the permission',

        'tray.show': 'Open window',
        'tray.start': 'Start clicking',
        'tray.stop': 'Stop clicking',
        'tray.quit': 'Quit',
        'tray.running': 'Clicker is running, {cps} cps',
        'tray.idle': 'Clicker is stopped',

        'notice.started': 'Autoclicker on',
        'notice.hold': 'Hold to click',
        'notice.stopped': 'Autoclicker off',
        'notice.detail': '{cps} cps, {button}',
        'notice.buttonLeft': 'left button',
        'notice.buttonRight': 'right button',
        'notice.pill': '{cps} cps · {clicks}',
        'notice.noClicks': 'No clicks',
        'notice.result': '{clicks} {word} in {span}',
        'notice.clickOne': 'click',
        'notice.clickMany': 'clicks',

        'span.seconds': '{seconds} s',
        'span.minutes': '{minutes} min',
        'span.minutesSeconds': '{minutes} min {seconds} s',

        'key.mouseLeft': 'Left mouse button',
        'key.mouseRight': 'Right mouse button',
        'key.mouseMiddle': 'Mouse wheel',
        'key.mouseX1': 'Side button 1',
        'key.mouseX2': 'Side button 2',
        'key.space': 'Space',
        'key.return': 'Return',
        'key.delete': 'Delete',
        'key.deleteForward': 'Forward Delete',
        'key.numEnter': 'Num Enter',
        'key.numClear': 'Num Clear',
        'key.arrowLeft': 'Left arrow',
        'key.arrowUp': 'Up arrow',
        'key.arrowRight': 'Right arrow',
        'key.arrowDown': 'Down arrow',
        'key.menu': 'Menu',
        'key.shiftLeft': 'Left Shift',
        'key.shiftRight': 'Right Shift',
        'key.controlLeft': 'Left Control',
        'key.controlRight': 'Right Control',
        'key.optionLeft': 'Left Option',
        'key.optionRight': 'Right Option',
        'key.commandLeft': 'Left Command',
        'key.commandRight': 'Right Command',
        'key.fn': 'Fn',
        'key.volumeUp': 'Volume up',
        'key.volumeDown': 'Volume down',
        'key.mute': 'Mute',
        'key.eisu': 'Eisu',
        'key.kana': 'Kana',
        'key.named': '{name} key',
        'key.code': 'Key code {code}'
    },

    ru: {
        'number.group': ' ',

        'app.title': 'Кликер',
        'window.minimize': 'Свернуть',
        'window.hide': 'Скрыть окно',

        'status.running': 'Работает',
        'status.idle': 'Выключен',
        'hint.toggle': '{key} включает и выключает',
        'hint.hold': 'Кликает, пока удерживаете: {key}',

        'speed.title': 'Скорость',
        'speed.unit': 'кл/с',
        'speed.interval': 'Пауза между кликами {ms} мс',

        'button.title': 'Кнопка',
        'button.left': 'Левая',
        'button.right': 'Правая',

        'mode.title': 'Режим',
        'mode.toggle': 'Вкл/выкл',
        'mode.hold': 'Удержание',

        'bind.title': 'Горячая клавиша',
        'bind.change': 'Изменить',
        'bind.cancel': 'Отмена',
        'bind.waiting': 'Нажмите клавишу или кнопку мыши',
        'bind.note': 'Escape останавливает кликер из любого приложения',
        'bind.noteCapturing': 'Escape отменяет выбор',
        'bind.takenByClick': '{key} уже выбрана для кликов',
        'bind.takenByHotkey': 'Эта кнопка уже стоит на горячей клавише: {key}',

        'counter.label': 'Кликов',
        'counter.reset': 'Сбросить счёт',

        'language.title': 'Язык',

        'access.title': 'macOS не пропускает клики',
        'access.text': 'Отметьте Кликер в Системных настройках, раздел «Конфиденциальность и безопасность», пункт «Универсальный доступ».',
        'access.action': 'Открыть настройки',
        'access.waiting': 'Жду разрешения',

        'tray.show': 'Показать окно',
        'tray.start': 'Запустить кликер',
        'tray.stop': 'Остановить кликер',
        'tray.quit': 'Выход',
        'tray.running': 'Кликер работает, {cps} кл/с',
        'tray.idle': 'Кликер выключен',

        'notice.started': 'Автокликер включён',
        'notice.hold': 'Удержание',
        'notice.stopped': 'Автокликер выключен',
        'notice.detail': '{cps} кл/с, {button}',
        'notice.buttonLeft': 'левая кнопка',
        'notice.buttonRight': 'правая кнопка',
        'notice.pill': '{cps} кл/с · {clicks}',
        'notice.noClicks': 'Кликов не было',
        'notice.result': '{clicks} {word} за {span}',
        'notice.clickOne': 'клик',
        'notice.clickFew': 'клика',
        'notice.clickMany': 'кликов',

        'span.seconds': '{seconds} с',
        'span.minutes': '{minutes} мин',
        'span.minutesSeconds': '{minutes} мин {seconds} с',

        'key.mouseLeft': 'Левая кнопка мыши',
        'key.mouseRight': 'Правая кнопка мыши',
        'key.mouseMiddle': 'Колесо мыши',
        'key.mouseX1': 'Боковая кнопка 1',
        'key.mouseX2': 'Боковая кнопка 2',
        'key.space': 'Пробел',
        'key.return': 'Return',
        'key.delete': 'Delete',
        'key.deleteForward': 'Delete вперёд',
        'key.numEnter': 'Enter на цифрах',
        'key.numClear': 'Clear на цифрах',
        'key.arrowLeft': 'Стрелка влево',
        'key.arrowUp': 'Стрелка вверх',
        'key.arrowRight': 'Стрелка вправо',
        'key.arrowDown': 'Стрелка вниз',
        'key.menu': 'Меню',
        'key.shiftLeft': 'Shift слева',
        'key.shiftRight': 'Shift справа',
        'key.controlLeft': 'Control слева',
        'key.controlRight': 'Control справа',
        'key.optionLeft': 'Option слева',
        'key.optionRight': 'Option справа',
        'key.commandLeft': 'Command слева',
        'key.commandRight': 'Command справа',
        'key.fn': 'Fn',
        'key.volumeUp': 'Громче',
        'key.volumeDown': 'Тише',
        'key.mute': 'Без звука',
        'key.eisu': 'Eisu',
        'key.kana': 'Kana',
        'key.named': 'Клавиша {name}',
        'key.code': 'Код {code}'
    }
};

function isLanguage(value) {
    return LANGUAGES.includes(value);
}

function normalizeLanguage(value) {
    return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, (match, name) => (
        name in values ? String(values[name]) : match
    ));
}

function translate(language, key, values = {}) {
    const dictionary = DICTIONARIES[normalizeLanguage(language)];
    const template = dictionary[key];
    // Пропущенный ключ виден сразу, а не превращается в пустое место.
    if (template === undefined) return key;
    return fill(template, values);
}

// Разряды разделены по-своему в каждом языке: «1 247» против «1,247».
function formatNumber(value, language) {
    const group = translate(language, 'number.group');
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

// Русский требует трёх форм, английскому хватает двух.
function clicksWord(count, language) {
    if (normalizeLanguage(language) !== 'ru') {
        return translate('en', count === 1 ? 'notice.clickOne' : 'notice.clickMany');
    }

    const tail100 = count % 100;
    if (tail100 >= 11 && tail100 <= 14) return translate('ru', 'notice.clickMany');

    const tail10 = count % 10;
    if (tail10 === 1) return translate('ru', 'notice.clickOne');
    if (tail10 >= 2 && tail10 <= 4) return translate('ru', 'notice.clickFew');
    return translate('ru', 'notice.clickMany');
}

// Окно живёт в отдельном процессе и не может подключить этот модуль, поэтому
// словарь уходит к нему вместе с состоянием.
function dictionary(language) {
    return { ...DICTIONARIES[normalizeLanguage(language)] };
}

function createTranslator(language) {
    const current = normalizeLanguage(language);
    return {
        language: current,
        t: (key, values) => translate(current, key, values),
        number: value => formatNumber(value, current)
    };
}

module.exports = {
    LANGUAGES,
    DEFAULT_LANGUAGE,
    isLanguage,
    normalizeLanguage,
    translate,
    formatNumber,
    clicksWord,
    dictionary,
    createTranslator
};
