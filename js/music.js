import { baseTracks, createYouTubeTrack, loadStoredTracks, saveStoredTracks } from "./music/tracks.js";

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "0:00";
    }
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainder = totalSeconds % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function loadYouTubeApi() {
    if (window.YT && window.YT.Player) {
        return Promise.resolve(window.YT);
    }
    if (loadYouTubeApi.promise) {
        return loadYouTubeApi.promise;
    }
    loadYouTubeApi.promise = new Promise((resolve, reject) => {
        const existing = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            existing?.();
            resolve(window.YT);
        };
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return loadYouTubeApi.promise;
}

function updateRangeGradient(element, percent, colorStart, colorEnd) {
    if (!element || Number.isNaN(percent)) {
        return;
    }
    const clamped = Math.max(0, Math.min(100, percent));
    element.style.background = `linear-gradient(90deg, ${colorStart} 0%, ${colorEnd} ${clamped}%, rgba(255,255,255,0.12) ${clamped}%, rgba(255,255,255,0.08) 100%)`;
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
    const replayToggleBtn = document.getElementById("replay-toggle");
    const replayToggleIcon = document.getElementById("replay-toggle-icon");
    const addTrackBtn = document.getElementById("add-track-btn");
    const addTrackModal = document.getElementById("add-track-modal");
    const addTrackForm = document.getElementById("add-track-form");
    const newTrackTitleInput = document.getElementById("new-track-title");
    const newTrackUrlInput = document.getElementById("new-track-url");
    const titleErrorEl = addTrackForm?.querySelector('[data-error="title"]');
    const urlErrorEl = addTrackForm?.querySelector('[data-error="url"]');
    const modalDismissButtons = addTrackModal?.querySelectorAll('[data-dismiss="modal"]');
    const youtubeWrapper = document.getElementById("youtube-player-wrapper");
    const currentTimeEl = document.getElementById("current-time");
    const totalDurationEl = document.getElementById("total-duration");
    const playlistContainer = document.getElementById("playlist");

    if (!audioEl || !trackTitleEl || !trackSubtitleEl || !playlistContainer || !currentTimeEl || !totalDurationEl || !addTrackModal) {
        return;
    }

    audioEl.crossOrigin = "anonymous";

    let playlist = [];
    let currentTrackIndex = 0;
    let isPlaying = false;
    let isReplayEnabled = false;
    let previousVolume = Number(volumeControl?.value ?? audioEl.volume ?? 0.7);
    let youtubePlayer = null;
    let youtubeReady = false;
    let youtubeProgressTimer = null;
    let pendingYouTubeLoad = null;
    let pendingYouTubePlay = false;
    let modalKeyHandler = null;

    const getCurrentTrack = () => playlist[currentTrackIndex];

    function loadFromStorage() {
        const stored = loadStoredTracks();
        const combined = [...baseTracks];
        stored.forEach((track) => {
            if (!combined.some((item) => item.id === track.id && item.type === track.type)) {
                combined.push(track);
            }
        });
        playlist = combined;
    }

    function saveUserTracks() {
        const userTracks = playlist.filter((track) => track.type === "youtube");
        saveStoredTracks(userTracks);
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
        const percent = typeof percentOverride === "number" ? percentOverride : Number(progressControl.value);
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

    function updatePlaylistActiveState() {
        const items = playlistContainer.querySelectorAll(".playlist-item");
        items.forEach((item) => {
            const itemIndex = Number(item.dataset.index);
            const icon = item.querySelector(".icon");
            const itemType = item.dataset.type;
            const active = itemIndex === currentTrackIndex;
            item.classList.toggle("active", active);
            if (icon) {
                if (itemType === "youtube") {
                    icon.textContent = active ? "equalizer" : "play_arrow";
                } else {
                    icon.textContent = active ? (isPlaying ? "equalizer" : "play_arrow") : "play_arrow";
                }
            }
        });
    }

    function setMuteIcon() {
        if (!muteToggleIcon) {
            return;
        }
        const track = getCurrentTrack();
        if (track?.type === "youtube" && youtubePlayer && youtubeReady) {
            muteToggleIcon.textContent = youtubePlayer.isMuted() ? "volume_off" : youtubePlayer.getVolume() < 50 ? "volume_down" : "volume_up";
            return;
        }
        muteToggleIcon.textContent = audioEl.muted || audioEl.volume <= 0.001 ? "volume_off" : audioEl.volume < 0.5 ? "volume_down" : "volume_up";
    }

    function startYouTubeProgressTimer() {
        clearInterval(youtubeProgressTimer);
        youtubeProgressTimer = window.setInterval(() => {
            if (!youtubePlayer || !youtubeReady || getCurrentTrack()?.type !== "youtube") {
                return;
            }
            const duration = youtubePlayer.getDuration();
            if (!duration) {
                return;
            }
            const current = youtubePlayer.getCurrentTime();
            const percent = (current / duration) * 100;
            if (progressControl) {
                progressControl.value = String(percent);
            }
            currentTimeEl.textContent = formatTime(current);
            totalDurationEl.textContent = formatTime(duration);
            refreshProgressUI(percent);
        }, 250);
    }

    function stopYouTubeProgressTimer() {
        clearInterval(youtubeProgressTimer);
        youtubeProgressTimer = null;
    }

    function showYouTubeWrapper() {
        youtubeWrapper?.classList.remove("hidden");
        youtubeWrapper?.classList.add("active");
    }

    function hideYouTubeWrapper() {
        youtubeWrapper?.classList.remove("active");
        youtubeWrapper?.classList.add("hidden");
        stopYouTubeProgressTimer();
    }

    function handleYouTubeStateChange(event) {
        if (!getCurrentTrack() || getCurrentTrack().type !== "youtube") {
            return;
        }
        const YT = window.YT;
        if (!YT) {
            return;
        }
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                isPlaying = true;
                updatePlayToggleIcon();
                updatePlaylistActiveState();
                startYouTubeProgressTimer();
                pendingYouTubePlay = false;
                break;
            case YT.PlayerState.PAUSED:
                isPlaying = false;
                updatePlayToggleIcon();
                updatePlaylistActiveState();
                stopYouTubeProgressTimer();
                break;
            case YT.PlayerState.CUED:
                if (pendingYouTubePlay && youtubePlayer) {
                    youtubePlayer.playVideo();
                }
                break;
            case YT.PlayerState.ENDED:
                if (isReplayEnabled) {
                    youtubePlayer.seekTo(0, true);
                    youtubePlayer.playVideo();
                } else {
                    loadTrack(currentTrackIndex + 1, true);
                }
                break;
            default:
                break;
        }
    }

    function prepareYouTube(track, autoPlay) {
        showYouTubeWrapper();
        youtubeReady = false;
        pendingYouTubePlay = autoPlay;
        loadYouTubeApi()
            .then((YT) => {
                if (!youtubePlayer) {
                    pendingYouTubeLoad = { videoId: track.videoId, autoPlay };
                    youtubePlayer = new YT.Player("youtube-player", {
                        videoId: track.videoId,
                        playerVars: {
                            autoplay: autoPlay ? 1 : 0,
                            controls: 0,
                            rel: 0,
                            modestbranding: 1,
                            playsinline: 1
                        },
                        events: {
                            onReady: (event) => {
                                youtubeReady = true;
                                if (volumeControl) {
                                    const vol = Number(volumeControl.value) * 100;
                                    event.target.setVolume(vol);
                                }
                                if (pendingYouTubeLoad) {
                                    if (pendingYouTubeLoad.autoPlay) {
                                        event.target.loadVideoById(pendingYouTubeLoad.videoId);
                                        pendingYouTubePlay = true;
                                    } else {
                                        event.target.cueVideoById(pendingYouTubeLoad.videoId);
                                        pendingYouTubePlay = false;
                                    }
                                    pendingYouTubeLoad = null;
                                } else if (!autoPlay) {
                                    event.target.pauseVideo();
                                }
                                if (pendingYouTubePlay) {
                                    try {
                                        event.target.playVideo();
                                    } catch (playError) {
                                        console.warn("YouTube autoplay blocked", playError);
                                    }
                                }
                            },
                            onStateChange: handleYouTubeStateChange
                        }
                    });
                } else if (youtubeReady) {
                    if (autoPlay) {
                        youtubePlayer.loadVideoById(track.videoId);
                        pendingYouTubePlay = true;
                    } else {
                        youtubePlayer.cueVideoById(track.videoId);
                        pendingYouTubePlay = false;
                    }
                } else {
                    pendingYouTubeLoad = { videoId: track.videoId, autoPlay };
                }
            })
            .catch((error) => {
                console.error("YouTube API failed to load", error);
            });
    }

    function playAudioTrack(track, autoPlay) {
        hideYouTubeWrapper();
        if (youtubePlayer && youtubeReady) {
            youtubePlayer.stopVideo();
        }
        pendingYouTubePlay = false;
        audioEl.src = track.src;
        audioEl.loop = isReplayEnabled;
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
        } else {
            audioEl.pause();
        }
        setMuteIcon();
        if (progressControl) {
            progressControl.value = "0";
            refreshProgressUI(0);
        }
        currentTimeEl.textContent = "0:00";
        totalDurationEl.textContent = "0:00";
    }

    function playYouTubeTrack(track, autoPlay) {
        audioEl.pause();
        pendingYouTubePlay = autoPlay;
        prepareYouTube(track, autoPlay);
        isPlaying = autoPlay;
        updatePlayToggleIcon();
        updatePlaylistActiveState();
        if (progressControl) {
            progressControl.value = "0";
            refreshProgressUI(0);
        }
        currentTimeEl.textContent = "0:00";
        totalDurationEl.textContent = "--:--";
        setMuteIcon();
    }

    function loadTrack(index, autoPlay = false) {
        if (!playlist.length) {
            return;
        }
        const nextIndex = (index + playlist.length) % playlist.length;
        const track = playlist[nextIndex];
        const shouldAutoPlay = track.type === "youtube" ? true : autoPlay;
        currentTrackIndex = nextIndex;
        trackTitleEl.textContent = track.title;
        trackSubtitleEl.textContent = track.subtitle ?? "";
        if (track.type === "youtube") {
            playYouTubeTrack(track, shouldAutoPlay);
        } else {
            playAudioTrack(track, shouldAutoPlay);
        }
    }

    function renderPlaylist() {
        playlistContainer.innerHTML = "";
        const fragment = document.createDocumentFragment();
        playlist.forEach((track, index) => {
            const item = document.createElement("li");
            item.className = "playlist-item";
            item.dataset.index = String(index);
            item.dataset.type = track.type;

            const infoWrapper = document.createElement("div");
            infoWrapper.className = "flex flex-col flex-1 overflow-hidden";

            const titleRow = document.createElement("div");
            titleRow.className = "flex items-center gap-2";
            const titleEl = document.createElement("strong");
            titleEl.textContent = track.title;
            titleRow.appendChild(titleEl);
            if (track.type === "youtube") {
                const badge = document.createElement("span");
                badge.className = "playlist-badge";
                badge.textContent = "YouTube";
                titleRow.appendChild(badge);
            }
            infoWrapper.appendChild(titleRow);

            const subtitleEl = document.createElement("span");
            subtitleEl.textContent = track.subtitle ?? "";
            infoWrapper.appendChild(subtitleEl);

            const icon = document.createElement("span");
            icon.className = "material-symbols-outlined icon text-xl";
            icon.textContent = track.type === "youtube" ? "play_arrow" : "play_arrow";

            item.appendChild(infoWrapper);
            item.appendChild(icon);

            item.addEventListener("click", () => {
                const wasPlaying = isPlaying;
                const isSameTrack = index === currentTrackIndex;
                loadTrack(index, !isSameTrack || !wasPlaying);
                if (isSameTrack && wasPlaying) {
                    if (track.type === "youtube" && youtubePlayer && youtubeReady) {
                        youtubePlayer.pauseVideo();
                    } else {
                        audioEl.pause();
                    }
                }
            });

            fragment.appendChild(item);
        });
        playlistContainer.appendChild(fragment);
        updatePlaylistActiveState();
    }

    function openModal() {
        addTrackModal.classList.remove("hidden");
        addTrackBtn?.setAttribute("aria-expanded", "true");
        requestAnimationFrame(() => {
            newTrackTitleInput?.focus();
        });
        modalKeyHandler = (event) => {
            if (event.key === "Escape") {
                closeModal();
            }
        };
        document.addEventListener("keydown", modalKeyHandler);
    }

    function clearModalErrors() {
        if (titleErrorEl) {
            titleErrorEl.textContent = "";
        }
        if (urlErrorEl) {
            urlErrorEl.textContent = "";
        }
        newTrackTitleInput?.classList.remove("error");
        newTrackUrlInput?.classList.remove("error");
    }

    function closeModal() {
        addTrackModal.classList.add("hidden");
        addTrackBtn?.setAttribute("aria-expanded", "false");
        clearModalErrors();
        addTrackForm?.reset();
        if (modalKeyHandler) {
            document.removeEventListener("keydown", modalKeyHandler);
            modalKeyHandler = null;
        }
    }

    function setFieldError(kind, message) {
        if (kind === "title" && titleErrorEl) {
            titleErrorEl.textContent = message ?? "";
            if (message) {
                newTrackTitleInput?.classList.add("error");
            } else {
                newTrackTitleInput?.classList.remove("error");
            }
        }
        if (kind === "url" && urlErrorEl) {
            urlErrorEl.textContent = message ?? "";
            if (message) {
                newTrackUrlInput?.classList.add("error");
            } else {
                newTrackUrlInput?.classList.remove("error");
            }
        }
    }

    function handleFormSubmit(event) {
        event.preventDefault();
        if (!newTrackTitleInput || !newTrackUrlInput) {
            return;
        }
        clearModalErrors();
        const title = newTrackTitleInput.value.trim();
        const url = newTrackUrlInput.value.trim();
        let hasError = false;
        if (!title) {
            setFieldError("title", "Track name is required.");
            hasError = true;
        }
        const { track, error } = createYouTubeTrack(title, url);
        if (error === "TITLE_REQUIRED" && !hasError) {
            setFieldError("title", "Track name is required.");
            hasError = true;
        } else if (error === "INVALID_URL") {
            setFieldError("url", "Enter a valid YouTube link.");
            hasError = true;
        }
        if (hasError || !track) {
            return;
        }
        const existing = playlist.some((item) => item.type === "youtube" && item.id === track.id);
        if (existing) {
            setFieldError("url", "This video is already in the playlist.");
            return;
        }
        playlist.push(track);
        saveUserTracks();
        renderPlaylist();
        loadTrack(playlist.length - 1, true);
        closeModal();
    }

    function togglePlayPause() {
        const track = getCurrentTrack();
        if (!track) {
            return;
        }
        if (track.type === "youtube") {
            if (!youtubePlayer || !youtubeReady) {
                return;
            }
            const state = youtubePlayer.getPlayerState();
            if (state === window.YT.PlayerState.PLAYING || state === window.YT.PlayerState.BUFFERING) {
                youtubePlayer.pauseVideo();
            } else {
                youtubePlayer.playVideo();
            }
            return;
        }
        if (!isPlaying) {
            audioEl.play().catch((error) => console.error("Playback could not start:", error));
        } else {
            audioEl.pause();
        }
    }

    function stepTrack(step) {
        loadTrack(currentTrackIndex + step, isPlaying);
    }

    function toggleReplay() {
        isReplayEnabled = !isReplayEnabled;
        audioEl.loop = isReplayEnabled;
        replayToggleBtn?.setAttribute("aria-pressed", isReplayEnabled ? "true" : "false");
        if (replayToggleIcon) {
            replayToggleIcon.textContent = isReplayEnabled ? "repeat_one" : "repeat";
        }
    }

    function handleVolumeInput(event) {
        const volume = Number(event.target.value);
        previousVolume = volume;
        if (getCurrentTrack()?.type === "youtube" && youtubePlayer && youtubeReady) {
            youtubePlayer.setVolume(volume * 100);
            if (volume <= 0.001) {
                youtubePlayer.mute();
            } else {
                youtubePlayer.unMute();
            }
        } else {
            audioEl.volume = volume;
            audioEl.muted = volume <= 0.001;
        }
        setMuteIcon();
        refreshVolumeUI();
    }

    function toggleMute() {
        const track = getCurrentTrack();
        if (track?.type === "youtube" && youtubePlayer && youtubeReady) {
            if (youtubePlayer.isMuted()) {
                youtubePlayer.unMute();
                youtubePlayer.setVolume(previousVolume * 100);
            } else {
                youtubePlayer.mute();
            }
        } else {
            if (audioEl.muted || audioEl.volume <= 0.001) {
                audioEl.muted = false;
                audioEl.volume = previousVolume > 0.001 ? previousVolume : 0.5;
            } else {
                previousVolume = audioEl.volume;
                audioEl.muted = true;
            }
        }
        setMuteIcon();
        refreshVolumeUI();
    }

    function handleProgressInput(event) {
        const percent = Number(event.target.value);
        const track = getCurrentTrack();
        if (track?.type === "youtube" && youtubePlayer && youtubeReady) {
            const duration = youtubePlayer.getDuration();
            if (duration) {
                youtubePlayer.seekTo((percent / 100) * duration, true);
            }
        } else if (audioEl.duration) {
            audioEl.currentTime = (percent / 100) * audioEl.duration;
        }
        refreshProgressUI(percent);
    }

    function attachModalEvents() {
        addTrackBtn?.addEventListener("click", openModal);
        modalDismissButtons?.forEach((btn) => {
            btn.addEventListener("click", closeModal);
        });
        addTrackModal.addEventListener("click", (event) => {
            if (event.target instanceof HTMLElement && event.target.dataset.dismiss === "modal") {
                closeModal();
            }
        });
        addTrackForm?.addEventListener("submit", handleFormSubmit);
    }

    function attachPlayerEvents() {
        playToggleBtn?.addEventListener("click", togglePlayPause);
        fullscreenPlayBtn?.addEventListener("click", togglePlayPause);
        nextTrackBtn?.addEventListener("click", () => stepTrack(1));
        fullscreenNextBtn?.addEventListener("click", () => stepTrack(1));
        prevTrackBtn?.addEventListener("click", () => stepTrack(-1));
        fullscreenPrevBtn?.addEventListener("click", () => stepTrack(-1));
        replayToggleBtn?.addEventListener("click", toggleReplay);
        volumeControl?.addEventListener("input", handleVolumeInput);
        muteToggleBtn?.addEventListener("click", toggleMute);
        progressControl?.addEventListener("input", handleProgressInput);

        audioEl.addEventListener("play", () => {
            if (getCurrentTrack()?.type !== "local") {
                return;
            }
            isPlaying = true;
            updatePlayToggleIcon();
            updatePlaylistActiveState();
        });

        audioEl.addEventListener("pause", () => {
            if (getCurrentTrack()?.type !== "local") {
                return;
            }
            isPlaying = false;
            updatePlayToggleIcon();
            updatePlaylistActiveState();
        });

        audioEl.addEventListener("timeupdate", () => {
            if (getCurrentTrack()?.type !== "local") {
                return;
            }
            if (progressControl && audioEl.duration) {
                const percent = (audioEl.currentTime / audioEl.duration) * 100;
                progressControl.value = String(percent);
                refreshProgressUI(percent);
            }
            currentTimeEl.textContent = formatTime(audioEl.currentTime);
        });

        audioEl.addEventListener("loadedmetadata", () => {
            if (getCurrentTrack()?.type !== "local" || !audioEl.duration) {
                return;
            }
            totalDurationEl.textContent = formatTime(audioEl.duration);
        });

        audioEl.addEventListener("ended", () => {
            if (audioEl.loop) {
                return;
            }
            loadTrack(currentTrackIndex + 1, true);
        });
    }

    function initialize() {
        loadFromStorage();
        renderPlaylist();
        audioEl.volume = previousVolume;
        refreshVolumeUI();
        setMuteIcon();
        loadTrack(0, false);
        attachModalEvents();
        attachPlayerEvents();
    }

    initialize();
}
