import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, Table, Tag, Select, Input, Modal, Form, InputNumber, message, Space, Typography, Divider, Tabs, Checkbox } from 'antd';
import { PlusOutlined, EditOutlined, CheckOutlined, DeleteOutlined, EyeOutlined, SendOutlined, ArrowUpOutlined, ArrowDownOutlined, SaveOutlined } from '@ant-design/icons';
import API_BASE_URL from '../../../../config/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

/**
 * StockOrders - Purchase Order Management for restaurant stock
 * 
 * Workflow: Chef creates order → Purchaser buys → Chef validates received → Close
 * Supports both Nashua and Westborough locations.
 */
const StockOrders = () => {
    const { restaurantId } = useParams();
    const [searchParams] = useSearchParams();
    const orderIdFromUrl = searchParams.get('order');
    const [orders, setOrders] = useState([]);
    const [masterList, setMasterList] = useState({ categories: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('orders');

    // Create order modal
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newOrderBy, setNewOrderBy] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);

    // View/Edit order modal
    const [viewModalVisible, setViewModalVisible] = useState(false);
    const [currentOrder, setCurrentOrder] = useState(null);

    // Add item modal
    const [addItemModalVisible, setAddItemModalVisible] = useState(false);
    const [newItemCategory, setNewItemCategory] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');

    // Master list editing
    const [editingMaster, setEditingMaster] = useState(false);
    const [editableMaster, setEditableMaster] = useState({ categories: [] });
    const [editingItemIndex, setEditingItemIndex] = useState(null); // { catIdx, itemIdx }
    const [editingItemValue, setEditingItemValue] = useState('');

    useEffect(() => {
        fetchOrders();
        fetchMasterList();
    }, [restaurantId]);

    // Auto-open order from URL param (WhatsApp link)
    useEffect(() => {
        if (orderIdFromUrl && orders.length > 0) {
            const order = orders.find(o => o.id === orderIdFromUrl);
            if (order) {
                openOrder(order);
            }
        }
    }, [orderIdFromUrl, orders]);

    const fetchOrders = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/stock-orders?location=${restaurantId}`);
            const data = await res.json();
            setOrders(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Error fetching orders:', e);
        }
        setLoading(false);
    };

    const fetchMasterList = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/stock-orders/master`);
            const data = await res.json();
            setMasterList(data);
        } catch (e) {
            console.error('Error fetching master list:', e);
        }
    };

    const saveMasterListToServer = async (data) => {
        try {
            await fetch(`${API_BASE_URL}/api/stock-orders/master`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.error('Error saving master list:', e);
            message.error('Failed to save master list');
        }
    };

    // ─── Create Order ────────────────────────────────────────────────────────

    const openCreateModal = () => {
        setSelectedItems([]);
        setNewOrderBy('');
        setCreateModalVisible(true);
    };

    const toggleItem = (category, itemName) => {
        const exists = selectedItems.find(i => i.name === itemName && i.category === category);
        if (exists) {
            setSelectedItems(selectedItems.filter(i => !(i.name === itemName && i.category === category)));
        } else {
            setSelectedItems([...selectedItems, { name: itemName, category, ordered: '' }]);
        }
    };

    const selectAllInCategory = (category) => {
        const catItems = masterList.categories.find(c => c.name === category)?.items || [];
        const allSelected = catItems.every(item => selectedItems.find(i => i.name === item && i.category === category));
        if (allSelected) {
            setSelectedItems(selectedItems.filter(i => i.category !== category));
        } else {
            const newItems = catItems
                .filter(item => !selectedItems.find(i => i.name === item && i.category === category))
                .map(item => ({ name: item, category, ordered: '' }));
            setSelectedItems([...selectedItems, ...newItems]);
        }
    };

    const updateSelectedQuantity = (itemName, category, value) => {
        setSelectedItems(selectedItems.map(i =>
            i.name === itemName && i.category === category ? { ...i, ordered: value } : i
        ));
    };

    const handleCreateOrder = async () => {
        if (selectedItems.length === 0) {
            message.warning('Select at least one item');
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/api/stock-orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location: restaurantId, orderedBy: newOrderBy, items: selectedItems })
            });
            const data = await res.json();
            if (data.success) {
                message.success('Order created!');
                setCreateModalVisible(false);
                fetchOrders();
            }
        } catch (e) {
            message.error('Failed to create order');
        }
    };

    // ─── View/Edit Order ─────────────────────────────────────────────────────

    const openOrder = (order) => {
        setCurrentOrder({ ...order, items: order.items.map(i => ({ ...i })) });
        setViewModalVisible(true);
    };

    const updateCurrentOrderItem = (index, field, value) => {
        const items = [...currentOrder.items];
        items[index] = { ...items[index], [field]: value };
        setCurrentOrder({ ...currentOrder, items });
    };

    const saveOrder = async (newStatus) => {
        const updates = {
            location: restaurantId,
            status: newStatus || currentOrder.status,
            items: currentOrder.items,
            orderedBy: currentOrder.orderedBy,
            receivedBy: currentOrder.receivedBy
        };

        try {
            const res = await fetch(`${API_BASE_URL}/api/stock-orders/${currentOrder.id}?location=${restaurantId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const data = await res.json();
            if (data.success) {
                message.success(`Order ${newStatus ? 'updated to ' + newStatus : 'saved'}!`);
                setViewModalVisible(false);
                fetchOrders();
            }
        } catch (e) {
            message.error('Failed to save order');
        }
    };

    const closeOrder = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/stock-orders/${currentOrder.id}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location: restaurantId })
            });
            const data = await res.json();
            if (data.success) {
                message.success('Order closed and inventory updated!');
                setViewModalVisible(false);
                fetchOrders();
            }
        } catch (e) {
            message.error('Failed to close order');
        }
    };

    const deleteOrder = async (orderId) => {
        try {
            await fetch(`${API_BASE_URL}/api/stock-orders/${orderId}?location=${restaurantId}`, { method: 'DELETE' });
            message.success('Order deleted');
            fetchOrders();
        } catch (e) {
            message.error('Failed to delete order');
        }
    };

    // ─── Add Item to Master ──────────────────────────────────────────────────

    const handleAddItem = async () => {
        if (!newItemCategory || !newItemName) {
            message.warning('Fill in both fields');
            return;
        }
        try {
            await fetch(`${API_BASE_URL}/api/stock-orders/master/item`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: newItemCategory, itemName: newItemName })
            });
            message.success('Item added to master list');
            setAddItemModalVisible(false);
            setNewItemName('');
            fetchMasterList();
        } catch (e) {
            message.error('Failed to add item');
        }
    };

    // ─── Status Helpers ──────────────────────────────────────────────────────

    const statusColor = {
        draft: 'default',
        submitted: 'blue',
        purchased: 'orange',
        received: 'green',
        closed: 'purple'
    };

    const columns = [
        { title: 'ID', dataIndex: 'id', key: 'id', render: id => id.substring(0, 8) },
        { title: 'Date', dataIndex: 'createdAt', key: 'date', render: d => new Date(d).toLocaleDateString() },
        { title: 'Ordered By', dataIndex: 'orderedBy', key: 'orderedBy' },
        { title: 'Items', dataIndex: 'items', key: 'items', render: items => items.length },
        { title: 'Status', dataIndex: 'status', key: 'status', render: s => <Tag color={statusColor[s]}>{s.toUpperCase()}</Tag> },
        {
            title: 'Actions', key: 'actions', render: (_, record) => (
                <Space>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => openOrder(record)}>View</Button>
                    {record.status === 'draft' && (
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteOrder(record.id)} />
                    )}
                </Space>
            )
        }
    ];

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
            <Title level={2} style={{ color: '#fd590d', textAlign: 'center' }}>
                📦 Stock Orders — {restaurantId}
            </Title>

            <Tabs activeKey={activeTab} onChange={setActiveTab}>
                <TabPane tab="Orders" key="orders">
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}
                            style={{ backgroundColor: '#fd590d', borderColor: '#fd590d' }}>
                            New Order
                        </Button>
                        <Text type="secondary">{orders.length} orders</Text>
                    </div>
                    <Table
                        dataSource={orders}
                        columns={columns}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                        size="small"
                    />
                </TabPane>

                <TabPane tab="Master List" key="master">
                    <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
                        <Button icon={<PlusOutlined />} onClick={() => setAddItemModalVisible(true)}>
                            Add Item
                        </Button>
                        <Input
                            placeholder="New Category Name"
                            value={newCategoryName}
                            onChange={e => setNewCategoryName(e.target.value)}
                            style={{ width: 200 }}
                            size="small"
                        />
                        <Button size="small" onClick={() => {
                            if (!newCategoryName.trim()) return;
                            const updated = { ...masterList, categories: [...masterList.categories, { name: newCategoryName.trim(), items: [] }] };
                            setMasterList(updated);
                            saveMasterListToServer(updated);
                            setNewCategoryName('');
                            message.success('Category added');
                        }}>Add Category</Button>
                        {editingMaster ? (
                            <Button type="primary" icon={<SaveOutlined />} onClick={() => {
                                saveMasterListToServer(editableMaster);
                                setMasterList(editableMaster);
                                setEditingMaster(false);
                                message.success('Master list saved');
                            }} style={{ marginLeft: 'auto', backgroundColor: '#fd590d', borderColor: '#fd590d' }}>
                                Save Order
                            </Button>
                        ) : (
                            <Button icon={<EditOutlined />} onClick={() => {
                                setEditableMaster(JSON.parse(JSON.stringify(masterList)));
                                setEditingMaster(true);
                            }} style={{ marginLeft: 'auto' }}>
                                Reorder Items
                            </Button>
                        )}
                    </div>
                    {(editingMaster ? editableMaster : masterList).categories.map((cat, catIdx) => (
                        <Card key={cat.name} size="small" title={
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text strong>{cat.name}</Text>
                                {editingMaster && (
                                    <Space size="small">
                                        <Button size="small" icon={<ArrowUpOutlined />} disabled={catIdx === 0}
                                            onClick={() => {
                                                const cats = [...editableMaster.categories];
                                                [cats[catIdx], cats[catIdx - 1]] = [cats[catIdx - 1], cats[catIdx]];
                                                setEditableMaster({ ...editableMaster, categories: cats });
                                            }} />
                                        <Button size="small" icon={<ArrowDownOutlined />} disabled={catIdx === editableMaster.categories.length - 1}
                                            onClick={() => {
                                                const cats = [...editableMaster.categories];
                                                [cats[catIdx], cats[catIdx + 1]] = [cats[catIdx + 1], cats[catIdx]];
                                                setEditableMaster({ ...editableMaster, categories: cats });
                                            }} />
                                        <Button size="small" danger icon={<DeleteOutlined />}
                                            onClick={() => {
                                                const cats = editableMaster.categories.filter((_, i) => i !== catIdx);
                                                setEditableMaster({ ...editableMaster, categories: cats });
                                            }} />
                                    </Space>
                                )}
                            </div>
                        } style={{ marginBottom: '10px' }}>
                            <div style={{ display: 'flex', flexDirection: editingMaster ? 'column' : 'row', flexWrap: 'wrap', gap: '6px' }}>
                                {cat.items.map((item, itemIdx) => (
                                    editingMaster ? (
                                        <div key={item + itemIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', backgroundColor: '#fafafa', borderRadius: '4px', border: '1px solid #f0f0f0' }}>
                                            <Space size={4}>
                                                <Button size="small" icon={<ArrowUpOutlined />} disabled={itemIdx === 0}
                                                    onClick={() => {
                                                        const cats = [...editableMaster.categories];
                                                        const items = [...cats[catIdx].items];
                                                        [items[itemIdx], items[itemIdx - 1]] = [items[itemIdx - 1], items[itemIdx]];
                                                        cats[catIdx] = { ...cats[catIdx], items };
                                                        setEditableMaster({ ...editableMaster, categories: cats });
                                                    }} />
                                                <Button size="small" icon={<ArrowDownOutlined />} disabled={itemIdx === cat.items.length - 1}
                                                    onClick={() => {
                                                        const cats = [...editableMaster.categories];
                                                        const items = [...cats[catIdx].items];
                                                        [items[itemIdx], items[itemIdx + 1]] = [items[itemIdx + 1], items[itemIdx]];
                                                        cats[catIdx] = { ...cats[catIdx], items };
                                                        setEditableMaster({ ...editableMaster, categories: cats });
                                                    }} />
                                            </Space>
                                            {editingItemIndex?.catIdx === catIdx && editingItemIndex?.itemIdx === itemIdx ? (
                                                <Input
                                                    size="small"
                                                    value={editingItemValue}
                                                    onChange={e => setEditingItemValue(e.target.value)}
                                                    onBlur={() => {
                                                        if (editingItemValue.trim()) {
                                                            const cats = [...editableMaster.categories];
                                                            cats[catIdx].items[itemIdx] = editingItemValue.trim();
                                                            setEditableMaster({ ...editableMaster, categories: cats });
                                                        }
                                                        setEditingItemIndex(null);
                                                    }}
                                                    onPressEnter={() => {
                                                        if (editingItemValue.trim()) {
                                                            const cats = [...editableMaster.categories];
                                                            cats[catIdx].items[itemIdx] = editingItemValue.trim();
                                                            setEditableMaster({ ...editableMaster, categories: cats });
                                                        }
                                                        setEditingItemIndex(null);
                                                    }}
                                                    autoFocus
                                                    style={{ width: '200px' }}
                                                />
                                            ) : (
                                                <Text style={{ flex: 1, cursor: 'pointer' }}
                                                    onDoubleClick={() => {
                                                        setEditingItemIndex({ catIdx, itemIdx });
                                                        setEditingItemValue(item);
                                                    }}>
                                                    {item}
                                                </Text>
                                            )}
                                            <Button size="small" danger icon={<DeleteOutlined />}
                                                onClick={() => {
                                                    const cats = [...editableMaster.categories];
                                                    cats[catIdx] = { ...cats[catIdx], items: cats[catIdx].items.filter((_, i) => i !== itemIdx) };
                                                    setEditableMaster({ ...editableMaster, categories: cats });
                                                }} />
                                        </div>
                                    ) : (
                                        <Tag key={item + itemIdx}>{item}</Tag>
                                    )
                                ))}
                            </div>
                        </Card>
                    ))}
                </TabPane>
            </Tabs>

            {/* Create Order Modal */}
            <Modal
                title="Create New Order"
                open={createModalVisible}
                onCancel={() => setCreateModalVisible(false)}
                onOk={handleCreateOrder}
                okText="Create Order"
                width={800}
                okButtonProps={{ style: { backgroundColor: '#fd590d', borderColor: '#fd590d' } }}
            >
                <Form layout="vertical">
                    <Form.Item label="Ordered By">
                        <Input value={newOrderBy} onChange={e => setNewOrderBy(e.target.value)} placeholder="Chef name" />
                    </Form.Item>
                </Form>

                <Divider>Select Items</Divider>
                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                    {masterList.categories.map(cat => (
                        <div key={cat.name} style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <Checkbox
                                    checked={cat.items.every(item => selectedItems.find(i => i.name === item && i.category === cat.name))}
                                    indeterminate={cat.items.some(item => selectedItems.find(i => i.name === item && i.category === cat.name)) && !cat.items.every(item => selectedItems.find(i => i.name === item && i.category === cat.name))}
                                    onChange={() => selectAllInCategory(cat.name)}
                                />
                                <Text strong>{cat.name}</Text>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '24px' }}>
                                {cat.items.map(item => {
                                    const selected = selectedItems.find(i => i.name === item && i.category === cat.name);
                                    return (
                                        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '280px', marginBottom: '4px' }}>
                                            <Checkbox
                                                checked={!!selected}
                                                onChange={() => toggleItem(cat.name, item)}
                                            />
                                            <Text style={{ flex: 1, fontSize: '0.85rem' }}>{item}</Text>
                                            {selected && (
                                                <Input
                                                    size="small"
                                                    placeholder="Qty"
                                                    value={selected.ordered}
                                                    onChange={e => updateSelectedQuantity(item, cat.name, e.target.value)}
                                                    style={{ width: '80px' }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                <Divider />
                <Text type="secondary">{selectedItems.length} items selected</Text>
            </Modal>

            {/* View/Edit Order Modal */}
            <Modal
                title={`Order ${currentOrder?.id?.substring(0, 8)} — ${currentOrder?.status?.toUpperCase()}`}
                open={viewModalVisible}
                onCancel={() => setViewModalVisible(false)}
                width={900}
                footer={currentOrder && (
                    <Space>
                        {currentOrder.status === 'draft' && (
                            <Button type="primary" icon={<SendOutlined />} onClick={() => saveOrder('submitted')}>
                                Submit to Purchaser
                            </Button>
                        )}
                        {currentOrder.status === 'submitted' && (
                            <Button type="primary" style={{ backgroundColor: '#fa8c16' }} onClick={() => saveOrder('purchased')}>
                                Mark as Purchased
                            </Button>
                        )}
                        {currentOrder.status === 'purchased' && (
                            <Button type="primary" style={{ backgroundColor: '#52c41a' }} onClick={() => saveOrder('received')}>
                                Mark as Received
                            </Button>
                        )}
                        {currentOrder.status === 'received' && (
                            <Button type="primary" style={{ backgroundColor: '#722ed1' }} icon={<CheckOutlined />} onClick={closeOrder}>
                                Close & Update Inventory
                            </Button>
                        )}
                        <Button onClick={() => saveOrder()}>Save Changes</Button>
                    </Space>
                )}
            >
                {currentOrder && (
                    <>
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                            <Form.Item label="Ordered By" style={{ flex: 1 }}>
                                <Input value={currentOrder.orderedBy} onChange={e => setCurrentOrder({ ...currentOrder, orderedBy: e.target.value })} />
                            </Form.Item>
                            <Form.Item label="Received By" style={{ flex: 1 }}>
                                <Input value={currentOrder.receivedBy} onChange={e => setCurrentOrder({ ...currentOrder, receivedBy: e.target.value })} />
                            </Form.Item>
                        </div>

                        <Table
                            dataSource={currentOrder.items}
                            rowKey={(_, idx) => idx}
                            size="small"
                            pagination={false}
                            scroll={{ y: 400 }}
                            columns={[
                                { title: '#', render: (_, __, idx) => idx + 1, width: 40 },
                                { title: 'Category', dataIndex: 'category', width: 120 },
                                { title: 'Item', dataIndex: 'name' },
                                {
                                    title: 'Ordered', dataIndex: 'ordered', width: 100,
                                    render: (val, _, idx) => (
                                        <Input size="small" value={val} onChange={e => updateCurrentOrderItem(idx, 'ordered', e.target.value)} />
                                    )
                                },
                                {
                                    title: 'Received', dataIndex: 'received', width: 100,
                                    render: (val, _, idx) => (
                                        <Input size="small" value={val} onChange={e => updateCurrentOrderItem(idx, 'received', e.target.value)}
                                            disabled={currentOrder.status === 'draft' || currentOrder.status === 'submitted'} />
                                    )
                                },
                                {
                                    title: 'Remarks', dataIndex: 'remarks', width: 150,
                                    render: (val, _, idx) => (
                                        <Input size="small" value={val} onChange={e => updateCurrentOrderItem(idx, 'remarks', e.target.value)} />
                                    )
                                }
                            ]}
                        />
                    </>
                )}
            </Modal>

            {/* Add Item to Master Modal */}
            <Modal
                title="Add Item to Master List"
                open={addItemModalVisible}
                onCancel={() => setAddItemModalVisible(false)}
                onOk={handleAddItem}
            >
                <Form layout="vertical">
                    <Form.Item label="Category">
                        <Select value={newItemCategory} onChange={setNewItemCategory} placeholder="Select or type new">
                            {masterList.categories.map(c => (
                                <Option key={c.name} value={c.name}>{c.name}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item label="Item Name">
                        <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="e.g., Coconut Oil" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default StockOrders;
