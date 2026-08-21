'use strict';

const koffi = require('koffi');
const { MOUSE_BASE } = require('./keys');

// Событие создаётся один раз и переиспользуется: на сотне кликов в секунду
// лишние выделения памяти ни к чему.
const CGPoint = koffi.struct('CGPoint', { x: 'double', y: 'double' });
const CGEventRef = koffi.pointer('CGEventRef', koffi.opaque());
const CGEventSourceRef = koffi.pointer('CGEventSourceRef', koffi.opaque());

const EVENT = {
    LEFT_DOWN: 1,
    LEFT_UP: 2,
    RIGHT_DOWN: 3,
    RIGHT_UP: 4
};
const BUTTON = { left: 0, right: 1 };
// Точка вброса: события уходят в самый низ, до перехватчиков и до окон, —
// так их видят и игры, и приложения с собственной обработкой ввода.
const HID_EVENT_TAP = 0;
// Состояние железа, а не сессии: синтетические клики самого кликера в него не
// попадают, поэтому бинд на кнопку мыши не самозапускается.
const HID_STATE = 1;
// Поле, по которому наши клики можно отличить от настоящих.
const FIELD_USER_DATA = 42;
const SIGNATURE = 0x47434c4bn;

function createMac() {
    const lib = koffi.load('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices');

    const api = {
        CGEventSourceCreate: lib.func('CGEventSourceRef CGEventSourceCreate(int32_t stateID)'),
        CGEventCreate: lib.func('CGEventRef CGEventCreate(CGEventSourceRef source)'),
        CGEventCreateMouseEvent: lib.func(
            'CGEventRef CGEventCreateMouseEvent(CGEventSourceRef source, uint32_t type, CGPoint position, uint32_t button)'
        ),
        CGEventGetLocation: lib.func('CGPoint CGEventGetLocation(CGEventRef event)'),
        CGEventSetLocation: lib.func('void CGEventSetLocation(CGEventRef event, CGPoint location)'),
        CGEventSetIntegerValueField: lib.func(
            'void CGEventSetIntegerValueField(CGEventRef event, uint32_t field, int64_t value)'
        ),
        CGEventSetFlags: lib.func('void CGEventSetFlags(CGEventRef event, uint64_t flags)'),
        CGEventPost: lib.func('void CGEventPost(uint32_t tap, CGEventRef event)'),
        CGEventSourceKeyState: lib.func('bool CGEventSourceKeyState(int32_t stateID, uint16_t key)'),
        CGEventSourceButtonState: lib.func('bool CGEventSourceButtonState(int32_t stateID, uint32_t button)'),
        AXIsProcessTrusted: lib.func('bool AXIsProcessTrusted()'),
        CFRelease: lib.func('void CFRelease(void *cf)')
    };

    const source = api.CGEventSourceCreate(HID_STATE);
    const origin = { x: 0, y: 0 };

    function createClick(type, button) {
        const event = api.CGEventCreateMouseEvent(source, type, origin, button);
        api.CGEventSetIntegerValueField(event, FIELD_USER_DATA, SIGNATURE);
        return event;
    }

    const clickSequences = {
        left: [createClick(EVENT.LEFT_DOWN, BUTTON.left), createClick(EVENT.LEFT_UP, BUTTON.left)],
        right: [createClick(EVENT.RIGHT_DOWN, BUTTON.right), createClick(EVENT.RIGHT_UP, BUTTON.right)]
    };

    // Клик уходит туда, где сейчас курсор: если поставить событию другую точку,
    // указатель прыгнет к ней.
    function cursorPoint() {
        const probe = api.CGEventCreate(source);
        const point = api.CGEventGetLocation(probe);
        api.CFRelease(probe);
        return point;
    }

    return {
        click(button) {
            const sequence = clickSequences[button] || clickSequences.left;
            const point = cursorPoint();
            for (const event of sequence) {
                api.CGEventSetLocation(event, point);
                // Клик уходит чистым, без модификаторов: иначе горячая клавиша
                // на Command или Shift сделала бы из каждого клика сочетание с
                // ней, а зажата она всё время работы кликера.
                api.CGEventSetFlags(event, 0n);
                api.CGEventPost(HID_EVENT_TAP, event);
            }
        },

        // Коды клавиш и кнопок мыши живут в одной нумерации, но состояние их
        // читают разные функции.
        isKeyDown(code) {
            if (code >= MOUSE_BASE) return api.CGEventSourceButtonState(HID_STATE, code - MOUSE_BASE);
            return api.CGEventSourceKeyState(HID_STATE, code);
        },

        // Без «Универсального доступа» система молча выбрасывает синтетические
        // клики: ошибки нет, просто ничего не происходит.
        isTrusted() {
            return api.AXIsProcessTrusted();
        },

        dispose() {
            for (const sequence of Object.values(clickSequences)) {
                for (const event of sequence) api.CFRelease(event);
            }
            if (source) api.CFRelease(source);
        }
    };
}

module.exports = { createMac, SIGNATURE };
