const STORAGE_KEY = "focus-player-youtube-tracks";
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export const baseTracks = [
    {
        id: "hz396",
        type: "local",
        source: "local",
        title: "396 Hz - Release Fear",
        subtitle: "Deep relaxation and emotional cleansing",
        src: "mp3/hz396.mp3"
    },
    {
        id: "hz369",
        type: "local",
        source: "local",
        title: "369 Hz - Tesla Sequence",
        subtitle: "Ignites flow and creativity",
        src: "mp3/hz369.mp3"
    },
    {
        id: "hz432",
        type: "local",
        source: "local",
        title: "432 Hz - Natural Harmony",
        subtitle: "Realigns you with the rhythm of nature",
        src: "mp3/hz432.mp3"
    },
    {
        id: "hz639",
        type: "local",
        source: "local",
        title: "639 Hz - Heart Connection",
        subtitle: "Heart-centered harmony and compassion",
        src: "mp3/hz639.mp3"
    },
    {
        id: "hz963",
        type: "local",
        source: "local",
        title: "963 Hz - Pure Consciousness",
        subtitle: "Opens the doorway to intuition and awareness",
        src: "mp3/hz963.mp3"
    },
    {
        id: "hz3",
        type: "local",
        source: "local",
        title: "3 Hz - Deep Delta",
        subtitle: "Deep sleep and subconscious relaxation",
        src: "mp3/hz3.mp3"
    },
    {
        id: "hz6",
        type: "local",
        source: "local",
        title: "6 Hz - Theta Rhythms",
        subtitle: "Perfect for inspiration and visualization",
        src: "mp3/hz6.mp3"
    },
    {
        id: "hz9",
        type: "local",
        source: "local",
        title: "9 Hz - Alpha Awakening",
        subtitle: "Gentle energy and light focus",
        src: "mp3/hz9.mp3"
    }
];

function applyRegexExtraction(urlString) {
    const candidates = [
        /youtu\.be\/([A-Za-z0-9_-]{11})/,
        /youtube\.com\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})/, 
        /youtube\.com\/watch.*[?&]v=([A-Za-z0-9_-]{11})/
    ];
    for (const pattern of candidates) {
        const match = urlString.match(pattern);
        if (match && match[1] && YOUTUBE_ID_PATTERN.test(match[1])) {
            return match[1];
        }
    }
    return null;
}

export function extractYouTubeId(rawUrl) {
    if (typeof rawUrl !== "string") {
        return null;
    }
    const trimmed = rawUrl.trim();
    if (!trimmed) {
        return null;
    }
    try {
        const url = new URL(trimmed);
        const host = url.hostname.toLowerCase();
        if (host.includes("youtube.com")) {
            const vParam = url.searchParams.get("v");
            if (vParam && YOUTUBE_ID_PATTERN.test(vParam)) {
                return vParam;
            }
            const pathnameParts = url.pathname.split("/").filter(Boolean);
            if (pathnameParts.length >= 2 && YOUTUBE_ID_PATTERN.test(pathnameParts[1])) {
                return pathnameParts[1];
            }
        }
        if (host.includes("youtu.be")) {
            const candidate = url.pathname.replace("/", "");
            if (YOUTUBE_ID_PATTERN.test(candidate)) {
                return candidate;
            }
        }
        return applyRegexExtraction(trimmed);
    } catch (error) {
        return applyRegexExtraction(trimmed);
    }
}

export function createYouTubeTrack(title, url) {
    const trimmedTitle = typeof title === "string" ? title.trim() : "";
    if (!trimmedTitle) {
        return { error: "TITLE_REQUIRED" };
    }
    const videoId = extractYouTubeId(url || "");
    if (!videoId) {
        return { error: "INVALID_URL" };
    }
    return {
        track: {
            id: videoId,
            videoId,
            type: "youtube",
            source: "youtube",
            title: trimmedTitle,
            subtitle: "YouTube video",
            addedAt: Date.now()
        }
    };
}

export function loadStoredTracks() {
    if (typeof window === "undefined" || !window.localStorage) {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .map((item) => {
                if (!item || typeof item !== "object") {
                    return null;
                }
                const videoId = typeof item.videoId === "string" ? item.videoId : item.id;
                if (!videoId || !YOUTUBE_ID_PATTERN.test(videoId)) {
                    return null;
                }
                const title = typeof item.title === "string" ? item.title : `YouTube Track ${videoId}`;
                return {
                    id: videoId,
                    videoId,
                    type: "youtube",
                    source: "youtube",
                    title,
                    subtitle: "YouTube video",
                    addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now()
                };
            })
            .filter(Boolean);
    } catch (error) {
        console.warn("Stored track parsing failed:", error);
        return [];
    }
}

export function saveStoredTracks(tracks) {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }
    try {
        const payload = tracks
            .filter((track) => track && track.type === "youtube")
            .map((track) => ({
                id: track.id,
                videoId: track.videoId || track.id,
                title: track.title,
                addedAt: track.addedAt ?? Date.now()
            }));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn("Unable to persist tracks:", error);
    }
}
