import { EditOutlined, DeleteOutlined, MenuOutlined, InfoCircleOutlined, FilePdfOutlined, WhatsAppOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { Button, Dropdown, Menu, Popconfirm, message } from 'antd';
import React from 'react';
import { calculateAmountDue } from '../utils/calculations';
import { generateInvoicePdf } from '../utils/invoice';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../../../../config/api';

const PartyOrderColumns = ({ handleModalOpen, handleDeletePartyOrder, setModalVisible, setModalData }) => {
    const { restaurantId } = useParams();

    const handleViewDetails = (order) => {
        setModalData(order.cPartyOrderItems);
        setModalVisible(true);
    };

    const handleShareInvoice = async (record, recipient) => {
        try {
            message.loading({ content: `Sending invoice to ${recipient}...`, key: 'shareInvoice' });

            // Step 1: Generate PDF
            let pdfBlob;
            try {
                pdfBlob = generateInvoicePdf(record, true);
            } catch (pdfError) {
                console.error('PDF generation failed:', pdfError);
                message.error({ content: 'Failed to generate invoice PDF.', key: 'shareInvoice' });
                return;
            }
    
            // Step 2: Send PDF to server which uploads to WhatsApp Media API and sends the message
            const formData = new FormData();
            formData.append('pdf', pdfBlob, `Invoice_${record.cInvoiceNumber}.pdf`);
            formData.append('phoneNumber', record.cPhoneNumber);
            formData.append('customerName', record.cName);
            formData.append('invoiceNumber', record.cInvoiceNumber);
            formData.append('location', restaurantId);
            formData.append('recipient', recipient);

            await axios.post(`${API_BASE_URL}/api/send-invoice-whatsapp`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            message.success({ content: `Invoice sent to ${recipient}!`, key: 'shareInvoice' });
        } catch (error) {
            console.error('Error sharing invoice:', error);
            const errorMsg = error.response?.data?.error || 'Failed to send invoice via WhatsApp.';
            message.error({ content: errorMsg, key: 'shareInvoice' });
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
                        <Menu.Item key="shareInvoice" disabled style={{ padding: 0, cursor: 'default' }}>
                            <Button type="link" icon={<WhatsAppOutlined />} style={{ cursor: 'default' }}>Share Invoice</Button>
                        </Menu.Item>
                        <Menu.Item key="shareCustomer" onClick={() => handleShareInvoice(record, 'customer')}>
                            <Button type="link" icon={<UserOutlined />} style={{ paddingLeft: 24 }}>To Customer</Button>
                        </Menu.Item>
                        <Menu.Item key="shareOwner" onClick={() => handleShareInvoice(record, 'owner')}>
                            <Button type="link" icon={<TeamOutlined />} style={{ paddingLeft: 24 }}>To Owner</Button>
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

