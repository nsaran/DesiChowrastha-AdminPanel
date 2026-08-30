import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Select, Typography, message, Space, Empty, Button, Card } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import protectedApi from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * Balance Sheet (read-only)
 *
 * Month-by-month (columns) view of key financial lines (rows):
 *   Total Income, Total Expense, Profit / Loss,
 *   Capital Withdrawal (Owner's Draw), Capital Investment.
 * Plus a Year Total column. Aggregated server-side from monthly summaries.
 * Capital movements are excluded from Profit / Loss (standard accounting).
 */
const BalanceSheet = () => {
    const { restaurantId } = useParams();

    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [months, setMonths] = useState([]);
    const [perMonth, setPerMonth] = useState({});
    const [totals, setTotals] = useState({});
    const [loading, setLoading] = useState(false);

    const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const monthLabel = (ym) => {
        const [, m] = ym.split('-');
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1] || ym;
    };

    const loadYear = useCallback(async (year) => {
        setLoading(true);
        try {
            const res = await protectedApi.get('/api/bank-transactions/balance-sheet', { params: { location: restaurantId, year } });
            setMonths(res.data.months || []);
            setPerMonth(res.data.perMonth || {});
            setTotals(res.data.totals || {});
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to load balance sheet.');
            setMonths([]);
            setPerMonth({});
            setTotals({});
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

    // Metric definitions -> becomes the table rows.
    const metrics = [
        { key: 'openingBalance', label: 'Opening Balance (prev. month P/L)', signed: true },
        { key: 'income', label: 'Total Income', positive: true },
        { key: 'expense', label: 'Total Expense', positive: false },
        { key: 'profitLoss', label: 'Profit / Loss', signed: true, bold: true },
        { key: 'capitalWithdrawal', label: "Capital Withdrawal (Owner's Draw)", positive: false },
        { key: 'capitalInvestment', label: 'Capital Investment', positive: true },
    ];

    // Export the balance sheet as CSV (metrics rows x month columns + Year Total),
    // using the same sign convention as the on-screen table.
    const handleExportCSV = () => {
        if (months.length === 0) {
            message.info('Nothing to export for this year.');
            return;
        }
        const displayVal = (metric, v) => (metric.positive || metric.signed ? v : -Math.abs(v));
        const esc = (s) => {
            const str = s === undefined || s === null ? '' : String(s);
            return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        };

        const header = ['Metric', ...months.map(monthLabel), 'Year Total'];
        const rows = metrics.map((metric) => {
            const cells = months.map((m) => displayVal(metric, (perMonth[m] || {})[metric.key] || 0).toFixed(2));
            const total = displayVal(metric, totals[metric.key] || 0).toFixed(2);
            return [metric.label, ...cells, total];
        });

        const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `balance-sheet_${restaurantId}_${selectedYear}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // Build one dataSource row per metric, with a value per month + a year total.
    const dataSource = metrics.map((metric) => {
        const row = { key: metric.key, label: metric.label, meta: metric };
        for (const m of months) {
            row[m] = (perMonth[m] || {})[metric.key] || 0;
        }
        row.total = totals[metric.key] || 0;
        return row;
    });

    const cellColor = (metric, v) => {
        if (metric.signed) return { color: v >= 0 ? '#237804' : '#a8071a' };
        if (metric.positive) return { color: '#237804' };
        return { color: '#a8071a' }; // expense / withdrawal shown in red
    };

    // Chart: always show all 12 months (Jan–Dec) of the selected year on the
    // X-axis, mapping each metric to its month (0 where no data exists).
    const monthKeys = Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const seriesFor = (key) => monthKeys.map((m) => Number(((perMonth[m] || {})[key] || 0).toFixed(2)));
    const chartOptions = {
        chart: { zoomType: 'xy' },
        title: { text: `Balance Sheet ${selectedYear}` },
        xAxis: [{ categories: monthNames, crosshair: true }],
        yAxis: [{ title: { text: 'Amount ($)' }, labels: { format: '${value:,.0f}' } }],
        tooltip: { shared: true, valuePrefix: '$' },
        legend: { align: 'center', verticalAlign: 'bottom' },
        credits: { enabled: false },
        series: [
            { name: 'Income', type: 'column', color: '#237804', data: seriesFor('income') },
            { name: 'Expense', type: 'column', color: '#a8071a', data: seriesFor('expense') },
            { name: 'Capital Withdrawal', type: 'column', color: '#d46b08', data: seriesFor('capitalWithdrawal') },
            { name: 'Capital Investment', type: 'column', color: '#1677ff', data: seriesFor('capitalInvestment') },
            { name: 'Profit / Loss', type: 'line', color: '#531dab', lineWidth: 3, data: seriesFor('profitLoss') },
            { name: 'Opening Balance', type: 'line', color: '#8c8c8c', dashStyle: 'ShortDash', data: seriesFor('openingBalance') },
        ],
    };

    const renderValue = (v, record) => {
        const m = record.meta;
        // Expenses/withdrawals are stored positive; show them as negative visually.
        const display = m.positive || m.signed ? v : -Math.abs(v);
        const style = { ...cellColor(m, m.signed ? v : display), ...(m.bold ? { fontWeight: 'bold' } : {}) };
        return v ? <span style={style}>{money(display)}</span> : '';
    };

    const columns = [
        { title: '', dataIndex: 'label', key: 'label', fixed: 'left', width: 240, render: (t, r) => (r.meta.bold ? <strong>{t}</strong> : t) },
        ...months.map((m) => ({
            title: monthLabel(m),
            dataIndex: m,
            key: m,
            align: 'right',
            width: 110,
            render: renderValue,
        })),
        {
            title: 'Year Total', dataIndex: 'total', key: 'total', align: 'right', fixed: 'right', width: 140,
            render: (v, record) => {
                const m = record.meta;
                const display = m.positive || m.signed ? v : -Math.abs(v);
                const style = { ...cellColor(m, m.signed ? v : display), fontWeight: 'bold' };
                return <span style={style}>{money(display)}</span>;
            },
        },
    ];

    return (
        <div style={{ margin: '16px' }}>
            <Title level={3}>Balance Sheet</Title>
            <Text type="secondary">
                Month-by-month income, expense and profit/loss for the year, plus owner capital
                movements. Read-only — capital withdrawals/investments are excluded from Profit / Loss.
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
                <>
                    <Card size="small" style={{ marginBottom: 16 }}>
                        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
                    </Card>
                    <Table
                        size="small"
                        bordered
                        rowKey="key"
                        loading={loading}
                        pagination={false}
                        dataSource={dataSource}
                        columns={columns}
                        scroll={{ x: 'max-content' }}
                    />
                </>
            )}
        </div>
    );
};

export default BalanceSheet;
