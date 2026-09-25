import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    Table, Select, Typography, message, Space, Empty, Button, Card, Tabs, Tag,
    Input, InputNumber, Modal, Statistic, Row, Col, AutoComplete,
} from 'antd';
import { ReloadOutlined, EditOutlined, CheckCircleOutlined, LineChartOutlined } from '@ant-design/icons';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import protectedApi from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * Receipt Transactions — view & analyze AI-scanned supplier receipts.
 *  - Transactions tab: filter by month / vendor / item; expandable line items;
 *    inline review/edit; mark reviewed.
 *  - Price Analytics tab: pick an item to chart its unit-price fluctuation over
 *    time, with min/max/avg and overall % change.
 */
const ReceiptTransactions = () => {
    const { restaurantId } = useParams();

    const [tab, setTab] = useState('transactions');
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);

    // Filter option lists.
    const [vendors, setVendors] = useState([]);
    const [items, setItems] = useState([]);
    const [months, setMonths] = useState([]);

    // Active filters.
    const [month, setMonth] = useState(null);
    const [vendor, setVendor] = useState(null);
    const [itemFilter, setItemFilter] = useState('');

    // Edit modal.
    const [editing, setEditing] = useState(null); // the transaction being edited

    // Price analytics.
    const [priceItem, setPriceItem] = useState(null);
    const [priceData, setPriceData] = useState(null);
    const [priceLoading, setPriceLoading] = useState(false);

    const money = (n) => (n === null || n === undefined || n === '' ? '—'
        : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

    const loadFilters = useCallback(async () => {
        try {
            const res = await protectedApi.get('/api/receipt-transactions/filters', { params: { location: restaurantId } });
            setVendors(res.data.vendors || []);
            setItems(res.data.items || []);
            setMonths(res.data.months || []);
        } catch (err) {
            /* non-fatal */
        }
    }, [restaurantId]);

    const loadTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const params = { location: restaurantId };
            if (month) params.month = month;
            if (vendor) params.vendor = vendor;
            if (itemFilter) params.item = itemFilter;
            const res = await protectedApi.get('/api/receipt-transactions', { params });
            setRows(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to load receipt transactions.');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [restaurantId, month, vendor, itemFilter]);

    useEffect(() => { loadFilters(); }, [loadFilters]);
    useEffect(() => { loadTransactions(); }, [loadTransactions]);

    // ---- Price analytics ----
    const loadPriceHistory = useCallback(async (item) => {
        if (!item) { setPriceData(null); return; }
        setPriceLoading(true);
        try {
            const res = await protectedApi.get('/api/receipt-transactions/item-price-history', {
                params: { location: restaurantId, item },
            });
            setPriceData(res.data);
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to load price history.');
            setPriceData(null);
        } finally {
            setPriceLoading(false);
        }
    }, [restaurantId]);

    const onPickPriceItem = (val) => {
        setPriceItem(val);
        loadPriceHistory(val);
    };

    // ---- Edit / review ----
    const openEdit = (record) => {
        setEditing(JSON.parse(JSON.stringify(record))); // deep copy for local edits
    };
    const saveEdit = async () => {
        try {
            await protectedApi.put(`/api/receipt-transactions/${editing.id}`, {
                location: restaurantId,
                vendor: editing.vendor,
                date: editing.date,
                subtotal: editing.subtotal,
                tax: editing.tax,
                total: editing.total,
                paymentMethod: editing.paymentMethod,
                lineItems: editing.lineItems,
                status: editing.status || 'reviewed',
            });
            message.success('Transaction saved.');
            setEditing(null);
            loadTransactions();
            loadFilters();
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to save.');
        }
    };
    const markReviewed = async (record) => {
        try {
            await protectedApi.put(`/api/receipt-transactions/${record.id}`, { location: restaurantId, status: 'reviewed' });
            message.success(`#${record.vendor || 'Receipt'} marked reviewed.`);
            loadTransactions();
        } catch (err) {
            message.error('Failed to update status.');
        }
    };

    const columns = [
        { title: 'Date', dataIndex: 'normDate', key: 'date', width: 110, render: (d) => d || '—' },
        { title: 'Vendor', dataIndex: 'vendor', key: 'vendor', render: (v) => v || <Text type="secondary">Unknown</Text> },
        { title: 'Items', key: 'items', width: 80, align: 'right', render: (_, r) => (r.lineItems || []).length },
        { title: 'Subtotal', dataIndex: 'subtotal', key: 'subtotal', width: 110, align: 'right', render: money },
        { title: 'Tax', dataIndex: 'tax', key: 'tax', width: 90, align: 'right', render: money },
        { title: 'Total', dataIndex: 'total', key: 'total', width: 120, align: 'right', render: (v) => <strong>{money(v)}</strong> },
        {
            title: 'Status', dataIndex: 'status', key: 'status', width: 110,
            render: (s, r) => {
                if (r.parseError) return <Tag color="red">Scan issue</Tag>;
                return s === 'reviewed'
                    ? <Tag color="green">Reviewed</Tag>
                    : <Tag color="gold">Scanned</Tag>;
            },
        },
        {
            title: 'Actions', key: 'actions', width: 150,
            render: (_, r) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
                    {r.status !== 'reviewed' && (
                        <Button size="small" type="link" icon={<CheckCircleOutlined />} onClick={() => markReviewed(r)}>Review</Button>
                    )}
                </Space>
            ),
        },
    ];

    const expandedRow = (record) => {
        const li = record.lineItems || [];
        if (li.length === 0) return <Text type="secondary">No line items extracted.</Text>;
        return (
            <Table
                size="small"
                pagination={false}
                rowKey={(_, i) => i}
                dataSource={li}
                columns={[
                    { title: 'Description', dataIndex: 'description', key: 'd' },
                    { title: 'Qty', dataIndex: 'quantity', key: 'q', width: 80, align: 'right', render: (v) => v ?? '—' },
                    { title: 'Unit Price', dataIndex: 'unitPrice', key: 'u', width: 110, align: 'right', render: money },
                    { title: 'Amount', dataIndex: 'amount', key: 'a', width: 110, align: 'right', render: money },
                ]}
            />
        );
    };

    // Summary stats for the current filtered set.
    const totalSpend = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);

    const priceChart = priceData && priceData.points && priceData.points.length > 0 ? {
        chart: { type: 'line', zoomType: 'x' },
        title: { text: `Unit price over time — ${priceData.item}` },
        xAxis: { categories: priceData.points.map((p) => p.date || ''), title: { text: 'Date' } },
        yAxis: { title: { text: 'Unit Price ($)' }, labels: { format: '${value:,.2f}' } },
        tooltip: {
            formatter: function () {
                const p = priceData.points[this.point.index] || {};
                return `<b>${this.y.toFixed(2)}</b><br/>${p.date || ''}${p.vendor ? '<br/>' + p.vendor : ''}`;
            },
        },
        credits: { enabled: false },
        legend: { enabled: false },
        series: [{ name: 'Unit Price', color: '#fd590d', data: priceData.points.map((p) => p.unitPrice) }],
    } : null;

    return (
        <div style={{ margin: '16px' }}>
            <Title level={3}>Receipt Transactions</Title>
            <Text type="secondary">
                AI-scanned supplier receipts. View by month, vendor or item, review the extracted
                data, and track item price fluctuation over time.
            </Text>

            <Tabs
                activeKey={tab}
                onChange={setTab}
                style={{ marginTop: 12 }}
                items={[
                    {
                        key: 'transactions',
                        label: 'Transactions',
                        children: (
                            <>
                                <div style={{ margin: '8px 0 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Space>
                                        <Text>Month:</Text>
                                        <Select allowClear style={{ width: 130 }} placeholder="All" value={month} onChange={setMonth}>
                                            {months.map((m) => <Option key={m} value={m}>{m}</Option>)}
                                        </Select>
                                    </Space>
                                    <Space>
                                        <Text>Vendor:</Text>
                                        <Select allowClear showSearch style={{ width: 200 }} placeholder="All vendors" value={vendor} onChange={setVendor}>
                                            {vendors.map((v) => <Option key={v} value={v}>{v}</Option>)}
                                        </Select>
                                    </Space>
                                    <Space>
                                        <Text>Item:</Text>
                                        <AutoComplete
                                            allowClear
                                            style={{ width: 220 }}
                                            placeholder="Contains…"
                                            value={itemFilter}
                                            onChange={setItemFilter}
                                            options={items.map((i) => ({ value: i }))}
                                            filterOption={(input, opt) => (opt?.value || '').toLowerCase().includes(input.toLowerCase())}
                                        />
                                    </Space>
                                    <Button icon={<ReloadOutlined />} onClick={loadTransactions} loading={loading}>Refresh</Button>
                                </div>

                                <Row gutter={16} style={{ marginBottom: 16 }}>
                                    <Col><Card size="small"><Statistic title="Receipts" value={rows.length} /></Card></Col>
                                    <Col><Card size="small"><Statistic title="Total Spend" value={totalSpend} precision={2} prefix="$" /></Card></Col>
                                </Row>

                                {rows.length === 0 && !loading ? (
                                    <Empty description="No receipt transactions match these filters." />
                                ) : (
                                    <Table
                                        size="small"
                                        bordered
                                        rowKey="id"
                                        loading={loading}
                                        dataSource={rows}
                                        columns={columns}
                                        expandable={{ expandedRowRender: expandedRow }}
                                        pagination={{ pageSize: 25 }}
                                        scroll={{ x: 'max-content' }}
                                    />
                                )}
                            </>
                        ),
                    },
                    {
                        key: 'analytics',
                        label: <span><LineChartOutlined /> Price Analytics</span>,
                        children: (
                            <>
                                <div style={{ margin: '8px 0 16px' }}>
                                    <Space>
                                        <Text>Item:</Text>
                                        <Select
                                            showSearch
                                            style={{ width: 320 }}
                                            placeholder="Select an item to see price history"
                                            value={priceItem}
                                            onChange={onPickPriceItem}
                                            filterOption={(input, opt) => (opt?.children || '').toLowerCase().includes(input.toLowerCase())}
                                        >
                                            {items.map((i) => <Option key={i} value={i}>{i}</Option>)}
                                        </Select>
                                    </Space>
                                </div>

                                {!priceItem ? (
                                    <Empty description="Pick an item to chart its unit-price fluctuation over time." />
                                ) : priceLoading ? (
                                    <Card loading />
                                ) : priceData && priceData.stats && priceData.stats.count > 0 ? (
                                    <>
                                        <Row gutter={16} style={{ marginBottom: 16 }}>
                                            <Col><Card size="small"><Statistic title="Data points" value={priceData.stats.count} /></Card></Col>
                                            <Col><Card size="small"><Statistic title="Min" value={priceData.stats.min} precision={2} prefix="$" /></Card></Col>
                                            <Col><Card size="small"><Statistic title="Max" value={priceData.stats.max} precision={2} prefix="$" /></Card></Col>
                                            <Col><Card size="small"><Statistic title="Average" value={priceData.stats.avg} precision={2} prefix="$" /></Card></Col>
                                            <Col>
                                                <Card size="small">
                                                    <Statistic
                                                        title="Change (first → last)"
                                                        value={priceData.stats.changePct}
                                                        precision={2}
                                                        suffix="%"
                                                        valueStyle={{ color: priceData.stats.changePct > 0 ? '#a8071a' : priceData.stats.changePct < 0 ? '#237804' : undefined }}
                                                    />
                                                </Card>
                                            </Col>
                                        </Row>
                                        <Card size="small">
                                            <HighchartsReact highcharts={Highcharts} options={priceChart} />
                                        </Card>
                                    </>
                                ) : (
                                    <Empty description="No priced occurrences of this item yet." />
                                )}
                            </>
                        ),
                    },
                ]}
            />

            {/* Edit / review modal */}
            <Modal
                title="Review Receipt Transaction"
                open={!!editing}
                onCancel={() => setEditing(null)}
                onOk={saveEdit}
                okText="Save"
                width={720}
            >
                {editing && (
                    <div>
                        <Row gutter={12}>
                            <Col span={12}>
                                <Text type="secondary">Vendor</Text>
                                <Input value={editing.vendor || ''} onChange={(e) => setEditing({ ...editing, vendor: e.target.value })} />
                            </Col>
                            <Col span={12}>
                                <Text type="secondary">Date (YYYY-MM-DD)</Text>
                                <Input value={editing.date || ''} onChange={(e) => setEditing({ ...editing, date: e.target.value })} placeholder="2026-09-20" />
                            </Col>
                        </Row>
                        <Row gutter={12} style={{ marginTop: 10 }}>
                            <Col span={8}>
                                <Text type="secondary">Subtotal</Text>
                                <InputNumber style={{ width: '100%' }} value={editing.subtotal} onChange={(v) => setEditing({ ...editing, subtotal: v })} />
                            </Col>
                            <Col span={8}>
                                <Text type="secondary">Tax</Text>
                                <InputNumber style={{ width: '100%' }} value={editing.tax} onChange={(v) => setEditing({ ...editing, tax: v })} />
                            </Col>
                            <Col span={8}>
                                <Text type="secondary">Total</Text>
                                <InputNumber style={{ width: '100%' }} value={editing.total} onChange={(v) => setEditing({ ...editing, total: v })} />
                            </Col>
                        </Row>

                        <div style={{ marginTop: 16, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong>Line items</Text>
                            <Button size="small" onClick={() => setEditing({ ...editing, lineItems: [...(editing.lineItems || []), { description: '', quantity: null, unitPrice: null, amount: null }] })}>
                                + Add item
                            </Button>
                        </div>
                        <Table
                            size="small"
                            pagination={false}
                            rowKey={(_, i) => i}
                            dataSource={editing.lineItems || []}
                            columns={[
                                {
                                    title: 'Description', dataIndex: 'description',
                                    render: (v, _, i) => (
                                        <Input value={v} onChange={(e) => {
                                            const li = [...editing.lineItems]; li[i] = { ...li[i], description: e.target.value }; setEditing({ ...editing, lineItems: li });
                                        }} />
                                    ),
                                },
                                {
                                    title: 'Qty', dataIndex: 'quantity', width: 80,
                                    render: (v, _, i) => (
                                        <InputNumber style={{ width: '100%' }} value={v} onChange={(val) => {
                                            const li = [...editing.lineItems]; li[i] = { ...li[i], quantity: val }; setEditing({ ...editing, lineItems: li });
                                        }} />
                                    ),
                                },
                                {
                                    title: 'Unit', dataIndex: 'unitPrice', width: 100,
                                    render: (v, _, i) => (
                                        <InputNumber style={{ width: '100%' }} value={v} onChange={(val) => {
                                            const li = [...editing.lineItems]; li[i] = { ...li[i], unitPrice: val }; setEditing({ ...editing, lineItems: li });
                                        }} />
                                    ),
                                },
                                {
                                    title: 'Amount', dataIndex: 'amount', width: 100,
                                    render: (v, _, i) => (
                                        <InputNumber style={{ width: '100%' }} value={v} onChange={(val) => {
                                            const li = [...editing.lineItems]; li[i] = { ...li[i], amount: val }; setEditing({ ...editing, lineItems: li });
                                        }} />
                                    ),
                                },
                                {
                                    title: '', width: 40,
                                    render: (_, __, i) => (
                                        <Button size="small" danger type="text" onClick={() => {
                                            const li = [...editing.lineItems]; li.splice(i, 1); setEditing({ ...editing, lineItems: li });
                                        }}>✕</Button>
                                    ),
                                },
                            ]}
                        />
                        {editing.imageUrl && (
                            <div style={{ marginTop: 12 }}>
                                <a href={editing.imageUrl} target="_blank" rel="noopener noreferrer">View original receipt image</a>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ReceiptTransactions;
