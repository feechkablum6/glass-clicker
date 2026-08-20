'use strict';

const koffi = require('koffi');

const INPUT_MOUSE = 0;
const MOUSEEVENTF = {
    LEFTDOWN: 0x0002,
    LEFTUP: 0x0004,
    RIGHTDOWN: 0x0008,
    RIGHTUP: 0x0010
};
// Метка в dwExtraInfo позволяет отличить наши клики от настоящих, если
// когда-нибудь понадобится их фильтровать.
const SIGNATURE = 0x47434c4b;

const WCA_ACCENT_POLICY = 19;
const ACCENT = {
    DISABLED: 0,
    BLUR: 3,
    ACRYLIC: 4
};
const DWMWA_WINDOW_CORNER_PREFERENCE = 33;
const DWMWCP_ROUND = 2;
const MAPVK_VK_TO_VSC = 0;

const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
    dx: 'int32',
    dy: 'int32',
    mouseData: 'uint32',
    dwFlags: 'uint32',
    time: 'uint32',
    dwExtraInfo: 'uintptr_t'
});
const INPUT = koffi.struct('INPUT', {
    type: 'uint32',
    mi: MOUSEINPUT
});
const WINDOWCOMPOSITIONATTRIBDATA = koffi.struct('WINDOWCOMPOSITIONATTRIBDATA', {
    Attribute: 'int32',
    pData: 'void*',
    cbData: 'size_t'
});

function mouseInput(flags) {
    return {
        type: INPUT_MOUSE,
        mi: {
            dx: 0,
            dy: 0,
            mouseData: 0,
            dwFlags: flags,
            time: 0,
            dwExtraInfo: SIGNATURE
        }
    };
}

function createWin32() {
    const user32 = koffi.load('user32.dll');
    const winmm = koffi.load('winmm.dll');
    const dwmapi = koffi.load('dwmapi.dll');
    const gdi32 = koffi.load('gdi32.dll');

    const api = {
        SendInput: user32.func('uint32 __stdcall SendInput(uint32 cInputs, INPUT *pInputs, int cbSize)'),
        GetAsyncKeyState: user32.func('int16 __stdcall GetAsyncKeyState(int vKey)'),
        MapVirtualKeyW: user32.func('uint32 __stdcall MapVirtualKeyW(uint32 uCode, uint32 uMapType)'),
        GetKeyNameTextW: user32.func('int __stdcall GetKeyNameTextW(long lParam, void *lpString, int cchSize)'),
        SetWindowRgn: user32.func('int __stdcall SetWindowRgn(void *hWnd, void *hRgn, int bRedraw)'),
        CreateRoundRectRgn: gdi32.func('void* __stdcall CreateRoundRectRgn(int x1, int y1, int x2, int y2, int w, int h)'),
        DwmSetWindowAttribute: dwmapi.func('int32 __stdcall DwmSetWindowAttribute(void *hwnd, uint32 attribute, void *value, uint32 size)'),
        timeBeginPeriod: winmm.func('uint32 __stdcall timeBeginPeriod(uint32 uPeriod)'),
        timeEndPeriod: winmm.func('uint32 __stdcall timeEndPeriod(uint32 uPeriod)')
    };

    // Функция не документирована и в теории может исчезнуть, поэтому её
    // отсутствие не должно ронять приложение: окно просто останется без
    // системного размытия.
    let setComposition = null;
    try {
        setComposition = user32.func(
            'int __stdcall SetWindowCompositionAttribute(void *hwnd, WINDOWCOMPOSITIONATTRIBDATA *data)'
        );
    } catch (error) {
        setComposition = null;
    }

    const inputSize = koffi.sizeof(INPUT);
    const clickSequences = {
        left: [mouseInput(MOUSEEVENTF.LEFTDOWN), mouseInput(MOUSEEVENTF.LEFTUP)],
        right: [mouseInput(MOUSEEVENTF.RIGHTDOWN), mouseInput(MOUSEEVENTF.RIGHTUP)]
    };

    let timerResolutionDepth = 0;

    function toHandle(value) {
        if (typeof value === 'bigint') return value;
        if (Buffer.isBuffer(value)) return value.readBigUInt64LE(0);
        if (typeof value === 'number') return BigInt(value);
        return 0n;
    }

    return {
        click(button) {
            const sequence = clickSequences[button] || clickSequences.left;
            api.SendInput(sequence.length, sequence, inputSize);
        },

        isKeyDown(virtualKey) {
            return (api.GetAsyncKeyState(virtualKey) & 0x8000) !== 0;
        },

        readKeyName(virtualKey, extended) {
            const scanCode = api.MapVirtualKeyW(virtualKey, MAPVK_VK_TO_VSC);
            if (!scanCode) return null;

            const lParam = (scanCode << 16) | (extended ? 0x01000000 : 0);
            const buffer = Buffer.alloc(128);
            const length = api.GetKeyNameTextW(lParam, buffer, 64);
            if (length <= 0) return null;
            return buffer.toString('utf16le', 0, length * 2).trim() || null;
        },

        // Точность setTimeout в Windows по умолчанию около 15 мс, чего мало
        // даже для 30 кликов в секунду. Разрешение поднимается только на время
        // работы кликера, чтобы не держать систему в энергозатратном режиме.
        beginPreciseTimers() {
            timerResolutionDepth += 1;
            if (timerResolutionDepth === 1) api.timeBeginPeriod(1);
        },

        endPreciseTimers() {
            if (timerResolutionDepth === 0) return;
            timerResolutionDepth -= 1;
            if (timerResolutionDepth === 0) api.timeEndPeriod(1);
        },

        applyGlass(windowHandle, { enabled = true, tint = 0x8cf7f8fa } = {}) {
            if (!setComposition) return false;

            const accent = Buffer.alloc(16);
            accent.writeInt32LE(enabled ? ACCENT.ACRYLIC : ACCENT.DISABLED, 0);
            accent.writeInt32LE(2, 4);
            accent.writeUInt32LE(enabled ? tint >>> 0 : 0, 8);
            accent.writeInt32LE(0, 12);

            const result = setComposition(toHandle(windowHandle), {
                Attribute: WCA_ACCENT_POLICY,
                pData: accent,
                cbData: accent.length
            });
            return Boolean(result);
        },

        // Системное размытие рисуется поверх всей клиентской области, поэтому
        // скругление из CSS его не обрезает: углы задаются самому окну.
        applyRoundedCorners(windowHandle, { width, height, radius }) {
            const handle = toHandle(windowHandle);
            const preference = Buffer.alloc(4);
            preference.writeInt32LE(DWMWCP_ROUND, 0);
            const status = api.DwmSetWindowAttribute(
                handle,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                preference,
                preference.length
            );
            if (status === 0) return 'dwm';

            const region = api.CreateRoundRectRgn(0, 0, width + 1, height + 1, radius * 2, radius * 2);
            if (!region) return 'none';
            api.SetWindowRgn(handle, region, 1);
            return 'region';
        }
    };
}

module.exports = { createWin32, SIGNATURE };
