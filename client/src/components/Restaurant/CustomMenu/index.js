import React, { useState, useEffect, useCallback } from 'react';
import {
    Layout,
    Table,
    Tag,
    Form,
    Modal,
    Input,
    Button,
    Select,
    Typography,
    message,
    Radio,
    Dropdown,
    Menu,
    Upload,
} from 'antd';
import { EditOutlined, DeleteOutlined, MenuOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import CustomMenuHeader from './components/CustomMenuheader';
import { useMediaQuery } from 'react-responsive';
import { useParams } from "react-router-dom";
import { firestore } from '../../../config/firebase';
import CustomMenuFooter from './components/CustomMenufooter';
import CustomTvPagesConfigPanel from './components/CustomTvPagesConfig';
import Papa from 'papaparse'; 

const { Title } = Typography;
const { Content } = Layout;
const { Option } = Select;

const getCustomMenuCategoryRef = (restaurantId, category) =>
    firestore
        .collection('restaurants')
        .doc(restaurantId)
        .collection('custom menu')
        .doc(category);

const getCustomMenuItemsRef = (restaurantId, category) =>
    getCustomMenuCategoryRef(restaurantId, category).collection('items');

const getRestaurantMenuItemsPathPrefix = (restaurantId) =>
    `restaurants/${restaurantId}/custom menu/`;

const ensureCategoryDoc = async (restaurantId, category) => {
    await getCustomMenuCategoryRef(restaurantId, category).set(
        { name: category },
        { merge: true }
    );
};

const mapItemDocToMenuRow = (itemDoc) => {
    const itemData = itemDoc.data();
    const categoryName = itemDoc.ref.parent.parent.id;

    return {
        id: itemDoc.id,
        name: itemData.name || itemDoc.id,
        category: categoryName,
        itemType: normalizeItemType(itemData.itemType),
        price: itemData.price,
        availability: itemData.availability || 'available',
    };
};

const normalizeItemType = (raw) => {
    const value = String(raw || '').trim().toLowerCase();
    if (value === 'veg' || value === 'vegetarian') {
        return 'Veg';
    }
    return 'Non-Veg';
};

const parseCsvRow = (row) => {
    const name = String(row.Name ?? row.name ?? '').trim();
    const category = String(row.Category ?? row.category ?? '').trim();
    const priceRaw = row.Price ?? row.price ?? '';
    const price = parseFloat(String(priceRaw).replace(/[^0-9.-]/g, ''));

    return {
        name,
        category,
        itemType: normalizeItemType(
            row['Item Type'] ?? row['item type'] ?? row.ItemType ?? row.itemType
        ),
        price: Number.isFinite(price) ? price.toFixed(2) : null,
    };
};

const CustomMenu = () => {
    const { restaurantId } = useParams();
    const [menuData, setMenuData] = useState([]);
    const [visible, setVisible] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [form] = Form.useForm();
    const [currentPage, setCurrentPage] = useState(1);
    const [cardsPerPage, setCardsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });

    const fetchMenuData = useCallback(async () => {
        if (!restaurantId) {
            return;
        }

        setLoading(true);
        setMenuData([]);
        setCategories(['All']);
        setSelectedCategory('All');

        try {
            const menuPathPrefix = getRestaurantMenuItemsPathPrefix(restaurantId);
            const itemsSnapshot = await firestore.collectionGroup('items').get();

            const restaurantItems = itemsSnapshot.docs.filter((itemDoc) =>
                itemDoc.ref.path.startsWith(menuPathPrefix)
            );

            const allMenuData = restaurantItems.map(mapItemDocToMenuRow);
            const categoryNames = ['All'];

            allMenuData.forEach((item) => {
                if (!categoryNames.includes(item.category)) {
                    categoryNames.push(item.category);
                }
            });

            setMenuData(allMenuData);
            setCategories(categoryNames);
        } catch (error) {
            console.error('Error fetching menu data:', error);
            message.error('Failed to load menu data.');
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        fetchMenuData();
    }, [fetchMenuData]);

    // Show modal for adding/editing an item
    const showModal = (item = null) => {
        setCurrentItem(item);
        form.setFieldsValue(item || { itemType: 'Veg' });
        setVisible(true);
    };

    const handleCancel = () => {
        setVisible(false);
        form.resetFields();
    };

    const handleCategoryChange = (value) => {
        setSelectedCategory(value);
    };

    const handleOk = async () => {
        if (!restaurantId) {
            message.error('Restaurant not found.');
            return;
        }

        try {
            const values = await form.validateFields();
            const { name, category, itemType, price } = values;

            const availability = currentItem ? currentItem.availability : 'available';
            const normalizedItemType = normalizeItemType(itemType);

            const dataToSave = {
                name,
                category,
                itemType: normalizedItemType,
                price: parseFloat(price).toFixed(2),
                availability,
            };

            await ensureCategoryDoc(restaurantId, category);
            const newItemRef = getCustomMenuItemsRef(restaurantId, category).doc(name);

            if (currentItem) {
                const categoryChanged = currentItem.category !== category;
                const nameChanged = currentItem.id !== name;

                if (categoryChanged || nameChanged) {
                    await getCustomMenuItemsRef(restaurantId, currentItem.category)
                        .doc(currentItem.id)
                        .delete();
                    await newItemRef.set(dataToSave);
                } else {
                    await newItemRef.update(dataToSave);
                }

                setMenuData((prevData) =>
                    prevData
                        .filter((item) => item.id !== currentItem.id)
                        .concat({ ...dataToSave, id: name })
                );
                message.success('Item updated successfully');
            } else {
                await newItemRef.set(dataToSave);
                setMenuData((prevData) => [...prevData, { ...dataToSave, id: name }]);
                message.success('Item added successfully');
            }

            if (!categories.includes(category)) {
                setCategories((prev) => [...prev, category]);
            }

            setVisible(false);
            form.resetFields();
        } catch (error) {
            console.error('Error saving item:', error);
            message.error('Failed to save item');
        }
    };
    

    // Handle item deletion
    const handleDelete = async (item) => {
        if (!restaurantId) {
            return;
        }

        try {
            await getCustomMenuItemsRef(restaurantId, item.category).doc(item.id).delete();

            setMenuData((prevData) => {
                const remaining = prevData.filter(
                    (menuItem) =>
                        !(menuItem.id === item.id && menuItem.category === item.category)
                );
                const hasCategoryItems = remaining.some((menuItem) => menuItem.category === item.category);
                if (!hasCategoryItems) {
                    setCategories((prevCategories) =>
                        prevCategories.filter((cat) => cat !== item.category)
                    );
                    if (selectedCategory === item.category) {
                        setSelectedCategory('All');
                    }
                }
                return remaining;
            });

            message.success('Item deleted successfully');
        } catch (error) {
            console.error('Error deleting item:', error);
            message.error('Failed to delete item');
        }
    };

    // Handle availability change
    const handleAvailabilityChange = async (record, value) => {
        if (!restaurantId) {
            return;
        }

        try {
            await getCustomMenuItemsRef(restaurantId, record.category)
                .doc(record.id)
                .update({ availability: value });
    
            // After successful update in Firestore, update the local state to reflect the change in the table
            setMenuData((prevData) => {
                return prevData.map((item) =>
                    item.id === record.id ? { ...item, availability: value } : item
                );
            });
    
            message.success('Availability updated successfully');
        } catch (error) {
            console.error('Error updating availability:', error);
            message.error('Failed to update availability');
        }
    };

    const handleDownloadSampleCSV = () => {
        const fields = ['Name', 'Category', 'Item Type', 'Price'];
        const data = [
            { Name: 'Margherita Pizza', Category: 'Pizza', 'Item Type': 'Veg', Price: '12.99' },
            { Name: 'Chicken Wings', Category: 'Appetizers', 'Item Type': 'Non-Veg', Price: '9.99' },
        ];
        const csv = Papa.unparse({ fields, data });
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'custom-menu-sample.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    const deleteItemsInBatches = async (docRefs) => {
        const batchSize = 500;
        for (let i = 0; i < docRefs.length; i += batchSize) {
            const batch = firestore.batch();
            docRefs.slice(i, i + batchSize).forEach((ref) => batch.delete(ref));
            await batch.commit();
        }
    };

    const getCategoryItemRefs = async (categoryName) => {
        const snapshot = await getCustomMenuItemsRef(restaurantId, categoryName).get();
        return snapshot.docs.map((doc) => doc.ref);
    };

    const handleDeleteAll = () => {
        Modal.confirm({
            title: 'Delete all menu items?',
            content: 'This will permanently remove every item in the custom menu. This action cannot be undone.',
            okText: 'Delete all',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    const menuPathPrefix = getRestaurantMenuItemsPathPrefix(restaurantId);
                    const itemsSnapshot = await firestore.collectionGroup('items').get();
                    const itemRefs = itemsSnapshot.docs
                        .filter((itemDoc) => itemDoc.ref.path.startsWith(menuPathPrefix))
                        .map((itemDoc) => itemDoc.ref);

                    if (itemRefs.length === 0) {
                        message.info('No menu items to delete.');
                        return;
                    }

                    await deleteItemsInBatches(itemRefs);
                    setMenuData([]);
                    setCategories(['All']);
                    setSelectedCategory('All');
                    message.success(`Deleted ${itemRefs.length} item(s) successfully`);
                } catch (error) {
                    console.error('Error deleting all items:', error);
                    message.error('Failed to delete all items');
                }
            },
        });
    };

    const performDeleteByCategory = async (categoryName) => {
        try {
            const itemRefs = await getCategoryItemRefs(categoryName);

            if (itemRefs.length === 0) {
                message.info(`No items found in category "${categoryName}".`);
                return;
            }

            await deleteItemsInBatches(itemRefs);
            setMenuData((prevData) => prevData.filter((item) => item.category !== categoryName));
            setCategories((prevCategories) => prevCategories.filter((cat) => cat !== categoryName));
            if (selectedCategory === categoryName) {
                setSelectedCategory('All');
            }
            message.success(`Deleted ${itemRefs.length} item(s) from "${categoryName}"`);
        } catch (error) {
            console.error('Error deleting category items:', error);
            message.error('Failed to delete category items');
        }
    };

    const handleDeleteByCategory = () => {
        const deletableCategories = categories.filter((cat) => cat !== 'All');

        if (deletableCategories.length === 0) {
            message.info('No categories with items to delete.');
            return;
        }

        const categoryToDelete =
            selectedCategory !== 'All' ? selectedCategory : deletableCategories[0];

        if (selectedCategory !== 'All') {
            Modal.confirm({
                title: `Delete all items in "${categoryToDelete}"?`,
                content: 'This will permanently remove every item in this category. This action cannot be undone.',
                okText: 'Delete category',
                okType: 'danger',
                cancelText: 'Cancel',
                onOk: () => performDeleteByCategory(categoryToDelete),
            });
            return;
        }

        let chosenCategory = categoryToDelete;

        Modal.confirm({
            title: 'Delete items by category',
            content: (
                <div>
                    <p style={{ marginBottom: 8 }}>Select a category to delete all of its items:</p>
                    <Select
                        defaultValue={categoryToDelete}
                        style={{ width: '100%' }}
                        onChange={(value) => { chosenCategory = value; }}
                    >
                        {deletableCategories.map((category) => (
                            <Option key={category} value={category}>{category}</Option>
                        ))}
                    </Select>
                </div>
            ),
            okText: 'Delete category',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: () => performDeleteByCategory(chosenCategory),
        });
    };

    const handleCSVUpload = (file) => {
        if (!restaurantId) {
            message.error('Restaurant not found.');
            return;
        }

        setImporting(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            complete: async (result) => {
                try {
                    const parsedRows = result.data.map(parseCsvRow);
                    const validItems = parsedRows.filter(
                        (item) => item.name && item.category && item.price !== null
                    );
                    const skippedCount = parsedRows.length - validItems.length;

                    if (validItems.length === 0) {
                        message.warning(
                            'No valid rows found. Each row needs Name, Category, and Price.'
                        );
                        return;
                    }

                    let updatesCount = 0;
                    let newItemsCount = 0;

                    for (const item of validItems) {
                        await ensureCategoryDoc(restaurantId, item.category);
                        const itemRef = getCustomMenuItemsRef(restaurantId, item.category).doc(item.name);
                        const existingDoc = await itemRef.get();

                        const dataToSave = {
                            name: item.name,
                            category: item.category,
                            itemType: item.itemType,
                            price: item.price,
                            availability: 'available',
                        };

                        if (existingDoc.exists) {
                            const existingData = existingDoc.data();
                            await itemRef.update({
                                ...dataToSave,
                                availability: existingData.availability || 'available',
                            });
                            updatesCount++;
                        } else {
                            await itemRef.set(dataToSave);
                            newItemsCount++;
                        }
                    }

                    await fetchMenuData();

                    const summaryParts = [];
                    if (newItemsCount > 0) {
                        summaryParts.push(`${newItemsCount} added`);
                    }
                    if (updatesCount > 0) {
                        summaryParts.push(`${updatesCount} updated`);
                    }
                    if (skippedCount > 0) {
                        summaryParts.push(`${skippedCount} skipped`);
                    }

                    message.success(`Import complete: ${summaryParts.join(', ')}.`);
                } catch (error) {
                    console.error('Error importing CSV:', error);
                    message.error('Failed to import CSV');
                } finally {
                    setImporting(false);
                }
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                message.error('Failed to import CSV');
                setImporting(false);
            },
        });
    };

    
    // Filter menu data based on selected category
    const filteredData = selectedCategory === 'All'
        ? menuData
        : menuData.filter(item => item.category.toLowerCase() === selectedCategory.toLowerCase());

    // Define table columns
    const columns = [
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
        },
        {
            title: "Category",
            dataIndex: "category",
            key: "category",
        },
        {
            title: "Item Type",
            dataIndex: "itemType",
            key: "itemType",
            render: itemType => (
                <Tag color={itemType === "Veg" ? "green" : "red"}>{itemType}</Tag>
            ),
        },
        {
            title: "Price",
            dataIndex: "price",
            key: "price",
            render: price => `$${parseFloat(price).toFixed(2)}`,
        },
        {
            title: "Availability",
            dataIndex: "availability",
            key: "availability",
            render: (_, record) => (
                <Radio.Group
                    value={record.availability}
                    onChange={async (e) => {
                        const newValue = e.target.value;
                        handleAvailabilityChange(record, newValue);
                    }}
                >
                    <Radio value="available">Available</Radio>
                    <Radio value="notAvailable">Not Available</Radio>
                </Radio.Group>
            ),
        },
        
        {
            title: "Actions",
            key: "actions",
            render: (_, record) => (
                <Dropdown
                    overlay={
                        <Menu>
                            <Menu.Item key="edit" onClick={() => showModal(record)}>
                                <EditOutlined /> Edit
                            </Menu.Item>
                            <Menu.Item key="delete" onClick={() => handleDelete(record)} danger>
                                <DeleteOutlined /> Delete
                            </Menu.Item>
                        </Menu>
                    }
                    trigger={['click']}
                >
                    <Button type="link" icon={<MenuOutlined />} />
                </Dropdown>
            ),
        },
    ];

    return (
        <Layout style={{ minHeight: "100vh" }}>
        <CustomMenuHeader 
            style={{ 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                right: 0, 
                zIndex: 100, 
                width: '100%'  // Ensures header spans the entire width
            }} 
        />
        <Content
            style={{
                paddingTop: '64px', // The same height as the header
                paddingBottom: '60px', // Leave space for footer
                overflowY: 'auto', // This makes content scrollable
                height: 'calc(100vh - 124px)', // 100vh minus the header and footer heights
                padding: "0 50px", // Adjust content padding
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <Title level={3} style={{ marginLeft: '25px' }}>Custom Menu</Title>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Button icon={<DownloadOutlined />} onClick={handleDownloadSampleCSV}>
                        Download Sample CSV
                    </Button>
                    <Upload
                        beforeUpload={(file) => {
                            handleCSVUpload(file);
                            return false; // Prevent auto-upload
                        }}
                        showUploadList={false}
                    >
                        <Button icon={<UploadOutlined />} loading={importing} disabled={importing}>
                            Import CSV
                        </Button>
                    </Upload>
                    <Dropdown
                        overlay={
                            <Menu>
                                <Menu.Item key="deleteCategory" danger onClick={handleDeleteByCategory}>
                                    <DeleteOutlined /> Delete by Category
                                </Menu.Item>
                                <Menu.Item key="deleteAll" danger onClick={handleDeleteAll}>
                                    <DeleteOutlined /> Delete All Items
                                </Menu.Item>
                            </Menu>
                        }
                        trigger={['click']}
                    >
                        <Button danger icon={<DeleteOutlined />}>Bulk Delete</Button>
                    </Dropdown>
                    <span style={{ marginLeft: '7px', marginTop: '5px' }}>Filter by Category: </span>
                    <Select value={selectedCategory} style={{ width: 200, marginLeft: '10px' }} onChange={handleCategoryChange}>
                        {categories.map(category => (
                            <Option key={category} value={category}>{category}</Option>
                        ))}
                    </Select>
    
                    <Button type="primary" style={{ marginLeft: '20px' }} onClick={() => showModal()}>+ Add menu items</Button>
                </div>
            </div>
    
            <Table
                columns={columns}
                dataSource={filteredData}
                rowKey={(record) => `${record.category}-${record.id}`}
                loading={loading}
                pagination={{
                    current: currentPage,
                    pageSize: cardsPerPage,
                    onChange: (page, pageSize) => {
                        setCurrentPage(page);
                        setCardsPerPage(pageSize);
                    },
                    showSizeChanger: true,
                    pageSizeOptions: ["5", "10", "15", "20"],
                }}
                style={{ margin: 16 }}
            />

            <CustomTvPagesConfigPanel menuCategories={categories} />
        </Content>
        <CustomMenuFooter 
            style={{
                position: 'fixed', 
                width: '100%', 
                bottom: 0, 
                left: 0, 
                zIndex: 100
            }} 
        />
    
        <Modal
            title={currentItem ? "Edit Item" : "Add New Item"}
            visible={visible}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={currentItem ? "Save Changes" : "Add Item"}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter item name' }]}>
                    <Input />
                </Form.Item>
                <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please enter category' }]}>
                    <Input />
                </Form.Item>
                <Form.Item
                    name="price"
                    label="Price"
                    rules={[{ required: true, message: 'Please enter price' }]}>
                    <Input
                        type="number"
                        min={0}
                        step="0.01"
                        addonBefore="$"
                    />
                </Form.Item>
                <Form.Item name="itemType" label="Item Type">
                    <Radio.Group>
                        <Radio value="Veg">Veg</Radio>
                        <Radio value="Non-Veg">non-Veg</Radio>
                    </Radio.Group>
                </Form.Item>
            </Form>
        </Modal>
    </Layout>
    
    );
};

export default CustomMenu;
