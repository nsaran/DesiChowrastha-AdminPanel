import React, { useEffect, useState } from 'react';
import { Table, Button, message, Card } from 'antd';
import { useParams, useLocation } from 'react-router-dom';
import { firestore } from '../../../config/firebase';
import InventoryApprovalHeader from './components/InventoryApprovalHeader';
import InventoryApprovalFooter from './components/InventoryApprovalFooter';

const InventoryApprovalComponent = () => {
    const [requests, setRequests] = useState([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const { restaurantId } = useParams();
    const { state } = useLocation();
    const managerData = state?.managerData;

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const unsubscribe = firestore.collectionGroup('inventoryRequests')
            .where('status', '==', 'Pending')
            .orderBy('timestamp') // Ensure this field exists and is indexed in your Firestore rules
            .onSnapshot(snapshot => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setRequests(data);
            }, error => {
                message.error('Failed to fetch approval requests: ' + error.message);
                console.error("Error fetching documents: ", error);
            });

        return () => unsubscribe(); // Cleanup the subscription on unmount
    }, [restaurantId]);

    const approveRequest = async (id) => {
        try {
            const request = requests.find(req => req.id === id);
            if (request) {
                const now = new Date();
                
                // Retrieve the current quantity from Firestore
                const inventoryDoc = await firestore.collection('restaurants').doc(restaurantId).collection('inventory').doc(request.itemId).get();
                const currentQuantity = inventoryDoc.data().quantity;
        
                // Calculate the new quantity after approval
                const newQuantity = currentQuantity + request.requestedQuantity;
        
                await firestore.collection('restaurants').doc(restaurantId).collection('inventory').doc(request.itemId).update({
                    quantity: newQuantity,
                    lastModified: now.toISOString()
                });
                await firestore.collection('restaurants').doc(restaurantId).collection('inventoryRequests').doc(id).update({
                    status: 'Approved'
                });
                message.success('Request approved');
            }
        } catch (error) {
            message.error('Failed to approve request: ' + error.message);
            console.error("Error approving request: ", error);
        }
    };

    const rejectRequest = async (id) => {
        try {
            const request = requests.find(req => req.id === id);
            if (request) {
                const now = new Date();
                await firestore.collection('restaurants').doc(restaurantId).collection('inventory').doc(request.itemId).update({
                    status: 'Request Rejected',
                    lastModified: now.toISOString()
                });
                await firestore.collection('restaurants').doc(restaurantId).collection('inventoryRequests').doc(id).update({
                    status: 'Rejected'
                });
                message.error('Request rejected');
            }
        } catch (error) {
            message.error('Failed to reject request: ' + error.message);
            console.error("Error rejecting request: ", error);
        }
    };

    const renderCards = () => {
        return requests.map(request => (
            <Card key={request.id} title={request.itemName} style={{ marginBottom: 16 }} actions={[
                <Button onClick={() => rejectRequest(request.id)} danger>Reject</Button>,
                <Button type="primary" onClick={() => approveRequest(request.id)} style={{ marginRight: 10 }}>Approve</Button>
            ]}>
                <p><strong>Requested Quantity:</strong> {request.requestedQuantity}</p>
                <p><strong>Status:</strong> {request.status}</p>
            </Card>
        ));
    };

    const columns = [
        { title: 'Item Name', dataIndex: 'itemName', key: 'itemName' },
        { title: 'Requested Quantity', dataIndex: 'requestedQuantity', key: 'requestedQuantity' },
        { title: 'Status', dataIndex: 'status', key: 'status' },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <>
                    <Button style={{ marginRight: 10 }} onClick={() => rejectRequest(record.id)} danger>Reject</Button>
                    <Button type="primary" onClick={() => approveRequest(record.id)}>Approve</Button>
                </>
            )
        },
    ];

    return (
        <div>
            <InventoryApprovalHeader managerData={managerData} />
            <div style={{ margin: isMobile ? 16 : 24 }}>
                <h2 style={{ textAlign: 'left', color: 'black' }}>Inventory Approval Requests</h2>
                {isMobile ? (
                    renderCards()
                ) : (
                    <Table dataSource={requests} columns={columns} rowKey="id" pagination={{ pageSize: 5 }} />
                )}
            </div>
            <InventoryApprovalFooter />
        </div>
    );
};

export default InventoryApprovalComponent;
