import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Row, Col, Typography, Button, Tag, Space, Empty, Spin, message, Switch, Table, Collapse } from 'antd';
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
    useKeepAlive({ audio: true }); // always-on kitchen display

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    // Item names that are newly arrived or increased in quantity since the last
    // refresh — highlighted so the chef notices them. Cleared a few seconds later.
    const [newItems, setNewItems] = useState(new Set());
    const timerRef = useRef(null);
    const prevQtyByItemRef = useRef(null); // { itemName: totalQty } from the previous fetch
    const highlightTimerRef = useRef(null);
    const isFirstLoadRef = useRef(true);

    const fetchPending = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/pendingOrders?location=${restaurantId}`);
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
    }, [restaurantId]);

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
        const byItem = {}; // name -> { qty, orders: [{ orderNumber, qty }] }
        orders.forEach((o) => {
            (o.items || []).forEach((it) => {
                const name = it.displayName || 'Unknown item';
                const q = Number(it.quantity) || 0;
                if (!byItem[name]) byItem[name] = { qty: 0, orders: [] };
                byItem[name].qty += q;
                byItem[name].orders.push({ orderNumber: o.orderNumber, qty: q });
            });
        });
        return Object.entries(byItem)
            .map(([name, info], i) => ({ key: `${name}-${i}`, name, qty: info.qty, orders: info.orders }))
            .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
    })();

    const prepColumns = [
        {
            title: 'Item',
            dataIndex: 'name',
            key: 'name',
            render: (name, record) => {
                const orderNums = (record.orders || [])
                    .slice()
                    .sort((a, b) => Number(a.orderNumber) - Number(b.orderNumber))
                    .map((o) => `#${o.orderNumber}${o.qty > 1 ? ` (${o.qty})` : ''}`)
                    .join(', ');
                return (
                    <span style={{ fontSize: 18 }}>
                        {name}
                        {orderNums && (
                            <Text type="secondary" style={{ fontSize: 14, marginLeft: 8 }}>
                                ({orderNums})
                            </Text>
                        )}
                    </span>
                );
            },
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
            defaultSortOrder: 'descend',
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
                <Title level={3} style={{ margin: 0 }}>Live Orders</Title>
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
                <>
                    {/* Primary view: what to cook, how many, and which orders. */}
                    <Card
                        title="Prep Summary — total quantity to prepare"
                        headStyle={{ background: '#fff7e6', fontWeight: 600, fontSize: 18 }}
                        style={{ marginBottom: 16 }}
                    >
                        <div style={{ marginBottom: 12, fontSize: 16 }}>
                            <Text strong>Pending orders: </Text>
                            <Text>
                                ({orders
                                    .map((o) => o.orderNumber)
                                    .sort((a, b) => Number(a) - Number(b))
                                    .map((n) => `#${n}`)
                                    .join(', ')})
                            </Text>
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

                    {/* Individual orders, collapsed by default for reference. */}
                    <Collapse>
                        <Collapse.Panel header={`Individual orders (${orders.length})`} key="orders">
                            <Row gutter={[12, 12]}>
                                {orders.map((order) => (
                                    <Col key={order.orderID || order.orderNumber} xs={24} sm={12} md={8} lg={6}>
                                        <Card
                                            size="small"
                                            title={<span>Order #{order.orderNumber}</span>}
                                            hoverable
                                        >
                                            {(order.items || []).map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        padding: '4px 0',
                                                        borderBottom: idx < order.items.length - 1 ? '1px solid #f0f0f0' : 'none',
                                                    }}
                                                >
                                                    <span>{item.displayName}</span>
                                                    <Tag color="orange" style={{ marginLeft: 8 }}>x{item.quantity}</Tag>
                                                </div>
                                            ))}
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </Collapse.Panel>
                    </Collapse>
                </>
            )}
        </div>
    );
};

export default LiveOrders;
