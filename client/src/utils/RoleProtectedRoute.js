import React, { useContext } from "react";
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthContext } from './AuthProvider';
import { Spin } from 'antd';

/**
 * Route guard that checks:
 * 1. Authentication — user must be logged in
 * 2. Role — user's role must be in allowedRoles
 * 3. Restaurant — non-owners can only access their assigned restaurant
 * 
 * While auth state is loading, shows a spinner (not a redirect).
 */
const RoleProtectedRoute = ({ children, allowedRoles }) => {
    const { currentUser, role, assignedRestaurant, loading } = useContext(AuthContext);
    const location = useLocation();
    const { restaurantId } = useParams();

    // Still loading auth state — show spinner, don't redirect
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    // Not logged in — redirect to appropriate login page
    if (!currentUser) {
        if (restaurantId) {
            return <Navigate to={`/login/${restaurantId}`} state={{ from: location }} replace />;
        }
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Logged in but role not allowed
    if (!role || !allowedRoles.includes(role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    // Non-owners can only access their assigned restaurant
    if (role !== 'owner' && restaurantId && assignedRestaurant) {
        if (assignedRestaurant.toLowerCase() !== restaurantId.toLowerCase()) {
            return <Navigate to="/unauthorized" replace />;
        }
    }

    return children;
};

export default RoleProtectedRoute;
