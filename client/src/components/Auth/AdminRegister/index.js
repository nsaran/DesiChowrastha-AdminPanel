import React, { useState } from 'react';
import { Form, Input, Button, message, Card, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { auth, firestore } from '../../../config/firebase';
import './AdminRegister.css';

const { Title } = Typography;

const AdminRegister = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const { email, password } = values;
      const { user } = await auth.createUserWithEmailAndPassword(email, password);
      await firestore.collection('admins').doc(user.uid).set({
        email: user.email,
        createdAt: new Date(),
      });
      setLoading(false);
      message.success('Admin registered successfully!');
      navigate('/login');
    } catch (error) {
      setLoading(false);
      message.error(error.message);
    }
  };

  return (
    <div className="admin-register-wrapper">
      <Card className="admin-register-container" bordered={false}>
        <img className='dc-logo-img' src='https://iili.io/HeKYJkB.png' alt="Restaurant Logo" />
        <Title level={3} className="register-title">Admin Register</Title>
        <Form name="admin_register" onFinish={onFinish} className="admin-register-form">
          <Form.Item
            name="email"
            rules={[
              { type: 'email', message: 'Please enter a valid email address' },
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
          <Form.Item className="button-container">
            <Button type="primary" htmlType="submit" loading={loading} className="register-button">
              Register
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AdminRegister;
