const playlist = [
    {
        title: "396 Hz - Release Fear",
        subtitle: "Deep relaxation and emotional cleansing",
        src: "mp3/hz396.mp3"
    },
    {
        title: "369 Hz - Tesla Sequence",
        subtitle: "Ignites flow and creativity",
        src: "mp3/hz369.mp3"
    },
    {
        title: "432 Hz - Natural Harmony",
        subtitle: "Realigns you with the rhythm of nature",
        src: "mp3/hz432.mp3"
    },
    {
        title: "639 Hz - Heart Connection",
        subtitle: "Heart-centered harmony and compassion",
        src: "mp3/hz639.mp3"
    },
    {
        title: "963 Hz - Pure Consciousness",
        subtitle: "Opens the doorway to intuition and awareness",
        src: "mp3/hz963.mp3"
    },
    {
        title: "3 Hz - Deep Delta",
        subtitle: "Deep sleep and subconscious relaxation",
        src: "mp3/hz3.mp3"
    },
    {
        title: "6 Hz - Theta Rhythms",
        subtitle: "Perfect for inspiration and visualization",
        src: "mp3/hz6.mp3"
    },
    {
        title: "9 Hz - Alpha Awakening",
        subtitle: "Gentle energy and light focus",
        src: "mp3/hz9.mp3"
    }
];

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "0:00";
    }
    const wholeSeconds = Math.floor(seconds);
    const minutes = Math.floor(wholeSeconds / 60);
    const remainder = wholeSeconds % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function initMusicPlayer() {
    const audioEl = document.getElementById("audio-element");
    const trackTitleEl = document.getElementById("track-title");
    const trackSubtitleEl = document.getElementById("track-subtitle");
    const playToggleBtn = document.getElementById("play-toggle");
    const playToggleIcon = document.getElementById("play-toggle-icon");
    const nextTrackBtn = document.getElementById("next-track");
    const prevTrackBtn = document.getElementById("prev-track");
    const progressControl = document.getElementById("progress-control");
    const volumeControl = document.getElementById("volume-control");
    const muteToggleBtn = document.getElementById("mute-toggle");
    const muteToggleIcon = document.getElementById("mute-toggle-icon");
    const fullscreenPrevBtn = document.getElementById("fullscreen-prev");
    const fullscreenPlayBtn = document.getElementById("fullscreen-play");
    const fullscreenPlayIcon = document.getElementById("fullscreen-play-icon");
    const fullscreenNextBtn = document.getElementById("fullscreen-next");
    const currentTimeEl = document.getElementById("current-time");
    const totalDurationEl = document.getElementById("total-duration");
    const playlistContainer = document.getElementById("playlist");

    if (!audioEl || !trackTitleEl || !trackSubtitleEl || !playlistContainer || !currentTimeEl || !totalDurationEl) {
        return;
    }

    let currentTrackIndex = 0;
    let isPlaying = false;
    let previousVolume = Number(volumeControl?.value ?? audioEl.volume ?? 0.7);

    function hexToRgb(hex) {
        const normalized = hex.replace("#", "");
        const bigint = parseInt(normalized, 16);
        return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255
        };
    }

    function blendColors(colorA, colorB, factor) {
        const a = hexToRgb(colorA);
        const b = hexToRgb(colorB);
        const blend = (channelA, channelB) => Math.round(channelA + (channelB - channelA) * factor);
        return `rgb(${blend(a.r, b.r)}, ${blend(a.g, b.g)}, ${blend(a.b, b.b)})`;
    }

    function updateRangeGradient(element, percent, colorStart, colorEnd) {
        if (!element || Number.isNaN(percent)) {
            return;
        }
        const clamped = Math.max(0, Math.min(100, percent));
        const blendColor = blendColors(colorStart, colorEnd, clamped / 100);
        element.style.background = `linear-gradient(90deg, ${colorStart} 0%, ${blendColor} ${clamped}%, rgba(255,255,255,0.12) ${clamped}%, rgba(255,255,255,0.08) 100%)`;
    }

    function refreshVolumeUI() {
        if (!volumeControl) {
            return;
        }
        const percent = Number(volumeControl.value) * 100;
        updateRangeGradient(volumeControl, percent, "#1dd1a1", "#ff9f43");
    }

    function refreshProgressUI(percentOverride) {
        if (!progressControl) {
            return;
        }
        const percent =
            typeof percentOverride === "number"
                ? percentOverride
                : audioEl.duration
                    ? (audioEl.currentTime / audioEl.duration) * 100
                    : Number(progressControl.value);
        updateRangeGradient(progressControl, percent, "#4A90E2", "#E74AE2");
    }

    function updatePlayToggleIcon() {
        if (!playToggleIcon) {
            return;
        }
        const icon = isPlaying ? "pause" : "play_arrow";
        playToggleIcon.textContent = icon;
        if (fullscreenPlayIcon) {
            fullscreenPlayIcon.textContent = icon;
        }
    }

    function updateVolumeIcon() {
        if (!muteToggleIcon) {
            return;
        }
        if (audioEl.muted || audioEl.volume <= 0.001) {
            muteToggleIcon.textContent = "volume_off";
        } else if (audioEl.volume < 0.5) {
            muteToggleIcon.textContent = "volume_down";
        } else {
            muteToggleIcon.textContent = "volume_up";
        }
    }

    function updatePlaylistActiveState() {
        const items = playlistContainer.querySelectorAll(".playlist-item");
        items.forEach((item) => {
            const itemIndex = Number(item.dataset.index);
            const icon = item.querySelector(".icon");
            if (itemIndex === currentTrackIndex) {
                item.classList.add("active");
                if (icon) {
                    icon.textContent = isPlaying ? "equalizer" : "play_arrow";
                }
            } else {
                item.classList.remove("active");
                if (icon) {
                    icon.textContent = "play_arrow";
                }
            }
        });
    }

    function loadTrack(index, autoPlay = false) {
        if (!playlist.length) {
            return;
        }
        const safeIndex = (index + playlist.length) % playlist.length;
        currentTrackIndex = safeIndex;
        const track = playlist[safeIndex];
        audioEl.src = track.src;
        trackTitleEl.textContent = track.title;
        trackSubtitleEl.textContent = track.subtitle;
        if (progressControl) {
            progressControl.value = "0";
        }
        refreshProgressUI(0);
        currentTimeEl.textContent = "0:00";
        totalDurationEl.textContent = "0:00";
        isPlaying = autoPlay;
        updatePlayToggleIcon();
        updatePlaylistActiveState();

        if (autoPlay) {
            audioEl
                .play()
                .then(() => {
                    isPlaying = true;
                    updatePlayToggleIcon();
                    updatePlaylistActiveState();
                })
                .catch((error) => {
                    console.error("Playback could not start:", error);
                    isPlaying = false;
                    updatePlayToggleIcon();
                    updatePlaylistActiveState();
                });
        }
    }

    function playOrPause() {
        if (!isPlaying) {
            audioEl
                .play()
                .then(() => {
                    isPlaying = true;
                    updatePlayToggleIcon();
                    updatePlaylistActiveState();
                })
                .catch((error) => console.error("Playback could not start:", error));
        } else {
            audioEl.pause();
            isPlaying = false;
            updatePlayToggleIcon();
            updatePlaylistActiveState();
        }
    }

    playToggleBtn?.addEventListener("click", playOrPause);
    fullscreenPlayBtn?.addEventListener("click", playOrPause);

    nextTrackBtn?.addEventListener("click", () => {
        loadTrack(currentTrackIndex + 1, isPlaying);
    });
    fullscreenNextBtn?.addEventListener("click", () => {
        loadTrack(currentTrackIndex + 1, isPlaying);
    });

    prevTrackBtn?.addEventListener("click", () => {
        loadTrack(currentTrackIndex - 1, isPlaying);
    });
    fullscreenPrevBtn?.addEventListener("click", () => {
        loadTrack(currentTrackIndex - 1, isPlaying);
    });

    volumeControl?.addEventListener("input", (event) => {
        const volume = Number(event.target.value);
        audioEl.volume = volume;
        if (volume <= 0.001) {
            audioEl.muted = true;
        } else {
            previousVolume = volume;
            audioEl.muted = false;
        }
        updateVolumeIcon();
        refreshVolumeUI();
    });
    if (volumeControl) {
        const initialVolume = Number(volumeControl.value);
        audioEl.volume = initialVolume;
        previousVolume = initialVolume > 0.001 ? initialVolume : previousVolume;
        refreshVolumeUI();
    }
    muteToggleBtn?.addEventListener("click", () => {
        if (audioEl.muted || audioEl.volume <= 0.001) {
            audioEl.muted = false;
            const restoredVolume = previousVolume > 0.001 ? previousVolume : 0.5;
            audioEl.volume = restoredVolume;
            if (volumeControl) {
                volumeControl.value = String(restoredVolume);
            }
        } else {
            previousVolume = audioEl.volume > 0.001 ? audioEl.volume : previousVolume;
            audioEl.muted = true;
        }
        updateVolumeIcon();
        refreshVolumeUI();
    });

    updateVolumeIcon();

    progressControl?.addEventListener("input", (event) => {
        if (!audioEl.duration) {
            return;
        }
        const percent = Number(event.target.value) / 100;
        audioEl.currentTime = percent * audioEl.duration;
        refreshProgressUI(percent * 100);
    });

    audioEl.addEventListener("timeupdate", () => {
        if (!audioEl.duration) {
            return;
        }
        const percent = (audioEl.currentTime / audioEl.duration) * 100;
        if (progressControl) {
            progressControl.value = String(percent);
        }
        refreshProgressUI(percent);
        currentTimeEl.textContent = formatTime(audioEl.currentTime);
    });

    audioEl.addEventListener("loadedmetadata", () => {
        totalDurationEl.textContent = formatTime(audioEl.duration);
        refreshProgressUI(0);
    });

    audioEl.addEventListener("play", () => {
        isPlaying = true;
        updatePlayToggleIcon();
        updatePlaylistActiveState();
    });

    audioEl.addEventListener("pause", () => {
        isPlaying = false;
        updatePlayToggleIcon();
        updatePlaylistActiveState();
    });

    audioEl.addEventListener("volumechange", () => {
        if (!audioEl.muted && audioEl.volume > 0.001) {
            previousVolume = audioEl.volume;
        }
        if (volumeControl && document.activeElement !== volumeControl) {
            volumeControl.value = String(audioEl.volume);
        }
        updateVolumeIcon();
        refreshVolumeUI();
    });

    audioEl.addEventListener("ended", () => {
        loadTrack(currentTrackIndex + 1, true);
    });

    playlist.forEach((track, index) => {
        const item = document.createElement("li");
        item.className = "playlist-item";
        item.dataset.index = String(index);
        item.innerHTML = `
            <div class="flex flex-col flex-1 overflow-hidden">
                <strong>${track.title}</strong>
                <span>${track.subtitle}</span>
            </div>
            <span class="material-symbols-outlined icon text-xl">play_arrow</span>
        `;

        item.addEventListener("click", () => {
            const isSameTrack = index === currentTrackIndex;
            if (!isSameTrack) {
                loadTrack(index, true);
                return;
            }

            if (isPlaying) {
                audioEl.pause();
            } else {
                audioEl
                    .play()
                    .then(() => {
                        isPlaying = true;
                        updatePlayToggleIcon();
                        updatePlaylistActiveState();
                    })
                    .catch((error) => console.error("Playback could not start:", error));
            }
        });

        playlistContainer.appendChild(item);
    });

    loadTrack(0, false);
}
