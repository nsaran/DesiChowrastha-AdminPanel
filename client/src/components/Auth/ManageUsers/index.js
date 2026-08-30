import React, { useState, useEffect, useContext } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Tag, Dropdown, Menu, Space } from 'antd';
import { UserAddOutlined, DeleteOutlined, EditOutlined, StopOutlined, CheckCircleOutlined, KeyOutlined, MailOutlined, MoreOutlined } from '@ant-design/icons';
import { AuthContext } from '../../../utils/AuthProvider';
import API_BASE_URL from '../../../config/api';
import axios from 'axios';

const { Option } = Select;

const ManageUsers = () => {
    const { getToken } = useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
    const [editEmailModalVisible, setEditEmailModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [resetUser, setResetUser] = useState(null);
    const [emailUser, setEmailUser] = useState(null);
    const [form] = Form.useForm();
    const [resetForm] = Form.useForm();
    const [emailForm] = Form.useForm();

    const getAuthHeaders = async () => {
        const token = await getToken();
        return { Authorization: `Bearer ${token}` };
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const response = await axios.get(`${API_BASE_URL}/api/users`, { headers });
            setUsers(response.data.users);
        } catch (error) {
            message.error(error.response?.data?.error || 'Failed to fetch users');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = () => {
        setEditingUser(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEditRole = (user) => {
        setEditingUser(user);
        form.setFieldsValue({
            role: user.role,
            restaurantId: user.restaurantId || ''
        });
        setModalVisible(true);
    };

    const handleSubmit = async (values) => {
        try {
            const headers = await getAuthHeaders();

            if (editingUser) {
                // Update role
                await axios.put(`${API_BASE_URL}/api/users/${editingUser.uid}/role`, {
                    role: values.role,
                    restaurantId: values.restaurantId || null
                }, { headers });
                message.success(`Role updated for ${editingUser.email}`);
            } else {
                // Create new user
                await axios.post(`${API_BASE_URL}/api/users`, {
                    email: values.email,
                    password: values.password,
                    displayName: values.displayName,
                    role: values.role,
                    restaurantId: values.restaurantId || null
                }, { headers });
                message.success('User created successfully');
            }

            setModalVisible(false);
            form.resetFields();
            fetchUsers();
        } catch (error) {
            message.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (uid) => {
        try {
            const headers = await getAuthHeaders();
            await axios.delete(`${API_BASE_URL}/api/users/${uid}`, { headers });
            message.success('User deleted');
            fetchUsers();
        } catch (error) {
            message.error(error.response?.data?.error || 'Failed to delete user');
        }
    };

    const handleToggleDisable = async (uid, currentlyDisabled) => {
        try {
            const headers = await getAuthHeaders();
            await axios.put(`${API_BASE_URL}/api/users/${uid}/disable`, {
                disabled: !currentlyDisabled
            }, { headers });
            message.success(`User ${currentlyDisabled ? 'enabled' : 'disabled'}`);
            fetchUsers();
        } catch (error) {
            message.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleResetPassword = (user) => {
        setResetUser(user);
        resetForm.resetFields();
        setResetPasswordModalVisible(true);
    };

    const handleResetPasswordSubmit = async (values) => {
        try {
            const headers = await getAuthHeaders();
            await axios.put(`${API_BASE_URL}/api/users/${resetUser.uid}/reset-password`, {
                newPassword: values.newPassword
            }, { headers });
            message.success(`Password reset for ${resetUser.email}`);
            setResetPasswordModalVisible(false);
            resetForm.resetFields();
        } catch (error) {
            message.error(error.response?.data?.error || 'Failed to reset password');
        }
    };

    const handleEditEmail = (user) => {
        setEmailUser(user);
        emailForm.setFieldsValue({ newEmail: user.email });
        setEditEmailModalVisible(true);
    };

    const handleEditEmailSubmit = async (values) => {
        try {
            const headers = await getAuthHeaders();
            await axios.put(`${API_BASE_URL}/api/users/${emailUser.uid}/email`, {
                newEmail: values.newEmail
            }, { headers });
            message.success(`Email updated for ${emailUser.displayName || emailUser.email}`);
            setEditEmailModalVisible(false);
            emailForm.resetFields();
            fetchUsers();
        } catch (error) {
            message.error(error.response?.data?.error || 'Failed to update email');
        }
    };

    const roleColors = {
        owner: 'gold',
        manager: 'blue',
        chef: 'green',
        accountsManager: 'purple',
        none: 'default'
    };

    const columns = [
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Name',
            dataIndex: 'displayName',
            key: 'displayName',
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role) => (
                <Tag color={roleColors[role] || 'default'}>
                    {role ? role.toUpperCase() : 'NONE'}
                </Tag>
            ),
        },
        {
            title: 'Restaurant',
            dataIndex: 'restaurantId',
            key: 'restaurantId',
            render: (text) => text || '-',
        },
        {
            title: 'Status',
            dataIndex: 'disabled',
            key: 'disabled',
            render: (disabled) => (
                <Tag color={disabled ? 'red' : 'green'}>
                    {disabled ? 'Disabled' : 'Active'}
                </Tag>
            ),
        },
        {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (text) => new Date(text).toLocaleDateString(),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => {
                const menu = (
                    <Menu>
                        <Menu.Item key="editRole" icon={<EditOutlined />} onClick={() => handleEditRole(record)}>
                            Edit Role
                        </Menu.Item>
                        <Menu.Item key="resetPassword" icon={<KeyOutlined />} onClick={() => handleResetPassword(record)}>
                            Reset Password
                        </Menu.Item>
                        <Menu.Item key="editEmail" icon={<MailOutlined />} onClick={() => handleEditEmail(record)}>
                            Edit Email
                        </Menu.Item>
                        <Menu.Item
                            key="toggleDisable"
                            icon={record.disabled ? <CheckCircleOutlined /> : <StopOutlined />}
                            onClick={() => handleToggleDisable(record.uid, record.disabled)}
                        >
                            {record.disabled ? 'Enable' : 'Disable'}
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item key="delete" danger icon={<DeleteOutlined />}>
                            <Popconfirm
                                title="Are you sure you want to delete this user?"
                                onConfirm={() => handleDelete(record.uid)}
                                okText="Yes"
                                cancelText="No"
                            >
                                Delete
                            </Popconfirm>
                        </Menu.Item>
                    </Menu>
                );

                return (
                    <Dropdown overlay={menu} trigger={['click']}>
                        <Button icon={<MoreOutlined />}>Actions</Button>
                    </Dropdown>
                );
            },
        },
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0 }}>Manage Users</h2>
                <Button type="primary" icon={<UserAddOutlined />} onClick={handleCreateUser}>
                    Create User
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={users}
                rowKey="uid"
                loading={loading}
                pagination={{ pageSize: 10 }}
            />

            <Modal
                title={editingUser ? `Edit Role - ${editingUser.email}` : 'Create New User'}
                open={modalVisible}
                onCancel={() => { setModalVisible(false); form.resetFields(); }}
                footer={null}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    {!editingUser && (
                        <>
                            <Form.Item
                                name="email"
                                label="Email"
                                rules={[
                                    { required: true, message: 'Please enter email' },
                                    { type: 'email', message: 'Please enter a valid email' }
                                ]}
                            >
                                <Input placeholder="user@example.com" />
                            </Form.Item>
                            <Form.Item
                                name="password"
                                label="Password"
                                rules={[
                                    { required: true, message: 'Please enter password' },
                                    { min: 6, message: 'Password must be at least 6 characters' }
                                ]}
                            >
                                <Input.Password placeholder="Minimum 6 characters" />
                            </Form.Item>
                            <Form.Item name="displayName" label="Display Name">
                                <Input placeholder="Full name" />
                            </Form.Item>
                        </>
                    )}
                    <Form.Item
                        name="role"
                        label="Role"
                        rules={[{ required: true, message: 'Please select a role' }]}
                    >
                        <Select placeholder="Select role">
                            <Option value="owner">Owner</Option>
                            <Option value="manager">Manager</Option>
                            <Option value="chef">Chef</Option>
                            <Option value="accountsManager">Accounts Manager</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="restaurantId" label="Restaurant (optional)">
                        <Select placeholder="Select restaurant" allowClear>
                            <Option value="Nashua">Nashua</Option>
                            <Option value="Westborough">Westborough</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {editingUser ? 'Update Role' : 'Create User'}
                            </Button>
                            <Button onClick={() => { setModalVisible(false); form.resetFields(); }}>
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={`Reset Password - ${resetUser?.email || ''}`}
                open={resetPasswordModalVisible}
                onCancel={() => { setResetPasswordModalVisible(false); resetForm.resetFields(); }}
                footer={null}
            >
                <Form form={resetForm} layout="vertical" onFinish={handleResetPasswordSubmit}>
                    <Form.Item
                        name="newPassword"
                        label="New Password"
                        rules={[
                            { required: true, message: 'Please enter a new password' },
                            { min: 6, message: 'Password must be at least 6 characters' }
                        ]}
                    >
                        <Input.Password placeholder="Minimum 6 characters" />
                    </Form.Item>
                    <Form.Item
                        name="confirmPassword"
                        label="Confirm Password"
                        dependencies={['newPassword']}
                        rules={[
                            { required: true, message: 'Please confirm the password' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('newPassword') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Passwords do not match'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password placeholder="Re-enter password" />
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                Reset Password
                            </Button>
                            <Button onClick={() => { setResetPasswordModalVisible(false); resetForm.resetFields(); }}>
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={`Edit Email - ${emailUser?.email || ''}`}
                open={editEmailModalVisible}
                onCancel={() => { setEditEmailModalVisible(false); emailForm.resetFields(); }}
                footer={null}
            >
                <Form form={emailForm} layout="vertical" onFinish={handleEditEmailSubmit}>
                    <Form.Item
                        name="newEmail"
                        label="New Email"
                        rules={[
                            { required: true, message: 'Please enter the new email' },
                            { type: 'email', message: 'Please enter a valid email' }
                        ]}
                    >
                        <Input placeholder="newemail@example.com" />
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                Update Email
                            </Button>
                            <Button onClick={() => { setEditEmailModalVisible(false); emailForm.resetFields(); }}>
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ManageUsers;
