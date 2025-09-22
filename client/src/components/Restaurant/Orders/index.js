import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firestore } from '../../../config/firebase';
import '../../../assets/css/styles.css';
import moment from 'moment';
import { message, Select, DatePicker, Statistic, Row, Col, Radio, Avatar, Popover, Menu, Button } from 'antd';
import { MenuOutlined, UserOutlined, AppstoreOutlined, OrderedListOutlined, ShoppingCartOutlined, TeamOutlined, LogoutOutlined } from '@ant-design/icons';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import HighchartsExporting from 'highcharts/modules/exporting';

HighchartsExporting(Highcharts);

const { Option } = Select;

const OrdersComponent = ({ managerData }) => {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('partyOrderCount');
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('today');
  const [orderCounts, setOrderCounts] = useState({ completed: 0, remaining: 0, total: 0 });
  const [totalCost, setTotalCost] = useState(0);
  const [startingDate, setStartDate] = useState('');
  const [endingDate, setEndDate] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [yearlyCount, setYearlyCount] = useState(0);
  const [chartType, setChartType] = useState('pie');

  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  const avatarColor = getRandomColor();
  const avatarLetter = managerData ? managerData.email.charAt(0).toUpperCase() : '?';

  const popoverContent = (
    <Menu>
      <Menu.Item key="dashboard" icon={<AppstoreOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}`)}>
        Dashboard
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="inventoryManagement" icon={<AppstoreOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}/inventoryManagement`, managerData)}>
                Inventory Management
            </Menu.Item>
      
      <Menu.Divider />
      <Menu.Item key="chefsKitchen" icon={<UserOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}/ChefsKitchen`)}>
        Chef's Kitchen
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="menuItems" icon={<OrderedListOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}/menu`)}>
        Menu
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="tvMenu" icon={<AppstoreOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}/TVMenu`)}>
        TV Menu
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="partyOrders" icon={<TeamOutlined />} onClick={() => navigate(`/dashboard/${restaurantId}/partyorders`)}>
        Party Orders
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={() => navigate(`/login/${restaurantId}`)} danger>
        Logout
      </Menu.Item>
    </Menu>
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapshot = await firestore.collection('restaurants').doc(restaurantId).collection('partyOrders').get();
        const allPartyOrders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        let startDate, endDate;
        if (selectedTimeFrame === 'today') {
          startDate = moment().startOf('day');
          endDate = moment().endOf('day');
        } else if (selectedTimeFrame === 'weekly') {
          startDate = moment().startOf('isoWeek');
          endDate = moment().endOf('isoWeek');
        } else if (selectedTimeFrame === 'monthly') {
          startDate = moment().startOf('month');
          endDate = moment().endOf('month');
        } else if (selectedTimeFrame === 'yearly') {
          startDate = moment().startOf('year');
          endDate = moment().endOf('year');
        } else if (selectedTimeFrame === 'customdateselection') {
          startDate = startingDate;
          endDate = endingDate;
        }

        const filteredOrders = allPartyOrders.filter((order) =>
          moment(order.cPartyDate).isBetween(startDate, endDate, null, '[]')
        );

        const completedCount = filteredOrders.filter((order) => order.cPartyOrderStatus === 'COMPLETED').length;
        const remainingCount = filteredOrders.length - completedCount;
        const totalCount = filteredOrders.length;

        const totalCost = filteredOrders.reduce((acc, order) => acc + parseFloat(order.cOrderTotal || 0), 0);

        setOrderCounts({ completed: completedCount, remaining: remainingCount, total: totalCount });
        setTotalCost(totalCost);

        const today = moment();
        const weeklyStart = moment().startOf('isoWeek');
        const monthlyStart = moment().startOf('month');
        const yearlyStart = moment().startOf('year');
        const todayOrders = allPartyOrders.filter((order) => moment(order.cPartyDate).isSame(today, 'day'));
        const weeklyOrders = allPartyOrders.filter((order) => moment(order.cPartyDate).isSame(weeklyStart, 'week'));
        const monthlyOrders = allPartyOrders.filter((order) => moment(order.cPartyDate).isSame(monthlyStart, 'month'));
        const yearlyOrders = allPartyOrders.filter((order) => moment(order.cPartyDate).isSame(yearlyStart, 'year'));

        setTodayCount(todayOrders.length);
        setWeeklyCount(weeklyOrders.length);
        setMonthlyCount(monthlyOrders.length);
        setYearlyCount(yearlyOrders.length);
      } catch (error) {
        message.error('Failed to fetch party orders data.');
      }
    };

    fetchData();
  }, [restaurantId, selectedTimeFrame, startingDate, endingDate]);

  const handleStartDateChange = (date, dateString) => {
    setStartDate(dateString);
  };

  const handleEndDateChange = (date, dateString) => {
    setEndDate(dateString);
  };

  const handleTimeFrameChange = (value) => {
    setSelectedTimeFrame(value);
  };

  const handleTabChange = (e) => {
    setActiveTab(e.target.value);
  };

  const handleChartTypeChange = (e) => {
    setChartType(e.target.value);
  };

  const chartOptions = {
    chart: {
      type: chartType
    },
    title: {
      text: activeTab === 'partyOrderCount' ? 'Party Orders Count' : 'Orders Made Count'
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.1f} %'
        },
        colors: ['#7cb5ec', '#434348', '#90ed7d', '#f7a35c']
      }
    },
    series: [
      {
        name: 'Orders',
        colorByPoint: true,
        data: [
          { name: 'Today', y: todayCount },
          { name: 'Weekly', y: weeklyCount },
          { name: 'Monthly', y: monthlyCount },
          { name: 'Yearly', y: yearlyCount }
        ]
      }
    ],
    exporting: {
      enabled: true
    }
  };

  return (
    <div>
      <header className="order-header">
        <div className="header-content">
          <img src="https://iili.io/HeKYJkB.png" alt="Logo" className="restaurant-logo" />
          <div className="tab-container" style={{ marginRight: 20 }}>
            <Radio.Group onChange={handleTabChange} value={activeTab} buttonStyle="solid">
              <Radio.Button value="partyOrderCount">Party Order Count</Radio.Button>
              <Radio.Button value="ordersMadeCount">Orders Made Count</Radio.Button>
            </Radio.Group>
          </div>
          <Popover content={popoverContent} trigger="click" placement="bottomRight">
            <Button type="text" className="admin-avatar-button">
              <Avatar style={{ backgroundColor: avatarColor }}>
                {avatarLetter}
              </Avatar>
              <MenuOutlined style={{ fontSize: '20px', marginLeft: '10px' }} />
            </Button>
          </Popover>
        </div>
      </header>
      <div className="timeframe-dropdown" style={{ margin: 20 }}>
        <label>Select Time Frame: </label>
        <Select value={selectedTimeFrame} onChange={handleTimeFrameChange}>
          <Option value="today">Today</Option>
          <Option value="weekly">Weekly</Option>
          <Option value="monthly">Monthly</Option>
          <Option value="yearly">Yearly</Option>
          <Option value="customdateselection">Custom date Selection</Option>
        </Select>
        {selectedTimeFrame === 'customdateselection' && (
          <>
            <DatePicker onChange={handleStartDateChange} />
            <DatePicker onChange={handleEndDateChange} />
          </>
        )}
      </div>
      <Row gutter={16} style={{ margin: 20 }}>
        <Col span={8}>
          <Statistic title="Total Orders" value={orderCounts.total} />
        </Col>
        <Col span={8}>
          <Statistic title="Completed Orders" value={orderCounts.completed} />
        </Col>
        <Col span={8}>
          <Statistic title="Remaining Orders" value={orderCounts.remaining} />
        </Col>
        <Col span={8}>
          <Statistic title="Total Cost" value={`$${totalCost}`} />
        </Col>
      </Row>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Radio.Group onChange={handleChartTypeChange} value={chartType} buttonStyle="solid">
          <Radio.Button value="pie">Pie</Radio.Button>
          <Radio.Button value="column">Column</Radio.Button>
          <Radio.Button value="bar">Bar</Radio.Button>
          <Radio.Button value="line">Line</Radio.Button>
        </Radio.Group>
      </div>
      <div style={{ margin: 38 }}>
        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
      </div>
    </div>
  );
};

export default OrdersComponent;