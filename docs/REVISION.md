# Focus Timer — revision (2026-10)

Approved by Kaan on 2026-10-27, with the defaults: its own calm, typographic identity (not the zeigarn pixel world), focus first, no health claims, Pomodoro rounds, no Google Analytics. Branch `revision`.

## What was wrong

1. The countdown subtracted one second per `setInterval` tick: in a hidden tab with no sound playing, Chrome slows timers to once a minute, so a 25-minute focus fell behind.
2. Tailwind's development CDN in production (compiled in the browser on every visit), fonts and icons from Google.
3. A template look (dark gradient, glass cards, centred headline), an empty middle in the timer card, three overlapping ways to set a duration.
4. Fullscreen: three far-apart numbers and two unlabeled play buttons; no progress; the phone screen may sleep.
5. Phone: track names cut to "39…", preset buttons wrapping, a very long page.
6. Accessibility: 8 of 20 buttons labeled, no keyboard shortcuts, nothing in the tab title.
7. Copy: "396 Hz — Release Fear", "Ignites flow and creativity": health claims with nothing behind them.

## The new app

- **Focus first.** One big timer in the middle, a hairline of progress under it, Start / Reset / Skip. Music is a thin bar at the bottom; the library (and adding YouTube links) opens in a panel; durations and options in settings.
- **Pomodoro rounds.** Focus → short break, every 4th break long (all lengths and the round count in settings). The phase changes colour: amber for focus, sage for breaks. Today's rounds and focus minutes are kept on the device. Stopwatch and clock stay as tools.
- **Accurate.** Time is computed from an end time (`Date.now()`), never counted; the bell is scheduled in Web Audio at the exact end, so it rings on time in a background tab. The tab title shows the time left. Optional notification at the end.
- **Fullscreen** (or a pseudo-fullscreen where the browser has none): the numbers, the hairline, two labeled buttons (Timer, Music); the screen stays awake while it runs.
- **Breathing light:** while the timer runs, a soft light behind the numbers swells and settles on a 4 s in / 6 s out cycle. Off with reduced motion.
- **Type and colour:** Big Shoulders Display 300 for the numbers (tall and narrow, after Chicago's signs: a clock you read across the room), Atkinson Hyperlegible 400/700 for everything else (drawn for legibility); both self-hosted. Fraunces + IBM Plex, the first choice, read as a template and were replaced on the owner's call. Warm near-black `#13110f`, warm white `#ede6da`, amber `#e9a85b`, sage `#9cb79a`. Inline SVG icons.
- **Keyboard:** Space start/pause, R reset, S skip, F fullscreen, M music play/pause, N next track.
- **Copy:** tones named by their frequency, no claims.
- Plain HTML/CSS/JS modules, no build step. `node --test test/` covers the timer engine.
