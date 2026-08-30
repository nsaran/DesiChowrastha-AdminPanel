import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Select, Typography, message, Space, Button, Empty, Card, Row, Col, Statistic } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import protectedApi from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Salary Ledger — read-only year view.
 * All 12 months as columns; metric rows (per-period cash/bank + totals) down the side.
 */
const SalaryYearView = () => {
    const { restaurantId } = useParams();

    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [months, setMonths] = useState([]);
    const [perMonth, setPerMonth] = useState({});
    const [employeeMatrix, setEmployeeMatrix] = useState([]);
    const [yearTotals, setYearTotals] = useState({});
    const [loading, setLoading] = useState(false);

    const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const monthLabel = (ym) => MONTH_NAMES[Number(ym.split('-')[1]) - 1] || ym;

    const loadYear = useCallback(async (year) => {
        setLoading(true);
        try {
            const res = await protectedApi.get('/api/payroll/salary/year', { params: { location: restaurantId, year } });
            setMonths(res.data.months || []);
            setPerMonth(res.data.perMonth || {});
            setEmployeeMatrix(res.data.employeeMatrix || []);
            setYearTotals(res.data.yearTotals || {});
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to load salary year view.');
            setMonths([]); setPerMonth({}); setEmployeeMatrix([]); setYearTotals({});
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => { loadYear(currentYear); }, [loadYear, currentYear]);

    const handleYearChange = (year) => { setSelectedYear(year); loadYear(year); };

    const metrics = [
        { key: 'p1Cash', label: '1st — Cash' },
        { key: 'p1Bank', label: '1st — Bank' },
        { key: 'p16Cash', label: '16th — Cash' },
        { key: 'p16Bank', label: '16th — Bank' },
        { key: 'cash', label: 'Total Cash', bold: true },
        { key: 'bank', label: 'Total Bank', bold: true },
        { key: 'total', label: 'Month Total', bold: true },
    ];

    const dataSource = metrics.map((m) => {
        const row = { key: m.key, label: m.label, bold: m.bold };
        months.forEach((mo) => { row[mo] = (perMonth[mo] || {})[m.key] || 0; });
        row.total = yearTotals[m.key] || 0;
        return row;
    });

    const columns = [
        { title: '', dataIndex: 'label', key: 'label', fixed: 'left', width: 150, render: (t, r) => (r.bold ? <strong>{t}</strong> : t) },
        ...months.map((mo) => ({
            title: monthLabel(mo), dataIndex: mo, key: mo, align: 'right', width: 100,
            render: (v, r) => (r.bold ? <strong>{v ? money(v) : ''}</strong> : (v ? money(v) : '')),
        })),
        {
            title: 'Year Total', dataIndex: 'total', key: 'total', align: 'right', fixed: 'right', width: 130,
            render: (v) => <strong>{money(v)}</strong>,
        },
    ];

    // Employee x month matrix columns (each cell = that employee's total for the month).
    const employeeColumns = [
        { title: 'Employee', dataIndex: 'name', key: 'name', fixed: 'left', width: 180 },
        ...months.map((mo) => ({
            title: monthLabel(mo), dataIndex: mo, key: mo, align: 'right', width: 100,
            render: (v) => (v ? money(v) : ''),
        })),
        {
            title: 'Year Total', dataIndex: 'total', key: 'total', align: 'right', fixed: 'right', width: 130,
            render: (v) => <strong>{money(v)}</strong>,
        },
    ];

    const handleExportCSV = () => {
        const esc = (s) => { const str = s == null ? '' : String(s); return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str; };
        const num = (v) => Number(v || 0).toFixed(2);
        const header = ['', ...months.map(monthLabel), 'Year Total'];
        const lines = [header, ...dataSource.map((r) => [r.label, ...months.map((mo) => num(r[mo])), num(r.total)])];
        // Append the per-employee matrix as a second section.
        if (employeeMatrix.length > 0) {
            lines.push([]);
            lines.push(['By Employee']);
            lines.push(['Employee', ...months.map(monthLabel), 'Year Total']);
            employeeMatrix.forEach((r) => lines.push([r.name, ...months.map((mo) => num(r[mo])), num(r.total)]));
        }
        const csv = lines.map((r) => r.map(esc).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `salary-ledger_${restaurantId}_${selectedYear}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const hasData = (yearTotals.total || 0) !== 0;

    return (
        <div style={{ margin: '16px' }}>
            <Title level={3}>Salary Ledger — Year View</Title>
            <Text type="secondary">Read-only. Aggregate Cash vs Bank per pay period across all months of the year.</Text>

            <div style={{ margin: '16px 0' }}>
                <Space>
                    <Text>Year:</Text>
                    <Select style={{ width: 100 }} value={selectedYear} onChange={handleYearChange}>
                        {yearOptions.map((y) => <Option key={y} value={y}>{y}</Option>)}
                    </Select>
                    <Button icon={<DownloadOutlined />} onClick={handleExportCSV} disabled={!hasData}>Download CSV</Button>
                </Space>
            </div>

            {!hasData && !loading ? (
                <Empty description={`No salary data for ${selectedYear}`} />
            ) : (
                <>
                    <Card size="small" style={{ marginBottom: 16 }}>
                        <Row gutter={16}>
                            <Col><Statistic title="Total Cash" value={money(yearTotals.cash)} valueStyle={{ color: '#d46b08' }} /></Col>
                            <Col><Statistic title="Total Bank" value={money(yearTotals.bank)} valueStyle={{ color: '#1677ff' }} /></Col>
                            <Col><Statistic title="Total Paid" value={money(yearTotals.total)} /></Col>
                        </Row>
                    </Card>
                    <Table
                        rowKey="key"
                        loading={loading}
                        dataSource={dataSource}
                        columns={columns}
                        size="small"
                        bordered
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                    />

                    <Title level={5} style={{ marginTop: 24 }}>By Employee</Title>
                    <Table
                        rowKey="employeeId"
                        loading={loading}
                        dataSource={employeeMatrix}
                        columns={employeeColumns}
                        size="small"
                        bordered
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                    />
                </>
            )}
        </div>
    );
};

export default SalaryYearView;
