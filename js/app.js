// Focus Timer: the page around the engine — the big numbers, rounds, fullscreen, keyboard,
// the bell, notifications, the tab title, and keeping the screen awake while it runs.
import { createEngine, clock } from "./engine.js";
import { createBell } from "./bell.js";
import { load, save, stats, addRound } from "./store.js";
import { createMusic } from "./music.js";

const root = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const LABEL = { focus: "Focus", short: "Short break", long: "Long break", stopwatch: "Stopwatch", clock: "Clock" };
const LIMITS = { focus: [1, 180], short: [1, 60], long: [1, 90], rounds: [1, 12] };

const settings = { focus: 25, short: 5, long: 15, rounds: 4, autoStart: false, bell: true, notify: false, ...load().settings };
const engine = createEngine(settings);
const bell = createBell("mp3/finishsound.mp3");

const el = {
    time: $("[data-time]"),
    progress: $("[data-progress]"),
    phase: $("[data-phase-label]"),
    dots: $("[data-dots]"),
    toggle: $("[data-toggle]"),
    toggleLabel: $("[data-toggle-label]"),
    toggleIcon: $("[data-toggle-icon]"),
    announce: $("[data-announce]"),
    today: $("[data-today]"),
    zenTimerIcon: $("[data-zen-timer-icon]"),
    zenMusicIcon: $("[data-zen-music-icon]"),
};

const music = createMusic($(".player"), {
    onChange: (playing) => el.zenMusicIcon.setAttribute("href", playing ? "#i-pause" : "#i-play"),
});

/* ------------------------------------------------------------- render */

let last = { text: "", dots: "", label: "", title: "", button: "" };

function renderToday() {
    const s = stats();
    el.today.innerHTML = `Today <b>${s.rounds}</b> ${s.rounds === 1 ? "round" : "rounds"} · <b>${s.minutes}</b> min`;
}

function render() {
    const r = engine.read();
    root.dataset.phase = r.phase;
    root.dataset.tool = r.tool;
    root.classList.toggle("is-running", r.running);

    let text;
    if (r.tool === "pomodoro") text = clock(r.remaining);
    else if (r.tool === "stopwatch") text = clock(r.elapsed, { ceil: false });
    else text = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (text !== last.text) el.time.textContent = last.text = text;
    el.progress.style.setProperty("--p", r.progress.toFixed(4));

    const label = r.tool === "pomodoro" ? LABEL[r.phase] : LABEL[r.tool];
    if (label !== last.label) el.phase.textContent = last.label = label;

    const dots = `${r.round}/${r.rounds}/${r.phase}`;
    if (dots !== last.dots) {
        last.dots = dots;
        el.dots.innerHTML = Array.from({ length: r.rounds }, (_, i) => {
            const done = i < r.round - 1 || (i === r.round - 1 && r.phase !== "focus");
            return `<i class="${done ? "is-done" : ""}"></i>`;
        }).join("");
        el.dots.setAttribute("aria-label", `Round ${r.round} of ${r.rounds}`);
        el.dots.setAttribute("role", "img");
    }

    const started = r.tool === "pomodoro" ? r.remaining < r.total : r.elapsed > 0;
    const button = r.running ? "Pause" : started ? "Resume" : "Start";
    if (button !== last.button) {
        last.button = button;
        el.toggleLabel.textContent = button;
        el.toggleIcon.setAttribute("href", r.running ? "#i-pause" : "#i-play");
        el.zenTimerIcon.setAttribute("href", r.running ? "#i-pause" : "#i-play");
        el.toggle.title = `${button} (Space)`;
    }

    const title = r.tool === "pomodoro" && started ? `${text} · ${label}` : r.tool === "stopwatch" && started ? `${text} · Stopwatch` : "Focus Timer";
    if (title !== last.title) document.title = last.title = title;

    $$("[data-set-phase]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setPhase === r.phase)));
    $$("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === r.tool)));
}

function announce(text) {
    el.announce.textContent = "";
    requestAnimationFrame(() => (el.announce.textContent = text));
}

/* ----------------------------------------------------- the end of a phase */

function scheduleBell() {
    const r = engine.read();
    if (settings.bell && r.endsAt) bell.schedule(r.endsAt, 0.9);
    else bell.cancel();
}

function finished(ev, endedAt) {
    if (ev.finished === "focus" && ev.counted) {
        addRound(ev.minutes);
        renderToday();
    }
    if (settings.bell) bell.rang(endedAt);
    const text = ev.finished === "focus" ? `Focus done. ${LABEL[ev.next]} next.` : "Break over. Back to focus.";
    announce(text);
    if (settings.notify && "Notification" in window && Notification.permission === "granted" && document.hidden) {
        try {
            new Notification(ev.finished === "focus" ? "Focus done" : "Break over", { body: text, tag: "focus-timer", silent: settings.bell });
        } catch {
            /* some browsers only notify from a service worker */
        }
    }
    if (engine.read().running) scheduleBell();
    else wake(false);
}

// Read the engine on every frame while visible; a slow interval keeps a hidden tab
// (and its title) going. The time itself never depends on how often this runs.
function tick() {
    const before = engine.read().endsAt;
    const ev = engine.check();
    if (ev) finished(ev, before);
    render();
}
(function loop() {
    tick();
    requestAnimationFrame(loop);
})();
setInterval(() => {
    if (document.hidden) tick();
}, 1000);

/* ------------------------------------------------------------ actions */

function toggle() {
    const r = engine.read();
    if (r.tool === "clock") return;
    const started = engine.toggle();
    if (started) {
        bell.ready().then(scheduleBell).catch(() => {});
        wake(true);
    } else {
        bell.cancel();
        wake(false);
    }
    render();
}

function reset() {
    engine.reset();
    bell.cancel();
    wake(false);
    render();
}

function skip() {
    const ev = engine.skip();
    if (!ev) return;
    bell.cancel();
    announce(`${LABEL[ev.next]}.`);
    if (engine.read().running) scheduleBell();
    render();
}

$("[data-toggle]").addEventListener("click", toggle);
$("[data-zen-timer]").addEventListener("click", toggle);
$("[data-zen-music]").addEventListener("click", () => music.toggle());
$("[data-reset]").addEventListener("click", reset);
$("[data-skip]").addEventListener("click", skip);
$$("[data-tool]").forEach((b) =>
    b.addEventListener("click", () => {
        engine.setTool(b.dataset.tool);
        bell.cancel();
        wake(false);
        render();
    })
);
$$("[data-set-phase]").forEach((b) =>
    b.addEventListener("click", () => {
        engine.setPhase(b.dataset.setPhase);
        bell.cancel();
        wake(false);
        render();
    })
);

/* -------------------------------------------------- keep the screen on */

let lock = null;
let wanted = false;
async function wake(on) {
    wanted = on;
    if (!("wakeLock" in navigator)) return;
    if (on && !lock && !document.hidden) {
        try {
            lock = await navigator.wakeLock.request("screen");
            lock.addEventListener("release", () => (lock = null));
        } catch {
            lock = null;
        }
    } else if (!on && lock) {
        lock.release().catch(() => {});
        lock = null;
    }
}
document.addEventListener("visibilitychange", () => {
    if (!document.hidden && wanted) wake(true);
});

/* ---------------------------------------------------------- fullscreen */

let idle = 0;
function setZen(on) {
    root.classList.toggle("is-zen", on);
    $$("[data-zen]").forEach((b) => b.setAttribute("aria-pressed", String(on)));
    if (!on) root.classList.remove("is-idle");
}
async function toggleZen() {
    const on = !root.classList.contains("is-zen");
    if (document.fullscreenEnabled) {
        try {
            if (on) await root.requestFullscreen({ navigationUI: "hide" });
            else if (document.fullscreenElement) await document.exitFullscreen();
        } catch {
            setZen(on); // refused: fullscreen inside the page instead
        }
    } else setZen(on); // iPhone Safari has no element fullscreen
}
document.addEventListener("fullscreenchange", () => setZen(Boolean(document.fullscreenElement)));
$$("[data-zen]").forEach((b) => b.addEventListener("click", toggleZen));
document.addEventListener("pointermove", () => {
    if (!root.classList.contains("is-zen")) return;
    root.classList.remove("is-idle");
    clearTimeout(idle);
    idle = setTimeout(() => root.classList.add("is-idle"), 2500);
});

/* --------------------------------------------------------------- sheets */

$$("[data-open]").forEach((b) => b.addEventListener("click", () => document.getElementById(b.dataset.open).showModal()));
$$("dialog").forEach((d) => {
    $$("[data-close]", d).forEach((b) => b.addEventListener("click", () => d.close()));
    d.addEventListener("click", (e) => {
        if (e.target === d) d.close(); // a click on the backdrop
    });
});

const form = $("[data-settings]");
function fillSettings() {
    for (const k of ["focus", "short", "long", "rounds"]) form.elements[k].value = settings[k];
    for (const k of ["autoStart", "bell", "notify"]) form.elements[k].checked = Boolean(settings[k]);
}
function applySettings() {
    for (const k of Object.keys(LIMITS)) {
        const [lo, hi] = LIMITS[k];
        const v = Math.round(Number(form.elements[k].value));
        settings[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : settings[k];
    }
    settings.autoStart = form.elements.autoStart.checked;
    settings.bell = form.elements.bell.checked;
    settings.notify = form.elements.notify.checked;
    engine.configure({ focus: settings.focus, short: settings.short, long: settings.long, rounds: settings.rounds, autoStart: settings.autoStart });
    save({ settings });
    if (engine.read().running) scheduleBell();
    render();
}
form.addEventListener("change", (e) => {
    if (e.target.name === "notify" && e.target.checked && "Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission().then((p) => {
            if (p !== "granted") e.target.checked = false;
            applySettings();
        });
        return;
    }
    if (Object.keys(LIMITS).includes(e.target.name)) fillSettingsValue(e.target);
    applySettings();
});
function fillSettingsValue(input) {
    const [lo, hi] = LIMITS[input.name];
    const v = Math.round(Number(input.value));
    input.value = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : settings[input.name];
}
$$("[data-step]", form).forEach((b) =>
    b.addEventListener("click", () => {
        const [name, by] = b.dataset.step.split(":");
        const input = form.elements[name];
        const [lo, hi] = LIMITS[name];
        input.value = Math.min(hi, Math.max(lo, Number(input.value) + Number(by)));
        applySettings();
    })
);
if (!("Notification" in window)) form.elements.notify.closest("label").hidden = true;

/* ------------------------------------------------------------- keyboard */

document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest("input, textarea, select") || $("dialog[open]")) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "spacebar") {
        if (e.target.closest("button, a")) return; // the focused control gets its own press
        e.preventDefault();
        toggle();
    } else if (k === "r") reset();
    else if (k === "s") skip();
    else if (k === "f") toggleZen();
    else if (k === "m") music.toggle();
    else if (k === "n") music.next();
    else if (k === "escape" && root.classList.contains("is-zen") && !document.fullscreenElement) setZen(false);
});

fillSettings();
renderToday();
render();
