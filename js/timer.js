import { createReminderManager } from "./timer/reminder.js";

const SECOND = 1000;
const MAX_COUNTDOWN_MINUTES = 999;

function pad(value) {
    return String(value).padStart(2, "0");
}

function selectElement(id) {
    return document.getElementById(id);
}

function formatTimerParts(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    return {
        hours: pad(hours),
        minutes: pad(minutes),
        seconds: pad(seconds)
    };
}

export function initTimer() {
    const timerSection = selectElement("timer-section");
    if (!timerSection) {
        return;
    }

    const timerHoursEl = selectElement("timer-hours");
    const timerMinutesEl = selectElement("timer-minutes");
    const timerSecondsEl = selectElement("timer-seconds");
    const timerToggleBtn = selectElement("timer-toggle");
    const timerResetBtn = selectElement("timer-reset");
    const timerControls = selectElement("timer-controls");
    const countdownMinutesInput = selectElement("countdown-minutes");
    const fullscreenToggleBtn = selectElement("fullscreen-toggle");
    const fullscreenTimerToggleBtn = selectElement("fullscreen-timer-toggle");
    const fullscreenTimerIcon = selectElement("fullscreen-timer-icon");
    const reminderToggleBtn = selectElement("reminder-toggle");

    if (
        !timerHoursEl ||
        !timerMinutesEl ||
        !timerSecondsEl ||
        !timerToggleBtn ||
        !timerResetBtn ||
        !countdownMinutesInput ||
        !fullscreenToggleBtn ||
        !reminderToggleBtn
    ) {
        return;
    }

    const timerTypeInputs = Array.from(document.querySelectorAll(".timer-type-input"));
    const presetButtons = [
        selectElement("preset-pomodoro"),
        selectElement("preset-short-break"),
        selectElement("preset-long-break")
    ];

    const initialCountdownMinutes = (() => {
        const numeric = Number(countdownMinutesInput.value);
        if (!Number.isNaN(numeric) && numeric >= 1) {
            return Math.min(MAX_COUNTDOWN_MINUTES, Math.round(numeric));
        }
        return 25;
    })();
    countdownMinutesInput.value = String(initialCountdownMinutes);

    const state = {
        mode: "countdown",
        countdownTotal: initialCountdownMinutes * 60,
        countdownRemaining: initialCountdownMinutes * 60,
        stopwatchElapsed: 0,
        running: false,
        intervalId: null
    };

    const reminderManager = createReminderManager({
        button: reminderToggleBtn,
        getElapsedSeconds
    });
    let pseudoFullscreenActive = false;

    function getFullscreenElement() {
        return (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement ||
            null
        );
    }

    function isNativeFullscreenActive() {
        return Boolean(getFullscreenElement());
    }

    async function requestNativeFullscreen(target) {
        if (!target) {
            return false;
        }
        const method =
            target.requestFullscreen ||
            target.webkitRequestFullscreen ||
            target.mozRequestFullScreen ||
            target.msRequestFullscreen;
        if (!method) {
            return false;
        }
        try {
            const result = method.call(target);
            if (result && typeof result.then === "function") {
                await result;
            }
            return true;
        } catch (error) {
            console.warn("Fullscreen request failed for target", error);
            return false;
        }
    }

    async function exitNativeFullscreen() {
        const method =
            document.exitFullscreen ||
            document.webkitExitFullscreen ||
            document.mozCancelFullScreen ||
            document.msExitFullscreen;
        if (!method) {
            return false;
        }
        try {
            const result = method.call(document);
            if (result && typeof result.then === "function") {
                await result;
            }
            return true;
        } catch (error) {
            console.warn("Fullscreen exit failed", error);
            return false;
        }
    }

    function renderCountdown() {
        const { hours, minutes, seconds } = formatTimerParts(state.countdownRemaining);
        timerHoursEl.textContent = hours;
        timerMinutesEl.textContent = minutes;
        timerSecondsEl.textContent = seconds;
    }

    function renderStopwatch() {
        const { hours, minutes, seconds } = formatTimerParts(state.stopwatchElapsed);
        timerHoursEl.textContent = hours;
        timerMinutesEl.textContent = minutes;
        timerSecondsEl.textContent = seconds;
    }

    function renderClock() {
        const now = new Date();
        timerHoursEl.textContent = pad(now.getHours());
        timerMinutesEl.textContent = pad(now.getMinutes());
        timerSecondsEl.textContent = pad(now.getSeconds());
    }

    function updateTimerDisplay() {
        if (state.mode === "countdown") {
            renderCountdown();
        } else if (state.mode === "stopwatch") {
            renderStopwatch();
        } else {
            renderClock();
        }
    }

    function clearIntervalIfNeeded() {
        if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = null;
        }
    }

    function getElapsedSeconds() {
        if (state.mode === "countdown") {
            return state.countdownTotal - state.countdownRemaining;
        }
        if (state.mode === "stopwatch") {
            return state.stopwatchElapsed;
        }
        return 0;
    }

    function updateTimerToggleVisuals() {
        const isClock = state.mode === "clock";
        const label = isClock ? "Start" : state.running ? "Pause" : "Start";
        timerToggleBtn.textContent = label;
        if (fullscreenTimerIcon) {
            fullscreenTimerIcon.textContent = state.running ? "pause" : "play_arrow";
        }
        if (fullscreenTimerToggleBtn) {
            fullscreenTimerToggleBtn.disabled = isClock;
            fullscreenTimerToggleBtn.classList.toggle("timer-controls-disabled", isClock);
            fullscreenTimerToggleBtn.setAttribute("aria-pressed", state.running ? "true" : "false");
        }
    }

    function stopTimer({ keepButtonLabel = false } = {}) {
        clearIntervalIfNeeded();
        state.running = false;
        reminderManager.onTimerStop();
        if (!keepButtonLabel) {
            updateTimerToggleVisuals();
        }
    }

    function completeCountdown() {
        stopTimer();
        timerSection.classList.add("animate-complete");
        setTimeout(() => timerSection.classList.remove("animate-complete"), 1200);
    }

    function tickCountdown() {
        if (state.countdownRemaining > 0) {
            state.countdownRemaining -= 1;
            if (state.countdownRemaining === 0) {
                renderCountdown();
                completeCountdown();
                return;
            }
        }
        renderCountdown();
        reminderManager.onTimerTick({ running: state.running });
    }

    function tickStopwatch() {
        state.stopwatchElapsed += 1;
        renderStopwatch();
        reminderManager.onTimerTick({ running: state.running });
    }

    function startClockLoop() {
        clearIntervalIfNeeded();
        renderClock();
        state.intervalId = setInterval(renderClock, SECOND);
        state.running = false;
        updateTimerToggleVisuals();
    }

    function startTimer() {
        if (state.mode === "clock" || state.running) {
            return;
        }

        if (state.mode === "countdown" && state.countdownRemaining <= 0) {
            state.countdownRemaining = state.countdownTotal;
        }

        state.running = true;
        updateTimerToggleVisuals();
        reminderManager.onTimerStart();
        reminderManager.onTimerTick({ running: state.running });

        clearIntervalIfNeeded();
        state.intervalId = setInterval(() => {
            const handler = state.mode === "countdown" ? tickCountdown : tickStopwatch;
            handler();
        }, SECOND);
    }

    function pauseTimer() {
        if (!state.running) {
            return;
        }
        stopTimer();
    }

    function resetTimer() {
        stopTimer();
        if (state.mode === "countdown") {
            state.countdownRemaining = state.countdownTotal;
            renderCountdown();
        } else if (state.mode === "stopwatch") {
            state.stopwatchElapsed = 0;
            renderStopwatch();
        } else {
            renderClock();
        }
        reminderManager.onReset();
    }

    function setCountdownMinutes(minutes) {
        const numeric = Number(minutes);
        if (Number.isNaN(numeric)) {
            return;
        }
        const clamped = Math.min(MAX_COUNTDOWN_MINUTES, Math.max(1, numeric));
        state.countdownTotal = clamped * 60;
        state.countdownRemaining = state.countdownTotal;
        countdownMinutesInput.value = clamped;
        renderCountdown();
        reminderManager.onReset();
    }

    function applyModeUI() {
        const isCountdown = state.mode === "countdown";
        const isClock = state.mode === "clock";

        countdownMinutesInput.disabled = !isCountdown;
        presetButtons.forEach((button) => {
            if (!button) {
                return;
            }
            button.disabled = !isCountdown;
        });

        timerToggleBtn.disabled = isClock;
        timerResetBtn.disabled = isClock;
        timerControls?.classList.toggle("timer-controls-disabled", isClock);
        updateTimerToggleVisuals();

        timerSection.classList.toggle("timer-mode-clock", isClock);
    }

    function switchMode(newMode) {
        if (newMode === state.mode) {
            return;
        }
        stopTimer({ keepButtonLabel: true });
        state.mode = newMode;

        if (state.mode === "countdown") {
            state.countdownRemaining = state.countdownTotal;
            renderCountdown();
        } else if (state.mode === "stopwatch") {
            state.stopwatchElapsed = 0;
            renderStopwatch();
        }

        if (state.mode === "clock") {
            startClockLoop();
        } else {
            clearIntervalIfNeeded();
        }

        reminderManager.onModeChange();
        applyModeUI();
        updateTimerDisplay();
    }

    timerToggleBtn?.addEventListener("click", () => {
        if (state.mode === "clock") {
            return;
        }
        if (state.running) {
            pauseTimer();
        } else {
            startTimer();
        }
    });

    fullscreenTimerToggleBtn?.addEventListener("click", () => {
        if (state.mode === "clock") {
            return;
        }
        if (state.running) {
            pauseTimer();
        } else {
            startTimer();
        }
    });

    timerResetBtn?.addEventListener("click", () => {
        if (state.mode === "clock") {
            return;
        }
        resetTimer();
    });

    presetButtons.forEach((button) => {
        button?.addEventListener("click", () => {
            if (state.mode !== "countdown") {
                return;
            }
            const minutes = Number(button.dataset.minutes) || Number(button.textContent?.replace(/\D/g, ""));
            setCountdownMinutes(minutes);
        });
    });

    countdownMinutesInput?.addEventListener("change", (event) => {
        if (state.mode !== "countdown") {
            return;
        }
        setCountdownMinutes(event.target.value);
    });

    timerTypeInputs.forEach((input) => {
        input.addEventListener("change", (event) => {
            const selectedMode = event.target.value;
            switchMode(selectedMode);
        });
    });

    presetButtons.forEach((button) => {
        if (!button) {
            return;
        }
        if (!button.dataset.minutes) {
            const minutes = Number(button.textContent?.replace(/\D/g, ""));
            if (Number.isFinite(minutes)) {
                button.dataset.minutes = String(minutes);
            }
        }
    });

    function toggleFullscreenState(isFullscreen) {
        timerSection.classList.toggle("fullscreen-active", isFullscreen);
        document.body.classList.toggle("fullscreen-timer", isFullscreen);
        document.documentElement.classList.toggle("pseudo-fullscreen-root", pseudoFullscreenActive && isFullscreen);
        document.body.classList.toggle("pseudo-fullscreen-body", pseudoFullscreenActive && isFullscreen);
        if (isFullscreen) {
            timerSection.scrollIntoView({ behavior: "instant", block: "center" });
        }
        if (window.screen?.orientation) {
            if (isFullscreen && typeof window.screen.orientation.lock === "function") {
                window.screen.orientation.lock("landscape").catch(() => undefined);
            } else if (!isFullscreen && typeof window.screen.orientation.unlock === "function") {
                window.screen.orientation.unlock();
            }
        }
        const icon = fullscreenToggleBtn?.querySelector(".material-symbols-outlined");
        const label = fullscreenToggleBtn?.querySelector(".fullscreen-label");

        if (!icon || !label) {
            return;
        }

        if (isFullscreen) {
            icon.textContent = "fullscreen_exit";
            label.textContent = "Exit fullscreen";
        } else {
            icon.textContent = "fullscreen";
            label.textContent = "Enter fullscreen";
        }
    }

    async function enterTimerFullscreen() {
        const success =
            (await requestNativeFullscreen(timerSection)) ||
            (await requestNativeFullscreen(document.documentElement)) ||
            (await requestNativeFullscreen(document.body));
        if (success) {
            pseudoFullscreenActive = false;
            toggleFullscreenState(true);
        } else {
            pseudoFullscreenActive = true;
            toggleFullscreenState(true);
        }
    }

    async function exitTimerFullscreen() {
        if (pseudoFullscreenActive) {
            pseudoFullscreenActive = false;
            toggleFullscreenState(false);
            return;
        }
        const active = isNativeFullscreenActive();
        if (active) {
            const success = await exitNativeFullscreen();
            if (!success) {
                console.warn("Could not exit fullscreen via native API");
            }
        }
        toggleFullscreenState(false);
    }

    fullscreenToggleBtn?.addEventListener("click", async () => {
        const active = isNativeFullscreenActive() || pseudoFullscreenActive;
        try {
            if (active) {
                await exitTimerFullscreen();
            } else {
                await enterTimerFullscreen();
            }
        } catch (error) {
            console.error("Fullscreen toggle failed:", error);
        }
    });

    let lastTapTime = 0;
    timerSection.addEventListener("touchend", async (event) => {
        const now = Date.now();
        if (now - lastTapTime < 350) {
            event.preventDefault();
            const active = isNativeFullscreenActive() || pseudoFullscreenActive;
            if (active) {
                await exitTimerFullscreen();
            } else {
                await enterTimerFullscreen();
            }
        }
        lastTapTime = now;
    });

    const fullscreenEvents = [
        "fullscreenchange",
        "webkitfullscreenchange",
        "mozfullscreenchange",
        "MSFullscreenChange"
    ];
    fullscreenEvents.forEach((eventName) => {
        document.addEventListener(eventName, () => {
            if (pseudoFullscreenActive) {
                return;
            }
            const active = isNativeFullscreenActive();
            toggleFullscreenState(active);
        });
    });

    applyModeUI();
    updateTimerDisplay();
}
