# DesiChowrastha Admin Panel - Server

[![Node.js](https://img.shields.io/badge/Node.js-Express-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19.2-lightgrey.svg)](https://expressjs.com/)
[![Winston](https://img.shields.io/badge/Winston-3.13.0-blue.svg)](https://github.com/winstonjs/winston)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

A robust Node.js backend API server for the DesiChowrastha restaurant management system. Built with Express.js and designed to handle restaurant operations including menu management, order processing, and real-time data synchronization.

## Features

### API Endpoints
- **Menu Management**: Fetch and manage restaurant menus
- **Order Processing**: Handle order creation, updates, and status tracking
- **Bulk Operations**: Process multiple orders efficiently
- **Order Status Tracking**: Monitor pending and completed orders
- **Notification System**: Real-time notifications for order updates

### Technical Features
- **RESTful API**: Clean and consistent API design
- **CORS Support**: Cross-origin resource sharing enabled
- **Caching**: In-memory caching for improved performance
- **Logging**: Comprehensive logging with Winston
- **Error Handling**: Robust error handling and response management
- **Environment Configuration**: Flexible configuration management

## Technology Stack

- **Node.js** - JavaScript runtime environment
- **Express.js 4.19.2** - Web application framework
- **CORS 2.8.5** - Cross-origin resource sharing middleware
- **Winston 3.13.0** - Logging framework
- **Node Cache 5.1.2** - In-memory caching
- **Axios 1.6.8** - HTTP client for external API calls
- **Nodemon 3.1.0** - Development server with auto-restart
- **Dotenv 16.4.5** - Environment variable management

## Project Structure

```
server/
├── controllers/           # API route handlers
│   ├── menuController.js  # Menu-related endpoints
│   └── orderController.js # Order-related endpoints
├── services/             # Business logic services
│   ├── authService.js    # Authentication services
│   ├── menuService.js    # Menu management services
│   └── orderService.js   # Order processing services
├── utils/                # Utility functions
│   └── logger.js         # Logging configuration
├── config/               # Configuration files
│   └── config.js         # Application configuration
├── debugging/            # Debug and testing files
│   └── response.json     # Sample API responses
├── index.js              # Main server file
├── package.json          # Dependencies and scripts
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** (v14 or higher)
- **npm** (v6 or higher)

### Installation

1. **Navigate to the server directory**
   ```bash
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the server directory:
   ```env
   PORT=3010
   NODE_ENV=development
   # Add other environment variables as needed
   ```

4. **Start the server**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Verify the server is running**
   The server will start on `http://localhost:3010` (or your configured PORT)

## Available Scripts

### Development
```bash
npm run dev      # Start development server with nodemon
npm start        # Start production server
npm test         # Run test suite (currently not implemented)
```

### Production
```bash
npm start        # Start production server
```

## API Documentation

### Base URL
```
http://localhost:3010/api
```

### Endpoints

#### Menu Management
- **GET** `/api/menu` - Fetch restaurant menu
  - Returns: Menu data with categories and items
  - Response: JSON object with menu structure

#### Order Management
- **GET** `/api/orders` - Get all orders
  - Returns: Complete list of orders
  - Response: JSON array of order objects

- **GET** `/api/bulkOrders` - Get bulk orders
  - Returns: Bulk order data
  - Response: JSON array of bulk order objects

- **GET** `/api/pendingOrders` - Get pending orders
  - Returns: Orders awaiting processing
  - Response: JSON array of pending order objects

- **GET** `/api/completedOrders` - Get completed orders
  - Returns: Successfully processed orders
  - Response: JSON array of completed order objects

#### Notification System
- **GET** `/api/completedOrders/notify` - Get notification status
  - Returns: Current notification settings
  - Response: JSON object with notification status

- **GET** `/api/completedOrders/setNotify` - Set notification status
  - Returns: Updated notification settings
  - Response: JSON object with updated status

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3010
NODE_ENV=development

# Database Configuration (if applicable)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=desichowrastha
DB_USER=username
DB_PASSWORD=password

# External API Configuration
EXTERNAL_API_URL=https://api.example.com
API_KEY=your_api_key

# Cache Configuration
CACHE_TTL=3600
```

### Server Configuration

The server configuration can be modified in `config/config.js`:

```javascript
module.exports = {
  port: process.env.PORT || 3010,
  environment: process.env.NODE_ENV || 'development',
  cache: {
    ttl: process.env.CACHE_TTL || 3600
  }
};
```

## Caching Strategy

The server implements in-memory caching using Node Cache:

- **Global Cache**: `global.cacheData` - General application data
- **Order Cache**: `global.newOrderCacheData` - Order-specific data
- **TTL**: Configurable time-to-live for cached data
- **Performance**: Reduces database queries and improves response times

## Logging

The application uses Winston for comprehensive logging:

- **Log Levels**: error, warn, info, debug
- **Log Format**: JSON format for structured logging
- **Log Output**: Console and file logging
- **Log Rotation**: Automatic log file rotation

### Log Configuration

```javascript
const logger = require('./utils/logger');

// Usage examples
logger.info('Server started successfully');
logger.error('Database connection failed');
logger.warn('High memory usage detected');
```

## Error Handling

The server implements comprehensive error handling:

- **HTTP Status Codes**: Proper status code responses
- **Error Messages**: Descriptive error messages
- **Logging**: All errors are logged for debugging
- **Graceful Degradation**: Server continues running after errors

## Performance Optimization

- **Caching**: In-memory caching for frequently accessed data
- **Compression**: Response compression for large data
- **Connection Pooling**: Efficient database connections
- **Memory Management**: Optimized memory usage

## Security Features

- **CORS**: Cross-origin resource sharing configuration
- **Input Validation**: Request data validation
- **Rate Limiting**: API rate limiting (can be implemented)
- **Authentication**: Secure API endpoints (can be implemented)

## Development Guidelines

### Code Structure
- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic
- **Utils**: Utility functions and helpers
- **Config**: Configuration management

### Error Handling
```javascript
try {
  // Business logic
  const result = await someAsyncOperation();
  res.json(result);
} catch (error) {
  logger.error('Operation failed:', error);
  res.status(500).json({ error: 'Internal server error' });
}
```

### Logging Best Practices
```javascript
// Use appropriate log levels
logger.info('User authenticated successfully');
logger.warn('Deprecated API endpoint used');
logger.error('Database connection failed', { error: error.message });
```

## Testing

### Running Tests
```bash
npm test
```

### Test Structure
- Unit tests for individual functions
- Integration tests for API endpoints
- Mock data for testing scenarios

## Deployment

### Production Deployment
1. Set `NODE_ENV=production`
2. Configure production environment variables
3. Use process manager (PM2) for production
4. Set up reverse proxy (Nginx)
5. Configure SSL certificates

### Docker Deployment
```dockerfile
FROM node:14-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3010
CMD ["npm", "start"]
```

## Monitoring and Maintenance

### Health Checks
- Server status monitoring
- Database connection monitoring
- Memory usage monitoring
- API response time monitoring

### Log Management
- Log rotation and cleanup
- Error log analysis
- Performance log monitoring

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port 3010
   lsof -i :3010
   # Kill the process
   kill -9 <PID>
   ```

2. **Memory Issues**
   ```bash
   # Monitor memory usage
   node --inspect index.js
   ```

3. **Database Connection Issues**
   - Check database credentials
   - Verify database server status
   - Check network connectivity

## Contributing

1. Follow Node.js best practices
2. Use consistent error handling
3. Add comprehensive logging
4. Write meaningful commit messages
5. Update documentation

## License

This project is part of the DesiChowrastha Admin Panel system. See the main project LICENSE file for details.
