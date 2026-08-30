import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useLocation } from 'react-router-dom';
import { firestore } from '../../../config/firebase';
import RestaurantDashboardHeader from './components/RestaurantDashboardHeader';
import RestaurantDashboardFooter from './components/RestaurantDashboardFooter';
import RestaurantDashboardContent from './components/RestaurantDashboardContent';
import InventoryManagementComponent from '../InventoryManagement';
import "./RestaurantDashboard.css";

const RestaurantDashboard = () => {
    const { restaurantId } = useParams();
    const { state } = useLocation();
    const managerData = state?.managerData;

    // Load the real locations from the `restaurants` collection so the footer's
    // "Our Locations" list matches what /dashboard shows (instead of sample data).
    const [restaurants, setRestaurants] = useState([]);

    useEffect(() => {
        const fetchRestaurants = async () => {
            try {
                const snapshot = await firestore.collection('restaurants').get();
                setRestaurants(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error('Failed to load locations:', error);
            }
        };
        fetchRestaurants();
    }, []);

    return (
        <div className="restaurant-dashboard">
            <Helmet>
                <title>DesiChowrastha {restaurantId} | Home</title>
            </Helmet>
            <RestaurantDashboardHeader managerData={managerData} />
            <RestaurantDashboardContent />
            <RestaurantDashboardFooter restaurants={restaurants} />
        </div>
    );
};

export default RestaurantDashboard;