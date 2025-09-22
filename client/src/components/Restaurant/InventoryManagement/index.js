import React, { useState, useEffect, useRef } from "react";
import {
  Layout,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Dropdown,
  Menu,
  Popconfirm,
  Space,
  Card,
  Row,
  Col,
} from "antd";
import { useParams, useLocation } from "react-router-dom";
import { firestore } from "../../../config/firebase";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MenuOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import Papa from "papaparse";
import InventoryManagementHeader from "./components/InventoryManagementHeader";
import InventoryManagementFooter from "./components/InventoryManagementFooter";
import moment from "moment";
import useBreakpoint from "antd/lib/grid/hooks/useBreakpoint";

const { Content } = Layout;
const { Option } = Select;

const InventoryManagementComponent = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const { restaurantId } = useParams();
  const [form] = Form.useForm();
  const [currentFilter, setCurrentFilter] = useState("all");
  const { state } = useLocation();
  const managerData = state?.managerData;
  const fileInputRef = useRef(null);
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;

  useEffect(() => {
    const unsubscribe = fetchInventory();
    return () => unsubscribe();
  }, [restaurantId]);

  const fetchInventory = () => {
    setLoading(true);
    return firestore
      .collection("restaurants")
      .doc(restaurantId)
      .collection("inventory")
      .onSnapshot(
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            status: "Null",
            lastModified: "Not modified yet",
            ...doc.data(),
          }));
          setInventory(data);
          setLoading(false);
        },
        (error) => {
          message.error("Failed to fetch inventory.");
          setLoading(false);
        }
      );
  };

  const requestItemUpdate = async (item, increment) => {
    const { id, name, quantity } = item;
    const currentQuantity = Number(quantity);
    const newQuantity = increment ? currentQuantity + 1 : currentQuantity - 1;
    const requestedQuantity = increment ? 1 : -1;

    if (newQuantity >= 0) {
      setLoading(true);
      const now = new Date();

      const requestsRef = firestore
        .collection("restaurants")
        .doc(restaurantId)
        .collection("inventoryRequests");
      const existingRequestSnapshot = await requestsRef
        .where("itemId", "==", id)
        .where("status", "==", "Pending")
        .get();

      if (!existingRequestSnapshot.empty) {
        const existingRequest = existingRequestSnapshot.docs[0];
        const updatedRequestedQuantity =
          existingRequest.data().requestedQuantity + requestedQuantity;

        await requestsRef.doc(existingRequest.id).update({
          requestedQuantity: updatedRequestedQuantity,
          timestamp: now,
        });
        message.info("Existing request quantity updated");
      } else {
        await requestsRef.add({
          itemId: id,
          itemName: name,
          requestedQuantity: requestedQuantity,
          status: "Pending",
          username: "Supervisor",
          password: "Approval",
          timestamp: now,
        });
        message.info("New update request sent for approval");
      }

      setLoading(false);
    } else {
      message.error("Quantity cannot be less than zero");
    }
  };

  const handleFilterChange = (value) => {
    setCurrentFilter(value);
  };

  const getFilteredData = () => {
    return currentFilter === "all"
      ? inventory
      : inventory.filter((item) => item.category === currentFilter);
  };

  const convertToCSV = (data) => {
    const headers = "Name,Quantity,Category\n";
    const rows = data
      .map((item) => `${item.name},${item.quantity},${item.category}`)
      .join("\n");
    return headers + rows;
  };

  const downloadCSV = () => {
    const csvData = convertToCSV(inventory);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "inventory.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    { title: "Name", dataIndex: "name", key: "name" },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      align: "center",
    },
    {
      title: "Update Quantity",
      dataIndex: "updatequantity",
      key: "updatequantity",
      render: (_, record) => (
        <Button.Group>
          <Button
            type="primary"
            onClick={() => requestItemUpdate(record, false)}
          >
            <b>-</b>
          </Button>
          <Button
            type="primary"
            onClick={() => requestItemUpdate(record, true)}
          >
            <b>+</b>
          </Button>
        </Button.Group>
      ),
      align: "center",
    },
    { title: "Status", dataIndex: "status", key: "status", align: "center" },
    {
      title: "Last Modified",
      dataIndex: "lastModified",
      key: "lastModified",
      align: "center",
      render: (text) =>
        text === "Not modified yet" ? text : moment(text).fromNow(),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      align: "center",
      sorter: (a, b) => a.category.localeCompare(b.category),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item key="edit">
                <Button
                  type="link"
                  onClick={() => showEditModal(record)}
                  icon={<EditOutlined />}
                >
                  Edit
                </Button>
              </Menu.Item>
              <Menu.Item key="delete">
                <Popconfirm
                  title="Are you sure to delete this item?"
                  onConfirm={() => deleteItem(record.id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button type="link" danger icon={<DeleteOutlined />}>
                    Delete
                  </Button>
                </Popconfirm>
              </Menu.Item>
            </Menu>
          }
          trigger={["click"]}
        >
          <Button type="dashed" icon={<MenuOutlined />} />
        </Dropdown>
      ),
      align: "center",
    },
  ];

  const showEditModal = (item) => {
    setVisible(true);
    setCurrentItem(item);
    form.setFieldsValue(item);
  };

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        if (currentItem) {
          updateItem(currentItem.id, values);
        } else {
          addItem(values);
        }
      })
      .catch((info) => {
        console.log("Validate Failed:", info);
      });
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: async (results) => {
          const batch = firestore.batch();
          const inventoryRef = firestore
            .collection("restaurants")
            .doc(restaurantId)
            .collection("inventory");

          results.data.forEach((item, index) => {
            if (item.id) {
              const docRef = inventoryRef.doc(item.id);
              batch.set(
                docRef,
                {
                  name: item.Name,
                  quantity: item.Quantity,
                  category: item.Category,
                  status: item.Status || "Not specified",
                  lastModified:
                    item["Last Modified"] || new Date().toISOString(),
                },
                { merge: true }
              );
            } else {
              const docRef = inventoryRef.doc();
              batch.set(docRef, {
                name: item.Name,
                quantity: 0,
                category: item.Category,
              });
            }
          });

          try {
            await batch.commit();
            fetchInventory();
            message.success(
              "Inventory has been updated and stored in Firestore."
            );
          } catch (error) {
            console.error("Error updating inventory in Firestore:", error);
            message.error("Failed to update inventory in Firestore.");
          }
        },
        error: (error) => {
          message.error("Error parsing CSV file.");
        },
      });
    }
  };

  const handleCancel = () => {
    setVisible(false);
    form.resetFields();
    setCurrentItem(null);
  };

  const addItem = async (values) => {
    setLoading(true);
    try {
      await firestore
        .collection("restaurants")
        .doc(restaurantId)
        .collection("inventory")
        .add(values);
      fetchInventory();
      message.success("Item added successfully");
    } catch (error) {
      message.error("Failed to add item");
    }
    setVisible(false);
    setLoading(false);
  };

  const updateItem = async (id, values) => {
    setLoading(true);
    try {
      await firestore
        .collection("restaurants")
        .doc(restaurantId)
        .collection("inventory")
        .doc(id)
        .update(values);
      fetchInventory();
      message.success("Item updated successfully");
    } catch (error) {
      message.error("Failed to update item");
    }
    setVisible(false);
    setLoading(false);
  };

  const deleteItem = async (id) => {
    setLoading(true);
    try {
      await firestore
        .collection("restaurants")
        .doc(restaurantId)
        .collection("inventory")
        .doc(id)
        .delete();
      fetchInventory();
      message.success("Item deleted successfully");
    } catch (error) {
      message.error("Failed to delete item");
    }
    setLoading(false);
  };

  const renderCards = () => {
    return (
      <Row gutter={[16, 16]} style={{ paddingBottom: '80px' }}>
        {getFilteredData().map((item) => (
          <Col key={item.id} span={24}>
            <Card
              title={item.name}
              actions={[
                <Popconfirm
                  title="Are you sure to delete this item?"
                  onConfirm={() => deleteItem(item.id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button type="link" danger icon={<DeleteOutlined />}></Button>
                </Popconfirm>,
                <Button
                  type="link"
                  onClick={() => showEditModal(item)}
                  icon={<EditOutlined />}
                ></Button>,
              ]}
            >
              <p>Quantity: {item.quantity}</p>
              <p>Category: {item.category}</p>
              <p>Status: {item.status}</p>
              <p>
                Last Modified:{" "}
                {item.lastModified === "Not modified yet"
                  ? item.lastModified
                  : moment(item.lastModified).fromNow()}
              </p>
              <div style={{ textAlign: "right" }}>
                <Button.Group>
                  <Button
                    type="primary"
                    onClick={() => requestItemUpdate(item, false)}
                  >
                    <b>-</b>
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => requestItemUpdate(item, true)}
                  >
                    <b>+</b>
                  </Button>
                </Button.Group>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <div>
      <InventoryManagementHeader managerData={managerData} />
      <Layout className="layout" style={{ minHeight: "100vh" }}>
        <Content style={{ padding: "0 50px", paddingBottom: '80px', flex: 1 }}>
          {isMobile ? (
            <>
              <h3
                style={{
                  margin: "20px 0",
                  color: "black",
                  textAlign: "center",
                }}
              >
                Inventory Management
              </h3>
              <div style={{ marginBottom: 16 }}>
                <span>Filter by Category:</span>
                <Select
                  defaultValue="all"
                  style={{ width: "100%", marginBottom: 8 }}
                  onChange={handleFilterChange}
                >
                  {Array.from(
                    new Set(inventory.map((item) => item.category))
                  ).map((category) => (
                    <Option key={category} value={category}>
                      {category}
                    </Option>
                  ))}
                </Select>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <div style={{ flex: 1, marginRight: 8 }}>
                  <Button
                    onClick={triggerFileInput}
                    type="primary"
                    icon={<UploadOutlined />}
                    style={{ width: "100%" }}
                  >
                    Upload CSV
                  </Button>
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    hidden
                    onChange={handleUpload}
                  />
                </div>
                <div style={{ flex: 1, marginLeft: 8 }}>
                  <Button
                    onClick={downloadCSV}
                    type="primary"
                    style={{ width: "100%" }}
                  >
                    Download CSV
                  </Button>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <Button
                  onClick={() => setVisible(true)}
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{ width: "100%" }}
                >
                  Add New Item
                </Button>
              </div>
            </>
          ) : isTablet ? (
            <>
              <h3
                style={{
                  margin: "20px 0",
                  color: "black",
                  textAlign: "center",
                }}
              >
                Inventory Management
              </h3>
              <div style={{ marginBottom: 16 }}>
                <Button
                  onClick={() => setVisible(true)}
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{ width: "100%", marginBottom: 8 }}
                >
                  Add New Item
                </Button>
                <Button
                  onClick={triggerFileInput}
                  type="primary"
                  icon={<UploadOutlined />}
                  style={{ width: "100%", marginBottom: 8 }}
                >
                  Upload CSV
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  hidden
                  onChange={handleUpload}
                />
                <Button
                  onClick={downloadCSV}
                  type="primary"
                  style={{ width: "100%", marginBottom: 8 }}
                >
                  Download CSV
                </Button>
                <Select
                  defaultValue="all"
                  style={{ width: "100%", marginBottom: 8 }}
                  onChange={handleFilterChange}
                >
                  {Array.from(
                    new Set(inventory.map((item) => item.category))
                  ).map((category) => (
                    <Option key={category} value={category}>
                      {category}
                    </Option>
                  ))}
                </Select>
              </div>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: "20px 0", color: "black" }}>
                Inventory Management
              </h3>
              <Space>
                <Button
                  onClick={() => setVisible(true)}
                  type="primary"
                  icon={<PlusOutlined />}
                >
                  Add New Item
                </Button>
                <span>Filter by Category:</span>
                <Select
                  defaultValue="all"
                  style={{ width: 140 }}
                  onChange={handleFilterChange}
                >
                  {Array.from(
                    new Set(inventory.map((item) => item.category))
                  ).map((category) => (
                    <Option key={category} value={category}>
                      {category}
                    </Option>
                  ))}
                </Select>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  hidden
                  onChange={handleUpload}
                />
                <Button
                  onClick={triggerFileInput}
                  type="primary"
                  icon={<UploadOutlined />}
                >
                  Upload CSV
                </Button>
                <Button onClick={downloadCSV} type="primary">
                  Download CSV
                </Button>
              </Space>
            </div>
          )}
          {isMobile ? (
            renderCards()
          ) : (
            <Table
              dataSource={getFilteredData()}
              columns={columns}
              rowKey="id"
              loading={loading}
            />
          )}
          <Modal
            title={currentItem ? "Edit Item" : "Add New Item"}
            visible={visible}
            onOk={handleOk}
            onCancel={handleCancel}
          >
            <Form form={form} layout="vertical" name="itemForm">
              <Form.Item
                name="name"
                label="Name"
                rules={[
                  {
                    required: true,
                    message: "Please input the name of the item!",
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="quantity"
                label="Quantity"
                rules={[
                  { required: true, message: "Please input the quantity!" },
                ]}
              >
                <Input type="number" />
              </Form.Item>
              <Form.Item
                name="category"
                label="Category"
                rules={[
                  {
                    required: true,
                    message: "Please input the category of the item!",
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Form>
          </Modal>
        </Content>
        <InventoryManagementFooter />
      </Layout>
    </div>
  );
};

export default InventoryManagementComponent;
