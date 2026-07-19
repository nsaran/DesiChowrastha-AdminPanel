import React, { useState, useEffect, useCallback } from "react";
import GoogleFontLoader from "react-google-font";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import "bootstrap/dist/css/bootstrap.min.css";
import "../assets/css/tvmenu-styles.css";
import { renderToastMenuItems } from "../renderMenuItems";
import { useParams } from 'react-router-dom';
import LoaderIcon from '../assets/images/loader_icon.gif';
import logo from '../../../../assets/images/dc-nashua-logo.webp';
import API_BASE_URL from '../../../../config/api';
import VEG from "../assets/images/veg.png";
import NONVEG from "../assets/images/nonveg.png";
import EGG from "../assets/images/egg.png";
import CHILLI from "../assets/images/chilli.png";

/**
 * MenuPage2 - Converted from _images/Menu-Page-2.jpg
 * 
 * Layout: 3 equal columns on white background with centered watermark logo
 * Column 1: Street Style (Sandwiches/Frankies) + Veg Appetizers
 * Column 2: Veg Appetizers (continued) + Non-Veg Appetizers (Chicken/Fish/Shrimp/Goat)
 * Column 3: Egg Station + Special Dips + Tandoori
 * 
 * Designed for 55-inch TV display (16:9 aspect ratio)
 * Original image: 14370x8100px
 * Font sizes: Headers 3rem (orange #fd590d), Items 1.8rem (black)
 * Icons: veg/non-veg/egg ~20px, chilli ~20px
 */
const MenuPage2 = () => {
    const { restaurantId } = useParams();
    const [menu, setMenu] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);
    const [readyOrder, setReadyOrder] = useState(null);

    // SSE: Listen for completed orders
    useEffect(() => {
        const sseBaseUrl = API_BASE_URL || `http://localhost:3010`;
        const eventSource = new EventSource(`${sseBaseUrl}/api/whatsappOrders/stream?location=${restaurantId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'order_completed') {
                const orderNum = data.order.toastOrderNumber || data.order.id;
                setReadyOrder(orderNum);
                setTimeout(() => setReadyOrder(null), 10000);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => eventSource.close();
    }, [restaurantId]);

    useEffect(() => {
        const isWithinOperatingHours = () => {
            const hour = new Date().getHours();
            return hour >= 10 && hour < 22;
        };

        const fetchData = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/menu?location=${restaurantId}`);
                const data = await response.json();
                setMenu(data);
                setFetchError(false);
            } catch (error) {
                console.error("Error fetching menu:", error);
                setFetchError(true);
                setTimeout(() => setFetchError(false), 10000);
            }
            setIsLoading(false);
        };

        fetchData();
        const intervalId = setInterval(() => {
            if (isWithinOperatingHours()) fetchData();
        }, 600000);

        return () => clearInterval(intervalId);
    }, [restaurantId]);

    // Utility function to find menu group by name
    const findMenuGroupByName = (groups, groupName) => {
        if (!groups || !Array.isArray(groups)) {
            return null;
        }
        return groups.find(group => group.name === groupName) || null;
    };

    // Utility function to get menu items by category name
    const getMenuItemsByCategory = (groups, categoryName) => {
        const group = findMenuGroupByName(groups, categoryName);
        if (!group) {
            return [];
        }
        return group.menuItems ?? [];
    };

    // Render menu items with icons matching the image layout
    const renderMenuItemsFromArray = (menuItems) => {
        if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
            return <div>No items available</div>;
        }

        return menuItems
            .filter(item => item.name)
            .map(item => {
                const itemTypeImage = item.itemType === "Veg" ?
                    VEG :
                    item.itemType === "Non-Veg" ?
                        NONVEG :
                        item.itemType === "Egg" ?
                            EGG : null;

                let spiceLevelImages = [];
                if (item.spiceLevel) {
                    const spiceLevel = item.spiceLevel.toLowerCase();
                    if (spiceLevel === 'medium') {
                        spiceLevelImages.push(
                            <img key="medium-1" src={CHILLI} alt="Medium" className="menu-item-icon" />
                        );
                    } else if (spiceLevel === 'spicy') {
                        spiceLevelImages.push(
                            <img key="spicy-1" src={CHILLI} alt="Spicy" className="menu-item-icon" />,
                            <img key="spicy-2" src={CHILLI} alt="Spicy" className="menu-item-icon" />
                        );
                    }
                }

                return (
                    <div
                        key={item.id || item.guid || Math.random()}
                        className="menu-item reduced-spacing"
                    >
                        <h4 className={item.isAvailable === false ? "sold-out-menu-item-name" : ""}>
                            {itemTypeImage && (
                                <img
                                    src={itemTypeImage}
                                    alt={item.name}
                                    className="menu-item-icon"
                                />
                            )}
                            <span style={{ paddingLeft: !itemTypeImage ? "30px" : "0px" }}>
                                {item.name}
                            </span>
                            {spiceLevelImages}
                            <span className="menu-item-price">
                                {item.isAvailable === false ? "N/A" : `$ ${parseFloat(item.price || 0).toFixed(2)}`}
                            </span>
                        </h4>
                    </div>
                );
            });
    };

    const renderHerndonMenu = () => {
        const groups = menu[1]?.menuGroups ?? [];

        let streetStyle = getMenuItemsByCategory(groups, "Street Style(Frankie/Sandwich)");
        let vegAppetizers = getMenuItemsByCategory(groups, "Veg Appetizers");
        let nonVegAppetizers = getMenuItemsByCategory(groups, "Non-Veg  Appetizers(Chicken/Fish/Shrimp/Goat)");
        let eggStation = getMenuItemsByCategory(groups, "Egg Station");
        let specialDips = getMenuItemsByCategory(groups, "Special Dips");
        let tandoor = getMenuItemsByCategory(groups, "Tandoor");

        return (
            <div style={{ position: 'relative', minHeight: '100vh' }}>
                {/* Background watermark logo - DC logo centered, 800px, 20% opacity */}
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundImage: `url(${logo})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center center',
                        backgroundSize: '800px auto',
                        opacity: 0.2,
                        pointerEvents: 'none',
                        zIndex: 0,
                    }}
                />
                <Container fluid style={{ padding: '2rem', position: 'relative', zIndex: 1 }}>
                    <GoogleFontLoader
                        fonts={[
                            { font: "Lobster" },
                            { font: "Bree Serif" },
                        ]}
                    />
                    <Row>
                        {/* Column 1: Street Style + Veg Appetizers */}
                        <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Street Style</h2>
                            {renderMenuItemsFromArray(streetStyle)}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Veg Appetizers</h2>
                            {renderMenuItemsFromArray(vegAppetizers)}
                        </Col>

                        {/* Column 2: Veg Appetizers (continued) + Non-Veg Appetizers */}
                        <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Appetizers Non-Veg</h2>
                            <h5 style={{
                                fontFamily: "Lobster",
                                marginLeft: "-4px",
                                marginTop: "-8px",
                                color: "rgb(1, 137, 0)"
                            }}>
                                (Chicken/Fish/Shrimp/Goat)
                            </h5>
                            {renderMenuItemsFromArray(nonVegAppetizers)}
                        </Col>

                        {/* Column 3: Egg Station + Special Dips + Tandoori */}
                        <Col style={{ flex: '0 0 33.2%', maxWidth: '33.2%' }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Egg Station</h2>
                            {renderMenuItemsFromArray(eggStation)}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Special Dips</h2>
                            {renderMenuItemsFromArray(specialDips)}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Tandoori</h2>
                            {renderMenuItemsFromArray(tandoor)}
                        </Col>
                    </Row>

                    {/* Order Ready Banner - fixed at bottom, spans columns 2 & 3 */}
                    <div style={{
                        position: 'fixed',
                        bottom: '20px',
                        left: '33.4%',
                        right: '20px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        height: '70px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: readyOrder ? '#fd590d' : '#f0f0f0',
                        transition: 'background-color 0.3s ease',
                        zIndex: 100,
                        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
                    }}>
                        {readyOrder ? (
                            <div style={{
                                animation: 'pulse 1s ease-in-out infinite',
                                textAlign: 'center',
                            }}>
                                <span style={{
                                    fontFamily: "'Lobster', cursive",
                                    fontSize: '2.5rem',
                                    color: '#fff',
                                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                                }}>
                                    🎉 Order #{readyOrder} is Ready!
                                </span>
                            </div>
                        ) : (
                            <video
                                src="/_images/promos/Food_preparation.mp4"
                                autoPlay
                                loop
                                muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                            />
                        )}
                    </div>

                    <style>{`
                        @keyframes pulse {
                            0% { transform: scale(1); }
                            50% { transform: scale(1.05); }
                            100% { transform: scale(1); }
                        }
                    `}</style>
                </Container>
            </div>
        );
    };

    const renderWestboroughMenu = () => (
        <div style={{ position: 'relative', minHeight: '100vh' }}>
            {/* Background watermark logo - DC logo centered, 800px, 20% opacity */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundImage: `url(${logo})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center center',
                    backgroundSize: '800px auto',
                    opacity: 0.2,
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />
            <Container fluid style={{ padding: '2rem', position: 'relative', zIndex: 1 }}>
                <GoogleFontLoader
                    fonts={[
                        { font: "Lobster" },
                        { font: "Bree Serif" },
                    ]}
                />
                <Row>
                    {/* Column 1: Street Style + Veg Appetizers
                        Street Style: Grilled Veg Sandwich, Bombay Grill Sandwich,
                        Paneer Burji Sandwich, DC Chicken Sandwich, Veg Frankie,
                        Paneer Frankie, Chicken Tikka Frankie, Goat Keema Frankie
                        Veg Appetizers: Spicy Gobi, Dragon Cauliflower, Gobi Manchuria,
                        Gobi 65, Karam Podi Gobi, Baby Corn Manchuria, Baby Corn Pepper Salt,
                        Chilli Baby Corn, Crispy Corn Pepper Masala, Chilli Mushroom,
                        Karam Podi Mushroom, Veg Ball Manchurian, Chilli Paneer,
                        Paneer Vepudu, Paneer Manchuria */}
                    <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Veg Appetizers</h2>
                        {renderToastMenuItems(menu, "Veg Appetizers")}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Egg Station</h2>
                        {renderToastMenuItems(menu, "Egg Station")}
                    </Col>

                    {/* Column 2: Veg Appetizers (continued) + Non-Veg Appetizers
                        Veg continued: Karam Podi Paneer, Curry Leaf Paneer, Jalapeno Paneer
                        Non-Veg Appetizers: Chowrastha Fried Chicken, Chicken 65,
                        Pepper Chicken, Curry Leaf Chicken, Chilli Chicken, Cashew Chicken,
                        Guntur Kodi Vepudu, Jalapeno Chicken, Apollo Chicken,
                        Pachimirchi Kodi Vepudu, Hong Kong Chicken, Chicken Sukka,
                        Chicken Lollipop, Phuket Fish, Apollo Fish, Jhol Achaar Momo,
                        Chilli Momo, Pepper Shrimp, Chilli Goat Roast, Goat Sukka */}
                    <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Appetizers Non-Veg</h2>
                        {renderToastMenuItems(menu, "Non-Veg Appetizers")}
                    </Col>

                    {/* Column 3: Egg Station + Special Dips + Tandoori
                        Egg Station: Egg Pepper Fry, Chilly Egg, Egg Burji Dhaba Style, Egg Masala
                        Special Dips: Sambar, Chutney, Mint Chutney, Tamarind Chutney,
                        Salan, Raita, Chowrastha Special Dip
                        Tandoori: Paneer Tikka, Malai Broccoli, Mushroom Tikka, Soya Kebab,
                        Chicken Tikka, Tandoori Chicken, Chicken Malai Kabab,
                        Hariyali Chicken Tikka, Tangri Kebab, Shrimp Tikka, Tandoori Pomfret */}
                    <Col style={{ flex: '0 0 33.2%', maxWidth: '33.2%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Special Dips</h2>
                        {renderToastMenuItems(menu, "Special Dips")}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Tandoori</h2>
                        {renderToastMenuItems(menu, "Tandoor")}
                    </Col>
                </Row>

                {/* Order Ready Banner - fixed at bottom, spans columns 2 & 3 */}
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '33.4%',
                    right: '20px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    height: '70px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: readyOrder ? '#fd590d' : '#f0f0f0',
                    transition: 'background-color 0.3s ease',
                    zIndex: 100,
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
                }}>
                    {readyOrder ? (
                        <div style={{
                            animation: 'pulse 1s ease-in-out infinite',
                            textAlign: 'center',
                        }}>
                            <span style={{
                                fontFamily: "'Lobster', cursive",
                                fontSize: '2.5rem',
                                color: '#fff',
                                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                            }}>
                                🎉 Order #{readyOrder} is Ready!
                            </span>
                        </div>
                    ) : (
                        <video
                            src="/_images/promos/Food_preparation.mp4"
                            autoPlay
                            loop
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                        />
                    )}
                </div>

                <style>{`
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); }
                    }
                `}</style>
            </Container>
        </div>
    );

    return (
        <>
            {fetchError && (
                <div style={{
                    position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
                    backgroundColor: '#ff4d4f', color: '#fff', padding: '10px 20px',
                    borderRadius: '8px', fontSize: '1rem', fontFamily: 'sans-serif',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)', opacity: 0.9,
                }}>
                    ⚠️ Menu refresh failed. Showing last known data.
                </div>
            )}
            {isLoading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
                    <img src={LoaderIcon} alt="Loading..." style={{ width: '100px', height: '100px' }} />
                </div>
            ) : (
                restaurantId === "Herndon" ? renderHerndonMenu() : renderWestboroughMenu()
            )}
        </>
    );
};

export default MenuPage2;
