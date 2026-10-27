// What the app remembers on this device: settings, today's rounds, the music.
const KEY = "focus-timer";

export function load() {
    try {
        return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
        return {};
    }
}

export function save(patch) {
    const next = { ...load(), ...patch };
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        /* storage blocked: the app still works, it just forgets */
    }
    return next;
}

const today = () => new Date().toLocaleDateString("sv"); // YYYY-MM-DD, local

export function stats() {
    const s = load().stats;
    return s && s.date === today() ? s : { date: today(), rounds: 0, minutes: 0 };
}

export function addRound(minutes) {
    const s = stats();
    s.rounds += 1;
    s.minutes += minutes;
    save({ stats: s });
    return s;
}
