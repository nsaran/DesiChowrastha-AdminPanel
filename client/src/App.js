import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './utils/AuthProvider';
import RoleProtectedRoute from './utils/RoleProtectedRoute';
import AdminLogin from './components/Auth/AdminLogin';
import AdminDashboard from './components/Auth/AdminDashboard';
import ManageUsers from './components/Auth/ManageUsers';
import ChangePassword from './components/Auth/ChangePassword';
import Unauthorized from './components/Auth/Unauthorized';
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
import SignagePlayer from './components/Restaurant/TvMenu/pages/SignagePlayer';
import ManageSignage from './components/Restaurant/TvMenu/pages/ManageSignage';
import StockOrders from './components/Restaurant/TvMenu/pages/StockOrders';
import OtherServices from './components/Restaurant/OtherServices';
import Financials from './components/Restaurant/Financials';
import YearlyReport from './components/Restaurant/Financials/YearlyReport';
import BalanceSheet from './components/Restaurant/Financials/BalanceSheet';
import ProfitLoss from './components/Restaurant/Financials/ProfitLoss';
import Employees from './components/Restaurant/Financials/Employees';
import SalaryLedger from './components/Restaurant/Financials/SalaryLedger';
import SalaryYearView from './components/Restaurant/Financials/SalaryYearView';
import BankTransactions from './components/Restaurant/OtherServices/BankTransactions';
import TvMenuErrorBoundary from './components/Restaurant/TvMenu/ErrorBoundary';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route exact path="/" element={<HomePage />} />
          <Route exact path="/login" element={<AdminLogin />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/login/:restaurantId" element={<RestaurantLoginPage />} />

          {/* Customer-facing routes (no auth required) */}
          <Route path="/dashboard/:restaurantId/OtherServices/TabletMenu" element={<TabletMenu />} />
          <Route path="/dashboard/:restaurantId/OtherServices/QRCodes" element={<QRCodes />} />
          <Route path="/dashboard/:restaurantId/OtherServices/OrderStatus" element={<OrderStatus />} />
          <Route path="/dashboard/:restaurantId/OtherServices/CustomerFeedback" element={<TvMenuErrorBoundary><CustomerFeedback /></TvMenuErrorBoundary>} />
          <Route path="/dashboard/:restaurantId/OtherServices/TodaysSpecial" element={<TvMenuErrorBoundary><TodaysSpecial /></TvMenuErrorBoundary>} />

          {/* TV display routes (no auth - these run on restaurant TVs) */}
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
          <Route path="/dashboard/:restaurantId/customTvMenu" element={<CustomTvMenuLanding />} />
          <Route path="/dashboard/:restaurantId/customTvMenu/:pageId" element={<CustomTvMenuPageView />} />
          <Route path="/dashboard/:restaurantId/signage" element={<TvMenuErrorBoundary><SignagePlayer /></TvMenuErrorBoundary>} />

          {/* Change password - accessible to all authenticated roles */}
          <Route path="/dashboard/:restaurantId/change-password" element={<RoleProtectedRoute allowedRoles={['owner', 'manager', 'chef']}><ChangePassword /></RoleProtectedRoute>} />
          <Route path="/change-password" element={<RoleProtectedRoute allowedRoles={['owner', 'manager', 'chef']}><ChangePassword /></RoleProtectedRoute>} />

          {/* Owner only routes */}
          <Route path="/dashboard" element={<RoleProtectedRoute allowedRoles={['owner']}><AdminDashboard /></RoleProtectedRoute>} />
          <Route path="/dashboard/manage-users" element={<RoleProtectedRoute allowedRoles={['owner']}><ManageUsers /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId" element={<RoleProtectedRoute allowedRoles={['owner', 'manager', 'chef']}><RestaurantDashboard /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/partyorders" element={<RoleProtectedRoute allowedRoles={['owner', 'manager']}><RestaurantPartyOrdersComponent /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/inventoryManagement" element={<RoleProtectedRoute allowedRoles={['owner']}><InventoryManagementComponent /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/inventoryApproval" element={<RoleProtectedRoute allowedRoles={['owner']}><InventoryApprovalComponent /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/orders" element={<RoleProtectedRoute allowedRoles={['owner']}><OrdersComponent /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/filler" element={<RoleProtectedRoute allowedRoles={['owner']}><FillerComponent /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/ChefsKitchen" element={<RoleProtectedRoute allowedRoles={['owner', 'manager']}><ChefsKitchen /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/customMenu" element={<RoleProtectedRoute allowedRoles={['owner']}><CustomMenu /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/OtherServices" element={<RoleProtectedRoute allowedRoles={['owner', 'manager', 'chef']}><OtherServices /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/OtherServices/FacebookPost" element={<RoleProtectedRoute allowedRoles={['owner']}><TvMenuErrorBoundary><FacebookPost /></TvMenuErrorBoundary></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/OtherServices/WhatsAppOrders" element={<RoleProtectedRoute allowedRoles={['owner']}><WhatsAppOrders /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/Financials" element={<RoleProtectedRoute allowedRoles={['owner', 'accountsManager']}><Financials /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/Financials/BankTransactions" element={<RoleProtectedRoute allowedRoles={['owner', 'accountsManager']}><BankTransactions /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/Financials/YearlyReport" element={<RoleProtectedRoute allowedRoles={['owner', 'accountsManager']}><YearlyReport /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/Financials/BalanceSheet" element={<RoleProtectedRoute allowedRoles={['owner', 'accountsManager']}><BalanceSheet /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/Financials/ProfitLoss" element={<RoleProtectedRoute allowedRoles={['owner', 'accountsManager']}><ProfitLoss /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/Financials/Employees" element={<RoleProtectedRoute allowedRoles={['owner', 'accountsManager']}><Employees /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/Financials/SalaryLedger" element={<RoleProtectedRoute allowedRoles={['owner', 'accountsManager']}><SalaryLedger /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/Financials/SalaryYearView" element={<RoleProtectedRoute allowedRoles={['owner', 'accountsManager']}><SalaryYearView /></RoleProtectedRoute>} />

          {/* Chef routes */}
          <Route path="/dashboard/:restaurantId/OtherServices/ManageTodaysSpecial" element={<RoleProtectedRoute allowedRoles={['owner', 'chef']}><TvMenuErrorBoundary><ManageTodaysSpecial /></TvMenuErrorBoundary></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/OtherServices/StockOrders" element={<RoleProtectedRoute allowedRoles={['owner', 'chef', 'manager']}><StockOrders /></RoleProtectedRoute>} />

          {/* Manager routes */}
          <Route path="/dashboard/:restaurantId/menu" element={<RoleProtectedRoute allowedRoles={['owner', 'manager']}><MenuComponent /></RoleProtectedRoute>} />
          <Route path="/dashboard/:restaurantId/OtherServices/ManageSignage" element={<RoleProtectedRoute allowedRoles={['owner', 'manager']}><ManageSignage /></RoleProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;