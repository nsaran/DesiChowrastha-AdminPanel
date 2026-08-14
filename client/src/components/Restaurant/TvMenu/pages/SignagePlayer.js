import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from 'react-router-dom';
import API_BASE_URL from '../../../../config/api';

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

    const [mainStream, setMainStream] = useState(null);
    const [interrupts, setInterrupts] = useState([]);
    const [currentInterrupt, setCurrentInterrupt] = useState(-1); // -1 = showing main stream
    const [isLoading, setIsLoading] = useState(true);
    const [userInteracted, setUserInteracted] = useState(false);
    const interruptTimerRef = useRef(null);
    const cycleTimerRef = useRef(null);
    const interruptIndexRef = useRef(0);
    const ytPlayerRef = useRef(null);
    const ytContainerRef = useRef(null);

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
        }, 10000);
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

    // Fetch playlist from server
    const fetchPlaylist = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/signage/playlist?tvId=${tvId}&location=${restaurantId}`);
            const data = await res.json();
            if (data && data.items && data.items.length > 0) {
                // First item marked as mainStream type OR first URL item with 'youtube' in src
                const items = data.items.filter(i => i.enabled !== false);
                const mainIdx = items.findIndex(i => i.role === 'main' || (i.type === 'url' && i.src?.includes('youtube')));
                if (mainIdx >= 0) {
                    setMainStream(items[mainIdx]);
                    setInterrupts(items.filter((_, idx) => idx !== mainIdx));
                } else {
                    // No main stream found — use first item as main
                    setMainStream(items[0]);
                    setInterrupts(items.slice(1));
                }
            }
        } catch (e) {
            console.error('Error fetching signage playlist:', e);
        }
        setIsLoading(false);
    }, [tvId, restaurantId]);

    useEffect(() => {
        fetchPlaylist();
    }, [fetchPlaylist]);

    // Initialize YouTube IFrame Player API
    useEffect(() => {
        if (!mainStream || !mainStream.src?.includes('youtube')) return;

        // Extract video ID from embed URL
        const match = mainStream.src.match(/embed\/([^?]+)/);
        const videoId = match ? match[1] : null;
        if (!videoId) return;

        // Load the YT API script if not already loaded
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
        }

        const initPlayer = () => {
            if (ytPlayerRef.current) {
                ytPlayerRef.current.destroy();
            }
            ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
                videoId,
                playerVars: {
                    autoplay: 1,
                    mute: 1,
                    loop: 1,
                    playlist: videoId,
                    controls: 0,
                    showinfo: 0,
                    rel: 0,
                    modestbranding: 1,
                    fs: 0,
                    iv_load_policy: 3,
                },
                events: {
                    onReady: (event) => {
                        event.target.playVideo();
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
            }
        };
    }, [mainStream]);

    // Pause/resume YouTube when interrupt shows/hides
    useEffect(() => {
        if (!ytPlayerRef.current) return;
        try {
            if (currentInterrupt >= 0) {
                ytPlayerRef.current.pauseVideo();
            } else {
                ytPlayerRef.current.playVideo();
            }
        } catch (e) {}
    }, [currentInterrupt]);

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
                            const items = (data.playlist.items || []).filter(i => i.enabled !== false);
                            const mainIdx = items.findIndex(i => i.role === 'main' || (i.type === 'url' && i.src?.includes('youtube')));
                            if (mainIdx >= 0) {
                                setMainStream(items[mainIdx]);
                                setInterrupts(items.filter((_, idx) => idx !== mainIdx));
                            } else if (items.length > 0) {
                                setMainStream(items[0]);
                                setInterrupts(items.slice(1));
                            }
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
    }, [tvId, restaurantId, fetchPlaylist]);

    // Cycle interrupts periodically
    // Show main stream for mainStream.duration (default 300s), then show next interrupt
    useEffect(() => {
        if (interrupts.length === 0) return;

        const mainDuration = (mainStream?.duration || 300) * 1000;

        const startCycle = () => {
            // Show main stream first
            setCurrentInterrupt(-1);

            cycleTimerRef.current = setTimeout(async () => {
                // Find next enabled interrupt
                let attempts = 0;
                let idx = interruptIndexRef.current;

                while (attempts < interrupts.length) {
                    const item = interrupts[idx % interrupts.length];

                    // Check if item should be skipped via API
                    if (item.checkApi) {
                        try {
                            const res = await fetch(`${API_BASE_URL}${item.checkApi}`);
                            const data = await res.json();
                            if (!data || (Array.isArray(data) && data.length === 0)) {
                                idx++;
                                attempts++;
                                continue;
                            }
                        } catch (e) {
                            idx++;
                            attempts++;
                            continue;
                        }
                    }

                    // Show this interrupt
                    setCurrentInterrupt(idx % interrupts.length);
                    interruptIndexRef.current = (idx + 1) % interrupts.length;

                    // After interrupt duration, check if next item is chained
                    const interruptDuration = (item.duration || 30) * 1000;
                    interruptTimerRef.current = setTimeout(() => {
                        // If current item has chain:true, play next interrupt immediately
                        if (item.chain) {
                            showNextInterrupt();
                        } else {
                            startCycle();
                        }
                    }, interruptDuration);
                    return;
                }

                // All interrupts skipped — restart cycle
                startCycle();
            }, mainDuration);
        };

        // Show the next interrupt immediately (for chained items)
        const showNextInterrupt = async () => {
            let attempts = 0;
            let idx = interruptIndexRef.current;

            while (attempts < interrupts.length) {
                const item = interrupts[idx % interrupts.length];

                if (item.checkApi) {
                    try {
                        const res = await fetch(`${API_BASE_URL}${item.checkApi}`);
                        const data = await res.json();
                        if (!data || (Array.isArray(data) && data.length === 0)) {
                            idx++;
                            attempts++;
                            continue;
                        }
                    } catch (e) {
                        idx++;
                        attempts++;
                        continue;
                    }
                }

                setCurrentInterrupt(idx % interrupts.length);
                interruptIndexRef.current = (idx + 1) % interrupts.length;

                const interruptDuration = (item.duration || 30) * 1000;
                interruptTimerRef.current = setTimeout(() => {
                    if (item.chain) {
                        showNextInterrupt();
                    } else {
                        startCycle();
                    }
                }, interruptDuration);
                return;
            }

            // All remaining chained items skipped — back to main
            startCycle();
        };

        startCycle();

        return () => {
            if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
            if (interruptTimerRef.current) clearTimeout(interruptTimerRef.current);
        };
    }, [interrupts, mainStream]);

    // Operating hours: stop at 10pm, reload at 10am
    const [outsideHours, setOutsideHours] = useState(false);

    useEffect(() => {
        const checkHours = () => {
            const hour = new Date().getHours();
            if (hour >= 22 || hour < 10) {
                setOutsideHours(true);
                // Pause YouTube if playing
                if (ytPlayerRef.current) {
                    try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
                }
            } else if (outsideHours) {
                // It's now within hours and we were outside — reload the page
                window.location.reload();
            }
        };

        checkHours();
        const interval = setInterval(checkHours, 60000); // check every minute
        return () => clearInterval(interval);
    }, [outsideHours]);

    if (outsideHours) {
        return (
            <div style={styles.closed}>
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

    const handleUserInteraction = () => {
        if (!userInteracted) {
            setUserInteracted(true);
            if (ytPlayerRef.current) {
                try { ytPlayerRef.current.unMute(); } catch (e) {}
            }
        }
    };

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

            {/* Main Stream - YouTube Player API (pause/resume capable) */}
            <div style={{ ...styles.layer, zIndex: 1 }}>
                <div ref={ytContainerRef} style={{ width: '100%', height: '100%' }} />
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
                            loop={false}
                            onLoadedData={(e) => e.target.play().catch(() => {})}
                            onEnded={() => {
                                // Clear the duration timer and advance
                                if (interruptTimerRef.current) clearTimeout(interruptTimerRef.current);
                                if (showingInterrupt.chain) {
                                    // Trigger next interrupt immediately
                                    const nextIdx = interruptIndexRef.current;
                                    setCurrentInterrupt(nextIdx % interrupts.length);
                                    interruptIndexRef.current = (nextIdx + 1) % interrupts.length;
                                } else {
                                    setCurrentInterrupt(-1);
                                }
                            }}
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
