import React, { useState, useEffect, useCallback } from "react";
import { Tabs, Input, Button, Spin, Typography } from 'antd';
import { SendOutlined, RobotOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { renderToastMenuItems } from "../renderMenuItems";
import { useMenuItemDetail } from '../useMenuItemDetail';
import API_BASE_URL from '../../../../config/api';
import logo from '../../../../assets/images/dc-nashua-logo.webp';
import GoogleFontLoader from "react-google-font";

const { Text } = Typography;
const { TabPane } = Tabs;

/**
 * TabletMenu - Customer-facing tablet page
 * 
 * Shows all menu pages as tabs for a specific location.
 * Customers can tap items to see AI-generated descriptions and images.
 * Includes an AI chat assistant at the top for questions.
 * 
 * Route: /dashboard/:restaurantId/TabletMenu
 */
const TabletMenu = () => {
    const { restaurantId } = useParams();
    const [menu, setMenu] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [chatQuestion, setChatQuestion] = useState('');
    const [chatAnswer, setChatAnswer] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const { setSelectedItem, detailModal } = useMenuItemDetail();

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/menu?location=${restaurantId}`);
                const data = await response.json();
                setMenu(data);
            } catch (error) {
                console.error("Error fetching menu:", error);
            }
            setIsLoading(false);
        };
        fetchMenu();
    }, [restaurantId]);

    const handleAskAI = async () => {
        if (!chatQuestion.trim()) return;
        setChatLoading(true);
        setChatAnswer('');

        try {
            const response = await fetch(`${API_BASE_URL}/api/menu/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: chatQuestion, location: restaurantId })
            });
            const data = await response.json();
            setChatAnswer(data.answer || 'Sorry, I could not find an answer.');
        } catch (error) {
            setChatAnswer('Unable to connect. Please try again.');
        }
        setChatLoading(false);
    };

    // Get menu groups for the location
    const getGroups = () => {
        if (!menu || menu.length === 0) return [];
        return menu[0]?.menuGroups || [];
    };

    // Get all items with a specific dietary tag
    const getItemsByTag = (tagName) => {
        if (!menu || menu.length === 0) return [];
        const items = [];
        for (const menuSection of menu) {
            for (const group of (menuSection.menuGroups || [])) {
                for (const item of (group.menuItems || [])) {
                    if (item.itemTags && item.itemTags.some(tag => tag.name.toUpperCase() === tagName.toUpperCase())) {
                        items.push({ ...item, category: group.name });
                    }
                }
            }
        }
        return items;
    };

    const dietaryTags = [
        { key: 'JAIN', label: '🥗 Jain', color: '#4caf50' },
        { key: 'VEGAN', label: '🌱 Vegan', color: '#2e7d32' },
        { key: 'LACTOSE_FREE', label: '🥛 Lactose Free', color: '#1976d2' },
        { key: 'NUTS_FREE', label: '🥜 Nuts Free', color: '#f57c00' },
        { key: 'GLUTON_FREE', label: '🌾 Gluten Free', color: '#7b1fa2' },
    ];

    // Organize groups into tabs
    const getTabs = () => {
        const groups = getGroups();
        const tabConfig = {
            WESTBOROUGH: [
                { label: 'Tiffins & Dosas', categories: ['Tiffins', 'Dosa'] },
                { label: 'Appetizers', categories: ['Veg Appetizers', 'Non-Veg Appetizers'] },
                { label: 'Curries', categories: ['Veg Curries', 'Non-Veg Curries'] },
                { label: 'Biryani & Rice', categories: ['Veg Special Biryani', 'Non-Veg Special Biryani', 'Pulao', 'Rice'] },
                { label: 'Breads & Wok', categories: ['Breads', 'Indian Wok'] },
                { label: 'Drinks & Desserts', categories: ['Beverages', 'Fresh Juice', 'Desserts', 'Ice Cream'] },
                { label: 'Snacks & Chaat', categories: ['Snack Box', 'Chaat', 'Street Style'] },
                { label: 'Tandoor & Specials', categories: ['Tandoor', 'Special Dips', 'Chowrastha Specials'] },
            ],
            NASHUA: [
                { label: 'Tiffins & Dosas', categories: ['Tiffins', 'Dosa'] },
                { label: 'Appetizers', categories: ['Veg  Appetizers', 'Non-Veg  Appetizers'] },
                { label: 'Curries', categories: ['Veg  Curries', 'Non-Veg  Curries'] },
                { label: 'Biryani & Rice', categories: ["Biryani's", 'Pulao', 'Rice Specials'] },
                { label: 'Breads & Wok', categories: ['Breads', 'Indian Wok'] },
                { label: 'Drinks & Desserts', categories: ['Drinks', 'Desserts', 'Sweets and Snacks - Coming Soon'] },
                { label: 'Snacks & Chaat', categories: ['Snacks (Available from 5 PM)', 'Chaat', 'Street Style'] },
                { label: 'Tandoor & Specials', categories: ['Tandoor', 'Sides', 'Week End Special', 'Bakery'] },
            ]
        };

        const locationKey = restaurantId?.toUpperCase() || 'WESTBOROUGH';
        return tabConfig[locationKey] || tabConfig.WESTBOROUGH;
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fafafa' }}>
            <GoogleFontLoader fonts={[{ font: "Lobster" }, { font: "Bree Serif" }]} />
            {detailModal}

            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                backgroundColor: '#fff',
                borderBottom: '2px solid #fd590d',
                position: 'sticky',
                top: 0,
                zIndex: 100,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={logo} alt="Desi Chowrastha" style={{ width: '50px', height: 'auto' }} />
                    <span style={{ fontFamily: "'Lobster', cursive", fontSize: '1.5rem', color: '#fd590d' }}>
                        Desi Chowrastha
                    </span>
                </div>
                <Text type="secondary" style={{ fontSize: '0.9rem' }}>{restaurantId}</Text>
            </div>

            {/* AI Chat Bar */}
            <div style={{
                padding: '12px 20px',
                backgroundColor: '#fff',
                borderBottom: '1px solid #eee',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
            }}>
                <RobotOutlined style={{ fontSize: '1.5rem', color: '#fd590d', marginTop: '6px' }} />
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Input
                            placeholder="Ask me anything about our menu... (e.g., 'What's spicy?', 'Vegetarian options?')"
                            value={chatQuestion}
                            onChange={(e) => setChatQuestion(e.target.value)}
                            onPressEnter={handleAskAI}
                            style={{ borderRadius: '20px' }}
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={handleAskAI}
                            loading={chatLoading}
                            style={{ borderRadius: '20px', backgroundColor: '#fd590d', borderColor: '#fd590d' }}
                        />
                    </div>
                    {chatAnswer && (
                        <div style={{
                            marginTop: '8px',
                            padding: '10px 14px',
                            backgroundColor: '#f9f9f9',
                            borderRadius: '12px',
                            fontSize: '0.95rem',
                            lineHeight: '1.5',
                            color: '#333',
                        }}>
                            {chatAnswer}
                        </div>
                    )}
                </div>
            </div>

            {/* Menu Tabs */}
            <div style={{ padding: '0 20px' }}>
                <Tabs
                    defaultActiveKey="menu"
                    tabBarStyle={{ fontFamily: "'Bree Serif', serif", fontSize: '1rem' }}
                    size="large"
                    type="card"
                >
                    {/* Main Menu Tab */}
                    <TabPane tab="📋 Full Menu" key="menu">
                        <Tabs
                            defaultActiveKey="0"
                            tabPosition="top"
                            size="small"
                        >
                            {getTabs().map((tab, index) => (
                                <TabPane tab={tab.label} key={index}>
                                    <div style={{ padding: '10px 0' }}>
                                        {tab.categories.map(category => (
                                            <div key={category} style={{ marginBottom: '20px' }}>
                                                <h2 className="cat-title" style={{ fontFamily: "Lobster", fontSize: '2rem' }}>
                                                    {category}
                                                </h2>
                                                {renderToastMenuItems(menu, category, setSelectedItem)}
                                            </div>
                                        ))}
                                    </div>
                                </TabPane>
                            ))}
                        </Tabs>
                    </TabPane>

                    {/* Dietary Tags Tabs */}
                    {dietaryTags.map(tag => {
                        const tagItems = getItemsByTag(tag.key);
                        return (
                            <TabPane tab={`${tag.label} (${tagItems.length})`} key={tag.key}>
                                <div style={{ padding: '10px 0' }}>
                                    {tagItems.length > 0 ? (
                                        (() => {
                                            // Group items by category
                                            const grouped = {};
                                            tagItems.forEach(item => {
                                                if (!grouped[item.category]) grouped[item.category] = [];
                                                grouped[item.category].push(item);
                                            });

                                            return Object.entries(grouped).map(([category, items]) => (
                                                <div key={category} style={{ marginBottom: '20px' }}>
                                                    <h2 className="cat-title" style={{ fontFamily: "Lobster", fontSize: '2rem' }}>
                                                        {category}
                                                    </h2>
                                                    {items.map(item => (
                                                        <div
                                                            key={item.id}
                                                            className="menu-item reduced-spacing"
                                                            onClick={() => setSelectedItem(item)}
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            <h4 className={item.isAvailable === false ? "sold-out-menu-item-name" : ""}>
                                                                <span style={{
                                                                    display: 'inline-block',
                                                                    width: '10px',
                                                                    height: '10px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: tag.color,
                                                                    marginRight: '8px'
                                                                }}></span>
                                                                {item.name}
                                                                <span className="menu-item-price">
                                                                    {item.isAvailable === false ? "N/A" : `$ ${parseFloat(item.price || 0).toFixed(2)}`}
                                                                </span>
                                                            </h4>
                                                        </div>
                                                    ))}
                                                </div>
                                            ));
                                        })()
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                            No {tag.label} items available at this time.
                                        </div>
                                    )}
                                </div>
                            </TabPane>
                        );
                    })}
                </Tabs>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '0.85rem' }}>
                Tap any item to see details • Powered by AI
            </div>
        </div>
    );
};

export default TabletMenu;

