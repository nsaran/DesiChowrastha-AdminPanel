import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, Typography, Button, Tag, Space, Empty, Spin, message, Switch, Table } from 'antd';
import { ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons';
import API_BASE_URL from '../../../config/api';
import { useKeepAlive } from '../TvMenu/useKeepAlive';

const { Title, Text } = Typography;

// Auto-refresh interval for the live queue.
const REFRESH_MS = 30000;

/**
 * Live Orders (Chef's kitchen queue)
 *
 * Displays orders that currently have items still pending in the kitchen
 * (Toast fulfillment status "SENT"), pulled from GET /api/pendingOrders.
 *
 * The primary view is a PREP SUMMARY: the total quantity of each item across all
 * pending orders, so the chef can batch-prepare (e.g. "Irani Chai x 14"). Below
 * that, the individual orders are listed for reference.
 *
 * Display-only: auto-refreshes every 30s, with a manual Refresh button and an
 * optional auto-refresh toggle. Runs on always-on kitchen displays, so it uses
 * the keep-alive hook to stop the browser from suspending.
 */
const LiveOrders = () => {
    const { restaurantId } = useParams();
    const [searchParams] = useSearchParams();
    // Optional ?categories=Tandoor,Breads to show a different category view on
    // the same page. When absent, the server uses its default kitchen categories.
    const categoriesParam = (searchParams.get('categories') || '').trim();
    useKeepAlive({ audio: true }); // always-on kitchen display

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    // Item names that are newly arrived or increased in quantity since the last
    // refresh — highlighted so the chef notices them. Cleared a few seconds later.
    const [newItems, setNewItems] = useState(new Set());
    const [now, setNow] = useState(Date.now()); // live clock for wait-time ticking
    const timerRef = useRef(null);
    const prevQtyByItemRef = useRef(null); // { itemName: totalQty } from the previous fetch
    const highlightTimerRef = useRef(null);
    const isFirstLoadRef = useRef(true);

    // Tick every second so displayed wait times advance between server refreshes.
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // Minutes an order has been waiting, from its openedDate to now.
    const waitMinutes = (openedDate) => {
        if (!openedDate) return null;
        const ms = now - new Date(openedDate).getTime();
        if (Number.isNaN(ms) || ms < 0) return 0;
        return Math.floor(ms / 60000);
    };

    // Color-code the wait: green < 10 min, orange 10-20, red > 20.
    const waitColor = (mins) => {
        if (mins === null) return 'default';
        if (mins > 20) return 'red';
        if (mins >= 10) return 'orange';
        return 'green';
    };

    const formatWait = (mins) => {
        if (mins === null) return '';
        if (mins < 60) return `${mins}m`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    const fetchPending = useCallback(async () => {
        setLoading(true);
        try {
            const catQuery = categoriesParam ? `&categories=${encodeURIComponent(categoriesParam)}` : '';
            const res = await fetch(`${API_BASE_URL}/api/pendingOrders?location=${restaurantId}${catQuery}`);
            const data = await res.json();
            // The endpoint returns an array of pending orders, or a status string
            // when there are none — normalize to an array.
            const list = Array.isArray(data) ? data : [];

            // Compute current per-item totals so we can detect what's new/increased.
            const currentQty = {};
            list.forEach((o) => {
                (o.items || []).forEach((it) => {
                    const name = it.displayName || 'Unknown item';
                    currentQty[name] = (currentQty[name] || 0) + (Number(it.quantity) || 0);
                });
            });

            // On the first load we don't highlight anything (everything would be
            // "new"). On later loads, flag items that appeared or grew in quantity.
            if (!isFirstLoadRef.current && prevQtyByItemRef.current) {
                const prev = prevQtyByItemRef.current;
                const flagged = new Set();
                Object.keys(currentQty).forEach((name) => {
                    if (!(name in prev) || currentQty[name] > prev[name]) {
                        flagged.add(name);
                    }
                });
                if (flagged.size > 0) {
                    setNewItems(flagged);
                    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
                    // Keep the highlight visible long enough to be noticed, but
                    // clear it before the next refresh so it only marks fresh arrivals.
                    highlightTimerRef.current = setTimeout(() => setNewItems(new Set()), 15000);
                }
            }
            prevQtyByItemRef.current = currentQty;
            isFirstLoadRef.current = false;

            setOrders(list);
            setLastUpdated(new Date());
        } catch (err) {
            message.error('Failed to load pending orders.');
        } finally {
            setLoading(false);
        }
    }, [restaurantId, categoriesParam]);

    useEffect(() => {
        fetchPending();
    }, [fetchPending]);

    // Auto-refresh loop (toggleable).
    useEffect(() => {
        if (!autoRefresh) {
            if (timerRef.current) clearInterval(timerRef.current);
            return undefined;
        }
        timerRef.current = setInterval(fetchPending, REFRESH_MS);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [autoRefresh, fetchPending]);

    // Clean up the highlight timer on unmount.
    useEffect(() => () => {
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    }, []);

    // Total item count across all pending orders (quantity-aware).
    const totalItems = orders.reduce(
        (sum, o) => sum + (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
        0
    );

    // Prep summary: total quantity of EACH item across all pending orders, so the
    // chef can batch-prepare (e.g. "Irani Chai x 14"). Sorted by highest quantity.
    const prepSummary = (() => {
        // Group by item name + its modifiers (spice level, add-ons, etc.), so
        // "Chicken 65 (Medium)" and "Chicken 65 (Spicy)" are counted separately —
        // the chef prepares them differently.
        const byVariant = {}; // key -> { name, modifiers, qty, earliest, orders: [...] }
        orders.forEach((o) => {
            (o.items || []).forEach((it) => {
                const name = it.displayName || 'Unknown item';
                const modifiers = Array.isArray(it.modifiers) ? it.modifiers : [];
                const variantKey = `${name}||${modifiers.join(',')}`;
                const q = Number(it.quantity) || 0;
                if (!byVariant[variantKey]) {
                    byVariant[variantKey] = { name, modifiers, qty: 0, orders: [], earliest: Infinity };
                }
                byVariant[variantKey].qty += q;
                byVariant[variantKey].orders.push({ orderNumber: o.orderNumber, qty: q, openedDate: o.openedDate });
                const t = o.openedDate ? new Date(o.openedDate).getTime() : Infinity;
                if (t < byVariant[variantKey].earliest) byVariant[variantKey].earliest = t;
            });
        });
        return Object.entries(byVariant)
            .map(([variantKey, info], i) => ({
                key: `${variantKey}-${i}`,
                name: info.name,
                modifiers: info.modifiers,
                qty: info.qty,
                earliest: info.earliest,
                // Each variant's contributing orders, sorted by arrival (oldest first).
                orders: info.orders.slice().sort((a, b) => {
                    const ta = a.openedDate ? new Date(a.openedDate).getTime() : Infinity;
                    const tb = b.openedDate ? new Date(b.openedDate).getTime() : Infinity;
                    return ta - tb;
                }),
            }))
            // Order the whole list by arrival: the item whose oldest ticket is
            // waiting longest comes first, so the chef works oldest-first.
            .sort((a, b) => a.earliest - b.earliest || b.qty - a.qty || a.name.localeCompare(b.name));
    })();

    const prepColumns = [
        {
            title: 'Item (oldest first)',
            dataIndex: 'name',
            key: 'name',
            render: (name, record) => (
                <div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{name}</div>
                    {record.modifiers && record.modifiers.length > 0 && (
                        <div style={{ marginTop: 2 }}>
                            {record.modifiers.map((m, i) => (
                                <Tag key={i} color="purple" style={{ marginBottom: 2 }}>{m}</Tag>
                            ))}
                        </div>
                    )}
                    <Space size={[4, 4]} wrap style={{ marginTop: 4 }}>
                        {(record.orders || []).map((o, i) => {
                            const mins = waitMinutes(o.openedDate);
                            return (
                                <Tag key={i} color={waitColor(mins)}>
                                    #{o.orderNumber}{o.qty > 1 ? ` x${o.qty}` : ''}
                                    {mins !== null ? ` · ${formatWait(mins)}` : ''}
                                </Tag>
                            );
                        })}
                    </Space>
                </div>
            ),
        },
        {
            title: 'Qty to Prepare',
            dataIndex: 'qty',
            key: 'qty',
            width: 160,
            align: 'right',
            render: (q) => (
                <Tag color="orange" style={{ fontSize: 20, padding: '4px 14px', fontWeight: 700 }}>{q}</Tag>
            ),
            sorter: (a, b) => a.qty - b.qty,
        },
    ];

    return (
        <div style={{ margin: 16 }}>
            <style>{`
                .live-orders-new-row > td {
                    background-color: #e6fffb !important;
                    animation: liveOrdersFlash 1s ease-in-out 2;
                }
                @keyframes liveOrdersFlash {
                    0%, 100% { background-color: #e6fffb; }
                    50% { background-color: #b5f5ec; }
                }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <Title level={3} style={{ margin: 0 }}>
                    Live Orders{categoriesParam ? ` — ${categoriesParam}` : ''}
                </Title>
                <Tag color="blue">{orders.length} order{orders.length === 1 ? '' : 's'}</Tag>
                <Tag color="geekblue">{totalItems} item{totalItems === 1 ? '' : 's'}</Tag>
                <Space>
                    <Text type="secondary">Auto-refresh</Text>
                    <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
                </Space>
                <Button icon={<ReloadOutlined />} onClick={fetchPending} loading={loading}>Refresh</Button>
                {lastUpdated && (
                    <Text type="secondary">
                        <ClockCircleOutlined /> Updated {lastUpdated.toLocaleTimeString()}
                    </Text>
                )}
                {newItems.size > 0 && (
                    <Tag color="cyan">{newItems.size} newly arrived / increased</Tag>
                )}
            </div>

            {loading && orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
            ) : orders.length === 0 ? (
                <Empty description="No pending orders right now." />
            ) : (
                    /* What to cook, how many, and which orders. */
                    <Card
                        title="Prep Summary — total quantity to prepare"
                        headStyle={{ background: '#fff7e6', fontWeight: 600, fontSize: 18 }}
                        style={{ marginBottom: 16 }}
                    >
                        <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ marginRight: 8 }}>Pending orders (oldest first):</Text>
                            <Space size={[4, 4]} wrap>
                                {orders
                                    .slice()
                                    .sort((a, b) => {
                                        const ta = a.openedDate ? new Date(a.openedDate).getTime() : Infinity;
                                        const tb = b.openedDate ? new Date(b.openedDate).getTime() : Infinity;
                                        return ta - tb;
                                    })
                                    .map((o) => {
                                        const mins = waitMinutes(o.openedDate);
                                        return (
                                            <Tag key={o.orderID || o.orderNumber} color={waitColor(mins)}>
                                                #{o.orderNumber}{mins !== null ? ` · ${formatWait(mins)}` : ''}
                                            </Tag>
                                        );
                                    })}
                            </Space>
                        </div>
                        <Table
                            dataSource={prepSummary}
                            columns={prepColumns}
                            pagination={false}
                            size="middle"
                            rowKey="key"
                            rowClassName={(record) => (newItems.has(record.name) ? 'live-orders-new-row' : '')}
                        />
                    </Card>
            )}
        </div>
    );
};

export default LiveOrders;
