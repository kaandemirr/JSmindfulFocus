const TEN_MINUTES = 600;

function createAudio(src) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = 0.95;
    return audio;
}

function safeRequestWakeLock(state) {
    if (!("wakeLock" in navigator) || !state.enabled) {
        return;
    }
    navigator.wakeLock
        .request("screen")
        .then((wakeLock) => {
            state.wakeLock = wakeLock;
            wakeLock.addEventListener("release", () => {
                state.wakeLock = null;
                if (state.enabled) {
                    safeRequestWakeLock(state);
                }
            });
        })
        .catch((error) => {
            console.warn("Wake lock request failed:", error);
            state.wakeLock = null;
        });
}

function releaseWakeLock(state) {
    if (!state.wakeLock) {
        return;
    }
    state.wakeLock.release().catch(() => undefined);
    state.wakeLock = null;
}

function updateButtonVisual(button, enabled) {
    button?.setAttribute("aria-pressed", enabled ? "true" : "false");
    if (enabled) {
        button?.classList.add("is-active");
    } else {
        button?.classList.remove("is-active");
    }
}

export function createReminderManager({ button, getElapsedSeconds }) {
    if (!button || typeof getElapsedSeconds !== "function") {
        return {
            onTimerTick() {},
            onTimerStart() {},
            onTimerStop() {},
            onReset() {},
            onModeChange() {}
        };
    }

    const state = {
        enabled: false,
        lastMark: 0,
        wakeLock: null,
        firstAudio: createAudio("mp3/firstten.mp3"),
        nextAudio: createAudio("mp3/tenmore.mp3")
    };

    function playReminder(mark) {
        const audio = mark === 1 ? state.firstAudio : state.nextAudio;
        audio.currentTime = 0;
        audio
            .play()
            .catch((error) => {
                console.warn("Reminder audio could not play:", error);
            });
    }

    function resetMarks() {
        state.lastMark = 0;
    }

    function handleToggle() {
        state.enabled = !state.enabled;
        updateButtonVisual(button, state.enabled);
        if (state.enabled) {
            state.lastMark = Math.floor(getElapsedSeconds() / TEN_MINUTES);
            safeRequestWakeLock(state);
            handleTimerTick({ running: false });
        } else {
            resetMarks();
            releaseWakeLock(state);
            state.firstAudio.pause();
            state.firstAudio.currentTime = 0;
            state.nextAudio.pause();
            state.nextAudio.currentTime = 0;
        }
    }

    button.addEventListener("click", handleToggle);

    function handleTimerTick({ running }) {
        if (!state.enabled || !running) {
            return;
        }
        const elapsed = getElapsedSeconds();
        if (elapsed < TEN_MINUTES) {
            return;
        }
        const currentMark = Math.floor(elapsed / TEN_MINUTES);
        if (currentMark > state.lastMark) {
            state.lastMark = currentMark;
            playReminder(currentMark);
        }
    }

    function handleTimerStart() {
        if (!state.enabled) {
            return;
        }
        state.lastMark = Math.max(state.lastMark, Math.floor(getElapsedSeconds() / TEN_MINUTES));
        safeRequestWakeLock(state);
    }

    function handleTimerStop() {
        if (!state.enabled) {
            releaseWakeLock(state);
            return;
        }
        state.lastMark = Math.floor(getElapsedSeconds() / TEN_MINUTES);
        releaseWakeLock(state);
    }

    document.addEventListener(
        "visibilitychange",
        () => {
            if (document.visibilityState === "visible" && state.enabled) {
                safeRequestWakeLock(state);
            }
        },
        { passive: true }
    );

    return {
        onTimerTick: handleTimerTick,
        onTimerStart: handleTimerStart,
        onTimerStop: handleTimerStop,
        onReset: resetMarks,
        onModeChange: resetMarks
    };
}
