import React, { useState, useContext } from 'react';
import { Form, Input, Button, message, Card, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../../config/firebase';
import { AuthContext } from '../../../utils/AuthProvider';
import './AdminLogin.css';

const { Title } = Typography;

/**
 * Admin Login Page (/login)
 * 
 * - If user is already logged in as owner, redirects to /dashboard
 * - If user is logged in as non-owner, shows the login form (they can sign out and re-login)
 * - No auto-signout — we never sign out a user without their explicit action
 */
const AdminLogin = () => {
  const navigate = useNavigate();
  const { currentUser, role, refreshClaims } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  // If already logged in as owner, redirect immediately
  if (currentUser && role === 'owner') {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const { email, password } = values;

      // Sign out any existing session first (clean slate)
      if (auth.currentUser) {
        await auth.signOut();
      }

      await auth.signInWithEmailAndPassword(email, password);

      // Refresh claims and get the role before navigating
      const { role: userRole } = await refreshClaims();

      setLoading(false);

      if (userRole === 'owner') {
        message.success('Logged in successfully!');
        navigate('/dashboard');
      } else {
        message.error('This login is for owners only. Please use the restaurant login page.');
        await auth.signOut();
      }
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
