import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, Button, Table, Select, Typography, message, Card, Row, Col, Statistic, Tag, Space, InputNumber, Input, Alert } from 'antd';
import { UploadOutlined, ReloadOutlined, CheckOutlined } from '@ant-design/icons';
import protectedApi from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * Bank Transactions (owner-only)
 *
 * Upload a Bank of America statement CSV, have the server parse + categorize it,
 * then review/re-categorize in a table and see per-category totals.
 */
const BankTransactions = () => {
    const { restaurantId } = useParams();

    const currentYear = new Date().getFullYear();
    // Selectable years: current year plus the previous two (dynamic — advances
    // automatically each calendar year, and future years are supported).
    const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

    const [categories, setCategories] = useState([]);
    const [months, setMonths] = useState([]);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Load category list once.
    useEffect(() => {
        protectedApi.get('/api/bank-transactions/categories')
            .then((res) => setCategories(res.data.categories || []))
            .catch(() => setCategories([]));
    }, []);

    const loadMonths = useCallback(async () => {
        try {
            const res = await protectedApi.get('/api/bank-transactions/months', { params: { location: restaurantId } });
            setMonths(res.data.months || []);
            return res.data.months || [];
        } catch (err) {
            return [];
        }
    }, [restaurantId]);

    const loadMonth = useCallback(async (month) => {
        if (!month) return;
        setLoading(true);
        try {
            const res = await protectedApi.get('/api/bank-transactions', { params: { location: restaurantId, month } });
            setTransactions(res.data.transactions || []);
            setSummary(res.data.summary || []);
            setSelectedMonth(month);
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to load transactions.');
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    // Months (YYYY-MM) available for the selected year, most recent first.
    const monthsForYear = months.filter((m) => m.startsWith(`${selectedYear}-`));

    // On load: fetch all month keys, then auto-open the most recent month of the
    // default (current) year, if any exist.
    useEffect(() => {
        loadMonths().then((ms) => {
            const forYear = ms.filter((m) => m.startsWith(`${currentYear}-`));
            if (forYear.length > 0) loadMonth(forYear[0]);
        });
    }, [loadMonths, loadMonth, currentYear]);

    // When the user picks a different year, open its most recent month (or clear).
    const handleYearChange = (year) => {
        setSelectedYear(year);
        const forYear = months.filter((m) => m.startsWith(`${year}-`));
        if (forYear.length > 0) {
            loadMonth(forYear[0]);
        } else {
            setSelectedMonth(null);
            setTransactions([]);
            setSummary([]);
        }
    };

    const handleUpload = async (file) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('location', restaurantId);
            const res = await protectedApi.post('/api/bank-transactions/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            message.success(`Imported ${res.data.count} transactions for ${res.data.month}`);
            setTransactions(res.data.transactions || []);
            setSummary(res.data.summary || []);
            setSelectedMonth(res.data.month);
            await loadMonths();
        } catch (err) {
            message.error(err.response?.data?.error || 'Import failed.');
        } finally {
            setUploading(false);
        }
        return false; // prevent AntD auto-upload
    };

    const handleCategoryChange = async (record, category) => {
        try {
            const res = await protectedApi.put(`/api/bank-transactions/${selectedMonth}/category`, {
                location: restaurantId,
                transactionId: record.id,
                category,
            });
            setTransactions((prev) => prev.map((t) => (t.id === record.id ? { ...t, category, categorySource: 'manual' } : t)));
            setSummary(res.data.summary || []);
            message.success('Category updated');
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to update category.');
        }
    };

    // Persist an editable field (adjustAmount / comments) for a single transaction.
    const handleFieldSave = async (record, field, value) => {
        // Optimistically update local state.
        setTransactions((prev) => prev.map((t) => (t.id === record.id ? { ...t, [field]: value } : t)));
        try {
            const res = await protectedApi.put(`/api/bank-transactions/${selectedMonth}/field`, {
                location: restaurantId,
                transactionId: record.id,
                field,
                value,
            });
            if (res.data.summary) setSummary(res.data.summary);
            message.success('Saved');
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to save.');
        }
    };

    // The "adjusted" value drives Income/Expense; falls back to the parsed amount.
    // Numeric adjusted value used for Income/Expense/summary math.
    const adjustedOf = (t) => (t.adjustAmount !== undefined && t.adjustAmount !== null && t.adjustAmount !== '' ? Number(t.adjustAmount) : Number(t.amount) || 0);
    // Value shown in the editable Adjusted Amount input: blank for standard rows
    // that have no parsed amount and no manual value yet.
    const adjustedInputValue = (t) => {
        if (t.adjustAmount !== undefined && t.adjustAmount !== null && t.adjustAmount !== '') return Number(t.adjustAmount);
        if (t.categorySource === 'standard' && (!t.amount || Number(t.amount) === 0)) return undefined;
        return Number(t.amount) || 0;
    };

    const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const sourceTag = (src) => {
        const map = { rule: ['blue', 'Rule'], llm: ['purple', 'AI'], manual: ['green', 'Manual'], standard: ['gold', 'Standard'], none: ['default', '—'] };
        const [color, label] = map[src] || ['default', src || '—'];
        return <Tag color={color}>{label}</Tag>;
    };

    const columns = [
        { title: 'Date', dataIndex: 'date', key: 'date', width: 110, sorter: (a, b) => (a.date || '').localeCompare(b.date || '') },
        { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
        {
            title: 'Category', dataIndex: 'category', key: 'category', width: 230,
            filters: categories.map((c) => ({ text: c, value: c })),
            onFilter: (val, rec) => rec.category === val,
            render: (val, record) => (
                <Select
                    value={val}
                    style={{ width: 210 }}
                    size="small"
                    onChange={(c) => handleCategoryChange(record, c)}
                >
                    {categories.map((c) => <Option key={c} value={c}>{c}</Option>)}
                </Select>
            ),
        },
        {
            title: 'Adjusted Amount', key: 'adjustAmount', width: 190, align: 'right',
            sorter: (a, b) => adjustedOf(a) - adjustedOf(b),
            render: (_, record) => (
                <Space size={4}>
                    <InputNumber
                        size="small"
                        style={{ width: 120 }}
                        placeholder="Enter"
                        value={adjustedInputValue(record)}
                        onChange={(val) => setTransactions((prev) => prev.map((t) => (t.id === record.id ? { ...t, adjustAmount: val } : t)))}
                        onPressEnter={() => handleFieldSave(record, 'adjustAmount', adjustedOf(record))}
                    />
                    <Button
                        size="small"
                        type="primary"
                        icon={<CheckOutlined />}
                        title="Save adjusted amount"
                        onClick={() => handleFieldSave(record, 'adjustAmount', adjustedOf(record))}
                    />
                </Space>
            ),
        },
        {
            title: 'Actual Amount', dataIndex: 'amount', key: 'amount', width: 130, align: 'right',
            sorter: (a, b) => a.amount - b.amount,
            render: (v) => <span style={{ color: v >= 0 ? '#237804' : '#a8071a' }}>{money(v)}</span>,
        },
        {
            title: 'Income Amount', key: 'incomeAmount', width: 130, align: 'right',
            render: (_, record) => {
                const v = adjustedOf(record);
                return v > 0 ? <span style={{ color: '#237804' }}>{money(v)}</span> : '';
            },
        },
        {
            title: 'Expense Amount', key: 'expenseAmount', width: 130, align: 'right',
            render: (_, record) => {
                const v = adjustedOf(record);
                return v < 0 ? <span style={{ color: '#a8071a' }}>{money(v)}</span> : '';
            },
        },
        {
            title: 'Comments', key: 'comments', width: 200,
            render: (_, record) => (
                <Input
                    size="small"
                    defaultValue={record.comments || ''}
                    placeholder="Add note"
                    onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== (record.comments || '')) handleFieldSave(record, 'comments', val);
                    }}
                />
            ),
        },
        { title: 'Source', dataIndex: 'categorySource', key: 'categorySource', width: 90, align: 'center', render: sourceTag },
    ];

    const totalCredits = summary.reduce((s, r) => s + (r.credits || 0), 0);
    const totalDebits = summary.reduce((s, r) => s + (r.debits || 0), 0);
    const uncategorizedCount = transactions.filter((t) => t.category === 'Uncategorized').length;

    return (
        <div style={{ margin: '16px' }}>
            <style>{`
                .bank-txn-uncategorized > td { background-color: #fff1f0 !important; }
                .bank-txn-uncategorized:hover > td { background-color: #ffe7e3 !important; }
            `}</style>
            <Title level={3}>Monthly Report</Title>
            <Text type="secondary">
                Upload a Bank of America statement CSV. Transactions are parsed and categorized automatically;
                adjust any category below.
            </Text>

            <div style={{ margin: '16px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Upload accept=".csv" showUploadList={false} beforeUpload={handleUpload}>
                    <Button type="primary" icon={<UploadOutlined />} loading={uploading}>Upload BofA CSV</Button>
                </Upload>

                <Space>
                    <Text>Year:</Text>
                    <Select
                        style={{ width: 100 }}
                        value={selectedYear}
                        onChange={handleYearChange}
                    >
                        {yearOptions.map((y) => <Option key={y} value={y}>{y}</Option>)}
                    </Select>
                    <Text>Month:</Text>
                    <Select
                        style={{ width: 160 }}
                        value={selectedMonth}
                        placeholder="Select month"
                        onChange={loadMonth}
                        notFoundContent="No data for this year"
                    >
                        {monthsForYear.map((m) => <Option key={m} value={m}>{m}</Option>)}
                    </Select>
                    <Button icon={<ReloadOutlined />} onClick={() => selectedMonth && loadMonth(selectedMonth)} />
                </Space>
            </div>

            {summary.length > 0 && (
                <Card size="small" style={{ marginBottom: 16 }}>
                    <Row gutter={16} style={{ marginBottom: 12 }}>
                        <Col><Statistic title="Total In" value={money(totalCredits)} valueStyle={{ color: '#237804' }} /></Col>
                        <Col><Statistic title="Total Out" value={money(totalDebits)} valueStyle={{ color: '#a8071a' }} /></Col>
                        <Col><Statistic title="Net" value={money(totalCredits + totalDebits)} /></Col>
                    </Row>
                    <Table
                        size="small"
                        pagination={false}
                        rowKey="category"
                        dataSource={[...summary].sort((a, b) => a.net - b.net)}
                        columns={[
                            { title: 'Category', dataIndex: 'category', key: 'category' },
                            { title: 'Count', dataIndex: 'count', key: 'count', align: 'right' },
                            { title: 'In', dataIndex: 'credits', key: 'credits', align: 'right', render: money },
                            { title: 'Out', dataIndex: 'debits', key: 'debits', align: 'right', render: money },
                            { title: 'Net', dataIndex: 'net', key: 'net', align: 'right', render: money },
                        ]}
                    />
                </Card>
            )}

            {uncategorizedCount > 0 && (
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={`${uncategorizedCount} transaction${uncategorizedCount === 1 ? '' : 's'} still Uncategorized`}
                    description="Please set a category for the highlighted rows below so reports (P&L, Yearly, Balance Sheet) are accurate."
                />
            )}

            <Table
                columns={columns}
                dataSource={transactions}
                rowKey="id"
                loading={loading}
                size="middle"
                bordered
                pagination={{ pageSize: 50 }}
                rowClassName={(record) => (record.category === 'Uncategorized' ? 'bank-txn-uncategorized' : '')}
            />
        </div>
    );
};

export default BankTransactions;
