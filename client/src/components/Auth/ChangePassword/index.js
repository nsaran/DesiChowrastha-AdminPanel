import React, { useState } from 'react';
import { Form, Input, Button, message, Card, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../../config/firebase';
import firebase from '../../../config/firebase';

const { Title } = Typography;

/**
 * Change Password page - lets any authenticated user (owner, manager, chef)
 * change their own password.
 *
 * Uses Firebase client-side reauthentication + updatePassword.
 * Requires the current password for security (Firebase requires recent login
 * to change a password).
 */
const ChangePassword = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const onFinish = async (values) => {
        const user = auth.currentUser;
        if (!user) {
            message.error('You must be logged in to change your password.');
            return;
        }

        try {
            setLoading(true);

            // Reauthenticate with current password
            const credential = firebase.auth.EmailAuthProvider.credential(
                user.email,
                values.currentPassword
            );
            await user.reauthenticateWithCredential(credential);

            // Update to new password
            await user.updatePassword(values.newPassword);

            setLoading(false);
            message.success('Password changed successfully!');
            form.resetFields();
            navigate(-1);
        } catch (error) {
            setLoading(false);
            if (error.code === 'auth/wrong-password') {
                message.error('Current password is incorrect.');
            } else {
                message.error(error.message);
            }
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Card style={{ width: 420, maxWidth: '100%' }}>
                <Title level={3} style={{ textAlign: 'center' }}>Change Password</Title>
                <Form form={form} layout="vertical" onFinish={onFinish}>
                    <Form.Item
                        name="currentPassword"
                        label="Current Password"
                        rules={[{ required: true, message: 'Please enter your current password' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Current password" />
                    </Form.Item>
                    <Form.Item
                        name="newPassword"
                        label="New Password"
                        rules={[
                            { required: true, message: 'Please enter a new password' },
                            { min: 6, message: 'Password must be at least 6 characters' }
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="New password" />
                    </Form.Item>
                    <Form.Item
                        name="confirmPassword"
                        label="Confirm New Password"
                        dependencies={['newPassword']}
                        rules={[
                            { required: true, message: 'Please confirm your new password' },
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
                        <Input.Password prefix={<LockOutlined />} placeholder="Re-enter new password" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} block>
                            Change Password
                        </Button>
                        <Button style={{ marginTop: 8 }} onClick={() => navigate(-1)} block>
                            Cancel
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default ChangePassword;
