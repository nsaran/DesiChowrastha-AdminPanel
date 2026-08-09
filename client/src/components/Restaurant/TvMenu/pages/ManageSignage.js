import React, { useState, useEffect } from "react";
import { useParams } from 'react-router-dom';
import { Button, Input, Select, Card, message, Space, Typography, Divider, InputNumber, Switch } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, CopyOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import API_BASE_URL from '../../../../config/api';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

/**
 * ManageSignage - Admin page for managing digital signage playlists
 * 
 * Features:
 * - Create/edit playlists per TV ID
 * - Add items: URL, video, image, HTML
 * - Set duration per item
 * - Reorder items
 * - Live push to connected TVs via SSE
 */
const ManageSignage = () => {
    const { restaurantId } = useParams();
    const [playlists, setPlaylists] = useState([]);
    const [selectedTvId, setSelectedTvId] = useState('');
    const [newTvId, setNewTvId] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    // Fetch all playlists for this location
    useEffect(() => {
        const fetchPlaylists = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/signage/playlists?location=${restaurantId}`);
                const data = await res.json();
                setPlaylists(data || []);
                if (data.length > 0) {
                    setSelectedTvId(data[0].tvId);
                    setItems(data[0].items || []);
                }
            } catch (e) {
                console.error("Error fetching playlists:", e);
            }
            setFetching(false);
        };
        fetchPlaylists();
    }, [restaurantId]);

    // When selected TV changes, load its items
    useEffect(() => {
        if (!selectedTvId) return;
        const playlist = playlists.find(p => p.tvId === selectedTvId);
        setItems(playlist?.items || []);
    }, [selectedTvId, playlists]);

    const handleCreatePlaylist = () => {
        if (!newTvId.trim()) {
            message.warning("Enter a TV ID");
            return;
        }
        const id = newTvId.trim().toLowerCase().replace(/\s+/g, '-');
        if (playlists.find(p => p.tvId === id)) {
            message.warning("TV ID already exists");
            return;
        }
        const newPlaylist = { tvId: id, location: restaurantId.toUpperCase(), items: [] };
        setPlaylists([...playlists, newPlaylist]);
        setSelectedTvId(id);
        setItems([]);
        setNewTvId('');
        message.success(`Playlist created for TV: ${id}`);
    };

    const addItem = () => {
        setItems([...items, { type: 'url', src: '', label: '', duration: 30, content: '', enabled: true }]);
    };

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index, field, value) => {
        const updated = [...items];
        updated[index] = { ...updated[index], [field]: value };
        setItems(updated);
    };

    const moveItem = (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= items.length) return;
        const updated = [...items];
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
        setItems(updated);
    };

    const handleSave = async () => {
        if (!selectedTvId) {
            message.warning("Select or create a TV first");
            return;
        }

        // Validate
        for (const item of items) {
            if (item.type === 'html' && !item.content) {
                message.error("HTML items must have content");
                return;
            }
            if (item.type !== 'html' && !item.src) {
                message.error(`${item.type} items must have a source URL`);
                return;
            }
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/signage/playlist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tvId: selectedTvId, location: restaurantId, items })
            });
            const data = await res.json();
            if (data.success) {
                message.success("Playlist saved and pushed to TV!");
                // Update local state
                setPlaylists(prev => {
                    const existing = prev.findIndex(p => p.tvId === selectedTvId);
                    if (existing >= 0) {
                        const updated = [...prev];
                        updated[existing] = data.playlist;
                        return updated;
                    }
                    return [...prev, data.playlist];
                });
            }
        } catch (e) {
            message.error("Failed to save playlist");
        }
        setLoading(false);
    };

    const handleDelete = async () => {
        if (!selectedTvId) return;
        try {
            await fetch(`${API_BASE_URL}/api/signage/playlist?tvId=${selectedTvId}&location=${restaurantId}`, {
                method: 'DELETE'
            });
            setPlaylists(prev => prev.filter(p => p.tvId !== selectedTvId));
            setSelectedTvId('');
            setItems([]);
            message.success("Playlist deleted");
        } catch (e) {
            message.error("Failed to delete playlist");
        }
    };

    const getPlayerUrl = () => {
        const base = window.location.origin;
        return `${base}/dashboard/${restaurantId}/signage?tvId=${selectedTvId}`;
    };

    const copyPlayerUrl = () => {
        navigator.clipboard.writeText(getPlayerUrl());
        message.success("Player URL copied!");
    };

    if (fetching) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Text>Loading...</Text>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '30px' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <Title level={2} style={{ color: '#fd590d' }}>
                    📺 Manage Digital Signage
                </Title>
                <Text type="secondary" style={{ fontSize: '1.1rem' }}>
                    {restaurantId} — Configure content for your TVs
                </Text>
            </div>

            {/* TV Selection / Creation */}
            <Card style={{ marginBottom: '20px', borderRadius: '12px' }}>
                <Space size="middle" wrap>
                    <Select
                        placeholder="Select TV"
                        value={selectedTvId || undefined}
                        onChange={setSelectedTvId}
                        style={{ width: 200 }}
                    >
                        {playlists.map(p => (
                            <Option key={p.tvId} value={p.tvId}>{p.tvId}</Option>
                        ))}
                    </Select>

                    <Divider type="vertical" />

                    <Input
                        placeholder="New TV ID (e.g., lobby-tv)"
                        value={newTvId}
                        onChange={(e) => setNewTvId(e.target.value)}
                        style={{ width: 200 }}
                        onPressEnter={handleCreatePlaylist}
                    />
                    <Button type="primary" onClick={handleCreatePlaylist}>
                        Create TV
                    </Button>
                </Space>

                {selectedTvId && (
                    <div style={{ marginTop: '15px' }}>
                        <Text code>{getPlayerUrl()}</Text>
                        <Button
                            type="link"
                            icon={<CopyOutlined />}
                            onClick={copyPlayerUrl}
                            size="small"
                        >
                            Copy
                        </Button>
                    </div>
                )}
            </Card>

            {/* Playlist Items */}
            {selectedTvId && (
                <>
                    {items.map((item, index) => (
                        <Card
                            key={index}
                            style={{ marginBottom: '15px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
                            size="small"
                            title={
                                <Space>
                                    <span>#{index + 1}</span>
                                    <Select
                                        value={item.type}
                                        onChange={(val) => updateItem(index, 'type', val)}
                                        style={{ width: 100 }}
                                        size="small"
                                    >
                                        <Option value="url">URL</Option>
                                        <Option value="video">Video</Option>
                                        <Option value="image">Image</Option>
                                        <Option value="html">HTML</Option>
                                    </Select>
                                </Space>
                            }
                            extra={
                                <Space>
                                    <Switch
                                        checked={item.enabled !== false}
                                        onChange={(checked) => updateItem(index, 'enabled', checked)}
                                        checkedChildren="On"
                                        unCheckedChildren="Off"
                                        size="small"
                                    />
                                    <Button size="small" icon={<ArrowUpOutlined />} onClick={() => moveItem(index, -1)} disabled={index === 0} />
                                    <Button size="small" icon={<ArrowDownOutlined />} onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} />
                                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(index)} />
                                </Space>
                            }
                        >
                            <Space direction="vertical" style={{ width: '100%' }}>
                                {item.type !== 'html' ? (
                                    <Input
                                        placeholder={item.type === 'url' ? 'https://... or /dashboard/Nashua/TVMenu/Page1' : `/${item.type} path or URL`}
                                        value={item.src}
                                        onChange={(e) => updateItem(index, 'src', e.target.value)}
                                    />
                                ) : (
                                    <TextArea
                                        placeholder="<h1 style='color: #fd590d'>Your HTML content here</h1>"
                                        value={item.content}
                                        onChange={(e) => updateItem(index, 'content', e.target.value)}
                                        rows={3}
                                    />
                                )}
                                <Space>
                                    <Input
                                        placeholder="Label (optional)"
                                        value={item.label}
                                        onChange={(e) => updateItem(index, 'label', e.target.value)}
                                        style={{ width: 200 }}
                                    />
                                    <InputNumber
                                        min={5}
                                        max={3600}
                                        value={item.duration}
                                        onChange={(val) => updateItem(index, 'duration', val)}
                                        addonAfter="sec"
                                        style={{ width: 130 }}
                                    />
                                </Space>
                            </Space>
                        </Card>
                    ))}

                    <Space style={{ width: '100%', justifyContent: 'center', marginTop: '20px' }}>
                        <Button type="dashed" icon={<PlusOutlined />} onClick={addItem} size="large">
                            Add Item
                        </Button>
                    </Space>

                    <Divider />

                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Button danger onClick={handleDelete}>
                            Delete Playlist
                        </Button>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleSave}
                            loading={loading}
                            size="large"
                            style={{ backgroundColor: '#fd590d', borderColor: '#fd590d' }}
                        >
                            Save & Push to TV
                        </Button>
                    </Space>
                </>
            )}
        </div>
    );
};

export default ManageSignage;
