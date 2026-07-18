import React, { useState, useEffect } from 'react';
import { Card, Button, Tag, Divider, Empty, Badge, Typography, Space, Input, message } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ShoppingCartOutlined, ReloadOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import API_BASE_URL from '../../../../config/api';

const { Title, Text } = Typography;

/**
 * WhatsApp Orders Page
 * 
 * Displays incoming WhatsApp orders in two sections:
 * - Pending: New orders waiting to be processed
 * - Processed: Completed orders
 * 
 * Auto-refreshes every 15 seconds to show new orders.
 */
const WhatsAppOrders = () => {
    const { restaurantId } = useParams();
    const [orders, setOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchOrders = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/whatsappOrders?location=${restaurantId}`);
            const data = await response.json();
            setOrders(data);
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();

        // Subscribe to real-time updates via SSE
        const eventSource = new EventSource(`${API_BASE_URL}/api/whatsappOrders/stream?location=${restaurantId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'new_order') {
                setOrders(prev => [...prev, data.order]);
            } else if (data.type === 'order_completed') {
                setOrders(prev => prev.map(o => o.id === data.order.id ? data.order : o));
            } else if (data.type === 'order_preparation') {
                setOrders(prev => prev.map(o => o.id === data.order.id ? data.order : o));
            } else if (data.type === 'order_updated') {
                setOrders(prev => prev.map(o => o.id === data.order.id ? data.order : o));
            }
        };

        eventSource.onerror = () => {
            // Fallback to polling if SSE fails
            eventSource.close();
            const intervalId = setInterval(fetchOrders, 15000);
            return () => clearInterval(intervalId);
        };

        return () => eventSource.close();
    }, [restaurantId]);

    const markPreparation = async (orderId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/whatsappOrders/${orderId}/preparation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                message.success('Order moved to In Preparation!');
                fetchOrders();
            }
        } catch (error) {
            message.error('Failed to update order');
        }
    };

    const saveToastOrderNumber = async (orderId, toastOrderNumber) => {
        try {
            await fetch(`${API_BASE_URL}/api/whatsappOrders/${orderId}/toastOrder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toastOrderNumber })
            });
        } catch (error) {
            message.error('Failed to save Toast order number');
        }
    };

    const markComplete = async (orderId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/whatsappOrders/${orderId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                message.success('Order marked as completed!');
                fetchOrders();
            }
        } catch (error) {
            message.error('Failed to update order');
        }
    };

    const pendingOrders = orders.filter(o => o.status === 'pending').sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    const preparationOrders = orders.filter(o => o.status === 'preparation').sort((a, b) => new Date(b.preparationAt || b.receivedAt) - new Date(a.preparationAt || a.receivedAt));
    const completedOrders = orders.filter(o => o.status === 'completed').sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    const formatTime = (isoString) => {
        if (!isoString) return '';
        return new Date(isoString).toLocaleString('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            month: 'short',
            day: 'numeric'
        });
    };

    const OrderCard = ({ order, showPreparationButton, showCompleteButton }) => (
        <Card
            style={{
                marginBottom: '16px',
                borderLeft: order.status === 'pending' ? '4px solid #fd590d' : order.status === 'preparation' ? '4px solid #1890ff' : '4px solid #52c41a',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
            size="small"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <Text strong style={{ fontSize: '1.1rem' }}>#{order.id}</Text>
                    <Tag color={order.status === 'pending' ? 'orange' : order.status === 'preparation' ? 'blue' : 'green'} style={{ marginLeft: '8px' }}>
                        {order.status === 'preparation' ? 'IN PREPARATION' : order.status.toUpperCase()}
                    </Tag>
                </div>
                <Text type="secondary">{formatTime(order.receivedAt)}</Text>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div style={{ marginBottom: '8px' }}>
                <Text type="secondary">Customer: </Text>
                <a href={`https://voice.google.com/u/0/calls?a=nc,%2B${order.customerPhone}`} target="_blank" rel="noopener noreferrer">
                    {order.customerPhone}
                </a>
            </div>

            <div style={{ marginBottom: '12px' }}>
                {order.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <Text>{item.quantity}x {item.name}</Text>
                        <Text>${item.amount}</Text>
                    </div>
                ))}
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <Text type="secondary">Subtotal: ${order.subtotal}</Text>
                    {parseFloat(order.tax) > 0 && <Text type="secondary" style={{ marginLeft: '12px' }}>Tax: ${order.tax}</Text>}
                    {parseFloat(order.shipping) > 0 && <Text type="secondary" style={{ marginLeft: '12px' }}>Shipping: ${order.shipping}</Text>}
                </div>
                <Text strong style={{ fontSize: '1.2rem', color: '#fd590d' }}>
                    ${order.totalAmount}
                </Text>
            </div>

            {order.completedAt && (
                <div style={{ marginTop: '8px' }}>
                    <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                        Completed: {formatTime(order.completedAt)}
                    </Text>
                </div>
            )}

            {order.toastOrderNumber && (
                <div style={{ marginTop: '6px' }}>
                    <Tag color="purple">Toast Order #{order.toastOrderNumber}</Tag>
                </div>
            )}

            {showPreparationButton && (
                <div style={{ marginTop: '12px' }}>
                    <Input
                        placeholder="Enter Toast Order #"
                        defaultValue={order.toastOrderNumber || ''}
                        onBlur={(e) => saveToastOrderNumber(order.id, e.target.value)}
                        onPressEnter={(e) => saveToastOrderNumber(order.id, e.target.value)}
                        style={{ marginBottom: '8px' }}
                        prefix="#"
                    />
                    <Button
                        type="primary"
                        icon={<ClockCircleOutlined />}
                        onClick={() => markPreparation(order.id)}
                        style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
                        block
                    >
                        Mark as In Preparation
                    </Button>
                </div>
            )}

            {showCompleteButton && (
                <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => markComplete(order.id)}
                    style={{ marginTop: '12px', backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                    block
                >
                    Mark as Completed
                </Button>
            )}
        </Card>
    );

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <Title level={2} style={{ color: '#fd590d', margin: 0 }}>
                    <ShoppingCartOutlined /> WhatsApp Orders — {restaurantId}
                </Title>
                <Button icon={<ReloadOutlined />} onClick={fetchOrders}>Refresh</Button>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {/* Pending Section */}
                <div style={{ flex: 1, minWidth: '350px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                        <ClockCircleOutlined style={{ fontSize: '1.3rem', color: '#fd590d', marginRight: '8px' }} />
                        <Title level={4} style={{ margin: 0 }}>
                            Pending
                        </Title>
                        <Badge count={pendingOrders.length} style={{ backgroundColor: '#fd590d', marginLeft: '10px' }} />
                    </div>

                    {pendingOrders.length > 0 ? (
                        pendingOrders.map(order => (
                            <OrderCard key={order.id} order={order} showPreparationButton={true} showCompleteButton={false} />
                        ))
                    ) : (
                        <Empty description="No pending orders" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                </div>

                {/* In Preparation Section */}
                <div style={{ flex: 1, minWidth: '350px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                        <ShoppingCartOutlined style={{ fontSize: '1.3rem', color: '#1890ff', marginRight: '8px' }} />
                        <Title level={4} style={{ margin: 0 }}>
                            In Preparation
                        </Title>
                        <Badge count={preparationOrders.length} style={{ backgroundColor: '#1890ff', marginLeft: '10px' }} />
                    </div>

                    {preparationOrders.length > 0 ? (
                        preparationOrders.map(order => (
                            <OrderCard key={order.id} order={order} showPreparationButton={false} showCompleteButton={true} />
                        ))
                    ) : (
                        <Empty description="No orders in preparation" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                </div>

                {/* Processed Section */}
                <div style={{ flex: 1, minWidth: '350px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                        <CheckCircleOutlined style={{ fontSize: '1.3rem', color: '#52c41a', marginRight: '8px' }} />
                        <Title level={4} style={{ margin: 0 }}>
                            Processed
                        </Title>
                        <Badge count={completedOrders.length} style={{ backgroundColor: '#52c41a', marginLeft: '10px' }} />
                    </div>

                    {completedOrders.length > 0 ? (
                        completedOrders.map(order => (
                            <OrderCard key={order.id} order={order} showPreparationButton={false} showCompleteButton={false} />
                        ))
                    ) : (
                        <Empty description="No completed orders" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatsAppOrders;
