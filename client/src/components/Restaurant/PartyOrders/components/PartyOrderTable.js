import React, { useState, useEffect } from 'react';
import { Table, Button, Typography, Modal, Card, Pagination, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PartyOrderColumns from './PartyOrderColumns'; // Adjust the import path as necessary
import { useMediaQuery } from 'react-responsive';

const { Title } = Typography;
const { Search } = Input;

const PartyOrderTable = ({ partyOrdersData, loading, handleModalOpen, handleDeletePartyOrder }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [modalData, setModalData] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [filteredData, setFilteredData] = useState(partyOrdersData);

    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    const pageSize = 8;

    // Effect to update filteredData when partyOrdersData changes
    useEffect(() => {
        setFilteredData(partyOrdersData);
    }, [partyOrdersData]);


    // Handle the search functionality as user types
    const handleSearch = (event) => {
        const value = event.target.value;

        if (!value) {
            // Reset to full data if search is empty
            setFilteredData(partyOrdersData);
        } else {
            const lowerCaseValue = value.toLowerCase();
            const filtered = partyOrdersData.filter(order => 
                (order.cName && order.cName.toLowerCase().includes(lowerCaseValue)) ||
                (order.cPhoneNumber && order.cPhoneNumber.toLowerCase().includes(lowerCaseValue)) ||
                (order.cInvoiceNumber && order.cInvoiceNumber.toLowerCase().includes(lowerCaseValue))
            );
            setFilteredData(filtered);
        }
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    // Render the list of cards for mobile view
    const renderCards = () => {
        return filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(order => (
            <Card key={order.id} title={order.cName} style={{ marginBottom: 16 }}>
                <p>Invoice Number: {order.cInvoiceNumber}</p>
                <p>Phone Number: {order.cPhoneNumber}</p>
                <p>Order Date: {order.cOrderDate}</p>
                <p>Party Date: {order.cPartyDate}</p>
                <Button onClick={() => handleModalOpen(order)}>Edit</Button>
                <Button onClick={() => handleDeletePartyOrder(order)} danger>Delete</Button>
            </Card>
        ));
    };

    return (
        <>
            <div style={{ margin: "16px" }}>
                <Button onClick={() => handleModalOpen()} type="primary" style={{ marginTop: "8.4px", float: "right", marginBottom: "22px" }} ghost>
                    <PlusOutlined />
                    Add New Party Order
                </Button>
                <Title level={3} style={{ display: 'inline-block', marginRight: 16 }}>Party Orders</Title>
                
                {/* Search bar to filter by name, phone, or invoice number */}
                <Input
                    placeholder="Search by Name, Phone, or Invoice Number"
                    onChange={handleSearch}
                    style={{ width: 325, marginBottom: 22 }}
                    allowClear
                />

                {isMobile ? (
                    <>
                        {/* Display cards in mobile view */}
                        {renderCards()}
                        <Pagination
                            current={currentPage}
                            pageSize={pageSize}
                            total={filteredData.length}
                            onChange={handlePageChange}
                        />
                    </>
                ) : (
                    <Table
                        columns={PartyOrderColumns({ handleModalOpen, handleDeletePartyOrder, setModalVisible, setModalData })}
                        dataSource={filteredData}
                        loading={loading}
                        rowKey="id"
                        bordered
                        size="middle"
                        pagination={{ pageSize: 50 }}
                    />
                )}

                {/* Modal to show item details */}
                <Modal
                    visible={modalVisible}
                    title="Item Details"
                    onCancel={() => setModalVisible(false)}
                    footer={null}
                >
                    <Table
                        dataSource={modalData}
                        columns={[
                            { title: "Item Name", dataIndex: "itemName", key: "itemName" },
                            { title: "Quantity", dataIndex: "qty", key: "qty" },
                            { title: "Price", dataIndex: "price", key: "price" },
                            { title: "Tray Type", dataIndex: "trayType", key: "trayType" },
                            { title: "Spice Level", dataIndex: "spiceLevel", key: "spiceLevel" },
                        ]}
                        rowKey={(record, index) => index}
                    />
                </Modal>
            </div>
        </>
    );
};

export default PartyOrderTable;
