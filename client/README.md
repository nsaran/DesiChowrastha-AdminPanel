# DesiChowrastha Admin Panel - Client

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5.6.4-blue.svg)](https://ant.design/)
[![Firebase](https://img.shields.io/badge/Firebase-9.23.0-orange.svg)](https://firebase.google.com/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3.3-purple.svg)](https://getbootstrap.com/)

A modern React-based frontend application for the DesiChowrastha restaurant management system. Built with Ant Design components and Firebase integration for a professional, scalable admin interface.

## Features

### Authentication System
- **Admin Login/Register**: Secure authentication for system administrators
- **Restaurant Manager Login**: Role-based access for restaurant managers
- **Protected Routes**: Secure navigation with authentication guards

### Admin Dashboard
- **Restaurant Management**: Add, edit, and manage restaurant locations
- **Manager Registration**: Create and manage restaurant manager accounts
- **Centralized Monitoring**: Overview of all restaurant operations

### Restaurant Management
- **Order Processing**: Real-time order management and tracking
- **Menu Management**: Dynamic menu creation and updates
- **Inventory Control**: Stock management and inventory tracking
- **Party Orders**: Special handling for large group orders
- **Chef's Kitchen**: Kitchen display system for order preparation
- **TV Menu Display**: Digital menu boards for customer viewing
- **Custom Menu Builder**: Create custom menu layouts

## Technology Stack

- **React 18.2.0** - Modern UI library with hooks and functional components
- **Ant Design 5.6.4** - Professional UI component library
- **React Router DOM 6.14.1** - Client-side routing
- **Firebase 9.23.0** - Authentication and real-time database
- **Axios 1.6.8** - HTTP client for API communication
- **Bootstrap 5.3.3** - CSS framework for responsive design
- **Highcharts 11.4.1** - Data visualization and reporting
- **Moment.js 2.29.4** - Date manipulation library
- **React Helmet 6.1.0** - Document head management

## Project Structure

```
client/
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   │   ├── Auth/          # Authentication components
│   │   │   ├── AdminDashboard/
│   │   │   ├── AdminLogin/
│   │   │   └── AdminRegister/
│   │   ├── Home/          # Home page components
│   │   └── Restaurant/    # Restaurant management components
│   │       ├── Auth/      # Restaurant authentication
│   │       ├── Dashboard/ # Restaurant dashboard
│   │       ├── Menu/      # Menu management
│   │       ├── Orders/    # Order processing
│   │       ├── PartyOrders/ # Party order management
│   │       ├── InventoryManagement/ # Inventory control
│   │       ├── TvMenu/    # TV menu display
│   │       └── ChefsKitchen/ # Kitchen display
│   ├── config/            # Configuration files
│   │   └── firebase.js    # Firebase configuration
│   ├── utils/             # Utility functions
│   │   ├── AuthProvider.js # Authentication context
│   │   └── ProtectedRoute.js # Route protection
│   ├── assets/            # Static assets
│   │   ├── css/          # Custom styles
│   │   └── images/       # Image assets
│   ├── App.js            # Main application component
│   └── index.js          # Application entry point
├── package.json          # Dependencies and scripts
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** (v14 or higher)
- **npm** (v6 or higher)

### Installation

1. **Navigate to the client directory**
   ```bash
   cd client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the client directory:
   ```env
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Available Scripts

### Development
```bash
npm start          # Start development server
npm test           # Run test suite
npm run build      # Build for production
npm run eject      # Eject from Create React App (one-way operation)
```

### Production Build
```bash
npm run build      # Creates optimized production build
```

The build folder contains the production-ready files that can be deployed to any static hosting service.

## Component Architecture

### Authentication Components
- **AdminLogin**: Admin authentication interface
- **AdminRegister**: Admin registration form
- **AdminDashboard**: Main admin control panel
- **RestaurantLoginPage**: Restaurant manager login

### Restaurant Management Components
- **RestaurantDashboard**: Restaurant-specific dashboard
- **MenuComponent**: Menu management interface
- **OrdersComponent**: Order processing system
- **InventoryManagement**: Stock and inventory control
- **PartyOrders**: Large group order handling
- **TvMenu**: Digital menu display system
- **ChefsKitchen**: Kitchen order display

## Routing Structure

The application uses React Router for navigation:

- `/` - Home page
- `/login` - Admin login
- `/register` - Admin registration
- `/dashboard` - Admin dashboard (protected)
- `/login/:restaurantId` - Restaurant manager login
- `/dashboard/:restaurantId` - Restaurant dashboard
- `/dashboard/:restaurantId/menu` - Menu management
- `/dashboard/:restaurantId/orders` - Order management
- `/dashboard/:restaurantId/inventoryManagement` - Inventory control
- `/dashboard/:restaurantId/partyorders` - Party orders
- `/dashboard/:restaurantId/TVMenu` - TV menu display
- `/dashboard/:restaurantId/ChefsKitchen` - Kitchen display

## State Management

The application uses React Context API for state management:

- **AuthProvider**: Manages authentication state
- **ProtectedRoute**: Handles route protection based on authentication

## Styling

The application uses a combination of styling approaches:

- **Ant Design**: Primary UI component library
- **Bootstrap**: CSS framework for responsive design
- **Custom CSS**: Component-specific styles
- **Styled Components**: Dynamic styling for complex components

## API Integration

The frontend communicates with the backend through:

- **Axios**: HTTP client for API requests
- **Firebase**: Real-time database and authentication
- **Proxy Configuration**: Development proxy to backend server

## Browser Support

The application supports all modern browsers:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Optimization

- **Code Splitting**: Lazy loading of components
- **Bundle Optimization**: Webpack optimization for production builds
- **Caching**: Efficient caching strategies for API calls
- **Image Optimization**: Optimized image loading and compression

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill process on port 3000
   npx kill-port 3000
   ```

2. **Firebase Configuration Errors**
   - Verify Firebase configuration in `src/config/firebase.js`
   - Check environment variables in `.env` file

3. **Build Failures**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

## Contributing

1. Follow the existing code style and patterns
2. Use Ant Design components for consistency
3. Write meaningful commit messages
4. Test your changes thoroughly
5. Update documentation as needed

## License

This project is part of the DesiChowrastha Admin Panel system. See the main project LICENSE file for details.