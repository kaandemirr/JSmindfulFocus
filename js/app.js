import { initTimer } from "./timer.js";
import { initMusicPlayer } from "./music.js";

function bootstrap() {
    initTimer();
    initMusicPlayer();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
} else {
    bootstrap();
}
