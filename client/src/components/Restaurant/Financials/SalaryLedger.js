import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Select, Typography, message, Space, Button, InputNumber, Empty } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import protectedApi from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FIELDS = ['p1Cash', 'p1Bank', 'p16Cash', 'p16Bank'];

/**
 * Salary Ledger — entry (owner / accounts manager).
 *
 * Select Year + Month, then enter each employee's 1st and 16th Cash/Bank amounts.
 * Held in local state and saved in a single batch (protects Firestore quota).
 * The totals row gives aggregate cash-vs-bank per period for the month.
 */
const SalaryLedger = () => {
    const { restaurantId } = useParams();

    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonthIdx, setSelectedMonthIdx] = useState(new Date().getMonth()); // 0-11
    const [employees, setEmployees] = useState([]);
    const [rows, setRows] = useState({}); // empId -> { p1Cash, p1Bank, p16Cash, p16Bank }
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const monthKey = `${selectedYear}-${String(selectedMonthIdx + 1).padStart(2, '0')}`;
    const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const load = useCallback(async (mKey) => {
        setLoading(true);
        try {
            const [empRes, salRes] = await Promise.all([
                protectedApi.get('/api/payroll/employees', { params: { location: restaurantId } }),
                protectedApi.get('/api/payroll/salary', { params: { location: restaurantId, month: mKey } }),
            ]);
            setEmployees(empRes.data.employees || []);
            setRows(salRes.data.rows || {});
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to load salary ledger.');
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => { load(monthKey); }, [load, monthKey]);

    const setCell = (empId, field, value) => {
        setRows((prev) => ({
            ...prev,
            [empId]: { ...(prev[empId] || {}), [field]: value },
        }));
    };

    const cellVal = (empId, field) => {
        const v = (rows[empId] || {})[field];
        return v === undefined || v === null || v === '' ? undefined : Number(v);
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            await protectedApi.put('/api/payroll/salary', {
                location: restaurantId,
                month: monthKey,
                rows,
            });
            message.success(`Saved ${MONTHS[selectedMonthIdx]} ${selectedYear}`);
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    // Only show employees who are not terminated for this month (by termination date),
    // but keep it simple: show all except those with status 'Terminated'.
    const visibleEmployees = employees.filter((e) => e.employmentStatus !== 'Terminated');

    const numberCell = (field) => (_, record) => {
        if (record.isTotal) {
            const total = visibleEmployees.reduce((s, e) => s + (Number((rows[e.id] || {})[field]) || 0), 0);
            return <strong>{money(total)}</strong>;
        }
        return (
            <InputNumber
                size="small"
                style={{ width: 110 }}
                min={0}
                value={cellVal(record.id, field)}
                onChange={(val) => setCell(record.id, field, val)}
            />
        );
    };

    const rowTotal = (record) => {
        if (record.isTotal) {
            return visibleEmployees.reduce((s, e) => {
                const r = rows[e.id] || {};
                return s + FIELDS.reduce((t, f) => t + (Number(r[f]) || 0), 0);
            }, 0);
        }
        const r = rows[record.id] || {};
        return FIELDS.reduce((t, f) => t + (Number(r[f]) || 0), 0);
    };

    const columns = [
        {
            title: 'Employee', key: 'employee', fixed: 'left', width: 200,
            render: (_, r) => r.isTotal ? <strong>Totals</strong> : `${r.firstName || ''} ${r.lastName || ''}`.trim(),
        },
        { title: '1st — Cash', key: 'p1Cash', align: 'right', render: numberCell('p1Cash') },
        { title: '1st — Bank', key: 'p1Bank', align: 'right', render: numberCell('p1Bank') },
        { title: '16th — Cash', key: 'p16Cash', align: 'right', render: numberCell('p16Cash') },
        { title: '16th — Bank', key: 'p16Bank', align: 'right', render: numberCell('p16Bank') },
        {
            title: 'Total', key: 'total', align: 'right', fixed: 'right', width: 130,
            render: (_, record) => <strong>{money(rowTotal(record))}</strong>,
        },
    ];

    const dataSource = [...visibleEmployees, { id: '__totals__', isTotal: true }];

    return (
        <div style={{ margin: '16px' }}>
            <Title level={3}>Salary Ledger</Title>
            <Text type="secondary">
                Enter each employee's 1st and 16th pay-period Cash and Bank amounts for the selected month,
                then click Save All. The Totals row shows aggregate Cash vs Bank per period.
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
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveAll} disabled={visibleEmployees.length === 0}>
                        Save All
                    </Button>
                </Space>
            </div>

            {visibleEmployees.length === 0 && !loading ? (
                <Empty description="No active employees. Add employees on the Employees page first." />
            ) : (
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={dataSource}
                    columns={columns}
                    size="small"
                    bordered
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    rowClassName={(r) => (r.isTotal ? 'salary-totals-row' : '')}
                />
            )}
            <style>{`.salary-totals-row > td { background-color: #fafafa; }`}</style>
        </div>
    );
};

export default SalaryLedger;
