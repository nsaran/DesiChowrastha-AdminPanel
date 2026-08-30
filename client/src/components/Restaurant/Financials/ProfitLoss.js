import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Select, Typography, message, Space, Empty, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import protectedApi from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * Profit & Loss statement (read-only)
 *
 * Revenue lines -> Total Revenue, Expense lines -> Total Expenses, then
 * Net Profit / (Loss). Months as columns + Year Total. Excludes owner capital
 * movements and Uncategorized (fix those on the Monthly Report page).
 */
const ProfitLoss = () => {
    const { restaurantId } = useParams();

    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [months, setMonths] = useState([]);
    const [revenue, setRevenue] = useState({ lines: [], subtotal: {} });
    const [expense, setExpense] = useState({ lines: [], subtotal: {} });
    const [net, setNet] = useState({});
    const [loading, setLoading] = useState(false);

    const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const monthLabel = (ym) => {
        const [, m] = ym.split('-');
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1] || ym;
    };

    const loadYear = useCallback(async (year) => {
        setLoading(true);
        try {
            const res = await protectedApi.get('/api/bank-transactions/profit-loss', { params: { location: restaurantId, year } });
            setMonths(res.data.months || []);
            setRevenue(res.data.revenue || { lines: [], subtotal: {} });
            setExpense(res.data.expense || { lines: [], subtotal: {} });
            setNet(res.data.net || {});
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to load profit & loss.');
            setMonths([]);
            setRevenue({ lines: [], subtotal: {} });
            setExpense({ lines: [], subtotal: {} });
            setNet({});
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        loadYear(currentYear);
    }, [loadYear, currentYear]);

    const handleYearChange = (year) => {
        setSelectedYear(year);
        loadYear(year);
    };

    // Build a single dataSource with section header rows, category lines, subtotals, net.
    const ROW = {
        HEADER: 'header', LINE: 'line', SUBTOTAL: 'subtotal', NET: 'net',
    };
    const dataSource = [
        { key: 'rev-header', kind: ROW.HEADER, label: 'REVENUE' },
        ...revenue.lines.map((l) => ({ key: `rev-${l.category}`, kind: ROW.LINE, label: l.category, values: l })),
        { key: 'rev-subtotal', kind: ROW.SUBTOTAL, label: 'Total Revenue', values: revenue.subtotal },
        { key: 'exp-header', kind: ROW.HEADER, label: 'EXPENSES' },
        ...expense.lines.map((l) => ({ key: `exp-${l.category}`, kind: ROW.LINE, label: l.category, values: l })),
        { key: 'exp-subtotal', kind: ROW.SUBTOTAL, label: 'Total Expenses', values: expense.subtotal },
        { key: 'net', kind: ROW.NET, label: 'Net Profit / (Loss)', values: net },
    ];

    const netColor = (v) => ({ color: v >= 0 ? '#237804' : '#a8071a' });

    const renderCell = (record, monthKey) => {
        if (record.kind === ROW.HEADER) return '';
        const v = (record.values || {})[monthKey] || 0;
        if (record.kind === ROW.NET) return v ? <strong style={netColor(v)}>{money(v)}</strong> : '';
        if (record.kind === ROW.SUBTOTAL) return <strong>{money(v)}</strong>;
        return v ? money(v) : '';
    };

    const columns = [
        {
            title: '', dataIndex: 'label', key: 'label', fixed: 'left', width: 220,
            render: (t, r) => {
                if (r.kind === ROW.HEADER) return <strong>{t}</strong>;
                if (r.kind === ROW.SUBTOTAL || r.kind === ROW.NET) return <strong>{t}</strong>;
                return <span style={{ paddingLeft: 12 }}>{t}</span>;
            },
        },
        ...months.map((m) => ({
            title: monthLabel(m), key: m, align: 'right', width: 110,
            render: (_, record) => renderCell(record, m),
        })),
        {
            title: 'Year Total', key: 'total', align: 'right', fixed: 'right', width: 140,
            render: (_, record) => renderCell(record, 'total'),
        },
    ];

    const handleExportCSV = () => {
        if (months.length === 0) { message.info('Nothing to export for this year.'); return; }
        const esc = (s) => {
            const str = s === undefined || s === null ? '' : String(s);
            return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        };
        const num = (v) => Number(v || 0).toFixed(2);
        const header = ['', ...months.map(monthLabel), 'Year Total'];
        const lines = [header];
        dataSource.forEach((r) => {
            if (r.kind === ROW.HEADER) { lines.push([r.label]); return; }
            const cells = months.map((m) => num((r.values || {})[m] || 0));
            lines.push([r.label, ...cells, num((r.values || {}).total || 0)]);
        });
        const csv = lines.map((r) => r.map(esc).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `profit-loss_${restaurantId}_${selectedYear}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const rowClassName = (record) => {
        if (record.kind === ROW.HEADER) return 'pl-header-row';
        if (record.kind === ROW.NET) return 'pl-net-row';
        return '';
    };

    return (
        <div style={{ margin: '16px' }}>
            <Title level={3}>Profit &amp; Loss Statement</Title>
            <Text type="secondary">
                Revenue and expenses by month for the year. Excludes owner capital movements
                and uncategorized items — categorize those on the Monthly Report page.
            </Text>

            <div style={{ margin: '16px 0' }}>
                <Space>
                    <Text>Year:</Text>
                    <Select style={{ width: 100 }} value={selectedYear} onChange={handleYearChange}>
                        {yearOptions.map((y) => <Option key={y} value={y}>{y}</Option>)}
                    </Select>
                    <Button icon={<DownloadOutlined />} onClick={handleExportCSV} disabled={months.length === 0}>
                        Download CSV
                    </Button>
                </Space>
            </div>

            {months.length === 0 && !loading ? (
                <Empty description={`No transaction data for ${selectedYear}`} />
            ) : (
                <Table
                    size="small"
                    bordered
                    rowKey="key"
                    loading={loading}
                    pagination={false}
                    dataSource={dataSource}
                    columns={columns}
                    rowClassName={rowClassName}
                    scroll={{ x: 'max-content' }}
                />
            )}
        </div>
    );
};

export default ProfitLoss;
