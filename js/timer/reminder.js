const COMPLETION_AUDIO_SRC = "mp3/finishsound.mp3";

function createCompletionAudio() {
    const audio = new Audio(COMPLETION_AUDIO_SRC);
    audio.preload = "auto";
    audio.volume = 0.95;
    return audio;
}

function updateButton(button, enabled) {
    if (!button) {
        return;
    }
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
}

export function createReminderManager({ button }) {
    if (!button) {
        return {
            onTimerComplete() {},
            onTimerStart() {},
            onTimerStop() {},
            onReset() {},
            onModeChange() {}
        };
    }

    let enabled = false;
    let completionAudio = createCompletionAudio();
    const toggleIcon = button.querySelector("[data-reminder-toggle-icon]");

    function updateVisualState() {
        updateButton(button, enabled);
        if (toggleIcon) {
            toggleIcon.textContent = enabled ? "toggle_on" : "toggle_off";
        }
    }

    function resetAudio() {
        completionAudio.pause();
        completionAudio.currentTime = 0;
    }

    function toggle() {
        enabled = !enabled;
        updateVisualState();
        if (!enabled) {
            resetAudio();
            return;
        }
        completionAudio
            .play()
            .then(() => {
                completionAudio.pause();
                completionAudio.currentTime = 0;
            })
            .catch(() => {
                completionAudio = createCompletionAudio();
            }
            );
    }

    button.addEventListener("click", toggle, { passive: true });
    updateVisualState();

    function playCompletionSound() {
        if (!enabled) {
            return;
        }
        resetAudio();
        completionAudio
            .play()
            .catch((error) => {
                console.warn("Completion sound could not play", error);
            });
    }

    function refreshAudioInstance() {
        completionAudio = createCompletionAudio();
        if (!enabled) {
            resetAudio();
        }
    }

    return {
        onTimerComplete: playCompletionSound,
        onTimerStart: resetAudio,
        onTimerStop: resetAudio,
        onReset: resetAudio,
        onModeChange: () => {
            resetAudio();
            refreshAudioInstance();
        }
    };
}
