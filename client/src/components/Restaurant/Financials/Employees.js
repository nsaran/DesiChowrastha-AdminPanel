import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space, Popconfirm, message, Typography, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import moment from 'moment';
import protectedApi from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

const EMPLOYMENT_STATUSES = ['Active', 'On Leave', 'Terminated'];
const PAY_FREQUENCIES = ['Bi-weekly', 'Monthly', 'Semi-monthly', 'Weekly'];
const ROLES = ['Manager', 'Kitchen Staff', 'Front Desk', 'Helper', 'Contractor', 'Cleaner', 'Other'];
const DATE_FMT = 'YYYY-MM-DD';

/**
 * Employees roster (owner / accounts manager). CRUD for restaurant staff.
 */
const Employees = () => {
    const { restaurantId } = useParams();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await protectedApi.get('/api/payroll/employees', { params: { location: restaurantId } });
            setEmployees(res.data.employees || []);
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to load employees.');
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => { load(); }, [load]);

    const openAdd = () => {
        setEditing(null);
        form.resetFields();
        setModalOpen(true);
    };

    const openEdit = (record) => {
        setEditing(record);
        form.setFieldsValue({
            ...record,
            dateOfBirth: record.dateOfBirth ? moment(record.dateOfBirth) : null,
            joiningDate: record.joiningDate ? moment(record.joiningDate) : null,
            terminationDate: record.terminationDate ? moment(record.terminationDate) : null,
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                location: restaurantId,
                firstName: values.firstName,
                lastName: values.lastName,
                dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format(DATE_FMT) : '',
                joiningDate: values.joiningDate ? values.joiningDate.format(DATE_FMT) : '',
                terminationDate: values.terminationDate ? values.terminationDate.format(DATE_FMT) : '',
                employmentStatus: values.employmentStatus || '',
                basePay: values.basePay != null ? Number(values.basePay) : 0,
                payFrequency: values.payFrequency || '',
                role: values.role || '',
            };
            if (editing) {
                await protectedApi.put(`/api/payroll/employees/${editing.id}`, payload);
                message.success('Employee updated');
            } else {
                await protectedApi.post('/api/payroll/employees', payload);
                message.success('Employee added');
            }
            setModalOpen(false);
            load();
        } catch (err) {
            if (err?.errorFields) return; // validation error, form shows it
            message.error(err.response?.data?.error || 'Failed to save employee.');
        }
    };

    const handleDelete = async (record) => {
        try {
            await protectedApi.delete(`/api/payroll/employees/${record.id}`, { params: { location: restaurantId } });
            message.success('Employee deleted');
            load();
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to delete employee.');
        }
    };

    const statusColor = (s) => ({ Active: 'green', 'On Leave': 'orange', Terminated: 'red' }[s] || 'default');

    const columns = [
        { title: 'First Name', dataIndex: 'firstName', key: 'firstName', sorter: (a, b) => (a.firstName || '').localeCompare(b.firstName || '') },
        { title: 'Last Name', dataIndex: 'lastName', key: 'lastName' },
        { title: 'Role', dataIndex: 'role', key: 'role' },
        { title: 'Status', dataIndex: 'employmentStatus', key: 'employmentStatus', render: (s) => s ? <Tag color={statusColor(s)}>{s}</Tag> : '' },
        { title: 'DOB', dataIndex: 'dateOfBirth', key: 'dateOfBirth' },
        { title: 'Joining', dataIndex: 'joiningDate', key: 'joiningDate' },
        { title: 'Termination', dataIndex: 'terminationDate', key: 'terminationDate' },
        { title: 'Base Pay', dataIndex: 'basePay', key: 'basePay', align: 'right', render: (v) => (v ? `$${Number(v).toLocaleString()}` : '') },
        { title: 'Pay Frequency', dataIndex: 'payFrequency', key: 'payFrequency' },
        {
            title: 'Actions', key: 'actions', fixed: 'right', width: 110,
            render: (_, record) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                    <Popconfirm title="Delete this employee?" onConfirm={() => handleDelete(record)} okText="Yes" cancelText="No">
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ margin: '16px' }}>
            <Title level={3}>Employees</Title>
            <Text type="secondary">Manage restaurant staff records.</Text>

            <div style={{ margin: '16px 0' }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Employee</Button>
            </div>

            <Table
                rowKey="id"
                loading={loading}
                dataSource={employees}
                columns={columns}
                size="middle"
                bordered
                scroll={{ x: 'max-content' }}
                pagination={{ pageSize: 25 }}
            />

            <Modal
                title={editing ? 'Edit Employee' : 'Add Employee'}
                open={modalOpen}
                onOk={handleSave}
                onCancel={() => setModalOpen(false)}
                okText={editing ? 'Update' : 'Add'}
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="firstName" label="First Name" rules={[{ required: true, message: 'First name is required' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="lastName" label="Last Name" rules={[{ required: true, message: 'Last name is required' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="dateOfBirth" label="Date of Birth">
                        <DatePicker style={{ width: '100%' }} format={DATE_FMT} />
                    </Form.Item>
                    <Form.Item name="joiningDate" label="Joining Date">
                        <DatePicker style={{ width: '100%' }} format={DATE_FMT} />
                    </Form.Item>
                    <Form.Item name="terminationDate" label="Termination Date">
                        <DatePicker style={{ width: '100%' }} format={DATE_FMT} />
                    </Form.Item>
                    <Form.Item name="employmentStatus" label="Employment Status">
                        <Select allowClear placeholder="Select status">
                            {EMPLOYMENT_STATUSES.map((s) => <Option key={s} value={s}>{s}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="basePay" label="Base Pay">
                        <InputNumber style={{ width: '100%' }} min={0} prefix="$" />
                    </Form.Item>
                    <Form.Item name="payFrequency" label="Pay Frequency">
                        <Select allowClear placeholder="Select frequency">
                            {PAY_FREQUENCIES.map((f) => <Option key={f} value={f}>{f}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="role" label="Role">
                        <Select allowClear placeholder="Select role">
                            {ROLES.map((r) => <Option key={r} value={r}>{r}</Option>)}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Employees;
