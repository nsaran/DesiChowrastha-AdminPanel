import { useEffect, useRef, useCallback } from 'react';

/**
 * useKeepAlive
 *
 * Plays a near-silent Web Audio tone to stop an idle browser (Amazon Silk /
 * Fire Stick, Chrome) from suspending or closing the tab when there's no activity.
 * Ongoing audio playback is the most reliable cross-browser keep-alive.
 *
 * Browsers block audio until a user gesture, so the tone starts on the first
 * tap/click/keypress anywhere on the page, then the listeners are removed.
 * The audio context auto-resumes if the browser suspends it, and is cleaned up
 * on unmount.
 */
export function useKeepAlive() {
    const ctxRef = useRef(null);

    const start = useCallback(() => {
        if (ctxRef.current) return; // already running
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.0001;        // effectively inaudible, still counts as active playback
            oscillator.frequency.value = 20; // sub-audible low frequency
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start();
            ctxRef.current = ctx;
            setInterval(() => {
                if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            }, 30000);
        } catch (e) {
            console.warn('Keep-alive audio could not start:', e);
        }
    }, []);

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
        return () => {
            document.removeEventListener('click', onFirstInteraction);
            document.removeEventListener('touchstart', onFirstInteraction);
            document.removeEventListener('keydown', onFirstInteraction);
            if (ctxRef.current) {
                try { ctxRef.current.close(); } catch (e) {}
                ctxRef.current = null;
            }
        };
    }, [start]);
}

export default useKeepAlive;
