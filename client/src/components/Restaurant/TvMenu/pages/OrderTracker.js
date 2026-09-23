import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import API_BASE_URL from '../../../../config/api';
import { useKeepAlive } from '../useKeepAlive';
import './OrderTracker.css';

/**
 * Order Tracker — Domino's-style lobby board.
 *
 * Shows every currently-active order with a staged progress tracker:
 *   Received → Preparing → Ready
 *
 * Data flow (webhook-driven):
 *  - Initial load: GET /api/activeOrders?location=..
 *  - Live updates: SSE /api/orders/stream pushes { type: 'board_update', ... }
 *    whenever a Toast order webhook fires. We update just that order in place.
 *  - Polling fallback: if SSE errors, poll /api/activeOrders every 30s.
 *
 * Always-on lobby display, so it uses the keep-alive hook.
 */

const STAGES = [
    { key: 'received', label: 'Order Received', icon: '🧾' },
    { key: 'preparing', label: 'Preparing', icon: '👨‍🍳' },
    { key: 'ready', label: 'Ready for Pickup', icon: '✅' },
];
const STAGE_INDEX = { received: 0, preparing: 1, ready: 2 };

const OrderTracker = () => {
    const { restaurantId } = useParams();
    useKeepAlive({ audio: true, reloadMinutes: 30 });

    const [orders, setOrders] = useState([]);
    const [connected, setConnected] = useState(false);
    const pollRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/activeOrders?location=${restaurantId}`);
            const data = await res.json();
            if (Array.isArray(data)) setOrders(data);
        } catch (e) {
            /* ignore; SSE or next poll will recover */
        }
    }, [restaurantId]);

    // Initial load.
    useEffect(() => { load(); }, [load]);

    // Live updates via SSE, with a polling fallback.
    useEffect(() => {
        const base = API_BASE_URL || window.location.origin;
        const loc = (restaurantId || '').toUpperCase();
        let es = null;

        const startPolling = () => {
            if (pollRef.current) return;
            pollRef.current = setInterval(load, 30000);
        };
        const stopPolling = () => {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        };

        try {
            es = new EventSource(`${base}/api/orders/stream?location=${loc}`);
            es.onopen = () => { setConnected(true); stopPolling(); };
            es.onmessage = (event) => {
                let msg;
                try { msg = JSON.parse(event.data); } catch (e) { return; }
                if (msg.type !== 'board_update') return;

                setOrders((prev) => {
                    // Remove when the order left the board (picked up / voided).
                    if (msg.removed) {
                        return prev.filter((o) => o.orderGuid !== msg.orderGuid);
                    }
                    const entry = {
                        orderGuid: msg.orderGuid,
                        orderNumber: msg.orderNumber,
                        stage: msg.stage,
                        openedDate: msg.openedDate,
                    };
                    const idx = prev.findIndex((o) => o.orderGuid === msg.orderGuid);
                    let next;
                    if (idx >= 0) {
                        next = prev.slice();
                        next[idx] = { ...next[idx], ...entry };
                    } else {
                        next = [...prev, entry];
                    }
                    // Keep oldest-first ordering.
                    next.sort((a, b) => {
                        const ta = a.openedDate ? new Date(a.openedDate).getTime() : Infinity;
                        const tb = b.openedDate ? new Date(b.openedDate).getTime() : Infinity;
                        return ta - tb;
                    });
                    return next;
                });
            };
            es.onerror = () => {
                setConnected(false);
                startPolling();
            };
        } catch (e) {
            startPolling();
        }

        return () => {
            if (es) es.close();
            stopPolling();
        };
    }, [restaurantId, load]);

    return (
        <div className="ot-wrap">
            <header className="ot-header">
                <h1>Order Status</h1>
                <span className={`ot-live ${connected ? 'on' : ''}`}>
                    <span className="ot-dot" /> {connected ? 'Live' : 'Updating…'}
                </span>
            </header>

            {orders.length === 0 ? (
                <div className="ot-empty">No active orders right now.</div>
            ) : (
                <div className="ot-grid">
                    {orders.map((o) => {
                        const active = STAGE_INDEX[o.stage] ?? 0;
                        return (
                            <div className={`ot-card stage-${o.stage}`} key={o.orderGuid || o.orderNumber}>
                                <div className="ot-num">#{o.orderNumber}</div>
                                <div className="ot-track">
                                    {STAGES.map((s, i) => {
                                        const state = i < active ? 'done' : i === active ? 'current' : 'todo';
                                        return (
                                            <div className={`ot-step ${state}`} key={s.key}>
                                                <div className="ot-step-icon">{s.icon}</div>
                                                <div className="ot-step-label">{s.label}</div>
                                                {i < STAGES.length - 1 && <div className="ot-connector" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default OrderTracker;
