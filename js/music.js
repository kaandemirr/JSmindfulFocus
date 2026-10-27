// The music bar and the library: the tones as local files, and the visitor's own YouTube tracks
// (kept on this device). A YouTube track plays in a small visible player, as YouTube requires.
import { baseTracks, loadStoredTracks, saveStoredTracks, createYouTubeTrack } from "./music/tracks.js";
import { load, save } from "./store.js";

const fmt = (s) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

let ytApi = null;
function loadYouTube() {
    ytApi ??= new Promise((resolve, reject) => {
        if (window.YT?.Player) return resolve(window.YT);
        const before = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            before?.();
            resolve(window.YT);
        };
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.onerror = () => {
            ytApi = null;
            reject(new Error("YouTube could not load"));
        };
        document.head.append(s);
    });
    return ytApi;
}

function svg(id) {
    return `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
}

export function createMusic(bar, { onChange } = {}) {
    const $ = (s, r = bar) => r.querySelector(s);
    const audio = $("[data-audio]");
    const el = {
        play: $("[data-play]"),
        playIcon: $("[data-play-icon]"),
        title: $("[data-track-title]"),
        sub: $("[data-track-sub]"),
        seek: $("[data-seek]"),
        cur: $("[data-cur]"),
        dur: $("[data-dur]"),
        loop: $("[data-loop]"),
        mute: $("[data-mute]"),
        muteIcon: $("[data-mute-icon]"),
        volume: $("[data-volume]"),
        ytBox: $("[data-yt-box]"),
    };
    const library = document.getElementById("library");
    const list = $("[data-tracks]", library);
    const form = $("[data-add]", library);
    const formMsg = $("[data-add-msg]", library);

    const saved = load().music || {};
    let tracks = [...baseTracks, ...loadStoredTracks()];
    let index = Math.max(0, tracks.findIndex((t) => t.id === saved.track));
    let volume = saved.volume ?? 70;
    let muted = Boolean(saved.muted);
    let loop = Boolean(saved.loop);
    let playing = false;
    let seeking = false;
    let yt = null;
    let ytReady = null;
    let ytTick = 0;

    const current = () => tracks[index];
    const isYT = () => current()?.type === "youtube";
    const persist = () => save({ music: { track: current()?.id, volume, muted, loop } });
    const fill = (input, pct) => input.style.setProperty("--fill", `${pct}%`);

    function applyVolume() {
        audio.volume = muted ? 0 : volume / 100;
        if (yt?.setVolume) {
            yt.setVolume(volume);
            muted ? yt.mute() : yt.unMute();
        }
        el.volume.value = String(volume);
        fill(el.volume, volume);
        el.muteIcon.setAttribute("href", muted || volume === 0 ? "#i-mute" : "#i-volume");
        el.mute.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    }

    function showTime(cur, dur) {
        el.cur.textContent = fmt(cur);
        el.dur.textContent = fmt(dur);
        if (!seeking) {
            const pct = dur > 0 ? (cur / dur) * 100 : 0;
            el.seek.value = String(Math.round(pct * 10));
            fill(el.seek, pct);
        }
    }

    function render() {
        const t = current();
        el.title.textContent = t.title;
        el.sub.textContent = t.subtitle;
        el.playIcon.setAttribute("href", playing ? "#i-pause" : "#i-play");
        el.play.setAttribute("aria-label", playing ? "Pause music (M)" : "Play music (M)");
        el.loop.setAttribute("aria-pressed", String(loop));
        el.ytBox.hidden = !isYT();
        renderList();
        if ("mediaSession" in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.subtitle, album: "Focus Timer" });
            navigator.mediaSession.playbackState = playing ? "playing" : "paused";
        }
        onChange?.(playing);
    }

    function renderList() {
        list.textContent = "";
        tracks.forEach((t, i) => {
            const li = document.createElement("li");
            const now = i === index;
            li.className = now ? "is-current" : "";
            const b = document.createElement("button");
            b.type = "button";
            b.className = "track";
            b.innerHTML = `${svg(now && playing ? "i-pause" : "i-play")}<span><b></b><small></small></span>`;
            b.querySelector("b").textContent = t.title;
            b.querySelector("small").textContent = t.subtitle;
            b.setAttribute("aria-label", `${now && playing ? "Pause" : "Play"} ${t.title}`);
            b.addEventListener("click", () => (now ? toggle() : select(i, true)));
            li.append(b);
            if (t.type === "youtube") {
                const del = document.createElement("button");
                del.type = "button";
                del.className = "icon-btn";
                del.innerHTML = svg("i-trash");
                del.setAttribute("aria-label", `Remove ${t.title}`);
                del.addEventListener("click", () => remove(i));
                li.append(del);
            }
            list.append(li);
        });
    }

    function ensureYT() {
        ytReady ??= loadYouTube().then(
            (YT) =>
                new Promise((resolve) => {
                    yt = new YT.Player("yt-player", {
                        width: "100%",
                        height: "100%",
                        playerVars: { playsinline: 1, rel: 0 },
                        events: {
                            onReady: () => {
                                applyVolume();
                                resolve(yt);
                            },
                            onStateChange: (e) => {
                                if (!isYT()) return;
                                if (e.data === YT.PlayerState.ENDED) {
                                    if (loop) {
                                        yt.seekTo(0);
                                        yt.playVideo();
                                    } else next(true);
                                } else if (e.data === YT.PlayerState.PLAYING && !playing) {
                                    playing = true;
                                    render();
                                } else if (e.data === YT.PlayerState.PAUSED && playing) {
                                    playing = false;
                                    render();
                                }
                            },
                        },
                    });
                })
        );
        return ytReady;
    }

    function halt() {
        audio.pause();
        try {
            yt?.pauseVideo?.();
        } catch {
            /* not ready yet */
        }
        playing = false;
    }

    async function select(i, autoplay) {
        halt();
        index = (i + tracks.length) % tracks.length;
        persist();
        const t = current();
        showTime(0, 0);
        render();
        if (t.type === "local") {
            audio.src = t.src;
            audio.loop = loop;
            if (autoplay) await play();
            return;
        }
        try {
            await ensureYT();
            if (autoplay) {
                yt.loadVideoById(t.videoId);
                playing = true;
            } else yt.cueVideoById(t.videoId);
        } catch {
            el.sub.textContent = "YouTube didn't load";
        }
        render();
    }

    async function play() {
        const t = current();
        if (t.type === "local") {
            if (!audio.src) {
                audio.src = t.src;
                audio.loop = loop;
            }
            try {
                await audio.play();
                playing = true;
            } catch {
                playing = false;
            }
        } else {
            try {
                await ensureYT();
                if (yt.getVideoData?.()?.video_id !== t.videoId) yt.loadVideoById(t.videoId);
                else yt.playVideo();
                playing = true;
            } catch {
                el.sub.textContent = "YouTube didn't load";
            }
        }
        render();
    }

    function pause() {
        halt();
        render();
    }
    const toggle = () => (playing ? pause() : play());
    const next = (auto) => select(index + 1, auto === true || playing);
    function prev() {
        if (current().type === "local" && audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        select(index - 1, playing);
    }

    function remove(i) {
        const wasCurrent = i === index;
        tracks.splice(i, 1);
        saveStoredTracks(tracks);
        if (wasCurrent) select(0, false);
        else {
            if (i < index) index -= 1;
            persist();
            render();
        }
    }

    // audio element
    audio.addEventListener("timeupdate", () => showTime(audio.currentTime, audio.duration));
    audio.addEventListener("loadedmetadata", () => showTime(audio.currentTime, audio.duration));
    audio.addEventListener("ended", () => {
        if (!audio.loop) next(true);
    });
    audio.addEventListener("pause", () => {
        if (playing && !isYT()) {
            playing = false;
            render();
        }
    });
    // YouTube has no time events: read its clock while it plays
    ytTick = setInterval(() => {
        if (isYT() && yt?.getCurrentTime && playing) showTime(yt.getCurrentTime(), yt.getDuration());
    }, 500);

    // controls
    el.play.addEventListener("click", toggle);
    $("[data-next]").addEventListener("click", () => next());
    $("[data-prev]").addEventListener("click", prev);
    el.loop.addEventListener("click", () => {
        loop = !loop;
        audio.loop = loop;
        persist();
        render();
    });
    el.mute.addEventListener("click", () => {
        muted = !muted;
        persist();
        applyVolume();
    });
    el.volume.addEventListener("input", () => {
        volume = Number(el.volume.value);
        muted = false;
        applyVolume();
    });
    el.volume.addEventListener("change", persist);
    el.seek.addEventListener("input", () => {
        seeking = true;
        const pct = Number(el.seek.value) / 10;
        fill(el.seek, pct);
        const dur = isYT() ? yt?.getDuration?.() || 0 : audio.duration;
        el.cur.textContent = fmt((pct / 100) * dur);
    });
    el.seek.addEventListener("change", () => {
        const pct = Number(el.seek.value) / 1000;
        if (isYT()) yt?.seekTo?.(pct * (yt.getDuration?.() || 0), true);
        else if (Number.isFinite(audio.duration)) audio.currentTime = pct * audio.duration;
        seeking = false;
    });

    // adding a YouTube track
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const data = new FormData(form);
        const made = createYouTubeTrack(String(data.get("title") || ""), String(data.get("url") || ""));
        const say = (text, kind) => {
            formMsg.textContent = text;
            formMsg.dataset.kind = kind || "";
        };
        if (made.error === "TITLE_REQUIRED") return say("Give it a title.", "error");
        if (made.error) return say("That doesn't look like a YouTube link.", "error");
        if (tracks.some((t) => t.id === made.track.id)) return say("It's already in your library.", "error");
        tracks.push(made.track);
        saveStoredTracks(tracks);
        form.reset();
        say(`Added “${made.track.title}”.`);
        render();
    });

    // the lock screen and media keys
    if ("mediaSession" in navigator) {
        const set = (a, f) => {
            try {
                navigator.mediaSession.setActionHandler(a, f);
            } catch {
                /* unsupported action */
            }
        };
        set("play", play);
        set("pause", pause);
        set("nexttrack", () => next());
        set("previoustrack", prev);
    }

    applyVolume();
    render();
    return { toggle, play, pause, next, prev, isPlaying: () => playing, dispose: () => clearInterval(ytTick) };
}
