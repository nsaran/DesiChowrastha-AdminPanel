import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Button, Card } from 'antd';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();

  const register = () => navigate('/register');
  const login = () => navigate('/login');

  return (
    <div className="home-page-admin">
      <Card className="home-card" bordered={false}>
        <Row justify="center" align="middle">
          <Col span={24} className="logo-container">
            <img className='dc-logo-img' src='https://iili.io/HeKYJkB.png' alt="Restaurant Logo" />
          </Col>
          <Col span={24} className="button-container">
            <Button type="primary" size="large" className="home-button" onClick={login}>Login</Button>
          </Col>
          <Col span={24} className="button-container">
            <Button type="primary" size="large" className="home-button" onClick={register}>Register</Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Home;