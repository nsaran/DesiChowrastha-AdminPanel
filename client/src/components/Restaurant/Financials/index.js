import React from 'react';
import { Form, Button } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

const Financials = () => {
    const navigate = useNavigate();
    const { restaurantId } = useParams();
    const handleNavigate = (path) => {
        navigate(`/dashboard/${restaurantId}/${path}`);
    };

    return (
        <div className="TV-Menu">
            <Form name="Financials-Page">
                <Form.Item>
                    <img className='dc-logo-img' src='https://iili.io/HeKYJkB.png' alt="Restaurant Logo" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu1-button" onClick={() => handleNavigate('Financials/BankTransactions')}>Monthly Report</Button>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu2-button" onClick={() => handleNavigate('Financials/YearlyReport')}>Yearly Report</Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default Financials;
