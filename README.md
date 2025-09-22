# DesiChowrastha Admin Panel

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green.svg)](https://nodejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-9.23.0-orange.svg)](https://firebase.google.com/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5.6.4-blue.svg)](https://ant.design/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

A comprehensive restaurant management system built with React and Node.js, designed specifically for DesiChowrastha restaurants. This admin panel provides complete control over restaurant operations including menu management, order processing, inventory tracking, and TV menu displays.

## Features

### Admin Dashboard
- **Restaurant Management**: Add and manage multiple restaurant locations
- **Manager Registration**: Create and manage restaurant manager accounts
- **Centralized Control**: Monitor all restaurant operations from a single interface

### Restaurant Operations
- **Order Management**: Real-time order processing and tracking
- **Menu Management**: Dynamic menu creation and updates
- **Inventory Management**: Track stock levels and manage inventory
- **Party Orders**: Special handling for large group orders
- **Chef's Kitchen**: Kitchen display system for order preparation
- **TV Menu Display**: Digital menu boards for customer viewing

### Technical Features
- **Real-time Updates**: Live order status and inventory updates
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Firebase Integration**: Secure authentication and data storage
- **Modern UI**: Built with Ant Design components for professional appearance
- **Multi-restaurant Support**: Manage multiple restaurant locations

## Technology Stack

### Frontend
- **React 18.2.0** - Modern UI library
- **Ant Design 5.6.4** - Professional UI component library
- **React Router DOM** - Client-side routing
- **Firebase** - Authentication and real-time database
- **Axios** - HTTP client for API communication
- **Highcharts** - Data visualization and reporting

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **CORS** - Cross-origin resource sharing
- **Winston** - Logging framework
- **Node Cache** - In-memory caching

## Project Structure

```
DCAdminPanel/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Auth/       # Authentication components
│   │   │   └── Restaurant/ # Restaurant management components
│   │   ├── config/         # Configuration files
│   │   └── utils/          # Utility functions
│   └── package.json
├── server/                 # Node.js backend application
│   ├── controllers/        # API route handlers
│   ├── services/          # Business logic services
│   └── utils/             # Utility functions
└── README.md
```

## Quick Start

### Prerequisites

- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kurubarana-TSS/DesiChowrastha-AdminPanel.git
   cd DesiChowrastha-AdminPanel
   ```

2. **Install dependencies**
   ```bash
   # Install client dependencies
   cd client
   npm install
   
   # Install server dependencies
   cd ../server
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Create environment files
   # Client: client/.env
   # Server: server/.env
   ```

4. **Start the applications**
   ```bash
   # Start the backend server (from server directory)
   npm start
   
   # Start the frontend (from client directory)
   npm start
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3010

## Development Setup

### Client Development
```bash
cd client
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
```

### Server Development
```bash
cd server
npm start          # Start production server
npm run dev        # Start development server with nodemon
```

## API Endpoints

- `GET /api/menu` - Fetch restaurant menu
- `GET /api/orders` - Get all orders
- `GET /api/bulkOrders` - Get bulk orders
- `GET /api/pendingOrders` - Get pending orders
- `GET /api/completedOrders` - Get completed orders
- `GET /api/completedOrders/notify` - Get notification status
- `GET /api/completedOrders/setNotify` - Set notification status

## Configuration

### Firebase Configuration
The application uses Firebase for authentication and data storage. Configure your Firebase project in `client/src/config/firebase.js`.

### Environment Variables
Create `.env` files in both client and server directories with the necessary configuration variables.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions, please contact the development team or create an issue in the repository.

## Acknowledgments

- Built with modern web technologies
- Designed for scalability and maintainability
- Optimized for restaurant operations