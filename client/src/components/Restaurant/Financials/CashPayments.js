import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Select, Typography, message, Space, Button, InputNumber, Input, DatePicker, Popconfirm, Statistic, Card } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import moment from 'moment';
import protectedApi from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DATE_FMT = 'YYYY-MM-DD';

/**
 * Cash Payments (owner / accounts manager)
 *
 * Enter miscellaneous cash payments for a month as line items. The total feeds
 * the read-only "Cash Payment - Others" row on the Monthly Report.
 */
const CashPayments = () => {
    const { restaurantId } = useParams();

    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonthIdx, setSelectedMonthIdx] = useState(new Date().getMonth());
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const monthKey = `${selectedYear}-${String(selectedMonthIdx + 1).padStart(2, '0')}`;
    const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const load = useCallback(async (mKey) => {
        setLoading(true);
        try {
            const res = await protectedApi.get('/api/cash-payments', { params: { location: restaurantId, month: mKey } });
            setItems((res.data.items || []).map((it) => ({ ...it, key: it.id })));
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to load cash payments.');
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => { load(monthKey); }, [load, monthKey]);

    const addRow = () => {
        const id = `${monthKey}-${Date.now()}`;
        // Default date to the 1st of the selected month.
        const defaultDate = `${monthKey}-01`;
        setItems((prev) => [...prev, { id, key: id, date: defaultDate, description: '', amount: 0, note: '' }]);
    };

    const updateRow = (id, field, value) => {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
    };

    const removeRow = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            await protectedApi.put('/api/cash-payments', {
                location: restaurantId,
                month: monthKey,
                items: items.map(({ key, ...rest }) => rest),
            });
            message.success(`Saved ${MONTHS[selectedMonthIdx]} ${selectedYear}`);
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

    const columns = [
        {
            title: 'Date', dataIndex: 'date', key: 'date', width: 160,
            render: (v, r) => (
                <DatePicker
                    size="small"
                    style={{ width: 140 }}
                    format={DATE_FMT}
                    value={v ? moment(v) : null}
                    onChange={(d) => updateRow(r.id, 'date', d ? d.format(DATE_FMT) : '')}
                />
            ),
        },
        {
            title: 'Description', dataIndex: 'description', key: 'description',
            render: (v, r) => <Input size="small" value={v} placeholder="What was paid" onChange={(e) => updateRow(r.id, 'description', e.target.value)} />,
        },
        {
            title: 'Amount', dataIndex: 'amount', key: 'amount', width: 140, align: 'right',
            render: (v, r) => <InputNumber size="small" style={{ width: 120 }} min={0} value={v} onChange={(val) => updateRow(r.id, 'amount', val)} />,
        },
        {
            title: 'Note', dataIndex: 'note', key: 'note',
            render: (v, r) => <Input size="small" value={v} placeholder="Optional note" onChange={(e) => updateRow(r.id, 'note', e.target.value)} />,
        },
        {
            title: '', key: 'actions', width: 50, align: 'center',
            render: (_, r) => (
                <Popconfirm title="Remove this line?" onConfirm={() => removeRow(r.id)} okText="Yes" cancelText="No">
                    <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            ),
        },
    ];

    return (
        <div style={{ margin: '16px' }}>
            <Title level={3}>Cash Payments (Others)</Title>
            <Text type="secondary">
                Record miscellaneous cash payments for the month. The total feeds the read-only
                "Cash Payment - Others" row on the Monthly Report.
            </Text>

            <div style={{ margin: '16px 0' }}>
                <Space wrap>
                    <Text>Year:</Text>
                    <Select style={{ width: 100 }} value={selectedYear} onChange={setSelectedYear}>
                        {yearOptions.map((y) => <Option key={y} value={y}>{y}</Option>)}
                    </Select>
                    <Text>Month:</Text>
                    <Select style={{ width: 120 }} value={selectedMonthIdx} onChange={setSelectedMonthIdx}>
                        {MONTHS.map((m, i) => <Option key={m} value={i}>{m}</Option>)}
                    </Select>
                    <Button icon={<PlusOutlined />} onClick={addRow}>Add Line</Button>
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveAll}>Save All</Button>
                </Space>
            </div>

            <Card size="small" style={{ marginBottom: 16 }}>
                <Statistic title="Month Total (Cash Payment - Others)" value={money(total)} valueStyle={{ color: '#a8071a' }} />
            </Card>

            <Table
                rowKey="id"
                loading={loading}
                dataSource={items}
                columns={columns}
                size="small"
                bordered
                pagination={false}
            />
        </div>
    );
};

export default CashPayments;
