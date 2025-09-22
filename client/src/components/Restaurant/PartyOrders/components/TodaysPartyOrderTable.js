import React, { useState } from 'react';
import { Table, Typography, Modal, Card, Pagination, Button } from 'antd';
import PartyOrderColumns from './PartyOrderColumns'; // Adjust the import path as necessary
import { useMediaQuery } from 'react-responsive';

const { Title } = Typography;

const TodaysPartyOrderTable = ({ partyOrdersData, loading, handleModalOpen, handleDeletePartyOrder }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [modalData, setModalData] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);

    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    const pageSize = 2;

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    const renderCards = () => {
        return partyOrdersData.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(order => (
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
                <Title level={3}>Today's Party Orders</Title>
                {isMobile ? (
                    <>
                        {renderCards()}
                        <Pagination
                            current={currentPage}
                            pageSize={pageSize}
                            total={partyOrdersData.length}
                            onChange={handlePageChange}
                        />
                    </>
                ) : (
                    <Table
                        columns={PartyOrderColumns({ handleModalOpen, handleDeletePartyOrder, setModalVisible, setModalData })}
                        dataSource={partyOrdersData}
                        loading={loading}
                        rowKey="id"
                        bordered
                        size="middle"
                        pagination={{ pageSize: 50 }}
                    />
                )}
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

export default TodaysPartyOrderTable;
