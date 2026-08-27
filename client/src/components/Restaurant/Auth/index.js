import React, { useState, useContext } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, firestore } from '../../../config/firebase';
import { AuthContext } from '../../../utils/AuthProvider';
import './RestaurantLoginPage.css';

/**
 * Restaurant Login Page (/login/:restaurantId)
 * 
 * Supports both:
 * - Email login (for users created via Manage Users)
 * - Username login (legacy managers stored in Firestore)
 * 
 * After login, refreshes claims and navigates to the restaurant dashboard.
 * Does NOT auto-redirect or auto-signout — clean, predictable behavior.
 */
const RestaurantLoginPage = () => {
    const navigate = useNavigate();
    const { restaurantId } = useParams();
    const { refreshClaims } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        try {
            setLoading(true);
            const { username, password } = values;

            let email = username;

            // If input doesn't look like an email, look up username in Firestore
            if (!username.includes('@')) {
                const docRef = firestore
                    .collection('restaurants')
                    .doc(restaurantId)
                    .collection('managers')
                    .doc(username);

                const doc = await docRef.get();
                if (!doc.exists) {
                    throw new Error('User not found');
                }

                const managerData = doc.data();
                email = managerData.email;
            }

            // Sign out any existing session first (clean slate)
            if (auth.currentUser) {
                await auth.signOut();
            }

            await auth.signInWithEmailAndPassword(email, password);

            // Refresh claims and get role before navigating
            const { role } = await refreshClaims();

            setLoading(false);

            if (!role) {
                message.error('Your account has no role assigned. Contact the owner.');
                await auth.signOut();
                return;
            }

            message.success('Logged in successfully!', 2);
            navigate(`/dashboard/${restaurantId}`);
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
                        rules={[{ required: true, message: 'Please enter your email or username' }]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="Email or Username" />
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
