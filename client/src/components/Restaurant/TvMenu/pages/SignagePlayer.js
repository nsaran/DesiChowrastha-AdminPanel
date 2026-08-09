import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from 'react-router-dom';
import API_BASE_URL from '../../../../config/api';

/**
 * SignagePlayer - Digital Signage Player for TVs
 * 
 * Loads a playlist from the server and cycles through items.
 * Supports: URLs (iframe), videos, images, and HTML content.
 * Listens for live playlist updates via SSE.
 * 
 * URL: /dashboard/:restaurantId/signage?tvId=tv1
 */
const SignagePlayer = () => {
    const { restaurantId } = useParams();
    const [searchParams] = useSearchParams();
    const tvId = searchParams.get('tvId') || 'default';
    const orientation = searchParams.get('orientation') || 'landscape'; // landscape or portrait

    const [playlist, setPlaylist] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const timerRef = useRef(null);

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

        // Mark existing completed orders as known so only new ones show
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

        // Reset at 10pm
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
                setPlaylist(data.items);
            }
        } catch (e) {
            console.error('Error fetching signage playlist:', e);
        }
        setIsLoading(false);
    }, [tvId, restaurantId]);

    // Initial fetch
    useEffect(() => {
        fetchPlaylist();
    }, [fetchPlaylist]);

    // SSE for live updates (with polling fallback)
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
                            setPlaylist(data.playlist.items || []);
                            setCurrentIndex(0);
                        }
                    } catch (e) {
                        console.error('Error parsing signage SSE:', e);
                    }
                };
                eventSource.onerror = () => {
                    eventSource.close();
                    // Fallback to polling every 5 minutes
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

    // Check if current item should be skipped (e.g., Today's Special with no items)
    const [skipCurrent, setSkipCurrent] = useState(false);

    useEffect(() => {
        const enabledItems = playlist.filter(item => item.enabled !== false);
        if (enabledItems.length === 0) return;

        const currentItem = enabledItems[currentIndex % enabledItems.length];
        if (currentItem?.checkApi) {
            // Check if the API returns data
            const checkData = async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}${currentItem.checkApi}`);
                    const data = await res.json();
                    if (!data || (Array.isArray(data) && data.length === 0)) {
                        // No data — skip to next
                        setSkipCurrent(true);
                    } else {
                        setSkipCurrent(false);
                    }
                } catch (e) {
                    setSkipCurrent(true);
                }
            };
            checkData();
        } else {
            setSkipCurrent(false);
        }
    }, [currentIndex, playlist]);

    // If current item should be skipped, advance immediately
    useEffect(() => {
        if (skipCurrent) {
            const enabledItems = playlist.filter(item => item.enabled !== false);
            setCurrentIndex(prev => (prev + 1) % enabledItems.length);
            setSkipCurrent(false);
        }
    }, [skipCurrent, playlist]);

    // Auto-advance based on item duration
    useEffect(() => {
        if (playlist.length === 0) return;

        // Filter to only enabled items
        const enabledItems = playlist.filter(item => item.enabled !== false);
        if (enabledItems.length === 0) return;

        if (timerRef.current) clearTimeout(timerRef.current);

        const currentItem = enabledItems[currentIndex % enabledItems.length];
        const duration = (currentItem?.duration || 30) * 1000;

        timerRef.current = setTimeout(() => {
            setCurrentIndex(prev => (prev + 1) % enabledItems.length);
        }, duration);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [currentIndex, playlist]);

    if (isLoading) {
        return (
            <div style={styles.loading}>
                <div style={styles.loadingText}>Loading Signage...</div>
            </div>
        );
    }

    const enabledPlaylist = playlist.filter(item => item.enabled !== false);

    if (enabledPlaylist.length === 0) {
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

    const currentItem = enabledPlaylist[currentIndex % enabledPlaylist.length];

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

    return (
        <div style={containerStyle}>
            {currentItem.type === 'url' && (
                <iframe
                    key={currentItem.src + currentIndex}
                    src={currentItem.src}
                    style={styles.iframe}
                    title={`Signage content ${currentIndex}`}
                    frameBorder="0"
                    allow="autoplay; fullscreen"
                />
            )}

            {currentItem.type === 'video' && (
                <video
                    key={currentItem.src + currentIndex}
                    src={currentItem.src}
                    style={styles.video}
                    autoPlay
                    muted
                    playsInline
                    loop
                    onLoadedData={(e) => e.target.play().catch(() => {})}
                    onError={() => setCurrentIndex(prev => (prev + 1) % enabledPlaylist.length)}
                />
            )}

            {currentItem.type === 'image' && (
                <img
                    key={currentItem.src + currentIndex}
                    src={currentItem.src}
                    alt={currentItem.label || 'Signage'}
                    style={styles.image}
                />
            )}

            {currentItem.type === 'html' && (
                <div
                    key={currentIndex}
                    style={styles.htmlContent}
                    dangerouslySetInnerHTML={{ __html: currentItem.content }}
                />
            )}

            {/* Progress bar */}
            <div style={styles.progressContainer}>
                {enabledPlaylist.map((_, idx) => (
                    <div
                        key={idx}
                        style={{
                            ...styles.progressDot,
                            backgroundColor: idx === currentIndex % enabledPlaylist.length ? '#fd590d' : 'rgba(255,255,255,0.4)',
                        }}
                    />
                ))}
            </div>

            {/* Order Ready Overlay */}
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
                    zIndex: 100,
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
    },
    progressContainer: {
        position: 'absolute',
        bottom: '15px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        zIndex: 10,
    },
    progressDot: {
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        transition: 'background-color 0.3s ease',
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
};

export default SignagePlayer;
