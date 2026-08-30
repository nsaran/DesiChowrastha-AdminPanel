import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../../../utils/AuthProvider';
import { BellOutlined, CloseCircleOutlined, CheckCircleOutlined, MenuOutlined, UserOutlined, AppstoreOutlined, OrderedListOutlined, ShoppingCartOutlined, LogoutOutlined } from '@ant-design/icons';
import { message, Badge, Popover, List, Typography, Card, Avatar, Tooltip, Input, Button, Menu } from 'antd';
import { firestore, storage } from '../../../../config/firebase';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { generateInvoicePdf } from '../utils/invoice';
import '../assets/css/header.css';

const { Text } = Typography;
const { Meta } = Card;
const ColorList = ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#007bff'];
const GapList = [4, 3, 2, 1];

const PartyOrderHeader = ({ managerData }) => {
    const { restaurantId } = useParams();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [notificationCount, setNotificationCount] = useState(0);
    const [searchValue, setSearchValue] = useState('');

    const getRandomColor = () => {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    };

    const { currentUser } = useContext(AuthContext);
    const avatarColor = getRandomColor();
    const displayName = currentUser?.displayName || currentUser?.email || managerData?.email || 'User';
    const avatarLetter = displayName.charAt(0).toUpperCase();

    const popoverContent = (
        <Menu>
            <Menu.Item key="dashboard" icon={<AppstoreOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}`)}>
                Dashboard
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="inventoryManagement" icon={<AppstoreOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}/inventoryManagement`)}>
            Inventory Management
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="chefsKitchen" icon={<UserOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}/ChefsKitchen`)}>
                Chef's Kitchen
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="menuItems" icon={<OrderedListOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}/menu`)}>
                Menu
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="tvMenu" icon={<AppstoreOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}/TVMenu`)}>
                TV Menu
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="orderAnalysis" icon={<ShoppingCartOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}/orders`)}>
                Order Analysis
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={() => navigate(`/login/${restaurantId}`)} danger>
                Logout
            </Menu.Item>
        </Menu>
    );

    useEffect(() => {
        const unsubscribe = firestore
            .collection('restaurants')
            .doc(restaurantId)
            .collection('partyOrders')
            .onSnapshot(snapshot => {
                const notificationsData = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(order => {
                        const orderDate = new Date(order.cPartyDate);
                        const currentDate = new Date();
                        const orderStatus = order.cPartyOrderStatus;

                        return orderDate < currentDate && orderStatus !== 'COMPLETED' && orderStatus !== 'CANCELLED';
                    });

                setNotifications(notificationsData);
                setNotificationCount(notificationsData.length);
            }, error => {
                console.error('Error fetching notifications:', error);
            });

        return () => unsubscribe();
    }, [restaurantId]);

    const handleNotificationsClick = () => {
        setShowNotifications(!showNotifications);
    };

    // const shortenUrl = async (pdfUrl) => {
    //     const bitlyToken = 'd2853d35c790f2ad177d533931635b1055f4f844';
    //     const bitlyApi = `https://api-ssl.bitly.com/v4/shorten`;
    //     try {
    //         const bitlyResponse = await axios.post(
    //             bitlyApi,
    //             { long_url: pdfUrl },
    //             { headers: { Authorization: `Bearer ${bitlyToken}` } }
    //         );
    //         return bitlyResponse.data.link;
    //     } catch (error) {
    //         console.error('Error shortening URL with Bitly:', error);
    //         message.error('Failed to shorten the URL.');
    //         throw error;
    //     }
    // };

    const handleCompleteOrder = async (orderId, cPhoneNumber, cName, cInvoiceNumber) => {
        try {
            const snapshot = await firestore
                .collection('restaurants')
                .doc(restaurantId)
                .collection('partyOrders')
                .where('cInvoiceNumber', '==', orderId)
                .get();

            snapshot.forEach(async (doc) => {
                const orderRef = firestore.collection('restaurants').doc(restaurantId).collection('partyOrders').doc(doc.id);
                await orderRef.update({
                    cPartyOrderStatus: 'COMPLETED'
                });

                message.success('Party order status updated successfully for ' + orderId);

                // Generate PDF and shorten URL
                const pdfBlob = generateInvoicePdf({ cName, cInvoiceNumber }, true);
                const storageRef = storage.ref();
                const pdfRef = storageRef.child(`invoices/partyOrders/${restaurantId}/Invoice_${cInvoiceNumber}.pdf`);
                await pdfRef.put(pdfBlob);
                const pdfUrl = await pdfRef.getDownloadURL();
                // const shortUrl = await shortenUrl(pdfUrl);

                // Send WhatsApp message with short URL
                await axios.post('https://desichowrastha-completed-partyorders.onrender.com/api/send-whatsapp', {
                    phoneNumber: cPhoneNumber,
                    customerName: cName,
                    invoiceNumber: cInvoiceNumber,
                    // shortUrl: shortUrl
                });

                message.success('WhatsApp message sent successfully!');
            });

        } catch (error) {
            console.error('Error completing order:', error);
            message.error('Failed to complete the order.');
        }
    };

    const handleCancelOrder = async (orderId) => {
        try {
            const snapshot = await firestore
                .collection('restaurants')
                .doc(restaurantId)
                .collection('partyOrders')
                .where('cInvoiceNumber', '==', orderId)
                .get();

            snapshot.forEach((doc) => {
                const orderRef = firestore.collection('restaurants').doc(restaurantId).collection('partyOrders').doc(doc.id);
                orderRef.update({
                    cPartyOrderStatus: 'CANCELLED'
                }).then(() => {
                    message.success('Party order cancelled successfully for ' + orderId);
                }).catch((error) => {
                    console.error('Error cancelling party order:', error);
                });
            });

        } catch (error) {
            console.error('Error cancelling order:', error);
        }
    };

    const handleSearchChange = e => {
        setSearchValue(e.target.value);
    };

    const filteredNotifications = notifications.filter(notification =>
        notification.cInvoiceNumber.includes(searchValue) ||
        notification.cName.toLowerCase().includes(searchValue.toLowerCase()) ||
        (notification.cPhoneNumber && notification.cPhoneNumber.includes(searchValue))
    );

    const notificationContent = (
        <div style={{ width: 400 }}>
            <Input
                placeholder="Search by invoice number, name, or phone number"
                value={searchValue}
                onChange={handleSearchChange}
                style={{ marginBottom: 16 }}
            />
            <List
                dataSource={filteredNotifications}
                renderItem={notification => {
                    const randomColorIndex = Math.floor(Math.random() * ColorList.length);
                    const randomGapIndex = Math.floor(Math.random() * GapList.length);

                    return (
                        <Card
                            style={{ marginBottom: 16 }}
                            key={notification.cInvoiceNumber}
                            title={<Text strong>Invoice: {notification.cInvoiceNumber}</Text>}
                            actions={[
                                <Tooltip title="Cancel">
                                    <CloseCircleOutlined style={{ color: "#FF5733", fontSize: '18px' }} onClick={() => handleCancelOrder(notification.cInvoiceNumber)} key="cancel" />
                                </Tooltip>,
                                <Tooltip title="Complete">
                                    <CheckCircleOutlined style={{ color: "#097969", fontSize: '18px' }} onClick={() => handleCompleteOrder(notification.cInvoiceNumber, notification.cPhoneNumber, notification.cName, notification.cInvoiceNumber)} key="completed" />
                                </Tooltip>
                            ]}
                        >
                            <Meta
                                avatar={
                                    <Avatar
                                        style={{
                                            backgroundColor: ColorList[randomColorIndex],
                                            verticalAlign: 'middle',
                                        }}
                                        size="large"
                                        gap={GapList[randomGapIndex]}
                                    >
                                        {notification.cName.charAt(0)}
                                    </Avatar>
                                }
                                title={notification.cName}
                                description={notification.cPartyDate}
                            />
                        </Card>
                    );
                }}
            />
        </div>
    );

    return (
        <header className="order-header">
            <div className="header-content">
                <img src="https://iili.io/HeKYJkB.png" alt="Logo" className="restaurant-logo" />
                <Popover
                    content={notificationContent}
                    title="Notifications"
                    trigger="click"
                    visible={showNotifications}
                    onVisibleChange={handleNotificationsClick}
                >
                    <Badge count={notificationCount} className="notification-badge" style={{ marginTop: 13 }}>
                        <BellOutlined style={{ fontSize: '24px', cursor: 'pointer', marginTop: 13 }} />
                    </Badge>
                </Popover>
                <Popover content={popoverContent} trigger="click" placement="bottomRight">
                    <Tooltip title={displayName}>
                        <Button type="text" className="admin-avatar-button">
                            <Avatar style={{ backgroundColor: avatarColor }}>
                                {avatarLetter}
                            </Avatar>
                            <MenuOutlined style={{ fontSize: '20px', marginLeft: '10px' }} />
                        </Button>
                    </Tooltip>
                </Popover>
            </div>
        </header>
    );
};

export default PartyOrderHeader;