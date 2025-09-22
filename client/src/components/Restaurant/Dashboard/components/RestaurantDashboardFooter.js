import React from 'react';
import { Row, Col } from 'antd';

const RestaurantDashboardFooter = ({ restaurants }) => {
  const currentYear = new Date().getFullYear();

  return (
    <Row className="admin-footer">
      <Col xs={24} md={4}>
        <img src="https://iili.io/HeKYJkB.png" alt="Logo" className="footer-logo" />
        <p>Desi Chowrastha is here, to celebrate culture, heritage through food, much more than nostalgia and recipes.</p>
        <h4>Stay Connected</h4>
        <div className="social-links">
          <a href="https://facebook.com">
            <img src="https://iili.io/HQapkXV.md.png" style={{ width: '36px' }} alt="Facebook" />
          </a>
          <a href="https://instagram.com">
            <img src="https://iili.io/HQapvLB.md.png" style={{ width: '36px' }} alt="Instagram" />
          </a>
        </div>
        <p>&copy; {currentYear} DesiChowrastha, All rights reserved.</p>
      </Col>
      <Col xs={24} md={4}></Col>
      <Col xs={24} md={16}>
        <h3>Our Locations</h3>
        {restaurants.map((restaurant) => (
          <Row key={restaurant.id} align="middle">
            <img src="https://desichowrastha.com/images/icons/location_icon.svg" alt="Location" style={{ width: 18, marginRight: '10px' }} />
            <Col>
              <h4>{restaurant.name}</h4>
              <p style={{ marginTop: '-10px', color: 'gray' }}>{restaurant.address}</p>
            </Col>
          </Row>
        ))}
      </Col>
    </Row>
  );
};

export default RestaurantDashboardFooter;
