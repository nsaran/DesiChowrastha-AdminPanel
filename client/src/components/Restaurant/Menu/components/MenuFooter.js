import React from 'react';
import { Layout } from 'antd';

const { Footer } = Layout;

const MenuFooter = () => {
    return (
        <Footer style={{ textAlign: 'center', position: 'fixed', bottom: 0, width: '100%', backgroundColor: '#fff', color: '#000' }}>
            Menu ©2024 Created by TechMind Software Solutions
        </Footer>
    );
};

export default MenuFooter;