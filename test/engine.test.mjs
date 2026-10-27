import test from "node:test";
import assert from "node:assert/strict";
import { createEngine, clock } from "../js/engine.js";

const MIN = 60000;
function fakeClock(start = 1_000_000) {
    let t = start;
    return { now: () => t, advance: (ms) => (t += ms) };
}

test("the countdown follows the wall clock, however rarely it is read", () => {
    const c = fakeClock();
    const e = createEngine({}, c.now);
    e.start();
    c.advance(7 * MIN + 30_000); // a hidden tab: no reads for seven and a half minutes
    assert.equal(e.read().remaining, 17 * MIN + 30_000);
    assert.equal(clock(e.read().remaining), "17:30");
});

test("pause keeps the time left; start resumes from it", () => {
    const c = fakeClock();
    const e = createEngine({}, c.now);
    e.start();
    c.advance(5 * MIN);
    e.pause();
    c.advance(60 * MIN); // paused for an hour
    assert.equal(e.read().remaining, 20 * MIN);
    e.start();
    c.advance(20 * MIN);
    const done = e.check();
    assert.deepEqual(done, { finished: "focus", next: "short", counted: true, minutes: 25 });
});

test("rounds: three short breaks, then a long one, then a new set", () => {
    const c = fakeClock();
    const e = createEngine({ rounds: 4 }, c.now);
    const seen = [];
    for (let i = 0; i < 8; i++) {
        e.start();
        c.advance(e.read().remaining);
        const ev = e.check();
        seen.push(`${ev.finished}>${ev.next}`);
    }
    assert.deepEqual(seen, ["focus>short", "short>focus", "focus>short", "short>focus", "focus>short", "short>focus", "focus>long", "long>focus"]);
    assert.equal(e.read().round, 1);
});

test("check does nothing before the end and finishes once at it", () => {
    const c = fakeClock();
    const e = createEngine({ focus: 1 }, c.now);
    e.start();
    c.advance(59_999);
    assert.equal(e.check(), null);
    c.advance(1);
    assert.equal(e.check().finished, "focus");
    assert.equal(e.check(), null);
    assert.equal(e.read().running, false);
});

test("auto start runs the next phase from the moment the last one ended", () => {
    const c = fakeClock();
    const e = createEngine({ focus: 1, short: 1, autoStart: true }, c.now);
    e.start();
    c.advance(60_000);
    e.check();
    const r = e.read();
    assert.equal(r.phase, "short");
    assert.equal(r.running, true);
    assert.equal(r.remaining, 60_000);
});

test("skip moves on without counting the focus", () => {
    const e = createEngine();
    const ev = e.skip();
    assert.equal(ev.counted, false);
    assert.equal(ev.minutes, 0);
    assert.equal(e.read().phase, "short");
});

test("the stopwatch adds up across pauses", () => {
    const c = fakeClock();
    const e = createEngine({}, c.now);
    e.setTool("stopwatch");
    e.start();
    c.advance(90_000);
    e.pause();
    c.advance(10 * MIN);
    e.start();
    c.advance(30_000);
    assert.equal(e.read().elapsed, 120_000);
    assert.equal(clock(e.read().elapsed, { ceil: false }), "02:00");
});

test("new lengths apply to a timer that isn't running", () => {
    const e = createEngine();
    e.configure({ focus: 50 });
    assert.equal(e.read().remaining, 50 * MIN);
    assert.equal(clock(e.read().remaining), "50:00");
    assert.equal(clock(65 * MIN), "1:05:00");
});
