import React, { useState, useEffect, useCallback } from "react";
import { useParams } from 'react-router-dom';
import { Card, Input, Button, Space, Typography, message, Popconfirm, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import protectedApi from '../../../../utils/api';

const { Title, Text } = Typography;

/**
 * SoftLaunchManage - edit the soft-launch limited menu (owner/manager).
 * Add/remove categories and items; Save pushes to the server.
 *
 * Route: /dashboard/:restaurantId/OtherServices/SoftLaunchManage
 */
const SoftLaunchManage = () => {
    const { restaurantId } = useParams();
    const [menu, setMenu] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await protectedApi.get('/api/soft-launch', { params: { location: restaurantId } });
            setMenu(Array.isArray(res.data.menu) ? res.data.menu : []);
        } catch (err) {
            message.error('Failed to load soft launch menu.');
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => { load(); }, [load]);

    const setCategoryName = (idx, value) => {
        setMenu((prev) => prev.map((s, i) => (i === idx ? { ...s, category: value } : s)));
    };

    const addCategory = () => {
        setMenu((prev) => [...prev, { category: '', items: [] }]);
    };

    const removeCategory = (idx) => {
        setMenu((prev) => prev.filter((_, i) => i !== idx));
    };

    const setItem = (catIdx, itemIdx, value) => {
        setMenu((prev) => prev.map((s, i) => (
            i === catIdx ? { ...s, items: s.items.map((it, j) => (j === itemIdx ? value : it)) } : s
        )));
    };

    const addItem = (catIdx) => {
        setMenu((prev) => prev.map((s, i) => (i === catIdx ? { ...s, items: [...s.items, ''] } : s)));
    };

    const removeItem = (catIdx, itemIdx) => {
        setMenu((prev) => prev.map((s, i) => (
            i === catIdx ? { ...s, items: s.items.filter((_, j) => j !== itemIdx) } : s
        )));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await protectedApi.put('/api/soft-launch', { location: restaurantId, menu });
            message.success('Soft launch menu saved.');
            load();
        } catch (err) {
            message.error(err.response?.data?.error || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ margin: '16px', maxWidth: 800 }}>
            <Title level={3}>Soft Launch Menu</Title>
            <Text type="secondary">
                Add or remove categories and items. Changes appear on the Soft Launch page after you Save.
            </Text>

            <div style={{ margin: '16px 0' }}>
                <Space>
                    <Button icon={<PlusOutlined />} onClick={addCategory}>Add Category</Button>
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>Save</Button>
                </Space>
            </div>

            {menu.map((section, catIdx) => (
                <Card
                    key={catIdx}
                    size="small"
                    style={{ marginBottom: 16, borderRadius: 10 }}
                    title={
                        <Input
                            placeholder="Category name"
                            value={section.category}
                            onChange={(e) => setCategoryName(catIdx, e.target.value)}
                            style={{ maxWidth: 320 }}
                        />
                    }
                    extra={
                        <Popconfirm title="Remove this category?" onConfirm={() => removeCategory(catIdx)} okText="Yes" cancelText="No">
                            <Button size="small" danger icon={<DeleteOutlined />}>Category</Button>
                        </Popconfirm>
                    }
                >
                    <Space direction="vertical" style={{ width: '100%' }}>
                        {section.items.map((item, itemIdx) => (
                            <Space key={itemIdx} style={{ width: '100%' }}>
                                <Input
                                    placeholder="Item name"
                                    value={item}
                                    onChange={(e) => setItem(catIdx, itemIdx, e.target.value)}
                                    style={{ width: 360 }}
                                />
                                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(catIdx, itemIdx)} />
                            </Space>
                        ))}
                        <Button size="small" icon={<PlusOutlined />} onClick={() => addItem(catIdx)}>Add Item</Button>
                    </Space>
                </Card>
            ))}

            {menu.length === 0 && !loading && (
                <Text type="secondary">No categories yet. Click "Add Category" to start.</Text>
            )}

            <Divider />
            <Space>
                <Button icon={<PlusOutlined />} onClick={addCategory}>Add Category</Button>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>Save</Button>
            </Space>
        </div>
    );
};

export default SoftLaunchManage;
