import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, firestore } from '../../../config/firebase';
import './RestaurantLoginPage.css';

const RestaurantLoginPage = () => {
    const navigate = useNavigate();
    const { restaurantId } = useParams();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        try {
            setLoading(true);
            const { username, password } = values;

            const docRef = firestore
                .collection('restaurants')
                .doc(restaurantId)
                .collection('managers')
                .doc(username);

            const doc = await docRef.get();
            if (!doc.exists) {
                throw new Error('Manager not found');
            }

            const managerData = doc.data();
            const { email } = managerData;

            await auth.signInWithEmailAndPassword(email, password);

            setLoading(false);
            message.success('Manager logged in successfully!', 2);
            navigate(`/dashboard/${restaurantId}`, { state: { managerData } });
        } catch (error) {
            setLoading(false);
            message.error(error.message);
        }
    };

    return (
        <div className="restaurant-login-wrapper">
            <Helmet>
                <title>DesiChowrastha {restaurantId} | Login</title>
            </Helmet>
            <div className="restaurant-login-container">
                <img src="https://iili.io/HeKYJkB.png" alt="Logo" className="admin-logo" />
                <h4>{restaurantId}</h4>
                <Form name="restaurant_login" onFinish={onFinish} className="restaurant-login-form">
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: 'Please enter your username' }]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="Username" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please enter your password' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Password" />
                    </Form.Item>
                    <Form.Item className="login-button-container">
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            className="login-button"
                        >
                            Login
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </div>
    );
};

export default RestaurantLoginPage;
