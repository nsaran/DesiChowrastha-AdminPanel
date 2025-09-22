import React, { useContext } from "react";
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './AuthProvider';

const ProtectedRoute = ({ children }) => {
    const { currentUser } = useContext(AuthContext);
    const location = useLocation();

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;
