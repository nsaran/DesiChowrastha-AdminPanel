import React, { useState } from 'react';
import { Input, Button, Card, Tag, Typography, Divider, Spin, Empty, Progress, message } from 'antd';
import { SearchOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import API_BASE_URL from '../../../../config/api';

const { Title, Text } = Typography;

/**
 * Order Status Page
 * 
 * Allows users to look up the status of an order by order number.
 * Finds the GUID from server cache, then fetches full order details from Toast API.
 */
const OrderStatus = () => {
    const { restaurantId } = useParams();
    const [orderNumber, setOrderNumber] = useState('');
    const [orderData, setOrderData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async () => {
        if (!orderNumber.trim()) {
            message.warning('Please enter an order number');
            return;
        }

        setLoading(true);
        setError('');
        setOrderData(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/orderStatus?orderNum=${orderNumber.trim()}&location=${restaurantId}`);
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to fetch order status');
            } else {
                setOrderData(data);
            }
        } catch (err) {
            setError('Unable to connect to server');
        }

        setLoading(false);
    };

    const getStatusTag = (status) => {
        switch (status) {
            case 'COMPLETED':
            case 'CLOSED':
                return <Tag icon={<CheckCircleOutlined />} color="green" style={{ fontSize: '1rem', padding: '4px 12px' }}>COMPLETED</Tag>;
            case 'IN PROGRESS':
            case 'OPEN':
                return <Tag icon={<ClockCircleOutlined />} color="blue" style={{ fontSize: '1rem', padding: '4px 12px' }}>IN PROGRESS</Tag>;
            case 'VOIDED':
                return <Tag icon={<CloseCircleOutlined />} color="red" style={{ fontSize: '1rem', padding: '4px 12px' }}>VOIDED</Tag>;
            default:
                return <Tag color="default" style={{ fontSize: '1rem', padding: '4px 12px' }}>{status}</Tag>;
        }
    };

    const getFulfillmentTag = (status) => {
        switch (status) {
            case 'READY':
                return <Tag color="green">Ready</Tag>;
            case 'SENT':
                return <Tag color="orange">Preparing</Tag>;
            case 'HOLD':
                return <Tag color="blue">Hold</Tag>;
            default:
                return <Tag>{status}</Tag>;
        }
    };

    const formatTime = (isoString) => {
        if (!isoString) return '—';
        return new Date(isoString).toLocaleString('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
            <Title level={2} style={{ color: '#fd590d', textAlign: 'center' }}>
                🔍 Order Status — {restaurantId}
            </Title>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
                <Input
                    size="large"
                    placeholder="Enter Order Number (e.g., 47)"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    onPressEnter={handleSearch}
                    prefix="#"
                    style={{ fontSize: '1.2rem' }}
                />
                <Button
                    type="primary"
                    size="large"
                    icon={<SearchOutlined />}
                    onClick={handleSearch}
                    loading={loading}
                    style={{ backgroundColor: '#fd590d', borderColor: '#fd590d', minWidth: '120px' }}
                >
                    Search
                </Button>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Spin size="large" />
                </div>
            )}

            {error && (
                <Card style={{ borderColor: '#ff4d4f', marginBottom: '20px' }}>
                    <Text type="danger" style={{ fontSize: '1.1rem' }}>{error}</Text>
                </Card>
            )}

            {orderData && (
                <Card style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <Title level={3} style={{ margin: 0 }}>Order #{orderData.displayNumber || orderData.orderNumber}</Title>
                        {getStatusTag(orderData.status)}
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <Text type="secondary">Source: </Text>
                        <Text strong>{orderData.source || '—'}</Text>
                        <Divider type="vertical" />
                        <Text type="secondary">Opened: </Text>
                        <Text>{formatTime(orderData.openedDate)}</Text>
                        {orderData.closedDate && (
                            <>
                                <Divider type="vertical" />
                                <Text type="secondary">Closed: </Text>
                                <Text>{formatTime(orderData.closedDate)}</Text>
                            </>
                        )}
                    </div>

                    {/* Progress bar - 20 min completion target */}
                    {orderData.openedDate && (() => {
                        const openedTime = new Date(orderData.openedDate).getTime();
                        const now = orderData.closedDate ? new Date(orderData.closedDate).getTime() : Date.now();
                        const elapsed = Math.floor((now - openedTime) / 60000); // minutes
                        const isComplete = orderData.status === 'COMPLETED' || orderData.status === 'CLOSED';
                        const percent = isComplete ? 100 : Math.min(100, Math.round((elapsed / 20) * 100));
                        const isOverdue = elapsed > 20 && !isComplete;

                        return (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                                        {isComplete ? `Completed in ${elapsed} min` : `Elapsed: ${elapsed} min / 20 min`}
                                    </Text>
                                    <Text type={isOverdue ? 'danger' : 'secondary'} style={{ fontSize: '0.85rem' }}>
                                        {isOverdue ? 'Overdue!' : isComplete ? '✅ Done' : `${20 - elapsed} min remaining`}
                                    </Text>
                                </div>
                                <Progress
                                    percent={percent}
                                    status={isComplete ? 'success' : isOverdue ? 'exception' : 'active'}
                                    strokeColor={isComplete ? '#52c41a' : isOverdue ? '#ff4d4f' : '#fd590d'}
                                    showInfo={false}
                                    size="small"
                                />
                            </div>
                        );
                    })()}

                    <Divider />

                    {orderData.checks && orderData.checks.map((check, idx) => (
                        <div key={idx} style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <Text strong style={{ fontSize: '1.1rem' }}>Check #{check.orderNumber}</Text>
                                <Text strong style={{ fontSize: '1.1rem', color: '#fd590d' }}>
                                    ${check.totalAmount?.toFixed(2) || '0.00'}
                                </Text>
                            </div>

                            {check.items.map((item, itemIdx) => (
                                <div key={itemIdx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                                    <div>
                                        <Text>{item.quantity}x {item.name}</Text>
                                        {' '}{getFulfillmentTag(item.fulfillmentStatus)}
                                    </div>
                                    <Text>${item.price?.toFixed(2) || '0.00'}</Text>
                                </div>
                            ))}
                        </div>
                    ))}

                    {(!orderData.checks || orderData.checks.length === 0) && (
                        <Empty description="No check details available" />
                    )}
                </Card>
            )}
        </div>
    );
};

export default OrderStatus;
