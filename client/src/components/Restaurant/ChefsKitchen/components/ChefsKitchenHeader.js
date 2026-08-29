import React, { useState } from 'react';
import { PlusOutlined, MenuOutlined } from '@ant-design/icons';
import { Button, Modal, Select, Input, Avatar, Popover, Menu } from 'antd';
import { UserOutlined, AppstoreOutlined, OrderedListOutlined, ShoppingCartOutlined, TeamOutlined, LogoutOutlined, KeyOutlined } from '@ant-design/icons';
import { firestore } from '../../../../config/firebase';
import { useNavigate, useParams } from 'react-router-dom';

const ChefsKitchenHeader = ({ managerData }) => {
    const [invoiceNumbers, setInvoiceNumbers] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const { restaurantId } = useParams();
    const [newRowVisible, setNewRowVisible] = useState(false);
    const [invoiceDetails, setInvoiceDetails] = useState({});
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [newItemName, setNewItemName] = useState('');
    const [newItemQuantity, setNewItemQuantity] = useState('');
    const navigate = useNavigate();

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

    const handleInvoiceChange = value => {
        setSelectedInvoice(value);
    };

    const showModal = () => {
        setIsModalVisible(true);
    };

    const handleOk = () => {
        setIsModalVisible(false);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
    };

    const handleSubmit = () => {
        // Handle submit logic here
        setIsModalVisible(false);
    };

    const handleAddNewRow = async () => {
        try {
            setNewRowVisible(true);
            const snapshot = await firestore
                .collection('restaurants')
                .doc(restaurantId)
                .collection('partyOrders')
                .get();
            
            const allPartyOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const filterRecord = allPartyOrders.find(order => order.cInvoiceNumber === selectedInvoice);
    
            if (!filterRecord) {
                throw new Error('Party order not found for selected invoice.');
            }
    
            const existingItems = filterRecord.cPartyOrderItems || [];
            const newItems = [...existingItems, { itemName: newItemName, qty: newItemQuantity }];
    
            await firestore
                .collection('restaurants')
                .doc(restaurantId)
                .collection('partyOrders')
                .doc(filterRecord.id)
                .set({ cPartyOrderItems: newItems }, { merge: true });

            const updatedRecordSnapshot = await firestore
                .collection('restaurants')
                .doc(restaurantId)
                .collection('partyOrders')
                .doc(filterRecord.id)
                .get();

            const updatedRecordData = updatedRecordSnapshot.data();
            console.log('Updated Record:', updatedRecordData);
    
            const updatedInvoiceDetails = { ...invoiceDetails };
            updatedInvoiceDetails[selectedInvoice].items = newItems;
            setInvoiceDetails(updatedInvoiceDetails);
    
            setNewItemName('');
            setNewItemQuantity('');
                
        } catch (error) {
            console.error('Error adding new item to Firebase:', error);
        }
    };
    
    const customFooter = (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}> 
            <Button key="submit" type="primary" onClick={handleSubmit}>
                Submit
            </Button>
        </div>
    );

    const fetchInvoiceNumber = async () => {
        const snapshot = await firestore
            .collection('restaurants')
            .doc(restaurantId)
            .collection('partyOrders')
            .get();

        const details = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            details[data.cInvoiceNumber] = {
                customerName: data.cName,
                items: data.cPartyOrderItems,
            };
        });

        setInvoiceDetails(details);
        setInvoiceNumbers(Object.keys(details));
        showModal();
        console.log(invoiceDetails);
    };

    const handleNavigate = (path, data) => {
        navigate(`/dashboard/${restaurantId}/${path}`, { state: { managerData: data } });
    };

    const handleNavigateToDashboard = (path, data) => {
        navigate(`/dashboard/${restaurantId}`, { state: { managerData: data } });
    };

    const handleLogout = () => {
        navigate(`/login/${restaurantId}`);
    };

    const popoverContent = (
        <Menu>
            <Menu.Item key="dashboard" icon={<AppstoreOutlined />} onClick={() => handleNavigateToDashboard('dashboard', managerData)}>
                Dashboard
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="inventoryManagement" icon={<AppstoreOutlined />} onClick={() => handleNavigate('inventoryManagement', managerData)}>
                Inventory Management
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="menuItems" icon={<OrderedListOutlined />} onClick={() => handleNavigate('menu', managerData)}>
                Menu
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="tvMenu" icon={<AppstoreOutlined />} onClick={() => handleNavigate('TVMenu', managerData)}>
                TV Menu
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="orderAnalysis" icon={<ShoppingCartOutlined />} onClick={() => handleNavigate('orders', managerData)}>
                Order Analysis
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="partyOrders" icon={<TeamOutlined />} onClick={() => handleNavigate('partyorders', managerData)}>
                Party Orders
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="changePassword" icon={<KeyOutlined />} onClick={() => handleNavigate('change-password', managerData)}>
                Change Password
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout} danger>
                Logout
            </Menu.Item>
        </Menu>
    );

    return (
        <div className="ChefsKitchenHeader">
            <div className="header-left">
                <img src="https://iili.io/HeKYJkB.png" alt="Logo" className="restaurant-logo" />
            </div>
            <div className="header-right">
                <Popover content={popoverContent} trigger="click" placement="bottomRight">
                <Button onClick={fetchInvoiceNumber} type="primary" className='addIngredients'>
                <PlusOutlined /> Add Ingredients
            </Button>
                    <Button type="text" className="admin-avatar-button">
                        <Avatar style={{ backgroundColor: avatarColor }}>
                            {avatarLetter}
                        </Avatar>
                        <MenuOutlined style={{ fontSize: '20px', marginLeft: '10px' }} />
                    </Button>
                </Popover>
            </div>
          
            <Modal
                title="Add Ingredients"
                visible={isModalVisible}
                onCancel={handleCancel}
                footer={customFooter}
            >
                Invoice Number: <Select
                    className="invoiceDropdown"
                    style={{ width: '100%' }}
                    onChange={handleInvoiceChange}
                    allowClear
                >
                    {invoiceNumbers.map(invoiceNumber => (
                        <Select.Option key={invoiceNumber} value={invoiceNumber}>
                            {invoiceNumber}
                        </Select.Option>
                    ))}
                </Select>
                {selectedInvoice && invoiceDetails[selectedInvoice] && (
                    <div>
                        <h3>Customer Name: {invoiceDetails[selectedInvoice].customerName}</h3>
                        <table className='custom-table' style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th>Item Name</th>
                                    <th>Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoiceDetails[selectedInvoice].items.map((item, index) => (
                                    <tr key={index}>
                                        <td>{item.itemName}</td>
                                        <td>{item.qty}</td>
                                    </tr>
                                ))}
                            
                                {newRowVisible && (
                                    <tr>
                                        <td><Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Item Name" /></td>
                                        <td><Input value={newItemQuantity} onChange={e => setNewItemQuantity(e.target.value)} placeholder="Quantity" /></td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        
                        <Button className="AddIngredientInsidePopUp" style={{marginTop: '25px'}} onClick={handleAddNewRow} type='dashed'> <PlusOutlined/> Add Ingredients</Button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ChefsKitchenHeader;
