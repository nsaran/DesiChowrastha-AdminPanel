const https = require('https');

// Test completedOrders endpoint first to get a valid order number
https.get('https://repodepo.io/api/completedOrders?location=Nashua&noAlert=true', (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        console.log('completedOrders Status:', res.statusCode);
        try {
            const orders = JSON.parse(d);
            console.log('Total orders:', orders.length);
            if (orders.length > 0) {
                const orderNum = orders[0].orderNumber;
                console.log('Testing with order #' + orderNum);
                
                // Now test orderStatus with a real order number
                https.get(`https://repodepo.io/api/orderStatus?orderNum=${orderNum}&location=Nashua`, (res2) => {
                    let d2 = '';
                    res2.on('data', c => d2 += c);
                    res2.on('end', () => {
                        console.log('\norderStatus Status:', res2.statusCode);
                        console.log('Body:', d2.substring(0, 500));
                    });
                }).on('error', e => console.error('orderStatus Error:', e.message));
            } else {
                console.log('No completed orders found for today');
            }
        } catch (e) {
            console.log('Response:', d.substring(0, 300));
        }
    });
}).on('error', e => console.error('Error:', e.message));
