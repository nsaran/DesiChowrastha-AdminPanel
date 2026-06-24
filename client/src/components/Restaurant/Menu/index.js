import React, { useState, useEffect } from "react";
import {
  Layout,
  Table,
  Tag,
  Select,
  Typography,
  Form,
  Modal,
  Input,
  Button,
  Dropdown,
  Menu,
  Card,
  Pagination,
} from "antd";
import axios from "axios";
import { useParams } from "react-router-dom";
import { EditOutlined, DeleteOutlined, MenuOutlined } from "@ant-design/icons";
import MenuHeader from "./components/MenuHeader";
import MenuFooter from "./components/MenuFooter";
import { useMediaQuery } from "react-responsive";
import API_BASE_URL from "../../../config/api";

const { Option } = Select;
const { Title } = Typography;
const { Content, Footer } = Layout;

const MenuComponent = () => {
  const { restaurantId } = useParams();
  const [menuData, setMenuData] = useState([]);
  const [flatMenuData, setFlatMenuData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [visible, setVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form] = Form.useForm();
  const [currentPage, setCurrentPage] = useState(1);
  const [cardsPerPage, setCardsPerPage] = useState(10);
  const [tablePageSize, setTablePageSize] = useState(10); // Page size for table

  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        //const response = await axios.get(`https://desichowrastha-admin.azurewebsites.net/api/menu?location=${restaurantId}`);
        const response = await axios.get(`${API_BASE_URL}/api/menu?location=${restaurantId}`);

        setMenuData(response.data);
        const flattenedData = response.data.flatMap((menu) =>
          menu.menuGroups.flatMap((group) =>
            group.menuItems.map((item) => ({
              ...item,
              menuName: menu.name,
              category: group.name,
            }))
          )
        );
        setFlatMenuData(flattenedData);

        const extractedCategories = new Set(
          flattenedData.map((item) => item.category)
        );
        setCategories([...extractedCategories]);
      } catch (error) {
        console.error("Failed to fetch menu:", error);
      }
    };

    fetchMenu();
  }, [restaurantId]);

  const handleCategoryChange = (value) => {
    setSelectedCategory(value);
  };

  const showEditModal = (item) => {
    setVisible(true);
    setCurrentItem(item);
    form.setFieldsValue(item);
  };

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        console.log("Received values of form: ", values);
        setVisible(false);
      })
      .catch((info) => {
        console.log("Validate Failed:", info);
      });
  };

  const handleCancel = () => {
    setVisible(false);
  };

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
      render: (itemType) => {
        let color = "geekblue";
        if (itemType === "Veg") {
          color = "green";
        } else if (itemType === "Non-Veg") {
          color = "red";
        } else if (itemType === "Egg") {
          color = "orange";
        } else if (itemType === "Undefined") {
          color = "blue";
        }
        return <Tag color={color}>{itemType}</Tag>;
      },
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
      render: (price) => `$${price.toFixed(2)}`,
    },
    {
      title: "Pricing Strategy",
      dataIndex: "pricingStrategy",
      key: "pricingStrategy",
      render: (strategy) => <Tag color="blue">{strategy}</Tag>,
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
              <Menu.Item key="disabled">
                <Button type="link" danger icon={<DeleteOutlined />}>
                  Disabled
                </Button>
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

  const filteredData =
    selectedCategory === "All"
      ? flatMenuData
      : flatMenuData.filter((item) => item.category === selectedCategory);

  const paginatedData = filteredData.slice(
    (currentPage - 1) * cardsPerPage,
    currentPage * cardsPerPage
  );

  return (
    <Layout>
      <MenuHeader />
      <Content style={{ padding: "0 50px", marginTop: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ marginTop: "20px", marginLeft: "20px", color: "black" }}>
            Menu
          </h2>
          {!isMobile && (
            <div>
              <span
                style={{ fontSize: "16px", lineHeight: "32px", marginRight: "8px" }}
              >
                Filter by Category:{" "}
              </span>
              <Select
                defaultValue="All"
                style={{ width: 200, marginRight: "20px" }}
                onChange={handleCategoryChange}
              >
                <Option value="All">All Categories</Option>
                {categories.map((category) => (
                  <Option key={category} value={category}>
                    {category}
                  </Option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {isMobile && (
          <div style={{ marginBottom: 20 }}>
            <span
              style={{ fontSize: "16px", lineHeight: "32px" }}
            >
              Filter by Category:{" "}
            </span>
            <Select
              defaultValue="All"
              style={{ width: 200, marginRight: "20px" }}
              onChange={handleCategoryChange}
            >
              <Option value="All">All Categories</Option>
              {categories.map((category) => (
                <Option key={category} value={category}>
                  {category}
                </Option>
              ))}
            </Select>
          </div>
        )}

        {isMobile ? (
          <div style={{ padding: 16 }}>
            {paginatedData.map((item) => (
              <Card key={item.guid} style={{ marginBottom: 16 }}>
                <Title level={4}>{item.name}</Title>
                <p>Category: {item.category}</p>
                <p>
                  Item Type:{" "}
                  <Tag
                    color={
                      item.itemType === "Veg"
                        ? "green"
                        : item.itemType === "Non-Veg"
                        ? "red"
                        : item.itemType === "Egg"
                        ? "orange"
                        : "blue"
                    }
                  >
                    {item.itemType}
                  </Tag>
                </p>
                <p>Price: ${item.price.toFixed(2)}</p>
                <p>
                  Pricing Strategy:{" "}
                  <Tag color="blue">{item.pricingStrategy}</Tag>
                </p>
                <Dropdown
                  overlay={
                    <Menu>
                      <Menu.Item key="edit">
                        <Button
                          type="link"
                          onClick={() => showEditModal(item)}
                          icon={<EditOutlined />}
                        >
                          Edit
                        </Button>
                      </Menu.Item>
                      <Menu.Item key="disabled">
                        <Button type="link" danger icon={<DeleteOutlined />}>
                          Disabled
                        </Button>
                      </Menu.Item>
                    </Menu>
                  }
                  trigger={["click"]}
                >
                  <Button type="dashed" icon={<MenuOutlined />} />
                </Dropdown>
              </Card>
            ))}
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <Pagination
                current={currentPage}
                pageSize={cardsPerPage}
                total={filteredData.length}
                onChange={(page, pageSize) => {
                  setCurrentPage(page);
                  setCardsPerPage(pageSize);
                }}
                pageSizeOptions={["5", "10", "15", "20"]}
                showSizeChanger
              />
            </div>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="guid"
            pagination={{
              current: currentPage,
              pageSize: tablePageSize,
              onChange: (page, pageSize) => {
                setCurrentPage(page);
                setTablePageSize(pageSize);
              },
              pageSizeOptions: ["5", "10", "15", "20"],
              showSizeChanger: true,
            }}
            style={{ margin: 16 }}
          />
        )}
      </Content>

      <Modal
        title="Edit Menu Item"
        visible={visible}
        onOk={handleOk}
        onCancel={handleCancel}
        footer={[
          <Button key="back" onClick={handleCancel}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" onClick={handleOk}>
            Submit
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Please input the name!" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: "Please select the category!" }]}
          >
            <Select>
              {categories.map((category) => (
                <Option key={category} value={category}>
                  {category}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="price"
            label="Price"
            rules={[{ required: true, message: "Please input the price!" }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default MenuComponent;
