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
import FacebookPost from './components/Restaurant/TvMenu/pages/FacebookPost';
import BarMenu from './components/Restaurant/TvMenu/pages/BarMenu';
import CustomerFeedback from './components/Restaurant/TvMenu/pages/CustomerFeedback';
import TodaysSpecial from './components/Restaurant/TvMenu/pages/TodaysSpecial';
import ManageTodaysSpecial from './components/Restaurant/TvMenu/pages/ManageTodaysSpecial';
import ChefsKitchen from './components/Restaurant/ChefsKitchen';
import FillerComponent from './components/Restaurant/Filler';
import CustomMenu from './components/Restaurant/CustomMenu/index';
import CustomTvMenuLanding from './components/Restaurant/CustomTvMenu/CustomTvMenuLanding';
import CustomTvMenuPageView from './components/Restaurant/CustomTvMenu/CustomTvMenuPageView';
import WhatsAppOrders from './components/Restaurant/TvMenu/pages/WhatsAppOrders';
import TabletMenu from './components/Restaurant/TvMenu/pages/TabletMenu';
import QRCodes from './components/Restaurant/TvMenu/pages/QRCodes';
import OrderStatus from './components/Restaurant/TvMenu/pages/OrderStatus';
import OtherServices from './components/Restaurant/OtherServices';
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
          <Route path="/dashboard/:restaurantId/TVMenu/BarMenu" element={<TvMenuErrorBoundary><BarMenu /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/OtherServices/CustomerFeedback" element={<TvMenuErrorBoundary><CustomerFeedback /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/OtherServices/TodaysSpecial" element={<TvMenuErrorBoundary><TodaysSpecial /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/OtherServices/ManageTodaysSpecial" element={<TvMenuErrorBoundary><ManageTodaysSpecial /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/customTvMenu" element={<CustomTvMenuLanding />} />
          <Route path="/dashboard/:restaurantId/customTvMenu/:pageId" element={<CustomTvMenuPageView />} />
          <Route path="/dashboard/:restaurantId/ChefsKitchen" element={<ChefsKitchen />} />
          <Route path="/dashboard/:restaurantId/customMenu" element={<CustomMenu />}/>
          <Route path="/dashboard/:restaurantId/OtherServices" element={<OtherServices />} />
          <Route path="/dashboard/:restaurantId/OtherServices/FacebookPost" element={<TvMenuErrorBoundary><FacebookPost /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/OtherServices/WhatsAppOrders" element={<WhatsAppOrders />}/>
          <Route path="/dashboard/:restaurantId/OtherServices/OrderStatus" element={<OrderStatus />}/>
          <Route path="/dashboard/:restaurantId/TabletMenu" element={<TabletMenu />}/>
          <Route path="/dashboard/:restaurantId/QRCodes" element={<QRCodes />}/>
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;