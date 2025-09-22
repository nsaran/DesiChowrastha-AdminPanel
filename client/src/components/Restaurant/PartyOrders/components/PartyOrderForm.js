import React, { useState, useEffect } from 'react';
import { Form, Input, Row, Col, Select, Radio, Button } from 'antd';
import moment from 'moment';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

const { TextArea } = Input;
const { Option } = Select;

const PartyOrderForm = ({
    invoiceNumber,
    editRecord,
    form,
    handleSavePartyOrder,
    handleModalClose,
    handleCalculateTotals,
}) => {
    const formatDate = (value) => {
        return value ? moment(value).format('YYYY-MM-DD') : '';
    };
   
    const handlePhoneChange = (value, country) => {
        form.setFieldsValue({ cPhoneNumber: value });
      };

   
    
    return (
        <Form form={form} layout="vertical" onFinish={handleSavePartyOrder}>
            <Row gutter={16}>
                <Col span={24}>
                    <Form.Item label="Invoice Number" name="cInvoiceNumber">
                        <Input disabled value={invoiceNumber} />
                    </Form.Item>
                </Col>
            </Row>
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item
                        label="Customer Name"
                        name="cName"
                        rules={[{ required: true, message: "Please enter the customer name" }]}
                    >
                        <Input />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item
                        label="Order Delivery Time"
                        name="cOrderDeliveryTime"
                        rules={[{ required: true, message: "Please enter the order delivery time" }]}
                    >
                        <Input type="time" />
                    </Form.Item>
                </Col>
            </Row>
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item
                        label="Order Date"
                        name="cOrderDate"
                        rules={[{ required: true, message: "Please select the order date" }]}
                    >
                        <Input type="date" format={formatDate} />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item
                        label="Party Date"
                        name="cPartyDate"
                        rules={[{ required: true, message: "Please select the party date" }]}
                    >
                        <Input type="date" format={formatDate} />
                    </Form.Item>
                </Col>
            </Row>
            <Form.Item label="Email" name="cEmail">
                <Input type="email" />
            </Form.Item>
            <Form.Item label="Phone Number" name="cPhoneNumber"
        rules={[{ required: true, message: 'Please input your phone number' }]}
      >
        <PhoneInput
          country={'us'}
          inputProps={{ name: "cPhoneNumber" }}
          onChange={handlePhoneChange}
        />
      </Form.Item>
            <Form.Item label="Party Order Comments" name="cPartyOrderComments">
                <TextArea placeholder="Party Order Comments" />
            </Form.Item>

            <Form.List name="cPartyOrderItems">
                {(fields, { add, remove }) => (
                    <>
                        {fields.map((field, index) => (
                            <div key={field.key}>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item
                                            name={[field.name, "itemName"]}
                                            label="Item Name"
                                            rules={[{ required: true, message: "Please enter the item name" }]}
                                        >
                                            <Input placeholder="Item Name" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item
                                            label="Qty"
                                            name={[field.name, "qty"]}
                                            rules={[{ required: true, message: "Please enter the quantity" }]}
                                        >
                                            <Input type="number" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item
                                            label="Price"
                                            name={[field.name, "price"]}
                                            rules={[{ required: true, message: "Please enter the price" }]}
                                        >
                                            <Input type="number" addonBefore="$" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={24}>
                                        <Form.Item
                                            label="Tray Type"
                                            name={[field.name, "trayType"]}
                                            rules={[{ required: true, message: "Please select the tray type" }]}
                                        >
                                            <Select placeholder="Tray Type">
                                                <Option value="Shallow Tray">Shallow Tray</Option>
                                                <Option value="Small Deep / Half Tray">Small Deep / Half Tray</Option>
                                                <Option value="Long Medium Tray">Long Medium Tray</Option>
                                                <Option value="Long Deep / Full Tray">Long Deep / Full Tray</Option>
                                                <Option value="Single Item">Single Item</Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={24}>
                                        <Form.Item
                                            label="Spice Level"
                                            name={[field.name, "spiceLevel"]}
                                            rules={[{ required: true, message: "Please select the spice level" }]}
                                        >
                                            <Radio.Group>
                                                <Radio value="Mild">Mild</Radio>
                                                <Radio value="Medium">Medium</Radio>
                                                <Radio value="Spicy">Spicy</Radio>
                                                <Radio value="None">None</Radio>
                                            </Radio.Group>
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={24}>
                                        <Form.Item
                                            label="Item Comments"
                                            name={[field.name, "itemComments"]}
                                        >
                                            <TextArea placeholder="Item Comments" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                {fields.length > 1 && (
                                    <Row>
                                        <Col span={24} style={{ textAlign: "right" }}>
                                            <Button danger onClick={() => remove(field.name)}>
                                                Remove
                                            </Button>
                                        </Col>
                                    </Row>
                                )}
                                <br />
                            </div>
                        ))}
                        <Row>
                            <Col span={24} style={{ textAlign: "right" }}>
                                <Button type="primary" onClick={() => add()} block>
                                    Add Item
                                </Button>
                            </Col>
                        </Row>
                    </>
                )}
            </Form.List>
            <br />
            <Row gutter={16}>
                <Col span={24}>
                    <Form.Item label="Order Status" name="cPartyOrderStatus">
                        <Radio.Group>
                            <Radio value="CONFIRMED">CONFIRMED</Radio>
                            <Radio value="COMPLETED">COMPLETED</Radio>
                            <Radio value="CANCELLED">CANCELLED</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Col>
            </Row>
            <Row gutter={16}>
                <Col span={24}>
                    <Form.Item label="Payment Status" name="cPartyOrderPaymentStatus">
                        <Radio.Group>
                            <Radio value="COD">COD</Radio>
                            <Radio value="PARTIAL">PARTIAL</Radio>
                            <Radio value="FULL">FULL</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Col>
            </Row>
            <Form.Item label="Discount (%)" name="cOrderDiscount">
                <Input suffix="%" onChange={handleCalculateTotals} />
            </Form.Item>
            <Form.List name="cPartyOrderPaymentDetails">
                {(fields, { add, remove }) => (
                    <>
                        {fields.map((field, index) => (
                            <div key={field.key}>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item
                                            label="Payment Mode"
                                            name={[field.name, "paymentMode"]}
                                            rules={[
                                                { required: true, message: "Please select the payment mode" },
                                            ]}
                                        >
                                            <Radio.Group>
                                                <Radio value="CASH">CASH</Radio>
                                                <Radio value="ZELLE">ZELLE</Radio>
                                            </Radio.Group>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item
                                            label="Amount Paid"
                                            name={[field.name, "amountPaid"]}
                                            rules={[
                                                { required: true, message: "Please enter the amount paid" },
                                            ]}
                                        >
                                            <Input addonBefore="$" onChange={handleCalculateTotals} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                {fields.length > 1 && (
                                    <Row>
                                        <Col span={24} style={{ textAlign: "right" }}>
                                            <Button type="link" danger onClick={() => remove(field.name)}>
                                                Remove
                                            </Button>
                                        </Col>
                                    </Row>
                                )}
                            </div>
                        ))}
                        <Row>
                            <Col span={24} style={{ textAlign: "right" }}>
                                <Button type="primary" onClick={() => add()} block>
                                    Add Payment Detail
                                </Button>
                            </Col>
                        </Row>
                    </>
                )}
            </Form.List>
            <Form.Item name="cOrderTotal" label="Order Total">
                <Input disabled />
            </Form.Item>
            <Form.Item name="cAmountDue" label="Amount Due">
                <Input disabled />
            </Form.Item>
            <Button
                type="primary"
                onClick={handleCalculateTotals}
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%'
                }}
            >
                Calculate Totals &amp; Amount Due
            </Button>
            <br />
            <Form.Item>
                <Button type="primary" htmlType="submit">
                    {editRecord ? "Update" : "Create"}
                </Button>
                <Button htmlType="button" onClick={handleModalClose} style={{ marginLeft: "8px" }}>
                    Cancel
                </Button>
            </Form.Item>
        </Form>
    );
};

export default PartyOrderForm;