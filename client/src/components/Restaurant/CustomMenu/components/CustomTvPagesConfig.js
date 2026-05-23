import React, { useEffect, useState } from 'react';
import {
    Button,
    Card,
    Collapse,
    Form,
    Input,
    Modal,
    Select,
    Space,
    Typography,
    message,
    Empty,
    Radio,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import {
    fetchCustomTvPages,
    saveCustomTvPages,
    getUnassignedCategories,
    normalizeTvPage,
    normalizeTvPages,
    COLUMN_LAYOUT_OPTIONS,
} from '../customMenuApi';

const { Panel } = Collapse;
const { Text } = Typography;
const { Option } = Select;

const createEmptyPage = (index) =>
    normalizeTvPage({
        id: `page-${Date.now()}-${index}`,
        name: `Page ${index}`,
        columnLayout: 2,
        columnCategories: [[], []],
    });

const CustomTvPagesConfig = ({ menuCategories }) => {
    const { restaurantId } = useParams();
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editVisible, setEditVisible] = useState(false);
    const [editingPage, setEditingPage] = useState(null);
    const [form] = Form.useForm();
    const columnLayout = Form.useWatch('columnLayout', form) || 2;

    const availableCategories = menuCategories.filter((category) => category !== 'All');

    useEffect(() => {
        const loadPages = async () => {
            if (!restaurantId) {
                return;
            }
            setLoading(true);
            try {
                const savedPages = await fetchCustomTvPages(restaurantId);
                setPages(normalizeTvPages(savedPages));
            } catch (error) {
                console.error('Error loading TV pages config:', error);
                message.error('Failed to load TV menu page configuration.');
            } finally {
                setLoading(false);
            }
        };

        loadPages();
    }, [restaurantId]);

    const openEditModal = (page = null) => {
        const pageToEdit = normalizeTvPage(page || createEmptyPage(pages.length + 1));
        setEditingPage(pageToEdit);
        form.setFieldsValue({
            name: pageToEdit.name,
            columnLayout: pageToEdit.columnLayout,
            columnCategories: pageToEdit.columnCategories,
        });
        setEditVisible(true);
    };

    const handleSavePage = async () => {
        if (!editingPage?.id) {
            message.error('Page data is missing. Please close and try again.');
            return;
        }

        try {
            const values = await form.validateFields();
            const layout = Number(values.columnLayout) || 2;
            const columnCategories = Array.from({ length: layout }, (_, index) => {
                const column = values.columnCategories?.[index];
                return Array.isArray(column) ? column.filter(Boolean) : [];
            });

            const updatedPage = normalizeTvPage({
                id: editingPage.id,
                name: values.name.trim(),
                columnLayout: layout,
                columnCategories,
            });

            const pageExists = pages.some((page) => page.id === updatedPage.id);
            const nextPages = pageExists
                ? pages.map((page) => (page.id === updatedPage.id ? updatedPage : page))
                : [...pages, updatedPage];

            setPages(nextPages);
            setEditVisible(false);
            setEditingPage(null);
            form.resetFields();
        } catch (error) {
            // Form validation errors are handled by antd.
        }
    };

    const handleDeletePage = (pageId) => {
        setPages((prevPages) => prevPages.filter((page) => page.id !== pageId));
    };

    const handlePreviewPage = async (page) => {
        if (!restaurantId) {
            return;
        }

        try {
            await saveCustomTvPages(restaurantId, normalizeTvPages(pages));
            window.open(
                `/dashboard/${restaurantId}/customTvMenu/${page.id}`,
                '_blank',
                'noopener,noreferrer'
            );
        } catch (error) {
            console.error('Error saving before preview:', error);
            message.error('Save configuration before previewing.');
        }
    };

    const handleSaveConfig = async () => {
        if (!restaurantId) {
            message.error('Restaurant not found.');
            return;
        }

        setSaving(true);
        try {
            await saveCustomTvPages(restaurantId, normalizeTvPages(pages));
            message.success('Custom TV menu pages saved.');
        } catch (error) {
            console.error('Error saving TV pages config:', error);
            const detail = error?.message || 'Unknown error';
            message.error(`Failed to save TV menu page configuration: ${detail}`);
        } finally {
            setSaving(false);
        }
    };

    const unassignedCategories = getUnassignedCategories(pages, availableCategories);

    return (
        <Card
            title="Custom TV Menu Pages"
            style={{ margin: 16 }}
            loading={loading}
            extra={
                <Space>
                    <Button icon={<PlusOutlined />} onClick={() => openEditModal()}>
                        Add Page
                    </Button>
                    <Button type="primary" onClick={handleSaveConfig} loading={saving}>
                        Save TV Configuration
                    </Button>
                </Space>
            }
        >
            <Text type="secondary">
                Choose a column layout (1–4) and assign categories from your custom menu to
                each column for the TV display.
            </Text>

            {unassignedCategories.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <Text type="warning">
                        Unassigned categories (not shown on any page):{' '}
                        {unassignedCategories.join(', ')}
                    </Text>
                </div>
            )}

            {pages.length === 0 ? (
                <Empty
                    style={{ marginTop: 24 }}
                    description="No TV pages yet. Add a page to configure the Custom TV Menu display."
                />
            ) : (
                pages.map((page, index) => {
                    const normalized = normalizeTvPage(page);
                    return (
                        <Card
                            key={page.id}
                            size="small"
                            style={{ marginTop: 16 }}
                            title={page.name || `Page ${index + 1}`}
                            extra={
                                <Space>
                                    <Button
                                        type="link"
                                        icon={<EyeOutlined />}
                                        onClick={() => handlePreviewPage(page)}
                                    >
                                        Preview
                                    </Button>
                                    <Button
                                        type="link"
                                        icon={<EditOutlined />}
                                        onClick={() => openEditModal(page)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        type="link"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleDeletePage(page.id)}
                                    >
                                        Remove
                                    </Button>
                                </Space>
                            }
                        >
                            <p>
                                <strong>Layout:</strong> {normalized.columnLayout} column
                                {normalized.columnLayout > 1 ? 's' : ''}
                            </p>
                            {normalized.columnCategories.map((columnCategories, columnIndex) => (
                                <p key={`${page.id}-col-${columnIndex}`}>
                                    <strong>Column {columnIndex + 1}:</strong>{' '}
                                    {columnCategories.join(', ') || '—'}
                                </p>
                            ))}
                        </Card>
                    );
                })
            )}

            <Modal
                title={
                    editingPage && pages.some((page) => page.id === editingPage.id)
                        ? 'Edit TV Page'
                        : 'Add TV Page'
                }
                open={editVisible}
                destroyOnClose
                onOk={handleSavePage}
                onCancel={() => {
                    setEditVisible(false);
                    setEditingPage(null);
                    form.resetFields();
                }}
                okText="Apply"
                width={560}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="name"
                        label="Page name"
                        rules={[{ required: true, message: 'Please enter a page name' }]}
                    >
                        <Input placeholder="e.g. Page 1" />
                    </Form.Item>
                    <Form.Item
                        name="columnLayout"
                        label="Column layout"
                        rules={[{ required: true, message: 'Please select a column layout' }]}
                    >
                        <Radio.Group>
                            {COLUMN_LAYOUT_OPTIONS.map((count) => (
                                <Radio.Button key={count} value={count}>
                                    {count} {count === 1 ? 'Column' : 'Columns'}
                                </Radio.Button>
                            ))}
                        </Radio.Group>
                    </Form.Item>
                    {Array.from({ length: columnLayout }, (_, columnIndex) => (
                        <Form.Item
                            key={`column-${columnIndex}`}
                            name={['columnCategories', columnIndex]}
                            label={`Column ${columnIndex + 1} categories`}
                        >
                            <Select mode="multiple" placeholder="Select categories" allowClear>
                                {availableCategories.map((category) => (
                                    <Option
                                        key={`col-${columnIndex}-${category}`}
                                        value={category}
                                    >
                                        {category}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    ))}
                </Form>
            </Modal>
        </Card>
    );
};

const CustomTvPagesConfigPanel = (props) => (
    <Collapse defaultActiveKey={['tv-pages']} style={{ margin: '0 16px 16px' }}>
        <Panel header="Custom TV Menu — Page Configuration" key="tv-pages">
            <CustomTvPagesConfig {...props} />
        </Panel>
    </Collapse>
);

export default CustomTvPagesConfigPanel;
