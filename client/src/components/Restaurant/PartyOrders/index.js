import React, { useState, useEffect, useRef, useContext } from 'react';
import { Button, Modal, message, Form, DatePicker, Upload, Tooltip } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { firestore } from '../../../config/firebase';
import { useParams } from 'react-router-dom';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import PartyOrderForm from './components/PartyOrderForm';
import TodaysPartyOrderTable from './components/TodaysPartyOrderTable';
import PartyOrderTable from './components/PartyOrderTable';
import { calculateAmountDue, calculateOrderTotal } from './utils/calculations';
import Papa from 'papaparse';
import PartyOrderColumns from './components/PartyOrderColumns';
import PartyOrderHeader from './components/PartyOrderHeader';
import protectedApi from '../../../utils/api';
import { AuthContext } from '../../../utils/AuthProvider';
import { generateInvoicePdf } from './utils/invoice';

const { RangePicker } = DatePicker;

const RestaurantPartyOrdersComponent = () => {
    const { restaurantId } = useParams();
    const [partyOrdersData, setPartyOrdersData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editRecord, setEditRecord] = useState(null);
    const [form] = Form.useForm();
    const [todayOrders, setTodayOrders] = useState([]);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [isCalculateTotalsClicked, setIsCalculateTotalsClicked] = useState(false);
    const [invoiceNumber, setInvoiceNumber] = useState('000000');
    const isSavingRef = useRef(false);
    const { role } = useContext(AuthContext);
    const canDelete = role === 'owner'; // only owners may delete party orders


    const formatDate = (value) => {
        return value ? moment(value).format('YYYY-MM-DD') : '';
    };

    const [orderStartDate, setOrderStartDate] = useState(null);
    const [orderEndDate, setOrderEndDate] = useState(null);

    // Existing onDateChange for party date filtering
    const onPartyDateChange = (dates) => {
        if (dates) {
            const [start, end] = dates;
            setStartDate(start.format('YYYY-MM-DD'));
            setEndDate(end.format('YYYY-MM-DD'));
        } else {
            setStartDate(null);
            setEndDate(null);
        }
    };

    // New function to filter by Order Date
    const onOrderDateChange = (dates) => {
        if (dates) {
            const [start, end] = dates;
            setOrderStartDate(start.format('YYYY-MM-DD'));
            setOrderEndDate(end.format('YYYY-MM-DD'));
        } else {
            setOrderStartDate(null);
            setOrderEndDate(null);
        }
    };

    useEffect(() => {
        const unsubscribe = firestore
            .collection('restaurants')
            .doc(restaurantId)
            .collection('partyOrders')
            .onSnapshot(snapshot => {
                const allPartyOrders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

                const todayDate = moment().format('YYYY-MM-DD');
                const todayOrders = allPartyOrders.filter((order) => order.cPartyDate === todayDate);
                setTodayOrders(todayOrders);

                let filteredOrders = allPartyOrders;

                // Filter by Party Date
                if (startDate && endDate) {
                    filteredOrders = filteredOrders.filter((order) => {
                        const partyDate = moment(order.cPartyDate);
                        return partyDate.isBetween(startDate, endDate, null, '[]');
                    });
                }

                // Filter by Order Date
                if (orderStartDate && orderEndDate) {
                    filteredOrders = filteredOrders.filter((order) => {
                        const orderDate = moment(order.cOrderDate);
                        return orderDate.isBetween(orderStartDate, orderEndDate, null, '[]');
                    });
                }

                setPartyOrdersData(filteredOrders.sort((a, b) => new Date(b.cOrderDate) - new Date(a.cOrderDate)));
                setLoading(false);
            }, error => {
                setLoading(false);
                message.error('Failed to fetch party orders data.');
                console.error('Error fetching party orders:', error);
            });

        return () => unsubscribe();
    }, [restaurantId, startDate, endDate, orderStartDate, orderEndDate]); // Watch both party and order date ranges



    const generateInvoiceNumber = async () => {
        try {
            const partyOrdersSnapshot = await firestore.collection('restaurants').doc(restaurantId).collection('partyOrders').orderBy('cInvoiceNumber', 'desc').limit(1).get();
            const deletedPartyOrdersSnapshot = await firestore.collection('restaurants').doc(restaurantId).collection('deletedPartyOrders').orderBy('cInvoiceNumber', 'desc').limit(1).get();

            const partyOrdersMaxInvoice = partyOrdersSnapshot.docs.length > 0 ? partyOrdersSnapshot.docs[0].data().cInvoiceNumber : '000000';
            const deletedPartyOrdersMaxInvoice = deletedPartyOrdersSnapshot.docs.length > 0 ? deletedPartyOrdersSnapshot.docs[0].data().cInvoiceNumber : '000000';

            const maxInvoice = Math.max(parseInt(partyOrdersMaxInvoice, 10), parseInt(deletedPartyOrdersMaxInvoice, 10));
            const nextInvoiceNumber = String(maxInvoice + 1).padStart(6, '0');

            setInvoiceNumber(nextInvoiceNumber);
            return nextInvoiceNumber;
        } catch (error) {
            console.error('Error generating invoice number:', error);
            message.error('Failed to generate invoice number.');
            return '000000';
        }
    };

    const handleModalOpen = async (record) => {
        setEditRecord(record);
        const invoiceNumber = record ? record.cInvoiceNumber : await generateInvoiceNumber();
        setInvoiceNumber(invoiceNumber);

        const orderDate = record ? moment(record.cOrderDate).format('YYYY-MM-DD') : null;
        const partyDate = record ? moment(record.cPartyDate).format('YYYY-MM-DD') : null;

        form.setFieldsValue({
            cInvoiceNumber: invoiceNumber,
            cName: record ? record.cName : '',
            cPhoneNumber: record ? record.cPhoneNumber : '',
            cOrderDeliveryTime: record ? record.cOrderDeliveryTime : '',
            cOrderDate: orderDate,
            cPartyDate: partyDate,
            cEmail: record ? record.cEmail : '',
            cPartyOrderComments: record ? record.cPartyOrderComments : '',
            cPartyOrderItems: record ? record.cPartyOrderItems.map((item) => ({ ...item, key: uuidv4() })) : [],
            cPartyOrderStatus: record ? record.cPartyOrderStatus : 'CONFIRMED',
            cPartyOrderPaymentStatus: record ? record.cPartyOrderPaymentStatus : 'COD',
            cOrderDiscount: record ? record.cOrderDiscount : 0,
            cPartyOrderPaymentDetails: record
                ? record.cPartyOrderPaymentDetails.map((paymentDetail) => ({ ...paymentDetail, key: uuidv4() }))
                : [],
            cOrderTotal: record ? record.cOrderTotal : 0,
            cAmountDue: record ? record.cAmountDue : null,
        });

        setModalVisible(true);
        setIsCalculateTotalsClicked(false);
    };

    const handleModalClose = () => {
        setEditRecord(null);
        form.resetFields();
        setModalVisible(false);
    };

    const handleSavePartyOrder = async (values) => {
        if (!isCalculateTotalsClicked) {
            message.error('Please click the "Calculate Totals & Amount Due" button before saving.');
            return;
        }

        // Guard against double submission (double-click / duplicate onFinish),
        // which would otherwise create two identical party orders.
        if (isSavingRef.current) {
            return;
        }
        isSavingRef.current = true;

        try {
            setLoading(true);

            const partyOrderData = { ...values };

            const processedPartyOrderItems = values.cPartyOrderItems.map((item) => ({
                ...item,
                itemComments: item.itemComments || '',
            }));
            partyOrderData.cPartyOrderItems = processedPartyOrderItems;

            partyOrderData.cOrderTotal = parseFloat(partyOrderData.cOrderTotal);

            const excludeFields = ['cAmountDue'];
            Object.keys(partyOrderData).forEach((key) => {
                if (excludeFields.includes(key) && (partyOrderData[key] === null || partyOrderData[key] === undefined)) {
                    delete partyOrderData[key];
                }
            });

            const restaurantCollection = firestore.collection('restaurants').doc(restaurantId).collection('partyOrders');

            if (editRecord) {
                await restaurantCollection.doc(editRecord.id).update(partyOrderData);
                message.success('Party order updated successfully!');
            } else {
                await restaurantCollection.add(partyOrderData);
                message.success('Party order added successfully!');
            }

            setLoading(false);
            setIsCalculateTotalsClicked(false);
            handleModalClose();

            // Auto-send the invoice PDF to the owner via WhatsApp (non-blocking).
            // Uses the same flow as "Share Invoice" -> generate PDF -> server sends it.
            sendInvoiceToOwner(partyOrderData);
        } catch (error) {
            setLoading(false);
            console.log(error);
            message.error('Failed to save the party order. Please try again.');
        } finally {
            isSavingRef.current = false;
        }
    };

    // Generates the invoice PDF and sends it to the owner via the WhatsApp service.
    // Failures here do NOT block the save — they only log/warn.
    const sendInvoiceToOwner = async (record) => {
        try {
            const pdfBlob = generateInvoicePdf(record, true);
            const formData = new FormData();
            formData.append('pdf', pdfBlob, `Invoice_${record.cInvoiceNumber}.pdf`);
            formData.append('phoneNumber', record.cPhoneNumber || '');
            formData.append('customerName', record.cName || '');
            formData.append('invoiceNumber', record.cInvoiceNumber || '');
            formData.append('location', restaurantId);
            formData.append('recipient', 'owner');

            await protectedApi.post('/api/send-invoice-whatsapp', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        } catch (error) {
            console.warn('Could not send party order invoice to owner:', error.response?.data?.error || error.message);
        }
    };

    const handleDeletePartyOrder = async (record) => {
        // Deletion is enforced server-side: the endpoint requires the caller to be
        // an authenticated user with the 'owner' role. The server does the soft
        // delete (archive to deletedPartyOrders, then remove).
        try {
            setLoading(true);
            await protectedApi.delete(`/api/party-orders/${restaurantId}/${record.id}`);
            message.success('Party order deleted successfully!');
        } catch (error) {
            const status = error.response?.status;
            if (status === 401 || status === 403) {
                message.error('You are not authorized to delete party orders.');
            } else {
                message.error(error.response?.data?.error || 'Failed to delete party order.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCalculateTotals = () => {
        const values = form.getFieldsValue();
        const total = calculateOrderTotal(values.cPartyOrderItems);
        const amountDue = calculateAmountDue(total, values.cOrderDiscount, values.cPartyOrderPaymentDetails);
        form.setFieldsValue({
            cOrderTotal: total,
            cAmountDue: amountDue,
        });

        setIsCalculateTotalsClicked(true);
    };

    const columns = PartyOrderColumns({ handleModalOpen, handleDeletePartyOrder, canDelete });

    const exportToCSV = () => {
        const fields = [
            "Invoice Number",
            "Customer Name",
            "Phone Number",
            "Order Date",
            "Party Date",
            "Order Delivery Time",
            "Party Order Status",
            "Party Order Payment Status",
            "Order Total",
            "Discount",
            "Payment Details",
            "Amount Due",
        ];

        const data = partyOrdersData.map((order) => {
            const itemNamesAndQuantities = order.cPartyOrderItems.map(
                (item) => `${item.itemName}: ${item.itemQuantity}`
            );

            return {
                "Invoice Number": order.cInvoiceNumber,
                "Customer Name": order.cName,
                "Phone Number": order.cPhoneNumber,
                "Order Date": order.cOrderDate,
                "Party Date": order.cPartyDate,
                "Order Delivery Time": order.cOrderDeliveryTime,
                "Party Order Status": order.cPartyOrderStatus,
                "Party Order Payment Status": order.cPartyOrderPaymentStatus,
                "Order Total": `$ ${calculateOrderTotal(order.cPartyOrderItems).toFixed(2)}`,
                "Discount": order.cOrderDiscount + "%",
                "Payment Details": order.cPartyOrderPaymentDetails
                    .map((payment) => `${payment.paymentMode}: $${payment.amountPaid}`)
                    .join(", "),
                "Amount Due": `$ ${calculateAmountDue(
                    calculateOrderTotal(order.cPartyOrderItems),
                    order.cOrderDiscount,
                    order.cPartyOrderPaymentDetails
                ).toFixed(2)}`,
            };
        });

        const csv = Papa.unparse({
            fields,
            data,
        });

        // Build a filename that reflects the active date-range filter.
        // Prefer the Party Date range; fall back to the Order Date range.
        let fileName = "party-orders";
        if (startDate && endDate) {
            fileName = `party-orders_partydate_${startDate}_to_${endDate}`;
        } else if (orderStartDate && orderEndDate) {
            fileName = `party-orders_orderdate_${orderStartDate}_to_${orderEndDate}`;
        }

        let blob = new Blob([csv], { type: "text/csv" });
        let a = window.document.createElement("a");
        a.href = window.URL.createObjectURL(blob);
        a.download = `${fileName}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // const handleImportCSV = ({ file }) => {
    //     Papa.parse(file, {
    //         header: true,
    //         complete: async (results) => {
    //             const newOrders = results.data.map((order) => {
    //                 const paymentDetails = order["Payment Details"] ? order["Payment Details"].split(", ").map((detail) => {
    //                     const [paymentMode, amountPaid] = detail.split(": $");
    //                     return { paymentMode, amountPaid: parseFloat(amountPaid) };
    //                 }) : [];

    //                 const partyOrderItems = order["Items"] ? order["Items"].split(", ").map((item) => {
    //                     const [itemName, itemQuantity] = item.split(": ");
    //                     return { itemName, itemQuantity: parseInt(itemQuantity), key: uuidv4() };
    //                 }) : [];

    //                 const parsedOrderTotal = parseFloat(order["Order Total"]?.replace(/[^0-9.-]+/g, '') || 0);

    //                 return {
    //                     id: uuidv4(),
    //                     cInvoiceNumber: order["Invoice Number"] || '',
    //                     cName: order["Customer Name"] || '',
    //                     cPhoneNumber: order["Phone Number"] || '',
    //                     cOrderDate: order["Order Date"] || '',
    //                     cPartyDate: order["Party Date"] || '',
    //                     cOrderDeliveryTime: order["Order Delivery Time"] || '',
    //                     cPartyOrderStatus: order["Party Order Status"] || '',
    //                     cPartyOrderPaymentStatus: order["Party Order Payment Status"] || '',
    //                     cOrderTotal: parsedOrderTotal, // Store as number without currency symbol
    //                     cOrderDiscount: parseFloat(order["Discount"]?.replace('%', '').trim() || 0),
    //                     cPartyOrderPaymentDetails: paymentDetails,
    //                     cAmountDue: parseFloat(order["Amount Due"]?.replace('$', '').trim() || 0),
    //                     cPartyOrderItems: partyOrderItems,
    //                 };
    //             });

    //             try {
    //                 setLoading(true);

    //                 const restaurantCollection = firestore.collection('restaurants').doc(restaurantId).collection('partyOrders');

    //                 // Fetch existing data from Firestore
    //                 const snapshot = await restaurantCollection.get();
    //                 const existingOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    //                 // Check for duplicates within the CSV file
    //                 const seenInvoiceNumbers = new Set();
    //                 const duplicateInvoiceNumbersCSV = new Set();
    //                 const uniqueNewOrders = newOrders.filter(order => {
    //                     if (seenInvoiceNumbers.has(order.cInvoiceNumber)) {
    //                         duplicateInvoiceNumbersCSV.add(order.cInvoiceNumber);
    //                         return false;
    //                     }
    //                     seenInvoiceNumbers.add(order.cInvoiceNumber);
    //                     return true;
    //                 });

    //                 // Check for duplicates with existing Firestore data
    //                 const duplicateInvoiceNumbersFirestore = new Set();
    //                 const uniqueFilteredOrders = uniqueNewOrders.filter(order => {
    //                     const exists = existingOrders.some(existingOrder => existingOrder.cInvoiceNumber === order.cInvoiceNumber);
    //                     if (exists) {
    //                         duplicateInvoiceNumbersFirestore.add(order.cInvoiceNumber);
    //                     }
    //                     return !exists;
    //                 });

    //                 // Show warning and prevent import if duplicates are found
    //                 if (duplicateInvoiceNumbersCSV.size > 0 || duplicateInvoiceNumbersFirestore.size > 0) {
    //                     let warningMessage = 'Duplicate entries found. Import aborted.';

    //                     if (duplicateInvoiceNumbersCSV.size > 0) {
    //                         warningMessage += `\nDuplicate Invoice Numbers in CSV: ${[...duplicateInvoiceNumbersCSV].join(', ')}`;
    //                     }

    //                     if (duplicateInvoiceNumbersFirestore.size > 0) {
    //                         warningMessage += `\nDuplicate Invoice Numbers in Firestore: ${[...duplicateInvoiceNumbersFirestore].join(', ')}`;
    //                     }

    //                     message.warning(warningMessage);
    //                     setLoading(false);
    //                     return;
    //                 }

    //                 // Batch add unique new orders to Firestore
    //                 const batch = firestore.batch();
    //                 uniqueFilteredOrders.forEach((order) => {
    //                     const docRef = restaurantCollection.doc(order.id);
    //                     batch.set(docRef, order);
    //                 });

    //                 await batch.commit();

    //                 // Fetch all updated orders after import
    //                 const updatedSnapshot = await restaurantCollection.get();
    //                 const updatedOrders = updatedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    //                 setPartyOrdersData(updatedOrders);
    //                 message.success('CSV imported successfully!');
    //             } catch (error) {
    //                 message.error('Failed to import CSV. Please try again.');
    //             } finally {
    //                 setLoading(false);
    //             }
    //         }
    //     });
    // };

    const handleImportCSV = ({ file }) => {
        Papa.parse(file, {
            header: true,
            complete: async (results) => {
                const newOrders = results.data
                    .filter(order => {
                        // Check if crucial fields are filled; if not, exclude the row
                        return order["Invoice Number"] && order["Customer Name"];
                    })
                    .map((order, index) => {
                        const paymentDetails = [];
                        if (order["Cash"]) {
                            paymentDetails.push({ paymentMode: "CASH", amountPaid: parseFloat(order["Cash"]) });
                        }
                        if (order["Zelle"]) {
                            paymentDetails.push({ paymentMode: "ZELLE", amountPaid: parseFloat(order["Zelle"]) });
                        }
    
                        const partyOrderItems = order["Items"] ? order["Items"].split("; ").map((item) => {
                            const itemParts = item.split(", ");
                            const itemName = itemParts[0] ? itemParts[0].split(": ")[1] : '';
                            const qty = itemParts[1] ? parseInt(itemParts[1].split(": ")[1]) : 0;
                            const trayType = itemParts[2] ? itemParts[2].split(": ")[1] : '';
                            const spiceLevel = itemParts[3] ? itemParts[3].split(": ")[1] : '';
                            const itemComments = itemParts[4] ? itemParts[4].split(": ")[1] || '' : '';
                            const price = itemParts[5] ? parseFloat(itemParts[5].split(": ")[1]?.replace('$', '') || 0) : 0;
    
                            return {
                                itemName,
                                qty,
                                trayType,
                                spiceLevel,
                                itemComments,
                                price,
                                key: uuidv4(),
                            };
                        }) : [];
    
                        const parsedOrderTotal = parseFloat(order["Order Total"]?.replace(/[^0-9.-]+/g, '') || 0);
                        const parsedAmountDue = parseFloat(order["Amount Due"]?.replace(/[^0-9.-]+/g, '') || 0);
    
                        const orderStatus = order["Order Status"] === "undefined" ? 'CONFIRMED' : (order["Order Status"] || 'CONFIRMED');
                        const paymentStatus = order["Payment Status"] === "undefined" ? 'COD' : (order["Payment Status"] || 'COD');
                        const phoneNumber = order["Phone Number"] === "undefined" ? '' : (order["Phone Number"] ? '+1' + order["Phone Number"] : '');
                        const email = order["Email"] === "undefined" ? '' : (order["Email"] || '');
                        const partyOrderComments = order["Party Order Comments"] === "undefined" ? '' : (order["Party Order Comments"] || '');
    
                        // Format invoice number starting from 000001
                        const invoiceNumber = (index + 1).toString().padStart(6, '0'); // Starts from 000001
    
                        // Include old invoice number in the name field
                        const newName = `${order["Customer Name"] || ''} (Old Invoice: ${order["Invoice Number"] || 'N/A'})`;
    
                        return {
                            id: uuidv4(),
                            cInvoiceNumber: invoiceNumber, // New invoice number starting from 000001
                            cName: newName, // Customer name with old invoice number
                            cPhoneNumber: phoneNumber,
                            cOrderDate: order["Order Date"] || '',
                            cPartyDate: order["Party Date"] || '',
                            cOrderDeliveryTime: order["Order Delivery Time"] || '',
                            cPartyOrderStatus: orderStatus,
                            cPartyOrderPaymentStatus: paymentStatus,
                            cOrderTotal: parsedOrderTotal, // Store as number without currency symbol
                            cOrderDiscount: parseFloat(order["Discount"]?.replace('%', '').trim() || 0),
                            cPartyOrderPaymentDetails: paymentDetails,
                            cAmountDue: parsedAmountDue,
                            cPartyOrderItems: partyOrderItems,
                            cEmail: email,
                            cPartyOrderComments: partyOrderComments,
                            cAmountPaid: parseFloat(order["Amount Paid"] || 0),
                            cCash: parseFloat(order["Cash"] || 0),
                            cZelle: parseFloat(order["Zelle"] || 0),
                        };
                    });
    
                try {
                    setLoading(true);
    
                    const restaurantCollection = firestore.collection('restaurants').doc(restaurantId).collection('partyOrders');
    
                    // Batch add new orders to Firestore
                    const batch = firestore.batch();
                    newOrders.forEach((order) => {
                        const docRef = restaurantCollection.doc(order.id);
                        batch.set(docRef, order);
                    });
    
                    await batch.commit();
    
                    // Fetch all updated orders after import
                    const updatedSnapshot = await restaurantCollection.get();
                    const updatedOrders = updatedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
                    setPartyOrdersData(updatedOrders);
                    message.success('CSV imported successfully!');
                } catch (error) {
                    message.error('Failed to import CSV. Please try again.');
                } finally {
                    setLoading(false);
                }
            }
        });
    };
    
    

    return (
        <div style={{ margin: "16px" }}>
            <PartyOrderHeader />
            <TodaysPartyOrderTable
                columns={columns}
                partyOrdersData={todayOrders}
                loading={loading}
                handleModalOpen={handleModalOpen}
                handleDeletePartyOrder={handleDeletePartyOrder}
                canDelete={canDelete}
            />
            <Upload
                accept=".csv"
                showUploadList={false}
                beforeUpload={() => false}
                onChange={handleImportCSV}
            >
                <Button icon={<UploadOutlined />} style={{ float: "right", marginLeft: "16px", marginTop: "8.4px", marginBottom: "22px" }}>Import CSV</Button>
            </Upload>
            <Button onClick={exportToCSV} style={{ float: "right", marginLeft: "16px", marginTop: "8.4px", marginBottom: "22px" }}>Download CSV</Button>

            <Tooltip title="Filter by Party Date">
                <DatePicker.RangePicker
                    format='YYYY-MM-DD'
                    onChange={onPartyDateChange}
                    placeholder={['Start Date', 'End Date']}
                    style={{ float: "right", marginLeft: "16px", marginTop: "8.4px", marginBottom: "22px" }}
                />
            </Tooltip>
            <Tooltip title="Filter by Order Date">
                <DatePicker.RangePicker
                    format='YYYY-MM-DD'
                    onChange={onOrderDateChange}
                    placeholder={['Start Date', 'End Date']}
                    style={{ float: "right", marginLeft: "16px", marginTop: "8.4px", marginBottom: "22px" }}
                />
            </Tooltip>
            <PartyOrderTable
                columns={columns}
                partyOrdersData={partyOrdersData}
                loading={loading}
                handleModalOpen={handleModalOpen}
                handleDeletePartyOrder={handleDeletePartyOrder}
                canDelete={canDelete}
            />

            <Modal title={editRecord ? 'Edit Party Order' : 'Add Party Order'} visible={modalVisible} onCancel={handleModalClose} footer={null}>
                <PartyOrderForm
                    invoiceNumber={invoiceNumber}
                    editRecord={editRecord}
                    form={form}
                    handleSavePartyOrder={handleSavePartyOrder}
                    handleModalClose={handleModalClose}
                    handleCalculateTotals={handleCalculateTotals}
                    loading={loading}
                />
            </Modal>
        </div>
    );
};

export default RestaurantPartyOrdersComponent;