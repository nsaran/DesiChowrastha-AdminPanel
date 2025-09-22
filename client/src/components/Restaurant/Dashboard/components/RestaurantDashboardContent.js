import React, { useState, useEffect } from 'react';
import { message, Spin, Card, Button, Row, Col } from 'antd';
import { firestore } from '../../../../config/firebase';
import { useParams } from 'react-router-dom';
import '../RestaurantDashboardContent.css';

const RestaurantDashboardContent = () => {
    const { restaurantId } = useParams();
    const [loading, setLoading] = useState(false);
    const [restaurantData, setRestaurantData] = useState([]);
    const [isMobile, setIsMobile] = useState(false);

    const fetchRestaurantData = async () => {
        try {
            setLoading(true);
            const snapshot = await firestore.collection('restaurants').get();
            const restaurantData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setRestaurantData(restaurantData);
            setLoading(false);
        } catch (error) {
            setLoading(false);
            message.error('Failed to fetch restaurant data.');
        }
    };

    useEffect(() => {
        fetchRestaurantData();

        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const currentRestaurant = restaurantData.find((restaurant) => restaurant.id === restaurantId);

    const handleOrderNowClick = () => {
        if (currentRestaurant && currentRestaurant.orderNowURL) {
            window.open(currentRestaurant.orderNowURL, '_blank');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!currentRestaurant) {
        return <div>No restaurant data found.</div>;
    }

    return (
        <div className={isMobile ? 'mobile-view' : 'desktop-view'}>
            <Card className={isMobile ? 'mobile-card' : 'desktop-card'}>
                <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                        <h1>{currentRestaurant.name}</h1>
                        <Button type="primary" onClick={handleOrderNowClick} className={isMobile ? 'mobile-button' : 'desktop-button'}>
                            Order Now
                        </Button>
                    </div>
                </div>
            </Card>
            
        </div>
    );
};

export default RestaurantDashboardContent;
