const http = require('http');

// Create a test stock order for Nashua
const orderData = JSON.stringify({
    location: 'Nashua',
    orderedBy: 'Chef Kumar',
    items: [
        { name: 'Chicken Leg', category: 'Meat', ordered: '8 box' },
        { name: 'Goat Curry', category: 'Meat', ordered: '80 lbs' },
        { name: 'Onion Yellow', category: 'Vegetables', ordered: '6 bags' },
        { name: 'Tomato', category: 'Vegetables', ordered: '1 box' },
        { name: 'Yogurt', category: 'Dairy', ordered: '9 box' }
    ]
});

const req = http.request({
    hostname: 'localhost',
    port: 3010,
    path: '/api/stock-orders',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(orderData)
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', body.substring(0, 500));
    });
});

req.on('error', (e) => {
    console.error('Error:', e.message);
});

req.write(orderData);
req.end();
