import React, { useState, useEffect, useContext } from "react";
import { useParams } from 'react-router-dom';
import { Button, Input, DatePicker, Form, Card, message, Space, Typography, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import API_BASE_URL from '../../../../config/api';
import { ThemeContext } from '../../../../utils/ThemeProvider';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * MenuPage10 - Chef's Admin: Manage Today's Special Items
 * 
 * Allows the chef to add, edit, and remove today's special items.
 * Supports up to 3 items with name, description, price, startDate, and endDate.
 * Items are only displayed on MenuPage9 during their validity period.
 */
const MenuPage10 = () => {
    const { restaurantId } = useParams();
    const { isDark } = useContext(ThemeContext);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    // Theme-aware colors for the native <input type="date"> elements
    // (Ant Design components adapt automatically; native inputs do not)
    const inputBorder = isDark ? '#362f26' : '#d9d9d9';
    const inputBg = isDark ? '#211c17' : '#fff';
    const inputText = isDark ? '#f3ede7' : '#333';

    // Fetch existing items on load
    useEffect(() => {
        const fetchItems = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/todaysSpecial?location=${restaurantId}&all=true`);
                const data = await response.json();
                if (data && data.length > 0) {
                    setItems(data.map(item => ({
                        ...item,
                        startDate: item.startDate || '',
                        endDate: item.endDate || '',
                    })));
                }
            } catch (error) {
                console.error("Error fetching specials:", error);
            }
            setFetching(false);
        };
        fetchItems();
    }, [restaurantId]);

    const addItem = () => {
        if (items.length >= 3) {
            message.warning("Maximum 3 special items allowed");
            return;
        }
        setItems([...items, { name: '', description: '', price: '', startDate: '', endDate: '' }]);
    };

    const removeItem = (index) => {
        const updated = items.filter((_, i) => i !== index);
        setItems(updated);
    };

    const updateItem = (index, field, value) => {
        const updated = [...items];
        updated[index] = { ...updated[index], [field]: value };
        setItems(updated);
    };

    const handleSave = async () => {
        // Validate
        for (const item of items) {
            if (!item.name) {
                message.error("Each item must have a name");
                return;
            }
            if (!item.startDate || !item.endDate) {
                message.error(`Please set start and end dates for "${item.name}"`);
                return;
            }
            if (item.endDate < item.startDate) {
                message.error(`End date must be after start date for "${item.name}"`);
                return;
            }
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/todaysSpecial`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location: restaurantId, items })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to save');
            }

            message.success("Today's specials saved successfully!");
        } catch (error) {
            message.error(error.message);
        }
        setLoading(false);
    };

    const containerStyle = {
        maxWidth: '800px',
        margin: '0 auto',
        padding: '30px',
        minHeight: '100vh',
    };

    const headerStyle = {
        textAlign: 'center',
        marginBottom: '30px',
    };

    const cardStyle = {
        marginBottom: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    };

    if (fetching) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Text>Loading...</Text>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            <div style={headerStyle}>
                <Title level={2} style={{ color: '#fd590d' }}>
                    🍳 Manage Today's Special
                </Title>
                <Text type="secondary" style={{ fontSize: '1.1rem' }}>
                    {restaurantId} — Add up to 3 special items
                </Text>
            </div>

            {items.map((item, index) => (
                <Card
                    key={index}
                    style={cardStyle}
                    title={`Item ${index + 1}`}
                    extra={
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => removeItem(index)}
                        >
                            Remove
                        </Button>
                    }
                >
                    <Form layout="vertical">
                        <Form.Item label="Item Name" required>
                            <Input
                                placeholder="e.g., Goat Biryani"
                                value={item.name}
                                onChange={(e) => updateItem(index, 'name', e.target.value)}
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item label="Description (optional)">
                            <TextArea
                                placeholder="e.g., Hyderabadi style with raita"
                                value={item.description}
                                onChange={(e) => updateItem(index, 'description', e.target.value)}
                                rows={2}
                            />
                        </Form.Item>

                        <Form.Item label="Price ($)">
                            <Input
                                type="number"
                                placeholder="e.g., 16.99"
                                value={item.price}
                                onChange={(e) => updateItem(index, 'price', e.target.value)}
                                prefix="$"
                                size="large"
                                style={{ maxWidth: '200px' }}
                            />
                        </Form.Item>

                        <Divider>Validity Period</Divider>

                        <Space size="large" wrap>
                            <Form.Item label="Start Date" required>
                                <input
                                    type="date"
                                    value={item.startDate}
                                    onChange={(e) => updateItem(index, 'startDate', e.target.value)}
                                    style={{
                                        padding: '8px 12px',
                                        fontSize: '1rem',
                                        borderRadius: '6px',
                                        border: `1px solid ${inputBorder}`,
                                        backgroundColor: inputBg,
                                        color: inputText,
                                    }}
                                />
                            </Form.Item>

                            <Form.Item label="End Date" required>
                                <input
                                    type="date"
                                    value={item.endDate}
                                    onChange={(e) => updateItem(index, 'endDate', e.target.value)}
                                    min={item.startDate}
                                    style={{
                                        padding: '8px 12px',
                                        fontSize: '1rem',
                                        borderRadius: '6px',
                                        border: `1px solid ${inputBorder}`,
                                        backgroundColor: inputBg,
                                        color: inputText,
                                    }}
                                />
                            </Form.Item>
                        </Space>
                    </Form>
                </Card>
            ))}

            <Space direction="vertical" style={{ width: '100%', marginTop: '20px' }} size="middle">
                {items.length < 3 && (
                    <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={addItem}
                        block
                        size="large"
                    >
                        Add Special Item
                    </Button>
                )}

                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={loading}
                    block
                    size="large"
                    style={{ backgroundColor: '#fd590d', borderColor: '#fd590d', height: '50px', fontSize: '1.2rem' }}
                    disabled={false}
                >
                    {items.length === 0 ? 'Clear All Specials' : 'Save Today\'s Specials'}
                </Button>
            </Space>
        </div>
    );
};

export default MenuPage10;
