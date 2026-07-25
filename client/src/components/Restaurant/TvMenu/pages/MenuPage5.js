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
import { useStockUpdates } from '../useStockUpdates';
import VEG from "../assets/images/veg.png";
import NONVEG from "../assets/images/nonveg.png";
import EGG from "../assets/images/egg.png";
import CHILLI from "../assets/images/chilli.png";

/**
 * MenuPage5 - Converted from _images/Menu-Page-5.jpg
 * 
 * Layout: 3 equal columns on white background with centered watermark logo
 * Column 1: Fresh Bakes (Puffs/Bakery) + Hot Beverages + Freshly Baked Cakes info
 * Column 2: Drinks (Lassi/Shakes/Milks/Canned) + Fresh Juice
 * Column 3: Desserts + Ice Cream + Pastries + Catering Services info
 * 
 * Designed for 55-inch TV display (16:9 aspect ratio)
 * Original image: 14370x8100px
 */
const MenuPage5 = () => {
    const { restaurantId } = useParams();
    const [menu, setMenu] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);

    // Real-time stock updates via SSE
    const handleStockUpdate = useCallback((data) => {
        setMenu(prevMenu => {
            if (!prevMenu || !Array.isArray(prevMenu)) return prevMenu;
            return prevMenu.map(menuSection => ({
                ...menuSection,
                menuGroups: (menuSection.menuGroups || []).map(group => ({
                    ...group,
                    menuItems: (group.menuItems || []).map(item => {
                        if (item.id === data.itemGuid) {
                            return { ...item, isAvailable: data.type !== 'out_of_stock' };
                        }
                        return item;
                    })
                }))
            }));
        });
    }, []);

    useStockUpdates(restaurantId, handleStockUpdate);

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

    const findMenuGroupByName = (groups, groupName) => {
        if (!groups || !Array.isArray(groups)) return null;
        return groups.find(group => group.name === groupName) || null;
    };

    const getMenuItemsByCategory = (groups, categoryName) => {
        const group = findMenuGroupByName(groups, categoryName);
        if (!group) return [];
        return group.menuItems ?? [];
    };

    const renderMenuItemsFromArray = (menuItems) => {
        if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
            return <div>No items available</div>;
        }

        return menuItems
            .filter(item => item.name)
            .map(item => {
                const itemTypeImage = item.itemType === "Veg" ? VEG :
                    item.itemType === "Non-Veg" ? NONVEG :
                    item.itemType === "Egg" ? EGG : null;

                let spiceLevelImages = [];
                if (item.spiceLevel) {
                    const spiceLevel = item.spiceLevel.toLowerCase();
                    if (spiceLevel === 'medium') {
                        spiceLevelImages.push(<img key="medium-1" src={CHILLI} alt="Medium" className="menu-item-icon" />);
                    } else if (spiceLevel === 'spicy') {
                        spiceLevelImages.push(
                            <img key="spicy-1" src={CHILLI} alt="Spicy" className="menu-item-icon" />,
                            <img key="spicy-2" src={CHILLI} alt="Spicy" className="menu-item-icon" />
                        );
                    }
                }

                return (
                    <div key={item.id || item.guid || Math.random()} className="menu-item reduced-spacing">
                        <h4 className={item.isAvailable === false ? "sold-out-menu-item-name" : ""}>
                            {itemTypeImage && <img src={itemTypeImage} alt={item.name} className="menu-item-icon" />}
                            <span style={{ paddingLeft: !itemTypeImage ? "30px" : "0px" }}>{item.name}</span>
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

        let bakery = getMenuItemsByCategory(groups, "Bakery");
        let hotBeverages = getMenuItemsByCategory(groups, "Hot Beverages");
        let drinks = getMenuItemsByCategory(groups, "Drinks");
        let freshJuice = getMenuItemsByCategory(groups, "Fresh Juice");
        let desserts = getMenuItemsByCategory(groups, "Desserts");
        let iceCream = getMenuItemsByCategory(groups, "Ice Cream");
        let pastries = getMenuItemsByCategory(groups, "Pastries");

        return (
            <div style={{ position: 'relative', minHeight: '100vh' }}>
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundImage: `url(${logo})`, backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center center', backgroundSize: '800px auto',
                    opacity: 0.2, pointerEvents: 'none', zIndex: 0,
                }} />
                <Container fluid style={{ padding: '2rem', position: 'relative', zIndex: 1 }}>
                    <GoogleFontLoader fonts={[{ font: "Lobster" }, { font: "Bree Serif" }]} />
                    <Row>
                        <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Fresh Bakes</h2>
                            <h5 style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", color: "rgb(1, 137, 0)" }}>
                                Makes U Refresh
                            </h5>
                            {renderMenuItemsFromArray(bakery)}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Hot Beverages</h2>
                            {renderMenuItemsFromArray(hotBeverages)}
                            <h4 style={{ fontFamily: "Lobster", marginTop: "30px", fontSize: "1.8rem", color: "#fd590d" }}>
                                Freshly Baked Cakes By Pre-Order
                            </h4>
                            <h4 style={{ fontFamily: "Bree Serif", fontSize: "1.5rem", color: "black" }}>
                                www.desichowrastha.com
                            </h4>
                        </Col>
                        <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Drinks</h2>
                            <h5 style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", color: "rgb(1, 137, 0)" }}>
                                Fill U'R Thirst
                            </h5>
                            {renderMenuItemsFromArray(drinks)}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Fresh Juice</h2>
                            {renderMenuItemsFromArray(freshJuice)}
                        </Col>
                        <Col style={{ flex: '0 0 33.2%', maxWidth: '33.2%' }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Desserts</h2>
                            <h5 style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", color: "rgb(1, 137, 0)" }}>
                                "life tastes better with dessert"
                            </h5>
                            {renderMenuItemsFromArray(desserts)}
                            <div style={{ marginTop: "10px" }}>
                                <img
                                    src="/_images/promos/irani-chai.jpg"
                                    alt="Irani Chai"
                                    style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "8px" }}
                                />
                            </div>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Ice Cream</h2>
                            <h5 style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", color: "rgb(1, 137, 0)" }}>
                                (Vanilla | Chocolate | Butterscotch | Strawberry | Pistachio)
                            </h5>
                            {renderMenuItemsFromArray(iceCream)}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Pastries</h2>
                            {renderMenuItemsFromArray(pastries)}
                            <div style={{ marginTop: "30px", textAlign: "center" }}>
                                <video
                                    src="/_images/promos/catering_promotion_2.mp4"
                                    autoPlay
                                    loop
                                    muted
                                    style={{ width: "90%", maxWidth: "400px", height: "auto", borderRadius: "8px" }}
                                />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </div>
        );
    };

    const renderWestboroughMenu = () => (
        <div style={{ position: 'relative', minHeight: '100vh' }}>
            <div style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                backgroundImage: `url(${logo})`, backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center center', backgroundSize: '800px auto',
                opacity: 0.2, pointerEvents: 'none', zIndex: 0,
            }} />
            <Container fluid style={{ padding: '2rem', position: 'relative', zIndex: 1 }}>
                <GoogleFontLoader fonts={[{ font: "Lobster" }, { font: "Bree Serif" }]} />
                <Row>
                    {/* Column 1: Fresh Bakes + Hot Beverages
                        Bakery: Veg Puffs, Paneer Puffs, Egg Puffs, Chicken Puffs,
                        Bun Butter Jam, Cookies, Osmania Biscuits
                        Hot Beverages: Irani Chai, Masala Chai, Madras Filter Coffee
                        + Freshly Baked Cakes By Pre-Order (www.desichowrastha.com) */}
                    <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Fresh Bakes</h2>
                        {renderToastMenuItems(menu, "Bakers")}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Hot Beverages</h2>
                        {renderToastMenuItems(menu, "Chai/Coffee")}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Desserts</h2>
                        {renderToastMenuItems(menu, "Desserts")}
                        <div style={{ marginTop: "10px" }}>
                            <img
                                src="/_images/promos/irani-chai.jpg"
                                alt="Irani Chai"
                                style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "8px" }}
                            />
                        </div>
                    </Col>

                    {/* Column 2: Drinks + Fresh Juice
                        Drinks: Mango Lassi, Chikoo Shake, Badam Milk, Pistachio Milkshake,
                        Rose Milk, Butter Milk Masala, Canned Drinks, Water
                        Fresh Juice: Pineapple Juice, Orange Juice, Watermelon Juice,
                        Sugar Cane Juice, Blue Berry Mojito, Fresh Lime Soda */}
                    <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Drinks</h2>
                        {renderToastMenuItems(menu, "Beverages")}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Fresh Juice</h2>
                        {renderToastMenuItems(menu, "Fresh Juice")}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Ice Cream</h2>
                        <h5 style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", color: "rgb(1, 137, 0)" }}>
                            (Vanilla | Chocolate | Butterscotch | Strawberry | Pistachio)
                        </h5>
                        {renderToastMenuItems(menu, "Ice Cream")}
                    </Col>

                    {/* Column 3: Desserts + Ice Cream + Pastries + Catering info
                        Desserts: Sweet Paan, Rasmalai, Gulab Jamun, Double Ka Meetha,
                        Rava Laddu, Falooda
                        Ice Cream: (Vanilla|Chocolate|Butterscotch|Strawberry|Pistachio)
                        1 Scoop, 2 Scoop
                        Pastries: various pastries
                        + We Do Catering Services FOR ALL YOUR EVENTS */}
                    <Col style={{ flex: '0 0 33.2%', maxWidth: '33.2%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Snacks</h2>
                        <h5 style={{
                            fontFamily: "Lobster",
                            marginLeft: "-4px",
                            marginTop: "-8px",
                            color: "rgb(1, 137, 0)"
                        }}>
                            (Available From 5PM)
                        </h5>
                        {renderToastMenuItems(menu, `Snack Box`)}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Pastries</h2>
                        {renderToastMenuItems(menu, "Pastries")}
                        <div style={{ marginTop: "30px", textAlign: "center" }}>
                            <video
                                src="/_images/promos/catering_promotion_2.mp4"
                                autoPlay
                                loop
                                muted
                                style={{ width: "100%", maxWidth: "100%", height: "350px", objectFit: "cover", borderRadius: "8px" }}
                            />
                        </div>
                    </Col>
                </Row>
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

export default MenuPage5;
