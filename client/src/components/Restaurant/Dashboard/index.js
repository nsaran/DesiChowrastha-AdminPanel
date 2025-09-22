import React from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useLocation } from 'react-router-dom';
import RestaurantDashboardHeader from './components/RestaurantDashboardHeader';
import RestaurantDashboardFooter from './components/RestaurantDashboardFooter';
import RestaurantDashboardContent from './components/RestaurantDashboardContent';
import InventoryManagementComponent from '../InventoryManagement';
import "./RestaurantDashboard.css";

const RestaurantDashboard = () => {
    const { restaurantId } = useParams();
    const { state } = useLocation();
    const managerData = state?.managerData;
    console.log(managerData);
    const restaurants = [
        // Sample data for testing
        { id: '1', name: 'Coppell, TX (Drive-Thru)', address: '121 TX-121, Coppell, TX - 75019' },
        { id: '2', name: 'The Colony, TX (Castle Hills)', address: '4600 TX-121, Lewisville, TX 75056' },
        // Add more sample data as needed
    ];

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