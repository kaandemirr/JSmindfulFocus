// The end-of-phase bell, scheduled in Web Audio at the exact end time when a phase starts.
// Audio scheduling isn't throttled in a background tab the way timers are, so it rings on time.
export function createBell(src) {
    let ctx = null;
    let buffer = null;
    let loading = null;
    let node = null;
    let at = 0;
    const fallback = new Audio(src);
    fallback.preload = "auto";

    // Call from a user gesture (Start): browsers only let audio start after one.
    async function ready() {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx ??= new AC();
        if (ctx.state === "suspended") await ctx.resume().catch(() => {});
        loading ??= fetch(src)
            .then((r) => r.arrayBuffer())
            .then((b) => ctx.decodeAudioData(b))
            .then((b) => (buffer = b))
            .catch(() => null);
        await loading;
        return Boolean(buffer);
    }

    function cancel() {
        if (!node) return;
        try {
            node.stop();
        } catch {
            /* already played */
        }
        node.disconnect();
        node = null;
        at = 0;
    }

    function schedule(endsAt, volume = 1) {
        cancel();
        if (!ctx || !buffer || ctx.state !== "running") return false;
        const gain = ctx.createGain();
        gain.gain.value = volume;
        node = ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(gain).connect(ctx.destination);
        node.start(ctx.currentTime + Math.max(0, (endsAt - Date.now()) / 1000));
        at = endsAt;
        return true;
    }

    // At a phase's end: the scheduled bell has rung by itself; otherwise ring now.
    function rang(endsAt) {
        const scheduled = at && Math.abs(at - endsAt) < 1500;
        at = 0;
        node = null;
        if (scheduled) return;
        fallback.currentTime = 0;
        fallback.play().catch(() => {});
    }

    return { ready, schedule, cancel, rang };
}
