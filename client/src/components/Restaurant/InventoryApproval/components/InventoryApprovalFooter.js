import React from 'react';
import { Layout } from 'antd';

const { Footer } = Layout;

const InventoryApprovalFooter = () => {
    return (
        <Footer style={{ textAlign: 'center', position: 'fixed', bottom: 0, width: '100%', backgroundColor: '#fff', color: '#000' }}>
            Inventory Approval ©2024 Created by TechMind Software Solutions
        </Footer>
    );
};

export default InventoryApprovalFooter;