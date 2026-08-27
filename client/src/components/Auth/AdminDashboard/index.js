import React, { useState, useEffect } from 'react';
import { Button, Table, Modal, Form, Input, Avatar, Popover, Space, Popconfirm, message, Row, Col, Card, Divider, Tooltip } from 'antd';
import { PlusOutlined, UserOutlined, LogoutOutlined, EditOutlined, DeleteOutlined, UserAddOutlined, EllipsisOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import { auth, firestore } from '../../../config/firebase';
import './AdminDashboard.css';
import RestaurantForm from './components/RestaurantForm';
import ManagerForm from './components/ManagerForm';
import Header from './components/Header';
import Footer from './components/Footer';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [managerModalVisible, setManagerModalVisible] = useState(false);
  const [currentRestaurant, setCurrentRestaurant] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [adminEmail, setAdminEmail] = useState(null);
  const [form] = Form.useForm();
  const [managerForm] = Form.useForm();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.log(error);
    }
  };

  const handleAddRestaurant = (e) => {
    e.stopPropagation();
    form.resetFields();
    setEditRecord(null);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
  };

  const handleSaveRestaurant = async (values) => {
    try {
      setLoading(true);
      let messageContent = '';
      if (editRecord) {
        await firestore.collection('restaurants').doc(editRecord.id).update(values);
        messageContent = 'Restaurant updated successfully!';
        setRestaurants((prevRestaurants) =>
          prevRestaurants.map((restaurant) =>
            restaurant.id === editRecord.id ? { ...restaurant, ...values } : restaurant
          )
        );
      } else {
        // Extract restaurant name before comma for document ID
        const restaurantName = values.name;
        const documentId = restaurantName.includes(',') 
          ? restaurantName.split(',')[0].trim() 
          : restaurantName.trim();
        
        // Use setDoc with custom document ID
        await firestore.collection('restaurants').doc(documentId).set(values);
        messageContent = 'Restaurant added successfully!';
        setRestaurants((prevRestaurants) => [...prevRestaurants, { id: documentId, ...values }]);
      }
      setLoading(false);
      setModalVisible(false);
      message.success(messageContent);
    } catch (error) {
      setLoading(false);
      message.error(error.message);
    }
  };

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const snapshot = await firestore.collection('restaurants').get();
        const restaurantData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRestaurants(restaurantData);
      } catch (error) {
        console.log(error);
      }
    };
    fetchRestaurants();
  }, []);

  useEffect(() => {
    const getAdminEmail = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          setAdminEmail(user.email);
        }
      } catch (error) {
        console.log(error);
      }
    };
    getAdminEmail();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleEdit = (record) => {
    form.setFieldsValue(record);
    setEditRecord(record);
    setModalVisible(true);
  };

  const handleDelete = async (record) => {
    try {
      await firestore.collection('restaurants').doc(record.id).delete();
      setRestaurants((prevRestaurants) => prevRestaurants.filter((r) => r.id !== record.id));
      message.success('Restaurant deleted successfully!');
    } catch (error) {
      message.error('Failed to delete the restaurant.');
    }
  };

  const handleCreateManager = (record) => {
    managerForm.resetFields();
    setCurrentRestaurant(record.id);
    setManagerModalVisible(true);
  };

  const handleManagerModalClose = () => {
    setManagerModalVisible(false);
  };

  const handleSaveManager = async (values) => {
    try {
      setLoading(true);
      const docRef = firestore.collection('restaurants').doc(currentRestaurant).collection('managers').doc(values.username);

      const doc = await docRef.get();
      if (doc.exists) {
        message.error('Username already exists, please choose a different username.');
        setLoading(false);
        return;
      }

      const { user } = await auth.createUserWithEmailAndPassword(values.email, values.password);

      await docRef.set({ email: values.email, password: values.password });

      setLoading(false);
      setManagerModalVisible(false);
      message.success('Manager added successfully!');
    } catch (error) {
      setLoading(false);
      message.error(error.message);
    }
  };

  const actionsMenu = (record) => (
    <Space size="middle">
      <Tooltip title="Edit">
        <Button type="dashed" onClick={() => handleEdit(record)} icon={<EditOutlined />} />
      </Tooltip>
      <Popconfirm title="Are you sure you want to delete this restaurant?" onConfirm={() => handleDelete(record)} okText="Yes" cancelText="No">
        <Tooltip title="Delete">
          <Button type="dashed" danger icon={<DeleteOutlined />} />
        </Tooltip>
      </Popconfirm>
      <Tooltip title="Create Manager">
        <Button type="primary" onClick={() => handleCreateManager(record)} icon={<UserAddOutlined />} />
      </Tooltip>
    </Space>
  );

  const columns = [
    {
      title: 'Restaurant Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => <Link to={`/dashboard/${record.id}`}>{text}</Link>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (text) => `+${text}`,
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Popover content={() => actionsMenu(record)} trigger="click">
          <Button type="text">
            <EllipsisOutlined />
          </Button>
        </Popover>
      ),
    },
  ];

  const popoverContent = (
    <div>
      <p>{adminEmail}</p>
      <Button onClick={() => navigate('/dashboard/manage-users')} icon={<UserOutlined />} style={{ marginBottom: 8, width: '100%' }}>
        Manage Users
      </Button>
      <Button onClick={handleLogout} icon={<LogoutOutlined />} danger style={{ width: '100%' }}>
        Logout
      </Button>
    </div>
  );

  return (
    <div className="admin-dashboard">
      <Helmet>
        <title>DesiChowrastha Admin | Dashboard</title>
      </Helmet>
      <Header adminEmail={adminEmail} popoverContent={popoverContent} />
      <div className="admin-content">
        <Button type="primary" style={{ float: 'right', marginBottom: '24px' }} onClick={handleAddRestaurant}>
          <PlusOutlined /> Add Restaurant
        </Button>
        {isMobile ? (
          <div className="responsive-table" style={{ marginTop: '48px' }}>
            {restaurants.map((restaurant) => (
              <Card key={restaurant.id} className="restaurant-card">
                <Link to={`/dashboard/${restaurant.id}`} className="restaurant-link">
                  <h3>{restaurant.name}</h3>
                </Link>
                <Divider />
                <p className="restaurant-detail">Email: {restaurant.email}</p>
                <p className="restaurant-detail">Phone: {restaurant.phone}</p>
                <p className="restaurant-detail">Address: {restaurant.address}</p>
                <div className="actions-menu">{actionsMenu(restaurant)}</div>
              </Card>
            ))}
          </div>
        ) : (
          <Table columns={columns} dataSource={restaurants} />
        )}
      </div>
      <Footer restaurants={restaurants} />
      <RestaurantForm visible={modalVisible} onClose={handleModalClose} onSave={handleSaveRestaurant} form={form} loading={loading} editRecord={editRecord} />
      <ManagerForm visible={managerModalVisible} onClose={handleManagerModalClose} onSave={handleSaveManager} form={managerForm} loading={loading} />
    </div>
  );
};

export default AdminDashboard;
