import React, { useState } from 'react';
import { Form, Input, Button, message, Card, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../../config/firebase';
import './AdminLogin.css';

const { Title } = Typography;

const AdminLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const { email, password } = values;
      await auth.signInWithEmailAndPassword(email, password);
      setLoading(false);
      message.success('Admin logged in successfully!');
      navigate('/dashboard');
    } catch (error) {
      setLoading(false);
      message.error(error.message);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <Card className="admin-login-container" bordered={false}>
        <img className="dc-logo-img" src="https://iili.io/HeKYJkB.png" alt="Restaurant Logo" />
        <Title level={3} className="login-title"><span>Admin</span> <span>Login</span></Title>
        <Form name="admin_login" onFinish={onFinish} className="admin-login-form">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please enter your email' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Email" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Please enter your password' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>
          <Form.Item className="login-button-container">
            <Button type="primary" htmlType="submit" loading={loading} className="login-button">
              Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AdminLogin;
