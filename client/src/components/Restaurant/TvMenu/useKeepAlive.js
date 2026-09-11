import { useEffect, useRef, useCallback } from 'react';

/**
 * useKeepAlive
 *
 * Prevents an idle browser (Amazon Silk / Fire Stick, Chrome) from suspending or
 * closing the tab when there's no activity. Silk is aggressive about suspending
 * inactive tabs, so this uses SEVERAL mechanisms together rather than relying on
 * any single one:
 *
 *   1. A near-silent Web Audio tone (counts as active audio playback).
 *   2. A tiny looping muted <video> element (active media playback — often more
 *      effective than Web Audio on Silk).
 *   3. The Screen Wake Lock API where available (asks the OS to stay awake).
 *   4. A periodic keep-alive tick that nudges the page and re-acquires the wake
 *      lock / restarts media if the browser suspended them.
 *
 * Browsers block audio/media until a user gesture, so playback starts on the
 * first tap/click/keypress anywhere on the page.
 */
export function useKeepAlive(options = {}) {
    // reloadMinutes: if set (> 0), reload the page after that many minutes of
    // inactivity as a safety net (recovers even if Silk suspended the tab).
    // audio: if true, play a REAL looping <audio> element (not muted) at low
    //   volume. Unmuted media playback is the strongest signal to Amazon Silk /
    //   Fire devices that the tab is active, and reliably prevents the browser
    //   from suspending or closing it. Use on always-on operational pages.
    const { reloadMinutes = 0, audio = false } = options;

    const ctxRef = useRef(null);
    const videoRef = useRef(null);
    const audioRef = useRef(null);
    const wakeLockRef = useRef(null);
    const tickRef = useRef(null);
    const startedRef = useRef(false);
    const lastActivityRef = useRef(Date.now());
    const reloadTimerRef = useRef(null);

    // A short looping WAV tone (base64). Unlike the muted video / near-silent
    // Web Audio tone, this plays through a REAL <audio> element so the device
    // registers genuine audio playback. Kept very low (near-inaudible) volume.
    // ~0.2s of a quiet low-frequency sine wave, mono, 8kHz.
    const KEEPALIVE_AUDIO =
        'data:audio/wav;base64,UklGR-QDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YcADAACAgIGBgoKDg4SEhYWGhoeHiIiJiYqKi4uMjI2Njo6Pj5CQkZGSkpOTlJSVlZaWl5eYmJmZmpqbm5ycnZ2enp+foKChoaKio6OkpKWlpqanp6ioqamqqqurrKytra6ur6+wsLGxsrKzs7S0tba2tre3uLi5ubq6u7u8vL2+vr/AwMHBwsLDw8TExcXGxsfHyMjJycrKy8vMzM3Nzs7Pz9DQ0dHS0tPT1NTV1dbW19fY2NnZ2trb29zc3d3e3t/f4ODh4eLi4+Pk5OXl5ubn5+jo6enq6uvr7Ozt7e7u7+/w8PHx8vLz8/T09fX29vf3+Pj5+fr6+/v8/P39/v7//v79/fz8+/v6+vn5+Pj39/b29fX09PPz8vLx8fDw7+/u7u3t7Ozr6+rq6ejo5+fm5uXl5OTj4+Li4eHg4N/f3t7d3dzc29va2tnZ2NjX19bW1dXU1NPT0tLR0dDQz8/Ozs3NzMzLy8rKycnIyMfHxsbFxcTEw8PCwsHBwMC/v76+vb28vLu7urq5ubi4t7e2trW1tLSzs7KysbGwsK+vrq6trK2sq6uqqqmppqampaWkpKOjoqKhoaCgn5+enp2dnJybm5qamZmYmJeXlpaVlZSUk5OSkpGRkJCPj46OjY2MjIuLioqJiYiIh4eGhoWFhISDg4KCgYGAgH9/fn59fXx8e3t6enl5eHh3d3Z2dXV0dHNzcnJxcXBwb29ubm1tbGxrq6qqpqalpaSko6Oiop+fmpqVlZGRjY2JiYWFgYF9fXl5dXVxcW1taWllZWFhXV1ZWVVVUVFNTUlJRUVBQT09OTk1NTExLS0hIRUVCQj8/PDw5OTY2MzMwMC0tKionJyQkISEeHhsbGBgVFRISDw8MDAkJBgYDA';

    // A 1x1 silent looping video (base64 mp4) — playing media keeps Silk awake.
    const SILENT_VIDEO =
        'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAAr21kYXQAAAGzABAHAAABthADAowdbb9/AAAC6W1vb3YAAABsbXZoZAAAAAB8JbCAfCWwgAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAmR0cmFrAAAAXHRraGQAAAAPfCWwgHwlsIAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAEAAAABAAAAAAABJGVkdHMAAAAcZWxzdAAAAAAAAAABAAAD6AAAAAAAAQAAAAABnG1kaWEAAAAgbWRoZAAAAAB8JbCAfCWwgAAArEQAAP//FccAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABR21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAQdzdGJsAAAAl3N0c2QAAAAAAAAAAQAAAIdhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAEAAQAASAAAAEgAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAMWF2Y0MBTUAK/+EAGGdNQArC0kJf/wjkAI4CY0IK/wAAAwABAAADAAIPEiUwAQAABGjuPIAAAAAYc3R0cwAAAAAAAAABAAAAAQAArEQAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAFHN0c3oAAAAAAAAAxwAAAAEAAAAUc3RjbwAAAAAAAAABAAAAMAAAAGB1ZHRhAAAAWG1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAAK2lsc3QAAAAjqXRvbwAAABtkYXRhAAAAAQAAAABMYXZmNTguMjkuMTAw';

    const acquireWakeLock = useCallback(async () => {
        try {
            if ('wakeLock' in navigator && !wakeLockRef.current) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                wakeLockRef.current.addEventListener?.('release', () => {
                    wakeLockRef.current = null;
                });
            }
        } catch (e) { /* not supported / denied — other mechanisms still apply */ }
    }, []);

    const start = useCallback(() => {
        if (startedRef.current) return; // already running
        startedRef.current = true;

        // 1) Silent Web Audio tone.
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                const ctx = new AudioCtx();
                const oscillator = ctx.createOscillator();
                const gain = ctx.createGain();
                gain.gain.value = 0.0001;
                oscillator.frequency.value = 20;
                oscillator.connect(gain);
                gain.connect(ctx.destination);
                oscillator.start();
                ctxRef.current = ctx;
            }
        } catch (e) { /* ignore */ }

        // 2) Tiny looping muted video (hidden). Playing media is the strongest
        //    signal to Silk that the tab is active.
        try {
            const v = document.createElement('video');
            v.src = SILENT_VIDEO;
            v.loop = true;
            v.muted = true;
            v.playsInline = true;
            v.setAttribute('playsinline', '');
            v.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0.01;bottom:0;right:0;pointer-events:none;z-index:-1;';
            document.body.appendChild(v);
            v.play().catch(() => {});
            videoRef.current = v;
        } catch (e) { /* ignore */ }

        // 2b) Real, unmuted looping audio (opt-in). This is the strongest signal
        //     to Amazon Silk / Fire devices that the tab is active, so it won't be
        //     suspended or closed. Volume is kept very low (near-inaudible).
        if (audio) {
            try {
                const a = document.createElement('audio');
                a.src = KEEPALIVE_AUDIO;
                a.loop = true;
                a.volume = 0.02; // low but non-zero; NOT muted
                a.setAttribute('playsinline', '');
                a.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;z-index:-1;';
                document.body.appendChild(a);
                a.play().catch(() => {});
                audioRef.current = a;
            } catch (e) { /* ignore */ }
        }

        // 3) Screen wake lock (best-effort).
        acquireWakeLock();
    }, [acquireWakeLock, audio]);

    useEffect(() => {
        const onFirstInteraction = () => {
            start();
            document.removeEventListener('click', onFirstInteraction);
            document.removeEventListener('touchstart', onFirstInteraction);
            document.removeEventListener('keydown', onFirstInteraction);
        };
        document.addEventListener('click', onFirstInteraction);
        document.addEventListener('touchstart', onFirstInteraction);
        document.addEventListener('keydown', onFirstInteraction);

        // Track user activity so the idle-reload doesn't reload while someone is
        // actively using the page.
        const markActivity = () => { lastActivityRef.current = Date.now(); };
        document.addEventListener('click', markActivity);
        document.addEventListener('touchstart', markActivity);
        document.addEventListener('keydown', markActivity);
        document.addEventListener('mousemove', markActivity);

        // Idle auto-reload safety net: if enabled, reload the page once it has been
        // idle (no real user activity) for `reloadMinutes`. This recovers the page
        // even if the browser suspended it.
        if (reloadMinutes > 0) {
            const idleMs = reloadMinutes * 60 * 1000;
            reloadTimerRef.current = setInterval(() => {
                if (Date.now() - lastActivityRef.current >= idleMs) {
                    window.location.reload();
                }
            }, 60000); // check every minute
        }

        // 4) Periodic keep-alive tick: resume audio, restart video, re-acquire wake
        //    lock, and nudge the page so idle timers reset. Runs every 20s.
        tickRef.current = setInterval(() => {
            try {
                if (ctxRef.current && ctxRef.current.state === 'suspended') {
                    ctxRef.current.resume().catch(() => {});
                }
                if (videoRef.current && videoRef.current.paused) {
                    videoRef.current.play().catch(() => {});
                }
                if (audioRef.current && audioRef.current.paused) {
                    audioRef.current.play().catch(() => {});
                }
                if (!wakeLockRef.current) acquireWakeLock();
                // Tiny DOM nudge to look "active".
                window.dispatchEvent(new Event('mousemove'));
            } catch (e) { /* ignore */ }
        }, 20000);

        // Re-acquire the wake lock when the tab becomes visible again.
        const onVisibility = () => { if (!document.hidden) acquireWakeLock(); };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            document.removeEventListener('click', onFirstInteraction);
            document.removeEventListener('touchstart', onFirstInteraction);
            document.removeEventListener('keydown', onFirstInteraction);
            document.removeEventListener('click', markActivity);
            document.removeEventListener('touchstart', markActivity);
            document.removeEventListener('keydown', markActivity);
            document.removeEventListener('mousemove', markActivity);
            document.removeEventListener('visibilitychange', onVisibility);
            if (tickRef.current) clearInterval(tickRef.current);
            if (reloadTimerRef.current) clearInterval(reloadTimerRef.current);
            if (ctxRef.current) { try { ctxRef.current.close(); } catch (e) {} ctxRef.current = null; }
            if (videoRef.current) {
                try { videoRef.current.pause(); videoRef.current.remove(); } catch (e) {}
                videoRef.current = null;
            }
            if (audioRef.current) {
                try { audioRef.current.pause(); audioRef.current.remove(); } catch (e) {}
                audioRef.current = null;
            }
            if (wakeLockRef.current) {
                try { wakeLockRef.current.release(); } catch (e) {}
                wakeLockRef.current = null;
            }
            startedRef.current = false;
        };
    }, [start, acquireWakeLock, reloadMinutes]);
}

export default useKeepAlive;
