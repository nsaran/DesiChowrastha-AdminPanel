import React from 'react';
import { Form, Button } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

const OtherServices = () => {
    const navigate = useNavigate();
    const { restaurantId } = useParams();
    const handleNavigate = (path) => {
        navigate(`/dashboard/${restaurantId}/${path}`);
    };

    return (
        <div className="TV-Menu">
            <Form name="Other-Services-Page">
                <Form.Item>
                    <img className='dc-logo-img' src='https://iili.io/HeKYJkB.png' alt="Restaurant Logo" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu1-button" onClick={() => handleNavigate('OtherServices/FacebookPost')}>Facebook Post</Button>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu2-button" onClick={() => handleNavigate('OtherServices/CustomerFeedback')}>Customer Feedback</Button>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu3-button" onClick={() => handleNavigate('OtherServices/TodaysSpecial')}>Today's Special</Button>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu4-button" onClick={() => handleNavigate('OtherServices/ManageTodaysSpecial')}>Manage Today's Special</Button>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu1-button" onClick={() => handleNavigate('OtherServices/WhatsAppOrders')}>WhatsApp Orders</Button>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu2-button" onClick={() => handleNavigate('OtherServices/OrderStatus')}>Order Status</Button>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu3-button" onClick={() => handleNavigate('TabletMenu')}>Tablet Menu</Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default OtherServices;
