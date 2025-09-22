import React from 'react';
import { Modal, Form, Input, Button } from 'antd';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

const RestaurantForm = ({ visible, onClose, onSave, form, loading, editRecord }) => {
  return (
    <Modal title={editRecord ? 'Edit Restaurant' : 'Add Restaurant'} visible={visible} onCancel={onClose} footer={null}>
      <Form form={form} onFinish={onSave}>
        <Form.Item name="name" rules={[{ required: true, message: 'Please enter the restaurant name' }]}>
          <Input placeholder="Restaurant Name" />
        </Form.Item>
        <Form.Item name="location" rules={[{ required: true, message: 'Please enter the restaurant location' }]}>
          <Input placeholder="Restaurant Location" />
        </Form.Item>
        <Form.Item name="address" rules={[{ required: true, message: 'Please enter the restaurant address' }]}>
          <Input.TextArea placeholder="Restaurant Address" />
        </Form.Item>
        <Form.Item name="phone" rules={[{ required: true, message: 'Please enter the restaurant phone number' }]}>
          <PhoneInput
            country={'us'}
          />
        </Form.Item>
        <Form.Item name="description" rules={[{ required: true, message: 'Please enter the restaurant description' }]}>
          <Input.TextArea placeholder="Description" rows={4} />
        </Form.Item>
        <Form.Item name="email" rules={[{ required: true, message: 'Please enter the restaurant email' }]}>
          <Input placeholder="Restaurant Email" />
        </Form.Item>
        <Form.Item name="orderNowURL" rules={[{ required: true, message: 'Please enter the Order Now URL' }]}>
          <Input placeholder="Order Now URL" />
        </Form.Item>
        <Form.Item name="locationURL" rules={[{ required: true, message: 'Please enter the restaurant location url' }]}>
          <Input placeholder="Restaurant Location URL" />
        </Form.Item>
        <Form.Item name="landingpageImgURL" rules={[{ required: true, message: 'Please enter the restaurant image url' }]}>
          <Input placeholder="Restaurant Image URL" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RestaurantForm;