import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './utils/AuthProvider';
import ProtectedRoute from './utils/ProtectedRoute';
import AdminRegister from './components/Auth/AdminRegister';
import AdminLogin from './components/Auth/AdminLogin';
import AdminDashboard from './components/Auth/AdminDashboard';
import RestaurantLoginPage from './components/Restaurant/Auth';
import RestaurantDashboard from './components/Restaurant/Dashboard';
import RestaurantPartyOrdersComponent from './components/Restaurant/PartyOrders';
import InventoryManagementComponent from './components/Restaurant/InventoryManagement';
import InventoryApprovalComponent from './components/Restaurant/InventoryApproval';
import MenuComponent from './components/Restaurant/Menu';
import OrdersComponent from './components/Restaurant/Orders/index';
import HomePage from './components/Home/index';
import TvMenu from './components/Restaurant/TvMenu/index';
import Page1 from './components/Restaurant/TvMenu/pages/Page1';
import Page2 from './components/Restaurant/TvMenu/pages/Page2';
import Page3 from './components/Restaurant/TvMenu/pages/Page3';
import Page4 from './components/Restaurant/TvMenu/pages/Page4';
import MenuPage1 from './components/Restaurant/TvMenu/pages/MenuPage1';
import MenuPage2 from './components/Restaurant/TvMenu/pages/MenuPage2';
import MenuPage3 from './components/Restaurant/TvMenu/pages/MenuPage3';
import MenuPage4 from './components/Restaurant/TvMenu/pages/MenuPage4';
import MenuPage5 from './components/Restaurant/TvMenu/pages/MenuPage5';
import MenuPage6 from './components/Restaurant/TvMenu/pages/MenuPage6';
import MenuPage7 from './components/Restaurant/TvMenu/pages/MenuPage7';
import MenuPage8 from './components/Restaurant/TvMenu/pages/MenuPage8';
import MenuPage9 from './components/Restaurant/TvMenu/pages/MenuPage9';
import ChefsKitchen from './components/Restaurant/ChefsKitchen';
import FillerComponent from './components/Restaurant/Filler';
import CustomMenu from './components/Restaurant/CustomMenu/index';
import CustomTvMenuLanding from './components/Restaurant/CustomTvMenu/CustomTvMenuLanding';
import CustomTvMenuPageView from './components/Restaurant/CustomTvMenu/CustomTvMenuPageView';
import TvMenuErrorBoundary from './components/Restaurant/TvMenu/ErrorBoundary';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route exact path="/" element={<HomePage />} />
          <Route exact path="/login" element={<AdminLogin />} />
          <Route path="/register" element={<AdminRegister />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/login/:restaurantId" element={<RestaurantLoginPage />} />
          <Route path="/dashboard/:restaurantId" element={<RestaurantDashboard />} />
          <Route path="/dashboard/:restaurantId/partyorders" element={<RestaurantPartyOrdersComponent />} />
          <Route path="/dashboard/:restaurantId/inventoryManagement" element={<InventoryManagementComponent />} />
          <Route path="/dashboard/:restaurantId/inventoryApproval" element={<InventoryApprovalComponent />} />
          <Route path="/dashboard/:restaurantId/menu" element={<MenuComponent />} />
          <Route path="/dashboard/:restaurantId/filler" element={<FillerComponent />} />
          <Route path="/dashboard/:restaurantId/orders" element={<OrdersComponent />} />
          <Route path="/dashboard/:restaurantId/TVMenu" element={<TvMenu />} />
          <Route path="/dashboard/:restaurantId/TVMenu/Page1" element={<TvMenuErrorBoundary><Page1 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/Page2" element={<TvMenuErrorBoundary><Page2 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/Page3" element={<TvMenuErrorBoundary><Page3 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/Page4" element={<TvMenuErrorBoundary><Page4 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/MenuPage1" element={<TvMenuErrorBoundary><MenuPage1 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/MenuPage2" element={<TvMenuErrorBoundary><MenuPage2 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/MenuPage3" element={<TvMenuErrorBoundary><MenuPage3 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/MenuPage4" element={<TvMenuErrorBoundary><MenuPage4 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/MenuPage5" element={<TvMenuErrorBoundary><MenuPage5 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/MenuPage6" element={<TvMenuErrorBoundary><MenuPage6 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/MenuPage7" element={<TvMenuErrorBoundary><MenuPage7 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/MenuPage8" element={<TvMenuErrorBoundary><MenuPage8 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/TVMenu/MenuPage9" element={<TvMenuErrorBoundary><MenuPage9 /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/customTvMenu" element={<CustomTvMenuLanding />} />
          <Route path="/dashboard/:restaurantId/customTvMenu/:pageId" element={<CustomTvMenuPageView />} />
          <Route path="/dashboard/:restaurantId/ChefsKitchen" element={<ChefsKitchen />} />
          <Route path="/dashboard/:restaurantId/customMenu" element={<CustomMenu />}/>
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;