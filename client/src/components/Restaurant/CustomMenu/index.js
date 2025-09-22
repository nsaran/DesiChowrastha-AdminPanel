import React, { useState, useEffect } from 'react';
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
import { EditOutlined, DeleteOutlined, MenuOutlined, UploadOutlined } from '@ant-design/icons';
import CustomMenuHeader from './components/CustomMenuheader';
import { useMediaQuery } from 'react-responsive';
import { useParams } from "react-router-dom";
import { firestore } from '../../../config/firebase';
import CustomMenuFooter from './components/CustomMenufooter';
import Papa from 'papaparse'; 

const { Title } = Typography;
const { Content } = Layout;
const { Option } = Select;

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
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });

    useEffect(() => {
        const fetchMenuData = async () => {
            try {
                const restaurantRef = firestore.collection('restaurants').doc(restaurantId);
                const customMenuRef = restaurantRef.collection('custom menu');
    
                console.log("Fetching data for restaurant:", restaurantId);
    
                // Fetch all 'items' subcollections across all categories using collectionGroup
                const itemsSnapshot = await firestore.collectionGroup('items').get();
    
                if (itemsSnapshot.empty) {
                    console.warn('No menu items found.');
                    return;
                }
    
                const allMenuData = [];
                const categoryNames = ['All'];
    
                // Process each item found in the collectionGroup query
                itemsSnapshot.docs.forEach(itemDoc => {
                    const itemData = itemDoc.data();
                    const categoryName = itemDoc.ref.parent.parent.id;  // Access category name from document reference
    
                    console.log(`Item found in category ${categoryName}:`, itemData);
    
                    allMenuData.push({
                        id: itemDoc.id,
                        name: itemData.name,
                        category: categoryName,
                        itemType: itemData.itemType,
                        price: itemData.price,
                        availability: itemData.availability
                    });
    
                    // Ensure the category is added to the categoryNames array (for filtering purposes)
                    if (!categoryNames.includes(categoryName)) {
                        categoryNames.push(categoryName);
                    }
                });
    
                // Set state with the fetched data
                setMenuData(allMenuData);
                setCategories(categoryNames);
    
                console.log("Final Menu Data:", allMenuData);
                console.log("Final Category Names:", categoryNames);
    
            } catch (error) {
                console.error("Error fetching menu data:", error);
                message.error("Failed to load menu data.");
            }
        };
    
        fetchMenuData();
    }, [restaurantId]);

    // Show modal for adding/editing an item
    const showModal = (item = null) => {
        setCurrentItem(item);
        form.setFieldsValue(item || { itemType: 'veg' });
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
        try {
            const values = await form.validateFields();
            const { name, category, itemType, price } = values;
    
            // Keep the current availability value if it exists (or use 'available' by default)
            const availability = currentItem ? currentItem.availability : 'available';
    
            const dataToSave = {
                name,
                category,
                itemType: itemType === "Veg" ? "Veg" : "Non-Veg",
                price: parseFloat(price).toFixed(2),
                availability, // Don't overwrite if not modified
            };
    
            const categoryRef = firestore
                .collection('restaurants')
                .doc(restaurantId)
                .collection('custom menu')
                .doc(category)  // Now category is a document in the "custom menu" collection
                .collection('items');
    
            if (currentItem) {
                // If we're editing an existing item, update it in Firestore by its ID
                await categoryRef.doc(currentItem.id).update(dataToSave);
                // Update the item in the local state
                setMenuData(prevData =>
                    prevData.map(item =>
                        item.id === currentItem.id ? { ...item, ...dataToSave } : item
                    )
                );
                message.success('Item updated successfully');
            } else {
                // If adding a new item, add it to Firestore
                await categoryRef.doc(name).set(dataToSave);
                // Add the new item to the local state
                setMenuData(prevData => [...prevData, { ...dataToSave, id: name }]);
                message.success('Item added successfully');
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
        try {
            // Delete the item from the specific category's items collection
            await firestore
                .collection('restaurants')
                .doc(restaurantId)
                .collection('custom menu')
                .doc(item.category)   // Reference the item's category collection
                .collection('items')
                .doc(item.id)         // Delete the specific item document by its ID
                .delete();
            
            // Remove the deleted item from the local state
            setMenuData(prevData => prevData.filter(menuItem => menuItem.id !== item.id));

            message.success('Item deleted successfully');
        } catch (error) {
            console.error('Error deleting item:', error);
            message.error('Failed to delete item');
        }
    };

    // Handle availability change
    const handleAvailabilityChange = async (record, value) => {
        try {
            // Update availability for the item in the specific category
            await firestore
                .collection('restaurants')
                .doc(restaurantId)
                .collection('custom menu')
                .doc(record.category)  // Reference the item's category collection
                .collection('items')
                .doc(record.id)        // Reference the specific item document by its ID
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

    // Handle CSV upload and import
    const handleCSVUpload = async (file) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (result) => {
                const items = result.data.map(item => ({
                    name: item["Name"] || item["name"] || "",
                    category: item["Category"] || item["category"] || "",
                    itemType: (item["Item Type"] || item["item type"] || item["ItemType"] || item["itemType"] || "Non-Veg"),
                    price: parseFloat(item["Price"] || "0.00").toFixed(2),
                    availability: "available"
                }));

                let updatesCount = 0;
                let newItemsCount = 0;

                for (const item of items) {
                    const categoryRef = firestore
                        .collection('restaurants')
                        .doc(restaurantId)
                        .collection('custom menu')
                        .doc(item.category)  // Category is a document in the "custom menu" collection
                        .collection('items');

                    const snapshot = await categoryRef
                        .where("name", "==", item.name)
                        .get();

                    if (!snapshot.empty) {
                        // If item exists, update it
                        snapshot.forEach(async (doc) => {
                            await doc.ref.update({
                                itemType: item.itemType,
                                price: item.price,
                                availability: item.availability,
                            });
                            // Immediately reflect the update in the table (local state)
                            setMenuData(prevData =>
                                prevData.map(existingItem =>
                                    existingItem.id === doc.id ? { ...existingItem, ...item } : existingItem
                                )
                            );
                        });
                        updatesCount++;
                    } else {
                        // If item doesn't exist, create a new document
                        await categoryRef.doc(item.name).set(item);
                        // Immediately add the new item to the local state (table)
                        setMenuData(prevData => [...prevData, { ...item, id: item.name }]);
                        newItemsCount++;
                    }
                }

                if (updatesCount > 0) {
                    message.success(`${updatesCount} item(s) updated successfully`);
                }
                if (newItemsCount > 0) {
                    message.success(`${newItemsCount} new item(s) added successfully`);
                }
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                message.error('Failed to import CSV');
            }
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
                <div style={{ display: 'flex', alignItems: 'right' }}>
                    <Upload
                        beforeUpload={(file) => {
                            handleCSVUpload(file);
                            return false; // Prevent auto-upload
                        }}
                        showUploadList={false}
                    >
                        <Button icon={<UploadOutlined />}>Import CSV</Button>
                    </Upload>
                    <span style={{ marginLeft: '15px', marginTop:'5px' }}>Filter by Category: </span>
                    <Select defaultValue="All" style={{ width: 200, marginLeft: '10px' }} onChange={handleCategoryChange}>
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
                rowKey="name"
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
