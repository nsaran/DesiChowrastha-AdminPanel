const https = require('https');

https.get('https://repodepo.io/api/todaysSpecial?location=Nashua', (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => console.log('Status:', res.statusCode, '\nBody:', d));
}).on('error', e => console.error('Error:', e.message));
