import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import GoogleFontLoader from "react-google-font";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import "bootstrap/dist/css/bootstrap.min.css";
import "./assets/css/custom-tv-menu-styles.css";
import LoaderIcon from "./assets/images/loader_icon.gif";
import { firestore } from "../../../config/firebase";
import VEG from "./assets/images/veg.png";
import NONVEG from "./assets/images/nonveg.png";
import EGG from "./assets/images/egg.png";

const CustomTvMenu = () => {
    const { restaurantId } = useParams();
    const [menu, setMenu] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchMenuData = async () => {
            setIsLoading(true);
            try {
                // Get the reference to the restaurant and custom menu collection
                const restaurantRef = firestore.collection('restaurants').doc(restaurantId);
                const customMenuRef = restaurantRef.collection('custom menu');

                // Fetch all 'items' subcollections across all categories using collectionGroup
                const itemsSnapshot = await firestore.collectionGroup('items').get();

                if (itemsSnapshot.empty) {
                    console.warn('No menu items found.');
                    setIsLoading(false);
                    return;
                }

                const allMenuData = [];
                const categoryNames = [];

                // Process each item and organize them by category
                itemsSnapshot.docs.forEach(itemDoc => {
                    const itemData = itemDoc.data();
                    const categoryName = itemDoc.ref.parent.parent.id;  // Get the category name from the document reference

                    // If the category is not "All", add it to the categories list
                    if (categoryName !== "All" && !categoryNames.includes(categoryName)) {
                        categoryNames.push(categoryName);
                    }

                    allMenuData.push({
                        id: itemDoc.id,
                        name: itemData.name,
                        category: categoryName,
                        itemType: itemData.itemType,
                        price: itemData.price,
                        availability: itemData.availability
                    });
                });

                // Set the state with the fetched menu data and categories
                setMenu(allMenuData);
                setCategories(categoryNames);
            } catch (error) {
                console.error("Error fetching custom menu data:", error);
            }
            setIsLoading(false);
        };

        fetchMenuData();
    }, [restaurantId]);

    // Function to render menu items for a given category
    const renderMenuItems = (category) => (
        menu
            .filter((item) => item.category === category) 
            .map((item) => {
                const itemType = item.itemType ? item.itemType.toLowerCase() : "";
                const itemTypeImage = 
                    itemType === "veg" ? VEG : 
                    itemType === "non-veg" ? NONVEG : 
                    itemType === "egg" ? EGG : 
                    null;

                // Check availability and apply "sold-out" styling if not available
                const isAvailable = item.availability === "available";

                return (
                    <div key={item.id} className="menu-item">
                        <h4 className={!isAvailable ? "sold-out-menu-item-name" : ""}>
                            {itemTypeImage && (
                                <img
                                    src={itemTypeImage}
                                    alt={item.name}
                                    className="menu-item-icon"
                                />
                            )}
                            <span>{item.name}</span>
                            <span className="menu-item-price">
                                {isAvailable 
                                    ? `$ ${parseFloat(item.price).toFixed(2)}` 
                                    : "N/A"}
                            </span>
                        </h4>
                    </div>
                );
            })
    );

    // Explicitly define which categories go into which column
    const col1Categories = [
        "Appetizers", "Curries", "Drinks", "Dessert"
    ];
    const col2Categories = [
        "Biryanis & Pulaos", "Street Style Food", "Snacks"
    ];

    // Filter the categories based on these explicit assignments
    const col1 = categories.filter(category => col1Categories.includes(category));
    const col2 = categories.filter(category => col2Categories.includes(category));

    return (
        <>
            {isLoading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
                    <img src={LoaderIcon} alt="Loading..." style={{ width: '100px', height: '100px' }} />
                </div>
            ) : (
                <Container fluid>
                    <GoogleFontLoader
                        fonts={[
                            { font: "Lobster" },
                            { font: "Bree Serif" },
                        ]}
                    />
                    <Row>
                        <Col>
                            {col1.map((category) => (
                                <div key={category}>
                                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>{category}</h2>
                                    {renderMenuItems(category)}
                                </div>
                            ))}
                        </Col>
                        <Col>
                            {col2.map((category) => (
                                <div key={category}>
                                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>{category}</h2>
                                    {renderMenuItems(category)}
                                </div>
                            ))}
                        </Col>
                    </Row>
                </Container>
            )}
        </>
    );
};

export default CustomTvMenu;
