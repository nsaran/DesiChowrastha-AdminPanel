import React, { useEffect, useState } from 'react';
import { Menu, Button } from 'antd';
import ChefsKitchenHeader from './components/ChefsKitchenHeader';
import { Card } from 'antd';
import { useParams } from 'react-router-dom';
import { firestore } from '../../../config/firebase';
import moment from 'moment';
import { CalendarOutlined } from '@ant-design/icons';
import { useKeepAlive } from '../TvMenu/useKeepAlive';


const ChefsKitchen = () => {
    const { restaurantId } = useParams();
    useKeepAlive(); // keep the browser awake on always-on kitchen displays
    const [activeKey, setActiveKey] = useState('todayOrders');
    const [todayOrders, setTodayOrders] = useState([]);
    const [tomorrowOrders, setTomorrowOrders] = useState([]);
    const [upcomingOrders, setUpcomingOrders] = useState([]);
    const [todayCount, setTodayCount] = useState(0);
    const [tomorrowCount, setTomorrowCount] = useState(0);
    const [upcomingCount, setUpcomingCount] = useState(0);
    
    

    const handleClick = (e) => {
        setActiveKey(e.key);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const snapshot = await firestore
                    .collection('restaurants')
                    .doc(restaurantId)
                    .collection('partyOrders')
                    .get();
                const allPartyOrders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                const todayDate = moment().format('YYYY-MM-DD');
                const todayOrders = allPartyOrders.filter((order) => order.cPartyDate === todayDate);
                setTodayOrders(todayOrders);
                setTodayCount(todayOrders.length);

                const tomorrowDate = moment().add(1, 'days').format('YYYY-MM-DD');
                const tomorrowOrders = allPartyOrders.filter((order) => order.cPartyDate === tomorrowDate);
                setTomorrowOrders(tomorrowOrders);
                setTomorrowCount(tomorrowOrders.length);

                // upcoming orders  
                const startDate = moment().add(2, 'days').startOf('day').format('YYYY-MM-DD');
                const upcomingOrders = allPartyOrders.filter(order =>
                    moment(order.cPartyDate).isSameOrAfter(startDate)
                );
                setUpcomingOrders(upcomingOrders);
                setUpcomingCount(upcomingOrders.length);

                

            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, [restaurantId]);



    return (
        <div className='ChefsKitchen'>
            <ChefsKitchenHeader />
            <div className="menu-container">
                <Menu mode="horizontal" onClick={handleClick} selectedKeys={[activeKey]}>
                    <Menu.Item key="todayOrders">
                        <Button type={activeKey === 'todayOrders' ? 'primary' : 'default'}>
                            <span className="button-label">Today's Orders <span className="count">({todayCount})</span></span>
                        </Button>

                    </Menu.Item>
                    <Menu.Item key="tomorrowOrders">
                        <Button type={activeKey === 'tomorrowOrders' ? 'primary' : 'default'}>
                            <span className="button-label">Tomorrow's Orders<span className="count">({tomorrowCount})</span></span>
                        </Button>
                    </Menu.Item>
                    <Menu.Item key="upcomingOrders">
                        <Button type={activeKey === 'upcomingOrders' ? 'primary' : 'default'}>
                            <span className="button-label">Upcoming's Orders<span className="count">({upcomingCount})</span></span>
                        </Button>
                    </Menu.Item>
                </Menu>
            </div>

            {/* today order's cart */}
            {activeKey === 'todayOrders' && (
                <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
                    {todayOrders.map(order => (
                        <div className="card-container">
                            <Card key={order.cInvoiceNumber} title={'#' + order.cInvoiceNumber} style={{ width: 700, margin: 20 }} hoverable>
                                <p>Name: {order.cName} {'(' + 'Ready at ' + order.cOrderDeliveryTime + ')'}</p>
                                <p><CalendarOutlined /> {'Order Date: ' + order.cOrderDate}</p>
                                <p><CalendarOutlined /> {'Party Date: ' + order.cPartyDate}</p>
                                <p>Items</p>
                                <table className="custom-table">
                                    <thead>
                                        <tr>
                                            <th>Item Name</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                            <th>Spice Level</th>
                                            <th>Tray Type</th>
                                            <th>Comments</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.cPartyOrderItems.map((item, index) => (
                                            <tr key={index}>
                                                <td>{item.itemName}</td>
                                                <td>{item.qty}</td>
                                                <td>{item.price}</td>
                                                <td>{item.spiceLevel}</td>
                                                <td>{item.trayType}</td>
                                                <td>{item.itemComments}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p>No ingredients added. Click on the "Add Ingredients" button to add ingredients.</p>

                            </Card>
                        </div>
                    ))}
                </div>
            )}

            {/* tomorrow's order cart */}
            {activeKey === 'tomorrowOrders' && (
                <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
                    {tomorrowOrders.map(order => (
                        <div className="card-container">
                            <Card key={order.cInvoiceNumber} title={'#' + order.cInvoiceNumber} style={{ width: 700, margin: 20 }} hoverable>
                                <p>Name: {order.cName} {'(' + 'Ready at ' + order.cOrderDeliveryTime + ')'}</p>
                                <p><CalendarOutlined /> {'Order Date: ' + order.cOrderDate}</p>
                                <p><CalendarOutlined /> {'Party Date: ' + order.cPartyDate}</p>
                                <p>Items</p>
                                <table className="custom-table">
                                    <thead>
                                        <tr>
                                            <th>Item Name</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                            <th>Spice Level</th>
                                            <th>Tray Type</th>
                                            <th>Comments</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.cPartyOrderItems.map((item, index) => (
                                            <tr key={index}>
                                                <td>{item.itemName}</td>
                                                <td>{item.qty}</td>
                                                <td>{item.price}</td>
                                                <td>{item.spiceLevel}</td>
                                                <td>{item.trayType}</td>
                                                <td>{item.itemComments}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p>No ingredients added. Click on the "Add Ingredients" button to add ingredients.</p>

                            </Card>
                        </div>
                    ))}
                </div>
            )}

            {/* upcoming orders cart */}
            {activeKey === 'upcomingOrders' && (
                <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
                    {upcomingOrders.map(order => (
                        <div className="card-container">
                            <Card key={order.cInvoiceNumber} title={'#' + order.cInvoiceNumber} style={{ width: 700, margin: 20 }} hoverable>
                                <p>Name: {order.cName} {'(' + 'Ready at ' + order.cOrderDeliveryTime + ')'}</p>
                                <p><CalendarOutlined /> {'Order Date: ' + order.cOrderDate}</p>
                                <p><CalendarOutlined /> {'Party Date: ' + order.cPartyDate}</p>
                                <p>Items</p>
                                <table className="custom-table">
                                    <thead>
                                        <tr>
                                            <th>Item Name</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                            <th>Spice Level</th>
                                            <th>Tray Type</th>
                                            <th>Comments</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.cPartyOrderItems.map((item, index) => (
                                            <tr key={index}>
                                                <td>{item.itemName}</td>
                                                <td>{item.qty}</td>
                                                <td>{item.price}</td>
                                                <td>{item.spiceLevel}</td>
                                                <td>{item.trayType}</td>
                                                <td>{item.itemComments}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p>No ingredients added. Click on the "Add Ingredients" button to add ingredients.</p>

                            </Card>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
};

export default ChefsKitchen;
