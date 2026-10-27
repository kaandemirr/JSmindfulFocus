// The timer as data. Every reading is computed from an end time on the wall clock, never
// counted tick by tick, so a hidden tab (whose timers the browser slows down) can't fall behind.
//
//   const engine = createEngine(settings, now?)    now: () => ms, for tests
//   engine.read()      → { tool, phase, round, rounds, running, remaining, total, progress, elapsed }
//   engine.start() / pause() / toggle() / reset() / skip()
//   engine.check()     → a finished-phase event once the time is up (call it often), else null
//   engine.setTool("pomodoro" | "stopwatch" | "clock") · setPhase("focus" | "short" | "long") · configure({...})

export const DEFAULTS = Object.freeze({ focus: 25, short: 5, long: 15, rounds: 4, autoStart: false });
export const PHASES = ["focus", "short", "long"];
export const TOOLS = ["pomodoro", "stopwatch", "clock"];

const MINUTE = 60000;

export function createEngine(settings = {}, now = () => Date.now()) {
    const s = { ...DEFAULTS, ...settings };
    const st = {
        tool: "pomodoro",
        phase: "focus",
        round: 1, // which focus of the set this is (1..rounds)
        running: false,
        endsAt: 0,
        left: s.focus * MINUTE,
        swStart: 0,
        swAcc: 0,
    };

    const total = () => Math.max(1, s[st.phase]) * MINUTE;
    const remaining = () => (st.running ? Math.max(0, st.endsAt - now()) : st.left);
    const elapsed = () => st.swAcc + (st.running ? now() - st.swStart : 0);

    function read() {
        const t = total();
        const r = remaining();
        return {
            tool: st.tool,
            phase: st.phase,
            round: st.round,
            rounds: s.rounds,
            running: st.running,
            remaining: r,
            total: t,
            progress: st.tool === "pomodoro" ? Math.min(1, Math.max(0, 1 - r / t)) : 0,
            elapsed: elapsed(),
            endsAt: st.running && st.tool === "pomodoro" ? st.endsAt : null,
        };
    }

    function start() {
        if (st.running || st.tool === "clock") return false;
        if (st.tool === "pomodoro") {
            if (st.left <= 0) st.left = total();
            st.endsAt = now() + st.left;
        } else {
            st.swStart = now();
        }
        st.running = true;
        return true;
    }

    function pause() {
        if (!st.running) return false;
        if (st.tool === "pomodoro") st.left = remaining();
        else st.swAcc = elapsed();
        st.running = false;
        return true;
    }

    function toggle() {
        return st.running ? (pause(), false) : start();
    }

    function reset() {
        st.running = false;
        st.left = total();
        st.swAcc = 0;
    }

    // The phase after this one: a break after every focus (long after the last of a set),
    // a focus after every break.
    function advance({ counted }) {
        const finished = st.phase;
        let next;
        if (finished === "focus") next = st.round >= s.rounds ? "long" : "short";
        else {
            next = "focus";
            st.round = finished === "long" ? 1 : Math.min(s.rounds, st.round + 1);
        }
        st.phase = next;
        st.left = total();
        st.running = false;
        if (s.autoStart) start();
        return { finished, next, counted, minutes: finished === "focus" && counted ? s.focus : 0 };
    }

    function check() {
        if (st.tool !== "pomodoro" || !st.running || remaining() > 0) return null;
        return advance({ counted: true });
    }

    // Skipping moves on without counting the phase as done.
    function skip() {
        if (st.tool !== "pomodoro") return null;
        return advance({ counted: false });
    }

    function setTool(tool) {
        if (!TOOLS.includes(tool) || tool === st.tool) return;
        st.running = false;
        st.tool = tool;
        st.swAcc = 0;
        st.left = total();
    }

    function setPhase(phase) {
        if (!PHASES.includes(phase)) return;
        st.running = false;
        st.phase = phase;
        if (phase === "focus" && st.round > s.rounds) st.round = 1;
        st.left = total();
    }

    function configure(next) {
        Object.assign(s, next);
        st.round = Math.min(st.round, s.rounds);
        if (!st.running) st.left = total();
    }

    return { read, start, pause, toggle, reset, skip, check, setTool, setPhase, configure, settings: () => ({ ...s }) };
}

/** 1500000 → "25:00"; an hour or more → "1:05:00". */
export function clock(ms, { ceil = true } = {}) {
    const total = ceil ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(sec).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
