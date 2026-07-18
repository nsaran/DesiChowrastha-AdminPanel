import React from 'react';
import { Button, Avatar, Popover, Menu } from 'antd';
import { MenuOutlined, UserOutlined, AppstoreOutlined, OrderedListOutlined, ShoppingCartOutlined, TeamOutlined, LogoutOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import "../RestaurantDashboard.css";

const RestaurantDashboardHeader = ({ managerData }) => {
    const navigate = useNavigate();
    const { restaurantId } = useParams();

    const handleLogout = () => {
        navigate(`/login/${restaurantId}`);
    };

    const handleNavigate = (path, data) => {
        navigate(`/dashboard/${restaurantId}/${path}`, { state: { managerData: data } });
    };

    // const menu = (
    //     <Menu>
    //         <Menu.Item key="chefsKitchen" icon={<UserOutlined />} onClick={() => handleNavigate('ChefsKitchen', managerData)}>
    //             Chef's Kitchen
    //         </Menu.Item>
    //         <Menu.Item key="filler" icon={<PlusCircleOutlined />} onClick={() => handleNavigate('filler', managerData)}>
    //             Filler
    //         </Menu.Item>
    //         <Menu.Divider />
    //         <Menu.Item key="inventoryManagement" icon={<AppstoreOutlined />} onClick={() => handleNavigate('inventoryManagement', managerData)}>
    //             Inventory Management
    //         </Menu.Item>
    //         <Menu.Divider />
    //         <Menu.Item key="menuItems" icon={<OrderedListOutlined />} onClick={() => handleNavigate('menu', managerData)}>
    //             Menu
    //         </Menu.Item>
    //         <Menu.Divider />
    //         <Menu.Item key="orderAnalysis" icon={<ShoppingCartOutlined />} onClick={() => handleNavigate('orders', managerData)}>
    //             Order Analysis
    //         </Menu.Item>
    //         <Menu.Divider />
    //         <Menu.Item key="partyOrders" icon={<TeamOutlined />} onClick={() => handleNavigate('partyorders', managerData)}>
    //             Party Orders
    //         </Menu.Item>
    //         <Menu.Divider />
    //         <Menu.Item key="tvMenu" icon={<AppstoreOutlined />} onClick={() => handleNavigate('TVMenu', managerData)}>
    //             TV Menu
    //         </Menu.Item>
    //         <Menu.Divider />
    //         <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout} danger>
    //             Logout
    //         </Menu.Item>
    //     </Menu>
    // );

    const getRandomColor = () => {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    };

    const avatarColor = getRandomColor();
    const avatarLetter = managerData ? managerData.email.charAt(0).toUpperCase() : '?';

    const popoverContent = (
        <Menu>
            <Menu.Item key="filler" icon={<PlusCircleOutlined />} onClick={() => handleNavigate('filler', managerData)}>
                Filler
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="inventoryManagement" icon={<AppstoreOutlined />} onClick={() => handleNavigate('inventoryManagement', managerData)}>
                Inventory Management
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="chefsKitchen" icon={<UserOutlined />} onClick={() => handleNavigate('ChefsKitchen', managerData)}>
                Chef's Kitchen
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="menuItems" icon={<OrderedListOutlined />} onClick={() => handleNavigate('menu', managerData)}>
                Menu
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="customMenu" icon={<OrderedListOutlined />} onClick={() => handleNavigate('customMenu', managerData)}>
                Custom Menu
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="tvMenu" icon={<AppstoreOutlined />} onClick={() => handleNavigate('TVMenu', managerData)}>
                TV Menu
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="customTvMenu" icon={<AppstoreOutlined  />} onClick={() => handleNavigate('customTvMenu', managerData)}>
                Custom TV Menu
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="otherServices" icon={<AppstoreOutlined />} onClick={() => handleNavigate('OtherServices', managerData)}>
                Other Services
            </Menu.Item>
            <Menu.Divider />           
            <Menu.Item key="orderAnalysis" icon={<ShoppingCartOutlined />} onClick={() => handleNavigate('orders', managerData)}>
                Order Analysis
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="partyOrders" icon={<TeamOutlined />} onClick={() => handleNavigate('partyorders', managerData)}>
                Party Orders
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout} danger>
                Logout
            </Menu.Item>
        </Menu>
    );

    return (
        <header className="admin-header">
            <div className="admin-header-left">
                <img src="https://iili.io/HeKYJkB.png" alt="Logo" className="admin-logo" />
            </div>
            <div className="admin-header-right">
                <Popover content={popoverContent} trigger="click" placement="bottomRight">
                    <Button type="text" className="admin-avatar-button">
                        <Avatar style={{ backgroundColor: avatarColor }}>
                            {avatarLetter}
                        </Avatar>
                        <MenuOutlined style={{ fontSize: '20px', marginLeft: '10px' }} />
                    </Button>
                </Popover>
            </div>
        </header>
    );
};

export default RestaurantDashboardHeader;
