const http = require('http');

const playlist = {
    tvId: 'lobby-tv',
    location: 'Nashua',
    items: [
        { type: 'url', src: '/dashboard/Nashua/TVMenu/Page1', label: 'Menu Page 1', duration: 60 },
        { type: 'url', src: '/dashboard/Nashua/TVMenu/Page2', label: 'Menu Page 2', duration: 60 },
        { type: 'url', src: '/dashboard/Nashua/OtherServices/TodaysSpecial', label: "Today's Special", duration: 30, checkApi: '/api/todaysSpecial?location=Nashua' },
        { type: 'url', src: 'https://www.youtube.com/embed/7KoDrRw-UEo?list=PLgpSgXM6XMXTTeEKhLu53TWTiGNdI3FSJ&autoplay=1&mute=1&loop=1', label: 'YouTube Playlist', duration: 300 },
        { type: 'image', src: '/_images/promos/goat-curry.jpg', label: 'Goat Curry', duration: 15 },
        { type: 'html', content: '<h1 style="color:#fd590d; font-size:4rem; font-family: Lobster, cursive;">Happy Hour 4-6 PM &#127866;</h1>', label: 'Happy Hour', duration: 15 }
    ]
};

const data = JSON.stringify(playlist);

const req = http.request({
    hostname: 'localhost',
    port: 3010,
    path: '/api/signage/playlist',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(body);
    });
});

req.on('error', (e) => {
    console.error('Error:', e.message);
    console.log('Make sure the server is running on port 3010');
});

req.write(data);
req.end();
