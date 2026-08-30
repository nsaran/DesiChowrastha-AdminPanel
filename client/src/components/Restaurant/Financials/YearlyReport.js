import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Select, Typography, message, Card, Row, Col, Statistic, Space, Empty } from 'antd';
import protectedApi from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * Yearly Report (read-only)
 *
 * Cumulative per-category totals for a year plus a category-by-month matrix.
 * Aggregated server-side from the stored monthly summaries. Editing happens on
 * the Monthly Report page; this view is read-only.
 */
const YearlyReport = () => {
    const { restaurantId } = useParams();

    const currentYear = new Date().getFullYear();
    // Dynamic year options: current year + previous two (advances each year).
    const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [months, setMonths] = useState([]);
    const [categoryTotals, setCategoryTotals] = useState([]);
    const [matrix, setMatrix] = useState([]);
    const [grand, setGrand] = useState({ credits: 0, debits: 0, net: 0 });
    const [loading, setLoading] = useState(false);

    const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const monthLabel = (ym) => {
        const [, m] = ym.split('-');
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1] || ym;
    };

    const loadYear = useCallback(async (year) => {
        setLoading(true);
        try {
            const res = await protectedApi.get('/api/bank-transactions/yearly', { params: { location: restaurantId, year } });
            setMonths(res.data.months || []);
            setCategoryTotals(res.data.categoryTotals || []);
            setMatrix(res.data.matrix || []);
            setGrand(res.data.grand || { credits: 0, debits: 0, net: 0 });
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to load yearly report.');
            setMonths([]);
            setCategoryTotals([]);
            setMatrix([]);
            setGrand({ credits: 0, debits: 0, net: 0 });
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

    const netStyle = (v) => ({ color: v >= 0 ? '#237804' : '#a8071a' });

    // Cumulative category totals table.
    const totalsColumns = [
        { title: 'Category', dataIndex: 'category', key: 'category' },
        { title: 'Count', dataIndex: 'count', key: 'count', align: 'right' },
        { title: 'Total In', dataIndex: 'credits', key: 'credits', align: 'right', render: money },
        { title: 'Total Out', dataIndex: 'debits', key: 'debits', align: 'right', render: money },
        { title: 'Net', dataIndex: 'net', key: 'net', align: 'right', render: (v) => <span style={netStyle(v)}>{money(v)}</span> },
    ];

    // Category-by-month matrix: one column per month that has data, plus a total.
    const matrixColumns = [
        { title: 'Category', dataIndex: 'category', key: 'category', fixed: 'left', width: 200 },
        ...months.map((m) => ({
            title: monthLabel(m),
            dataIndex: m,
            key: m,
            align: 'right',
            width: 110,
            render: (v) => (v ? <span style={netStyle(v)}>{money(v)}</span> : ''),
        })),
        {
            title: 'Total', dataIndex: 'total', key: 'total', align: 'right', fixed: 'right', width: 130,
            render: (v) => <strong style={netStyle(v)}>{money(v)}</strong>,
        },
    ];

    return (
        <div style={{ margin: '16px' }}>
            <Title level={3}>Yearly Report</Title>
            <Text type="secondary">
                Cumulative summary of all transactions for the selected year. Read-only —
                make edits on the Monthly Report page.
            </Text>

            <div style={{ margin: '16px 0' }}>
                <Space>
                    <Text>Year:</Text>
                    <Select style={{ width: 100 }} value={selectedYear} onChange={handleYearChange}>
                        {yearOptions.map((y) => <Option key={y} value={y}>{y}</Option>)}
                    </Select>
                </Space>
            </div>

            {months.length === 0 && !loading ? (
                <Empty description={`No transaction data for ${selectedYear}`} />
            ) : (
                <>
                    <Card size="small" style={{ marginBottom: 16 }}>
                        <Row gutter={16}>
                            <Col><Statistic title="Total In" value={money(grand.credits)} valueStyle={{ color: '#237804' }} /></Col>
                            <Col><Statistic title="Total Out" value={money(grand.debits)} valueStyle={{ color: '#a8071a' }} /></Col>
                            <Col><Statistic title="Net" value={money(grand.net)} /></Col>
                        </Row>
                    </Card>

                    <Title level={5}>Category Totals</Title>
                    <Table
                        size="small"
                        rowKey="category"
                        loading={loading}
                        pagination={false}
                        dataSource={[...categoryTotals].sort((a, b) => a.net - b.net)}
                        columns={totalsColumns}
                        style={{ marginBottom: 24 }}
                    />

                    <Title level={5}>Month-by-Month (Net by Category)</Title>
                    <Table
                        size="small"
                        rowKey="category"
                        loading={loading}
                        pagination={false}
                        dataSource={matrix}
                        columns={matrixColumns}
                        scroll={{ x: 'max-content' }}
                    />
                </>
            )}
        </div>
    );
};

export default YearlyReport;
