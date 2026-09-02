import React, { useState, useEffect, useRef, useCallback, forwardRef, memo } from "react";
import { useParams, useSearchParams } from 'react-router-dom';
import API_BASE_URL from '../../../../config/api';

/**
 * Stable container for the YouTube iframe. The YT IFrame API replaces this div's
 * contents with an <iframe> outside of React's control. Wrapping it in React.memo
 * with an always-equal comparator ensures React NEVER re-renders/reconciles this
 * node after mount — so parent re-renders (e.g. an order-ready overlay popping up)
 * can't wipe or reset the video/audio.
 */
const YouTubeContainer = memo(
    forwardRef((props, ref) => <div ref={ref} style={{ width: '100%', height: '100%' }} />),
    () => true // never re-render
);

/**
 * SignagePlayer - Digital Signage Player for TVs
 * 
 * Architecture:
 * - Main Stream: YouTube video plays continuously in background (always on)
 * - Interrupts: Periodic content (QR codes, promos, Today's Special) overlays the main stream
 *   for a set duration, then returns to the main stream
 * - Order Overlay: Order-ready banner slides in at the bottom on top of everything
 * 
 * Playlist structure:
 * - mainStream: { src: 'youtube embed url' } — always playing behind everything
 * - interrupts: [ { type, src, duration, enabled, checkApi, ... } ] — periodic overlay content
 * 
 * URL: /dashboard/:restaurantId/signage?tvId=tv1&orientation=landscape|portrait
 */
const SignagePlayer = () => {
    const { restaurantId } = useParams();
    const [searchParams] = useSearchParams();
    const tvId = searchParams.get('tvId') || 'default';
    const orientation = searchParams.get('orientation') || 'landscape';

    const [mainVideos, setMainVideos] = useState([]); // all items marked as main
    const [mainStream, setMainStream] = useState(null); // the currently-playing main video
    const [interrupts, setInterrupts] = useState([]);
    const [currentInterrupt, setCurrentInterrupt] = useState(-1); // -1 = showing main stream
    const [isLoading, setIsLoading] = useState(true);
    const [userInteracted, setUserInteracted] = useState(false);
    const interruptTimerRef = useRef(null);
    const cycleTimerRef = useRef(null);
    const interruptIndexRef = useRef(0);
    const ytPlayerRef = useRef(null);
    const ytContainerRef = useRef(null);
    const currentVideoIdRef = useRef(null); // video id the current player is playing
    const mainVideosRef = useRef([]);       // latest main-video list (avoids stale closures)
    const userInteractedRef = useRef(false); // latest userInteracted (for YT event handlers)
    const webrtcVideoRef = useRef(null);    // <video> element for a WebRTC (WHEP) live feed
    const pcRef = useRef(null);             // active RTCPeerConnection for the WebRTC feed
    const [mainOpacity, setMainOpacity] = useState(1); // crossfade opacity for the main player
    const keepAliveCtxRef = useRef(null); // Web Audio context for the silent keep-alive tone

    // Order ready overlay state
    const [readyOrderNum, setReadyOrderNum] = useState(null);
    const [orderAnimState, setOrderAnimState] = useState('idle');
    const orderQueueRef = useRef([]);
    const knownOrdersRef = useRef(new Set());
    const orderProcessingRef = useRef(false);

    const showNextOrder = useCallback(() => {
        if (orderQueueRef.current.length === 0) {
            orderProcessingRef.current = false;
            return;
        }
        orderProcessingRef.current = true;
        const orderNum = orderQueueRef.current.shift();
        setOrderAnimState('slideIn');
        setReadyOrderNum(orderNum);
        setTimeout(() => setOrderAnimState('display'), 600);
        setTimeout(() => {
            setOrderAnimState('slideOut');
            setTimeout(() => {
                setReadyOrderNum(null);
                setOrderAnimState('idle');
                showNextOrder();
            }, 600);
        }, 20000);
    }, []);

    // SSE for order ready notifications
    useEffect(() => {
        const isDev = window.location.hostname === 'localhost';
        const sseBase = API_BASE_URL || (isDev ? 'http://localhost:3010' : window.location.origin);
        const ORDER_SSE_URL = `${sseBase}/api/orders/stream?location=${restaurantId}`;
        let eventSource = null;
        let fallbackInterval = null;

        const connectOrderSSE = () => {
            try {
                eventSource = new EventSource(ORDER_SSE_URL);
                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'order_ready' && data.orderNumber) {
                            if (!knownOrdersRef.current.has(data.orderNumber)) {
                                knownOrdersRef.current.add(data.orderNumber);
                                orderQueueRef.current.push(data.orderNumber);
                                if (!orderProcessingRef.current) showNextOrder();
                            }
                        }
                    } catch (e) {}
                };
                eventSource.onerror = () => {
                    eventSource.close();
                    startOrderPolling();
                };
            } catch (e) {
                startOrderPolling();
            }
        };

        const startOrderPolling = () => {
            if (fallbackInterval) return;
            const fetchOrders = async () => {
                const hour = new Date().getHours();
                if (hour < 10 || hour >= 22) return;
                try {
                    const res = await fetch(`${API_BASE_URL}/api/completedOrders?location=${restaurantId}`);
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        const newOrders = data.filter(o => !knownOrdersRef.current.has(o.orderNumber));
                        newOrders.forEach(o => {
                            knownOrdersRef.current.add(o.orderNumber);
                            orderQueueRef.current.push(o.orderNumber);
                        });
                        if (newOrders.length > 0 && !orderProcessingRef.current) showNextOrder();
                    }
                } catch (e) {}
            };
            fetchOrders();
            fallbackInterval = setInterval(fetchOrders, 300000);
        };

        connectOrderSSE();

        // Mark existing completed orders as known
        const markExistingOrders = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/completedOrders?location=${restaurantId}&noAlert=true`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    data.forEach(o => knownOrdersRef.current.add(o.orderNumber));
                }
            } catch (e) {}
        };
        markExistingOrders();

        const resetInterval = setInterval(() => {
            if (new Date().getHours() === 22) {
                knownOrdersRef.current.clear();
                orderQueueRef.current = [];
                setReadyOrderNum(null);
                setOrderAnimState('idle');
            }
        }, 60000);

        return () => {
            if (eventSource) eventSource.close();
            if (fallbackInterval) clearInterval(fallbackInterval);
            clearInterval(resetInterval);
        };
    }, [restaurantId, showNextOrder]);

    // Split a playlist into main videos (rotated randomly) and interrupts.
    // If liveStream is enabled, it takes precedence: it becomes the SOLE main video
    // (no rotation) so a live broadcast takes over the screen. Interrupts still play.
    const applyPlaylist = useCallback((playlist) => {
        const items = playlist.items || [];
        const live = playlist.liveStream;
        const enabled = items.filter(i => i.enabled !== false);
        const isMain = (i) => i.role === 'main' || (i.type === 'url' && i.src?.includes('youtube'));
        const rest = enabled.filter(i => !isMain(i));

        if (live && live.enabled && live.src) {
            // Live mode: single main = the live stream. Rotation is effectively off
            // (a single-item main list won't rotate).
            const liveItem = { type: 'url', src: live.src, role: 'main', label: 'Live Stream' };
            setMainVideos([liveItem]);
            setMainStream(liveItem);
            setInterrupts(rest);
            return;
        }

        const mains = enabled.filter(isMain);
        if (mains.length > 0) {
            setMainVideos(mains);
            setMainStream(mains[Math.floor(Math.random() * mains.length)]);
            setInterrupts(rest);
        } else if (enabled.length > 0) {
            setMainVideos([enabled[0]]);
            setMainStream(enabled[0]);
            setInterrupts(enabled.slice(1));
        }
    }, []);

    // Fetch playlist from server
    const fetchPlaylist = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/signage/playlist?tvId=${tvId}&location=${restaurantId}`);
            const data = await res.json();
            if (data && data.items && data.items.length > 0) {
                applyPlaylist(data);
            }
        } catch (e) {
            console.error('Error fetching signage playlist:', e);
        }
        setIsLoading(false);
    }, [tvId, restaurantId, applyPlaylist]);

    useEffect(() => {
        fetchPlaylist();
    }, [fetchPlaylist]);

    // Keep the latest values available to the (long-lived) YT event handlers.
    mainVideosRef.current = mainVideos;
    userInteractedRef.current = userInteracted;

    // Pick a random main video different from the current one (when possible),
    // then crossfade to it. Called when the current main video finishes.
    const rotateToNextMain = useCallback(() => {
        const list = mainVideosRef.current || [];
        if (list.length <= 1) {
            // Only one main video: just restart it (no visible switch needed).
            try { ytPlayerRef.current?.seekTo(0); ytPlayerRef.current?.playVideo(); } catch (e) {}
            return;
        }
        const currentId = currentVideoIdRef.current;
        const candidates = list.filter((v) => {
            const m = v.src?.match(/embed\/([^?]+)/);
            return (m ? m[1] : null) !== currentId;
        });
        const next = candidates[Math.floor(Math.random() * candidates.length)] || list[0];
        // Crossfade: fade out, swap the main stream, fade back in.
        setMainOpacity(0);
        setTimeout(() => setMainStream(next), 600);
    }, []);

    // A WebRTC (near-real-time) live source is a WHEP URL from MediaMTX (or an item
    // explicitly typed 'webrtc'). Everything else with 'youtube' is a YT embed.
    const isWebRtcSrc = (src) => !!src && (/\/whep\b/i.test(src) || /^webrtc:/i.test(src));
    const mainIsWebRtc = mainStream?.type === 'webrtc' || isWebRtcSrc(mainStream?.src);

    // Derive the YouTube video id from the current main stream (only for YT embeds).
    const mainVideoId = (() => {
        if (mainIsWebRtc) return null;
        if (!mainStream || !mainStream.src?.includes('youtube')) return null;
        const m = mainStream.src.match(/embed\/([^?]+)/);
        return m ? m[1] : null;
    })();

    // Connect to a WebRTC (WHEP) live feed via the browser's RTCPeerConnection.
    // WHEP handshake: POST our SDP offer to the WHEP URL, apply the SDP answer.
    // Near-real-time (sub-second to ~2s), served by MediaMTX on the local network.
    useEffect(() => {
        if (!mainIsWebRtc || !mainStream?.src) return;
        let cancelled = false;
        const whepUrl = mainStream.src.replace(/^webrtc:/i, '');

        const connect = async () => {
            try {
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
                });
                pcRef.current = pc;
                // We only want to receive audio+video.
                pc.addTransceiver('video', { direction: 'recvonly' });
                pc.addTransceiver('audio', { direction: 'recvonly' });

                pc.ontrack = (event) => {
                    if (webrtcVideoRef.current && event.streams[0]) {
                        webrtcVideoRef.current.srcObject = event.streams[0];
                        webrtcVideoRef.current.play().catch(() => {});
                        setMainOpacity(1);
                    }
                };

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                const res = await fetch(whepUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/sdp' },
                    body: offer.sdp,
                });
                if (!res.ok) throw new Error(`WHEP request failed: ${res.status}`);
                const answerSdp = await res.text();
                if (cancelled) return;
                await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
            } catch (e) {
                console.error('[Signage] WebRTC connect failed:', e);
            }
        };

        connect();

        return () => {
            cancelled = true;
            if (pcRef.current) {
                try { pcRef.current.close(); } catch (e) {}
                pcRef.current = null;
            }
            if (webrtcVideoRef.current) {
                webrtcVideoRef.current.srcObject = null;
            }
        };
    }, [mainIsWebRtc, mainStream?.src]);

    // Initialize YouTube IFrame Player API.
    // IMPORTANT: depend on the video ID STRING, not the mainStream object, so this
    // effect (and its player-destroying cleanup) only runs when the video actually
    // changes — not on every re-render or equal playlist update. That prevents the
    // video from resetting / re-muting when an order-ready overlay pops up.
    useEffect(() => {
        const videoId = mainVideoId;
        if (!videoId) return;

        // If a player already exists for this same video, do NOT recreate it.
        if (ytPlayerRef.current && currentVideoIdRef.current === videoId) return;

        // Load the YT API script if not already loaded
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
        }

        const initPlayer = () => {
            if (ytPlayerRef.current) {
                try { ytPlayerRef.current.destroy(); } catch (e) {}
            }
            currentVideoIdRef.current = videoId;
            // NOTE: no `loop`/`playlist` here — we want the ENDED event to fire so we
            // can rotate to a different random main video. If there's only one main
            // video, the ENDED handler simply restarts it.
            ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
                videoId,
                playerVars: {
                    autoplay: 1,
                    mute: 1,
                    controls: 0,
                    showinfo: 0,
                    rel: 0,
                    modestbranding: 1,
                    fs: 0,
                    iv_load_policy: 3,
                },
                events: {
                    onReady: (event) => {
                        try {
                            event.target.playVideo();
                            if (userInteractedRef.current) event.target.unMute();
                        } catch (e) {}
                        // Fade the (possibly newly-swapped) video in.
                        setMainOpacity(1);
                    },
                    onStateChange: (event) => {
                        // 0 === YT.PlayerState.ENDED -> rotate to the next random main video.
                        if (event.data === 0) {
                            rotateToNextMain();
                        }
                    },
                },
            });
        };

        if (window.YT && window.YT.Player) {
            initPlayer();
        } else {
            window.onYouTubeIframeAPIReady = initPlayer;
        }

        return () => {
            if (ytPlayerRef.current) {
                try { ytPlayerRef.current.destroy(); } catch (e) {}
                ytPlayerRef.current = null;
                currentVideoIdRef.current = null;
            }
        };
    }, [mainVideoId, rotateToNextMain]);

    // Pause/resume YouTube when interrupt shows/hides
    useEffect(() => {
        if (!ytPlayerRef.current) return;
        try {
            if (currentInterrupt >= 0) {
                ytPlayerRef.current.pauseVideo();
            } else {
                ytPlayerRef.current.playVideo();
                // Re-unmute after resume if user has interacted
                if (userInteracted) {
                    ytPlayerRef.current.unMute();
                }
            }
        } catch (e) {}
    }, [currentInterrupt, userInteracted]);

    // SSE for live playlist updates
    useEffect(() => {
        const isDev = window.location.hostname === 'localhost';
        const sseBase = API_BASE_URL || (isDev ? 'http://localhost:3010' : window.location.origin);
        const SSE_URL = `${sseBase}/api/signage/stream?tvId=${tvId}&location=${restaurantId}`;
        let eventSource = null;
        let fallbackInterval = null;

        const connectSSE = () => {
            try {
                eventSource = new EventSource(SSE_URL);
                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'playlist_update' && data.playlist) {
                            applyPlaylist(data.playlist);
                            setCurrentInterrupt(-1);
                        }
                    } catch (e) {}
                };
                eventSource.onerror = () => {
                    eventSource.close();
                    if (!fallbackInterval) {
                        fallbackInterval = setInterval(fetchPlaylist, 300000);
                    }
                };
            } catch (e) {
                if (!fallbackInterval) {
                    fallbackInterval = setInterval(fetchPlaylist, 300000);
                }
            }
        };

        connectSSE();
        return () => {
            if (eventSource) eventSource.close();
            if (fallbackInterval) clearInterval(fallbackInterval);
        };
    }, [tvId, restaurantId, fetchPlaylist, applyPlaylist]);

    // Cycle interrupts using a tick-based approach
    const interruptsRef = useRef(interrupts);
    interruptsRef.current = interrupts;
    const mainStreamRef = useRef(mainStream);
    mainStreamRef.current = mainStream;
    const phaseRef = useRef('main'); // 'main' or 'interrupt'
    const phaseStartRef = useRef(Date.now());
    const currentInterruptRef = useRef(-1);
    const tickBusyRef = useRef(false);

    useEffect(() => {
        if (interrupts.length === 0) return;

        const tick = async () => {
            // Prevent re-entry while async work is happening
            if (tickBusyRef.current) return;

            try {
            const now = Date.now();
            const elapsed = now - phaseStartRef.current;
            const items = interruptsRef.current;

            // Read the main-stream duration live from the ref (not captured once), so
            // the correct value is used even if the stream loaded/changed after this
            // effect ran. Defaults to 300s for the lobby main video.
            const mainDuration = (Number(mainStreamRef.current?.duration) || 300) * 1000;

            if (phaseRef.current === 'main') {
                if (elapsed < mainDuration) return; // Still showing main stream

                // Time to find next interrupt
                tickBusyRef.current = true;
                let idx = interruptIndexRef.current;
                let found = false;

                for (let attempts = 0; attempts < items.length; attempts++) {
                    const item = items[idx % items.length];
                    let skip = false;

                    if (item.checkApi) {
                        try {
                            const res = await fetch(`${API_BASE_URL}${item.checkApi}`);
                            const data = await res.json();
                            if (!data || (Array.isArray(data) && data.length === 0)) skip = true;
                        } catch (e) { skip = true; }
                    }

                    if (skip) {
                        idx = (idx + 1) % items.length;
                        continue;
                    }

                    // Show this interrupt
                    currentInterruptRef.current = idx % items.length;
                    interruptIndexRef.current = (idx + 1) % items.length;
                    phaseRef.current = 'interrupt';
                    phaseStartRef.current = Date.now();
                    setCurrentInterrupt(currentInterruptRef.current);
                    found = true;
                    break;
                }

                if (!found) {
                    // All skipped, reset main timer
                    phaseStartRef.current = Date.now();
                }

            } else {
                // In interrupt phase
                const item = items[currentInterruptRef.current];
                const dur = (item?.duration || 30) * 1000;

                if (elapsed < dur) return; // Still showing interrupt

                // Time's up for this interrupt
                if (item?.chain) {
                    // Find next chained interrupt
                    tickBusyRef.current = true;
                    let idx = interruptIndexRef.current;
                    let found = false;

                    for (let attempts = 0; attempts < items.length; attempts++) {
                        const nextItem = items[idx % items.length];
                        let skip = false;

                        if (nextItem.checkApi) {
                            try {
                                const res = await fetch(`${API_BASE_URL}${nextItem.checkApi}`);
                                const data = await res.json();
                                if (!data || (Array.isArray(data) && data.length === 0)) skip = true;
                            } catch (e) { skip = true; }
                        }

                        if (skip) {
                            idx = (idx + 1) % items.length;
                            continue;
                        }

                        currentInterruptRef.current = idx % items.length;
                        interruptIndexRef.current = (idx + 1) % items.length;
                        phaseStartRef.current = Date.now();
                        setCurrentInterrupt(currentInterruptRef.current);
                        found = true;
                        break;
                    }

                    if (!found) {
                        phaseRef.current = 'main';
                        phaseStartRef.current = Date.now();
                        setCurrentInterrupt(-1);
                    }
                } else {
                    // Back to main
                    phaseRef.current = 'main';
                    phaseStartRef.current = Date.now();
                    setCurrentInterrupt(-1);
                }
            }
            } catch (e) {
                console.error('[Signage tick error]', e);
            } finally {
                tickBusyRef.current = false;
            }
        };

        const intervalId = setInterval(tick, 1000);
        return () => clearInterval(intervalId);
    }, [interrupts.length]);

    // Operating hours: stop at 10pm, reload at 10am
    const [outsideHours, setOutsideHours] = useState(false);

    useEffect(() => {
        const checkHours = () => {
            const hour = new Date().getHours();
            if (hour >= 22 || hour < 10) {
                setOutsideHours(true);
                if (ytPlayerRef.current) {
                    try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
                }
            } else if (outsideHours) {
                window.location.reload();
            }
        };

        checkHours();
        const interval = setInterval(checkHours, 60000);
        return () => clearInterval(interval);
    }, [outsideHours]);

    // Starts a continuous, near-silent Web Audio tone. Ongoing audio playback is
    // the most reliable way to keep a browser tab/app (Fire Stick, Chrome) from
    // suspending or closing when idle — including during off-hours (10pm–10am),
    // so the page stays alive to auto-reload at 10am.
    const startKeepAlive = () => {
        if (keepAliveCtxRef.current) return; // already running
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            // Effectively inaudible volume, but enough to count as active playback
            gain.gain.value = 0.0001;
            oscillator.frequency.value = 20; // sub-audible low frequency
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start();
            keepAliveCtxRef.current = ctx;

            // Some browsers suspend the context when backgrounded; resume it periodically
            setInterval(() => {
                if (ctx.state === 'suspended') {
                    ctx.resume().catch(() => {});
                }
            }, 30000);
        } catch (e) {
            console.warn('Keep-alive audio could not start:', e);
        }
    };

    const handleUserInteraction = () => {
        if (!userInteracted) {
            setUserInteracted(true);
            if (ytPlayerRef.current) {
                try { ytPlayerRef.current.unMute(); } catch (e) {}
            }
        }
        // Start (or resume) the silent keep-alive tone on any user gesture
        startKeepAlive();
    };

    if (outsideHours) {
        return (
            <div style={styles.closed} onClick={handleUserInteraction}>
                <div style={styles.closedText}>
                    🕙 We're closed
                    <br />
                    <span style={{ fontSize: '1.5rem', opacity: 0.7, marginTop: '10px', display: 'block' }}>
                        See you at 10:00 AM!
                    </span>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div style={styles.loading}>
                <div style={styles.loadingText}>Loading Signage...</div>
            </div>
        );
    }

    if (!mainStream) {
        return (
            <div style={styles.empty}>
                <div style={styles.emptyText}>
                    No content configured for this display.
                    <br />
                    <span style={{ fontSize: '1rem', opacity: 0.7 }}>
                        TV: {tvId} | Location: {restaurantId}
                    </span>
                </div>
            </div>
        );
    }

    const isPortrait = orientation === 'portrait';
    const containerStyle = isPortrait ? {
        ...styles.container,
        width: '100vh',
        height: '100vw',
        transform: 'rotate(90deg)',
        transformOrigin: 'top left',
        position: 'absolute',
        top: 0,
        left: '100vw',
    } : styles.container;

    const showingInterrupt = currentInterrupt >= 0 && interrupts[currentInterrupt];



    return (
        <div style={containerStyle} onClick={handleUserInteraction}>
            {/* Tap to start overlay */}
            {!userInteracted && (
                <div style={styles.tapOverlay}>
                    <div style={styles.tapContent}>
                        <span style={{ fontSize: '4rem' }}>🔊</span>
                        <p style={{ fontFamily: "'Bree Serif', serif", fontSize: '1.5rem', color: '#fff', marginTop: '15px' }}>
                            Tap anywhere to enable audio
                        </p>
                    </div>
                </div>
            )}

            {/* Main Stream */}
            <div style={{ ...styles.layer, zIndex: 1, opacity: mainOpacity, transition: 'opacity 0.6s ease' }}>
                {mainIsWebRtc ? (
                    // Near-real-time WebRTC (WHEP) live feed — e.g. OBSBOT via MediaMTX.
                    <video
                        ref={webrtcVideoRef}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        autoPlay
                        playsInline
                        muted={!userInteracted}
                    />
                ) : (
                    <YouTubeContainer ref={ytContainerRef} />
                )}
            </div>

            {/* Interrupt overlay */}
            {showingInterrupt && (
                <div style={{
                    ...styles.layer,
                    zIndex: 10,
                    animation: 'fadeIn 0.5s ease',
                }}>
                    {showingInterrupt.type === 'url' && (
                        <iframe
                            key={showingInterrupt.src}
                            src={showingInterrupt.src}
                            style={styles.iframe}
                            title="Interrupt content"
                            frameBorder="0"
                            allow="autoplay; fullscreen"
                        />
                    )}
                    {showingInterrupt.type === 'video' && (
                        <video
                            key={showingInterrupt.src}
                            src={showingInterrupt.src}
                            style={styles.video}
                            autoPlay
                            muted={!userInteracted}
                            playsInline
                            loop
                            onLoadedData={(e) => e.target.play().catch(() => {})}
                        />
                    )}
                    {showingInterrupt.type === 'image' && (
                        <img
                            key={showingInterrupt.src}
                            src={showingInterrupt.src}
                            alt={showingInterrupt.label || 'Signage'}
                            style={styles.image}
                        />
                    )}
                    {showingInterrupt.type === 'html' && (
                        <div
                            style={styles.htmlContent}
                            dangerouslySetInnerHTML={{ __html: showingInterrupt.content }}
                        />
                    )}
                </div>
            )}

            {/* Order Ready Overlay - always on top */}
            {readyOrderNum && (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #fd590d 0%, #ff8c42 50%, #fd590d 100%)',
                    backgroundSize: '200% 200%',
                    animation: 'gradientShift 2s ease infinite',
                    transform: orderAnimState === 'slideIn' ? 'translateY(100%)' : orderAnimState === 'slideOut' ? 'translateY(100%)' : 'translateY(0)',
                    opacity: orderAnimState === 'slideIn' || orderAnimState === 'slideOut' ? 0 : 1,
                    transition: 'transform 0.6s ease-in-out, opacity 0.6s ease-in-out',
                    zIndex: 200,
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
                }}>
                    <span style={{ fontSize: '2.5rem', marginRight: '15px' }}>🔔</span>
                    <span style={{
                        fontFamily: "'Lobster', cursive",
                        fontSize: '3.5rem',
                        color: '#fff',
                        textShadow: '3px 3px 6px rgba(0,0,0,0.3)',
                        letterSpacing: '2px',
                        animation: 'pulseText 1s ease-in-out infinite',
                    }}>
                        Order #{readyOrderNum} is Ready!
                    </span>
                    <span style={{ fontSize: '2.5rem', marginLeft: '15px' }}>🎉</span>
                </div>
            )}

            <style>{`
                @keyframes gradientShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes pulseText {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

const styles = {
    container: {
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    layer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
    },
    iframe: {
        width: '100%',
        height: '100%',
        border: 'none',
    },
    video: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
    },
    image: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
    },
    htmlContent: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        color: '#fff',
        fontSize: '2rem',
        fontFamily: "'Bree Serif', serif",
        backgroundColor: '#000',
    },
    loading: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#000',
    },
    loadingText: {
        color: '#fff',
        fontSize: '1.5rem',
        fontFamily: 'sans-serif',
    },
    empty: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
    },
    emptyText: {
        color: '#888',
        fontSize: '1.5rem',
        fontFamily: 'sans-serif',
        textAlign: 'center',
    },
    closed: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#000',
    },
    closedText: {
        color: '#fd590d',
        fontSize: '3rem',
        fontFamily: "'Lobster', cursive",
        textAlign: 'center',
    },
    tapOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
        cursor: 'pointer',
    },
    tapContent: {
        textAlign: 'center',
        animation: 'pulseText 2s ease-in-out infinite',
    },
};

export default SignagePlayer;
