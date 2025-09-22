import React from 'react';
import { Form, Button } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

const TvMenu = () => {
    const navigate = useNavigate();
    const { restaurantId } = useParams();
    const handleNavigate = (path) => {
        navigate(`/dashboard/${restaurantId}/${path}`);
    };

    return (
        <div className="TV-Menu">
            <Form name="TV-Menu-Page">
                <Form.Item>
                    <img className='dc-logo-img' src='https://iili.io/HeKYJkB.png' alt="Restaurant Logo" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu1-button" onClick={() => handleNavigate('TVMenu/Page1')}>Page 1</Button>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu2-button" onClick={() => handleNavigate('TVMenu/Page2')}>Page 2</Button>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu3-button" onClick={() => handleNavigate('TVMenu/Page3')}>Page 3</Button>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" className="menu4-button" onClick={() => handleNavigate('TVMenu/Page4')}>Page 4</Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default TvMenu;
