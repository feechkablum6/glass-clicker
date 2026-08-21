'use strict';

const path = require('path');
const {
    app,
    BrowserWindow,
    Menu,
    Tray,
    ipcMain,
    nativeImage,
    nativeTheme,
    powerSaveBlocker,
    screen,
    shell,
    systemPreferences
} = require('electron');
const { createMac } = require('./lib/macos');
const { ClickEngine } = require('./lib/click-engine');
const { createSettingsStore } = require('./lib/settings');
const { createNoticeSource } = require('./lib/overlay-notice');
const { KEY, buttonCode, capturableKeys, describeKey } = require('./lib/keys');
const { dictionary, isLanguage, normalizeLanguage, translate } = require('./lib/i18n');

const WINDOW = { width: 400, height: 632 };
// Окно плашки шире самой карточки: в запас уходят тень и разлёт анимации.
const OVERLAY = { width: 460, height: 120, margin: 10 };
// Итог захода живёт на экране ограниченное время; запас поверх анимаций.
const RESULT_LIFETIME = 5000;
// Опрос бинда идёт чаще, чем человек способен нажать кнопку, поэтому
// пропущенных нажатий не бывает даже на коротком тапе.
const POLL_INTERVAL = 6;
// Перебор всей таблицы клавиш стоит дороже одного опроса, поэтому во время
// захвата бинда он идёт реже: задержка в 24 мс на нажатие незаметна.
const CAPTURE_INTERVAL = 24;
const COUNTER_INTERVAL = 120;
// Разрешение выдают в системных настройках, а не в приложении, поэтому его
// состояние приходится перечитывать.
const ACCESS_INTERVAL = 1000;
const ACCESSIBILITY_SETTINGS = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let isQuitting = false;
let mac = null;
let engine = null;
let settings = null;
let notices = null;
let pollTimer = null;
let counterTimer = null;
let accessTimer = null;
let capture = null;
let lastSentClicks = -1;
let overlayReady = false;
let pendingNotice = null;
let noticeId = 0;
// Плашка удержания висит, пока держат клавишу, и обновляет счёт кликов.
let liveNoticeId = 0;
let noticeSafetyTimer = null;
// Код бинда лежит рядом с циклом опроса: читать настройки каждые 6 мс незачем.
let activeBind = 0;
// Пока система не пропускает синтетические клики, кликер не запускается:
// иначе счётчик бежит, а в игре ничего не происходит.
let hasAccess = false;
let sleepBlocker = 0;
// Язык интерфейса. До первого выбора работает язык по умолчанию, а окно
// показывает вопрос о языке поверх всего остального.
let language = normalizeLanguage(null);

if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
}

function t(key, values) {
    return translate(language, key, values);
}

function bindLabel(code) {
    return describeKey(code, language);
}

// Словарь весит больше всего остального состояния и меняется только при смене
// языка, поэтому едет к окну не с каждым обновлением.
function currentState({ withStrings = false } = {}) {
    const stored = settings.get();
    const engineState = engine.getState();
    return {
        ...engineState,
        bind: stored.bind,
        bindLabel: bindLabel(stored.bind),
        capturing: capture !== null,
        access: hasAccess,
        language,
        languageChosen: stored.language !== null,
        ...(withStrings ? { strings: dictionary(language) } : {})
    };
}

function pushState(options) {
    refreshTray();
    // Скорость видна и на сжатой плашке, поэтому она обновляется вместе с ней.
    pushNoticeProgress();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const state = currentState(options);
    lastSentClicks = state.clicks;
    mainWindow.webContents.send('state', state);
}

function setLanguage(next) {
    if (!isLanguage(next)) return;

    language = settings.update({ language: next }).language;
    // Заход не прерывается сменой языка: источник плашки помнит свой счёт.
    notices.setLanguage(language);
    pushState({ withStrings: true });
}

function refreshTray() {
    if (!tray || tray.isDestroyed()) return;

    const { running, cps } = engine.getState();
    tray.setToolTip(running ? t('tray.running', { cps }) : t('tray.idle'));
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: t('tray.show'), click: showWindow },
        { type: 'separator' },
        { label: running ? t('tray.stop') : t('tray.start'), click: () => toggleClicker() },
        { type: 'separator' },
        { label: t('tray.quit'), click: quit }
    ]));
}

function showWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

function hideWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.hide();
}

function quit() {
    isQuitting = true;
    app.quit();
}

// Запуск без разрешения даёт молчаливую пустоту: система выбрасывает клики,
// а счётчик при этом считает. Вместо этого окно показывает, чего не хватает.
function toggleClicker() {
    if (!engine.running && !hasAccess) {
        showWindow();
        pushState();
        return;
    }
    engine.toggle();
}

function readAccess() {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false);
    if (trusted === hasAccess) return;

    hasAccess = trusted;
    if (!hasAccess) engine.stop();
    pushState();
}

function pushClicks() {
    const { clicks } = engine.getState();
    if (clicks === lastSentClicks) return;
    lastSentClicks = clicks;

    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('clicks', clicks);
    pushNoticeProgress();
}

// Плашка ставится там, где сейчас курсор: кликер нажимают в игре, а игра
// может идти не на том экране, где лежит окно кликера.
function placeOverlay() {
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    overlayWindow.setBounds({
        x: area.x + Math.round((area.width - OVERLAY.width) / 2),
        y: area.y + OVERLAY.margin,
        width: OVERLAY.width,
        height: OVERLAY.height
    });
}

function hideOverlay(id) {
    if (id !== noticeId || !overlayWindow || overlayWindow.isDestroyed()) return;
    clearTimeout(noticeSafetyTimer);
    overlayWindow.hide();
}

function showNotice(notice) {
    if (isQuitting || !overlayWindow || overlayWindow.isDestroyed()) return;
    // Первое включение может случиться раньше, чем плашка успела загрузиться.
    if (!overlayReady) {
        pendingNotice = notice;
        return;
    }

    noticeId += 1;
    // Пока кликер работает, плашка висит сжатой и обновляет счёт кликов.
    liveNoticeId = notice.kind === 'start' ? noticeId : 0;
    clearTimeout(noticeSafetyTimer);

    if (!overlayWindow.isVisible()) {
        placeOverlay();
        overlayWindow.showInactive();
        // Показ сбрасывает уровень окна, а плашке нужно быть выше игры.
        overlayWindow.setAlwaysOnTop(true, 'screen-saver');
        overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    overlayWindow.webContents.send('notice', { ...notice, id: noticeId });

    if (notice.kind === 'start') return;
    // Плашка сама сообщает, когда доиграла уход. Если это сообщение потеряется,
    // окно поверх всех останется висеть, поэтому есть запасной срок.
    const shown = noticeId;
    noticeSafetyTimer = setTimeout(() => hideOverlay(shown), RESULT_LIFETIME);
}

function publishNotice() {
    const notice = notices.update(engine.getState());
    if (!notice) return;
    // Показ окна занимает несколько миллисекунд: пусть он не встаёт в очередь
    // перед ближайшим кликом.
    setImmediate(() => showNotice(notice));
}

function pushNoticeProgress() {
    if (!liveNoticeId || !overlayWindow || overlayWindow.isDestroyed()) return;
    overlayWindow.webContents.send('notice:detail', {
        id: liveNoticeId,
        detail: notices.progress(engine.getState())
    });
}

// Сон системы посреди захода обрывает клики, поэтому на время работы кликера
// засыпание откладывается.
function holdWake() {
    if (sleepBlocker) return;
    sleepBlocker = powerSaveBlocker.start('prevent-app-suspension');
}

function releaseWake() {
    if (!sleepBlocker) return;
    if (powerSaveBlocker.isStarted(sleepBlocker)) powerSaveBlocker.stop(sleepBlocker);
    sleepBlocker = 0;
}

function startCapture() {
    // Клавиши, зажатые в момент старта, пропускаются до отпускания: иначе
    // биндом становится та самая кнопка, которой нажали «Изменить».
    const held = new Set();
    for (const code of capturableKeys()) {
        if (mac.isKeyDown(code)) held.add(code);
    }
    capture = { held, ticks: 0 };
    pushState();
}

function finishCapture(code) {
    capture = null;
    if (code === null) {
        pushState();
        return;
    }

    if (code === buttonCode(engine.getState().button)) {
        pushState();
        mainWindow?.webContents.send('bind:rejected', {
            label: bindLabel(code),
            reason: 'same-as-click'
        });
        return;
    }

    activeBind = settings.update({ bind: code }).bind;
    // Клавишу, которой назначили бинд, ещё держат: кликер ждёт, пока её отпустят.
    engine.adoptBind(mac.isKeyDown(activeBind));
    pushState();
}

function pollCapture() {
    capture.ticks += 1;
    if (capture.ticks * POLL_INTERVAL < CAPTURE_INTERVAL) return;
    capture.ticks = 0;

    if (mac.isKeyDown(KEY.ESCAPE)) {
        finishCapture(null);
        return;
    }

    for (const code of capturableKeys()) {
        const down = mac.isKeyDown(code);
        if (!down) {
            capture.held.delete(code);
            continue;
        }
        if (capture.held.has(code)) continue;
        finishCapture(code);
        return;
    }
}

function poll() {
    if (capture) {
        pollCapture();
        return;
    }

    // Аварийная остановка: Escape гасит кликер в любом режиме и из любого
    // приложения, поэтому вышедший из-под контроля бинд не запирает мышь.
    if (engine.running && mac.isKeyDown(KEY.ESCAPE)) {
        engine.stop();
        return;
    }

    const down = mac.isKeyDown(activeBind);
    if (!hasAccess && !engine.running) {
        // Нажатия бинда без разрешения не запускают кликер, но и не копятся:
        // движок помнит состояние клавиши, чтобы не сработать на отпускании.
        engine.adoptBind(down);
        return;
    }
    engine.updateBind(down);
}

function restoreWindowPosition(window) {
    const { x, y } = settings.get();
    if (x === null || y === null) return;

    const fits = screen.getAllDisplays().some(display => {
        const bounds = display.workArea;
        return x >= bounds.x - WINDOW.width + 80 &&
            x <= bounds.x + bounds.width - 80 &&
            y >= bounds.y &&
            y <= bounds.y + bounds.height - 60;
    });
    if (fits) window.setPosition(x, y);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: WINDOW.width,
        height: WINDOW.height,
        minWidth: WINDOW.width,
        minHeight: WINDOW.height,
        maxWidth: WINDOW.width,
        maxHeight: WINDOW.height,
        frame: false,
        // Стекло рисует система: NSVisualEffectView сам полупрозрачен, поэтому
        // окно остаётся обычным, а не transparent — иначе материал под ним чернеет.
        vibrancy: 'under-window',
        // Без этого материал сереет, как только окно теряет фокус, а кликером
        // пользуются как раз из другого приложения.
        visualEffectState: 'active',
        roundedCorners: true,
        hasShadow: true,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        title: t('app.title'),
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
            spellcheck: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        restoreWindowPosition(mainWindow);
        mainWindow.show();
        pushState({ withStrings: true });
    });

    mainWindow.on('moved', () => {
        const [x, y] = mainWindow.getPosition();
        settings.update({ x, y });
    });

    mainWindow.on('close', event => {
        if (isQuitting) return;
        event.preventDefault();
        hideWindow();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createOverlay() {
    overlayWindow = new BrowserWindow({
        width: OVERLAY.width,
        height: OVERLAY.height,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        // Тень рисует CSS: системная легла бы прямоугольником вокруг всего окна.
        hasShadow: false,
        // Системное скругление обрезало бы углы прозрачного окна вместе с тенью.
        roundedCorners: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        // Плашка ничего не принимает: фокус остаётся в игре или редакторе.
        focusable: false,
        alwaysOnTop: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload-overlay.js'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
            spellcheck: false
        }
    });

    // Клики и наведение проходят сквозь плашку в окно под ней.
    overlayWindow.setIgnoreMouseEvents(true);
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    // Игра занимает собственное пространство рабочего стола, и плашка должна
    // приезжать туда вместе с ней.
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));

    overlayWindow.webContents.on('did-finish-load', () => {
        overlayReady = true;
        if (!pendingNotice) return;
        const notice = pendingNotice;
        pendingNotice = null;
        showNotice(notice);
    });

    overlayWindow.on('closed', () => {
        overlayWindow = null;
    });
}

function createTray() {
    // Строка меню перекрашивает значок сама, поэтому он одноцветный и помечен
    // как template: иначе на тёмной панели он остаётся чёрным.
    const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'trayTemplate.png'));
    icon.setTemplateImage(true);

    tray = new Tray(icon);
    tray.on('click', showWindow);
    refreshTray();
}

function registerIpc() {
    ipcMain.handle('state:get', () => currentState({ withStrings: true }));

    ipcMain.handle('language:set', (event, next) => {
        setLanguage(next);
        return { ok: true };
    });

    ipcMain.handle('config:update', (event, patch = {}) => {
        if (patch.button && buttonCode(patch.button) === settings.get().bind) {
            return { ok: false, reason: 'same-as-bind', label: bindLabel(settings.get().bind) };
        }

        const stored = settings.update(patch);
        engine.configure({ cps: stored.cps, button: stored.button, mode: stored.mode });
        pushState();
        return { ok: true };
    });

    ipcMain.handle('bind:capture', () => {
        startCapture();
        return { ok: true };
    });

    ipcMain.handle('bind:cancel', () => {
        if (capture) finishCapture(null);
        return { ok: true };
    });

    ipcMain.handle('clicker:toggle', () => {
        toggleClicker();
        return { ok: true };
    });

    ipcMain.handle('counter:reset', () => {
        engine.resetCounter();
        pushState();
        return { ok: true };
    });

    // Системный запрос показывается один раз на установку, поэтому рядом с ним
    // всегда открывается и сам раздел настроек.
    ipcMain.handle('access:request', () => {
        systemPreferences.isTrustedAccessibilityClient(true);
        shell.openExternal(ACCESSIBILITY_SETTINGS);
        return { ok: true };
    });

    // Плашка отыграла уход и больше ничего не рисует: окно можно прятать.
    ipcMain.on('overlay:idle', (event, id) => hideOverlay(id));

    ipcMain.on('window:minimize', () => mainWindow?.minimize());
    ipcMain.on('window:close', () => hideWindow());
}

function bootstrap() {
    mac = createMac();
    settings = createSettingsStore(app.getPath('userData'));
    hasAccess = systemPreferences.isTrustedAccessibilityClient(false);

    const stored = settings.get();
    activeBind = stored.bind;
    language = normalizeLanguage(stored.language);
    notices = createNoticeSource({ language });
    engine = new ClickEngine({
        click: button => mac.click(button),
        now: () => Date.now(),
        schedule: (callback, delay) => setTimeout(callback, delay),
        cancel: timer => clearTimeout(timer),
        onChange: () => {
            pushState();
            publishNotice();
        },
        onLoadStart: () => holdWake(),
        onLoadEnd: () => releaseWake()
    });
    engine.configure({ cps: stored.cps, button: stored.button, mode: stored.mode });
    engine.adoptBind(mac.isKeyDown(activeBind));

    registerIpc();
    createWindow();
    createOverlay();
    createTray();

    pollTimer = setInterval(poll, POLL_INTERVAL);
    counterTimer = setInterval(pushClicks, COUNTER_INTERVAL);
    accessTimer = setInterval(readAccess, ACCESS_INTERVAL);
}

// Окно светлое во всех темах, а материал стекла берёт тему у приложения:
// без этого в тёмной теме под светлым интерфейсом оказался бы тёмный фон.
nativeTheme.themeSource = 'light';

// Повторный запуск возвращает окно из строки меню вместо второго кликера.
app.on('second-instance', () => showWindow());
app.on('activate', () => showWindow());

app.whenReady().then(() => {
    if (process.platform !== 'darwin') {
        console.error('The clicker only runs on macOS.');
        app.quit();
        return;
    }
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }]));
    bootstrap();
});

// Закрытие окна прячет его в строку меню, поэтому выход идёт только по команде.
app.on('window-all-closed', () => {});

app.on('before-quit', () => {
    isQuitting = true;
    if (pollTimer) clearInterval(pollTimer);
    if (counterTimer) clearInterval(counterTimer);
    if (accessTimer) clearInterval(accessTimer);
    clearTimeout(noticeSafetyTimer);
    engine?.stop();
    releaseWake();
    settings?.flush();
    mac?.dispose();
    if (tray && !tray.isDestroyed()) tray.destroy();
});
