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

    if (
        !timerHoursEl ||
        !timerMinutesEl ||
        !timerSecondsEl ||
        !timerToggleBtn ||
        !timerResetBtn ||
        !countdownMinutesInput ||
        !fullscreenToggleBtn
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

    function stopTimer({ keepButtonLabel = false } = {}) {
        clearIntervalIfNeeded();
        state.running = false;
        if (!keepButtonLabel) {
            timerToggleBtn.textContent = "Start";
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
    }

    function tickStopwatch() {
        state.stopwatchElapsed += 1;
        renderStopwatch();
    }

    function startClockLoop() {
        clearIntervalIfNeeded();
        renderClock();
        state.intervalId = setInterval(renderClock, SECOND);
        state.running = false;
    }

    function startTimer() {
        if (state.mode === "clock" || state.running) {
            return;
        }

        if (state.mode === "countdown" && state.countdownRemaining <= 0) {
            state.countdownRemaining = state.countdownTotal;
        }

        state.running = true;
        timerToggleBtn.textContent = "Pause";

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

        if (isClock) {
            timerToggleBtn.textContent = "Start";
        } else if (state.running) {
            timerToggleBtn.textContent = "Pause";
        } else {
            timerToggleBtn.textContent = "Start";
        }

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

    fullscreenToggleBtn?.addEventListener("click", async () => {
        const isCurrentlyFullscreen = document.fullscreenElement === timerSection;
        try {
            if (isCurrentlyFullscreen) {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                }
            } else if (timerSection.requestFullscreen) {
                await timerSection.requestFullscreen();
            }
        } catch (error) {
            console.error("Fullscreen request failed:", error);
        }
    });

    document.addEventListener("fullscreenchange", () => {
        const isFullscreen = document.fullscreenElement === timerSection;
        toggleFullscreenState(isFullscreen);
    });

    applyModeUI();
    updateTimerDisplay();
}
