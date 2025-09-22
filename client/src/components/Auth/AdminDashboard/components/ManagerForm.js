import React from 'react';
import { Modal, Form, Input, Button } from 'antd';
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';

const ManagerForm = ({ visible, onClose, onSave, form, loading }) => {
  return (
    <Modal title="Create Manager" visible={visible} onCancel={onClose} footer={null}>
      <Form form={form} onFinish={onSave}>
        <Form.Item name="username" rules={[{ required: true, message: 'Please enter the manager username' }]}>
          <Input placeholder="Username" />
        </Form.Item>
        <Form.Item name="email" rules={[{ required: true, message: 'Please enter the manager email' }]}>
          <Input placeholder="Email" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: 'Please enter the manager password' }]}>
          <Input.Password placeholder="input password" iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)} />
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

export default ManagerForm;