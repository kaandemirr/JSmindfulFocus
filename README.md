# Focus Timer

A focus timer with its own soundtrack: Pomodoro rounds, a stopwatch and a clock, with frequency tones or your own YouTube tracks behind them. Live demo: https://demirkaan.com/projects/focustimer

- **Exact time.** The timer is computed from an end time, never counted tick by tick, so a background tab can't fall behind. The bell is scheduled in Web Audio and rings on time even when the tab is hidden; the tab title shows the time left.
- **Rounds.** Focus, then a short break; after the last focus of a set, a long break. Lengths, the number of rounds and auto-start are in Settings. Today's rounds and focus minutes stay on the device.
- **Fullscreen** with only the time, its progress and two buttons; the screen stays awake while the timer runs.
- **Music.** The tones play from `mp3/`; YouTube links added in the Library play in a small player and are kept in the browser.
- **Keyboard:** Space start/pause, R reset, S skip, F fullscreen, M music, N next track.

Plain HTML, CSS and JavaScript modules, no build step. Serve the folder over HTTP (modules don't load from `file://`):

```bash
python3 -m http.server 8000
```

```bash
npm test
```

`docs/REVISION.md` explains the 2026 revision. Fonts: Big Shoulders Display and Atkinson Hyperlegible (SIL Open Font License, `fonts/`).
