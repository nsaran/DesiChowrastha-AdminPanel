//  before changes to party order columns.js
import { EditOutlined, DeleteOutlined, MenuOutlined, InfoCircleOutlined, FilePdfOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { Button, Dropdown, Menu, Popconfirm, message } from 'antd';
import React from 'react';
import { calculateAmountDue } from '../utils/calculations';
import { generateInvoicePdf } from '../utils/invoice';
import { storage } from '../../../../config/firebase';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const PartyOrderColumns = ({ handleModalOpen, handleDeletePartyOrder, setModalVisible, setModalData }) => {
    const { restaurantId } = useParams();

    const handleViewDetails = (order) => {
        setModalData(order.cPartyOrderItems);
        setModalVisible(true);
    };

    const handleShareInvoice = async (record) => {
        try {
            // Step 1: Generate PDF
            const pdfBlob = generateInvoicePdf(record, true); // Updated to return Blob
    
            // Step 2: Upload PDF to Firebase Storage
            const storageRef = storage.ref();
            const pdfRef = storageRef.child(`invoices/partyOrders/${restaurantId}/Invoice_${record.cInvoiceNumber}.pdf`);
            await pdfRef.put(pdfBlob);
            const pdfUrl = await pdfRef.getDownloadURL();
    
            // Step 3: Shorten URL with Bitly
            let shortUrl;
            try {
                const bitlyToken = 'd2853d35c790f2ad177d533931635b1055f4f844';
                const bitlyApi = `https://api-ssl.bitly.com/v4/shorten`;
                const bitlyResponse = await axios.post(
                    bitlyApi,
                    { long_url: pdfUrl },
                    { headers: { Authorization: `Bearer ${bitlyToken}` } }
                );
                shortUrl = bitlyResponse.data.link;
                console.log(shortUrl);
            } catch (bitlyError) {
                console.error('Error shortening URL with Bitly:', bitlyError);
                message.error('Failed to shorten the URL.');
                return;
            }
    
            // Step 4: Send URL to WhatsApp
            const whatsappMessage = `Hello ${record.cName}, your invoice is ready. You can view it here: ${shortUrl}`;
            console.log(whatsappMessage);
            const whatsappUrl = `https://wa.me/${record.cPhoneNumber}?text=${encodeURIComponent(whatsappMessage)}`;

            window.open(whatsappUrl, '_blank');
    
            message.success('Invoice shared successfully on WhatsApp!');
        } catch (error) {
            console.error('Error sharing invoice:', error);
            message.error('Failed to share the invoice.');
        }
    };    

    return [
        {
            title: "Invoice #",
            dataIndex: "cInvoiceNumber",
            key: "cInvoiceNumber",
            align: 'center',
            sorter: (a, b) => a.cInvoiceNumber.localeCompare(b.cInvoiceNumber),
        },
        {
            title: "Customer Name",
            dataIndex: "cName",
            key: "cName",
            align: 'center',
        },
        {
            title: "Phone Number",
            dataIndex: "cPhoneNumber",
            key: "cPhoneNumber",
            render: (cPhoneNumber) => (
                <a
                    href={`https://wa.me/${cPhoneNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {cPhoneNumber}
                </a>
            ),
            align: 'center',
        },
        {
            title: "Order Date",
            dataIndex: "cOrderDate",
            key: "cOrderDate",
            sorter: (a, b) => new Date(a.cOrderDate) - new Date(b.cOrderDate),
            align: 'center',
        },
        {
            title: "Party Date",
            dataIndex: "cPartyDate",
            key: "cPartyDate",
            sorter: (a, b) => new Date(a.cPartyDate) - new Date(b.cPartyDate),
            align: 'center',
        },
        {
            title: "Delivery Time",
            dataIndex: "cOrderDeliveryTime",
            key: "cOrderDeliveryTime",
            align: 'center',
        },
        {
            title: "Order Status",
            dataIndex: "cPartyOrderStatus",
            key: "cPartyOrderStatus",
            align: 'center',
        },
        {
            title: "Payment Status",
            dataIndex: "cPartyOrderPaymentStatus",
            key: "cPartyOrderPaymentStatus",
            align: 'center',
        },
        {
            title: "Order Total",
            dataIndex: "cOrderTotal",
            key: "cOrderTotal",
            render: (text) => `$ ${parseFloat(text).toFixed(2)}`, // Ensure correct formatting
            align: 'center',
        },
        {
            title: "Discount",
            dataIndex: "cOrderDiscount",
            key: "cOrderDiscount",
            render: (text) => `${text} %`,
            align: 'center',
        },
        {
            title: "Payments",
            dataIndex: "cPartyOrderPaymentDetails",
            key: "cPartyOrderPaymentDetails",
            render: (paymentDetails) => {
                const combinedPayments = paymentDetails.reduce((acc, payment) => {
                    const paymentMode = payment.paymentMode;
                    const amountPaid = payment.amountPaid;
                    if (acc.hasOwnProperty(paymentMode)) {
                        acc[paymentMode] += amountPaid;
                    } else {
                        acc[paymentMode] = amountPaid;
                    }
                    return acc;
                }, {});

                return (
                    <ul>
                        {Object.entries(combinedPayments).map(
                            ([paymentMode, amountPaid]) => (
                                <li key={paymentMode}>
                                    {paymentMode}: ${amountPaid}
                                </li>
                            )
                        )}
                    </ul>
                );
            },
            align: 'center',
        },
        {
            title: "Amount Due",
            dataIndex: "cPartyOrderPaymentDetails",
            key: "cPartyOrderPaymentDetails",
            render: (paymentDetails, record) => {
                const total = parseFloat(record.cOrderTotal); // Ensure total is a number
                const amountDue = calculateAmountDue(total, record.cOrderDiscount, paymentDetails);
                return (
                    <span
                        style={{
                            backgroundColor: amountDue > 0 ? "yellow" : "transparent",
                            fontWeight: amountDue > 0 ? "bold" : "normal",
                            display: "inline-block",
                            padding: "5px",
                            borderRadius: "8px",
                            margin: "5px",
                        }}
                    >
                        {`$ ${amountDue.toFixed(2)}`}
                    </span>
                );
            },
            align: 'center',
        },
        {
            title: 'Actions',
            dataIndex: 'actions',
            key: 'actions',
            render: (text, record) => {
                const menu = (
                    <Menu>
                        <Menu.Item key="generateInvoice" onClick={() => generateInvoicePdf(record)}>
                            <Button type="link" icon={<FilePdfOutlined />}>Generate Invoice</Button>
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item key="shareInvoice" onClick={() => handleShareInvoice(record)}>
                            <Button type="link" icon={<WhatsAppOutlined />}>Share Invoice</Button>
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item key="edit" onClick={() => handleModalOpen(record)}>
                            <Button type="link" icon={<EditOutlined />}>
                                Edit
                            </Button>
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item key="delete">
                            <Popconfirm
                                title="Are you sure to delete this party order?"
                                onConfirm={() => handleDeletePartyOrder(record)}
                                okText="Yes"
                                cancelText="No"
                            >
                                <Button type="link" danger icon={<DeleteOutlined />}>
                                    Delete
                                </Button>
                            </Popconfirm>
                        </Menu.Item>
                    </Menu>
                );

                return (
                    <>
                        <Button
                            type="dashed"
                            icon={<InfoCircleOutlined />}
                            style={{ marginRight: 8 }}
                            onClick={() => handleViewDetails(record)}
                        />
                        <Dropdown overlay={menu} trigger={['click']}>
                            <Button type="dashed" icon={<MenuOutlined />} />
                        </Dropdown>
                    </>
                );
            },
            align: 'center',
        },
    ];
};

export default PartyOrderColumns;

