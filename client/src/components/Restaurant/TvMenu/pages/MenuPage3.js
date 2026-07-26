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
 * MenuPage3 - Converted from _images/Menu-Page-3.jpg
 * 
 * Layout: 3 equal columns on white background with centered watermark logo
 * Column 1: Veg Curries
 * Column 2: Non-Veg Curries (Chicken/Goat/Fish/Shrimp)
 * Column 3: Breads + Indian Wok (Fried Rice/Noodles) with add-on pricing
 * 
 * Designed for 55-inch TV display (16:9 aspect ratio)
 * Original image: 14370x8100px
 */
const MenuPage3 = () => {
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

        let vegCurries = getMenuItemsByCategory(groups, "Veg  Curries");
        let nonVegCurries = getMenuItemsByCategory(groups, "Non-Veg  Curries");
        let breads = getMenuItemsByCategory(groups, "Breads");
        let indianWok = getMenuItemsByCategory(groups, "Indian Wok(Fried Rice/Noodles)");

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
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Veg Curries</h2>
                            {renderMenuItemsFromArray(vegCurries)}
                            <div style={{ marginTop: "15px" }}>
                                <img
                                    src="/_images/promos/goat-curry.jpg"
                                    alt="Goat Curry"
                                    style={{ width: "100%", height: "300px", objectFit: "cover", borderRadius: "8px" }}
                                />
                            </div>
                        </Col>
                        <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Non-Veg Curries</h2>
                            {renderMenuItemsFromArray(nonVegCurries)}
                        </Col>
                        <Col style={{ flex: '0 0 33.2%', maxWidth: '33.2%' }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Breads</h2>
                            {renderMenuItemsFromArray(breads)}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Indian Wok</h2>
                            <h5 style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", color: "rgb(1, 137, 0)" }}>
                                (Fried Rice / Noodles)
                            </h5>
                            {renderMenuItemsFromArray(indianWok)}
                            <p style={{ fontFamily: "Lobster", fontSize: "1.6rem", color: "black", marginTop: "10px" }}>
                                <span style={{ color: "red" }}>Extra: </span>
                                Paneer +$1.99 | Egg +$1.00 | Chicken +$2.00 | Shrimp +$3.00 | Goat Keema +$4.00
                            </p>
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
                    {/* Column 1: Veg Curries
                        Yellow Dal Tadaka, Dal Makhani, Chettinad Veg Curry, Kadai Mushroom Curry,
                        Nizami Handi Veg, Aloo Gobi, Bhindi Masala, Bhindi Curry (Pulusu),
                        Chana Masala, Guttivankaya Curry, Aloo Mutter Masala,
                        Mutter Paneer Masala, Malai Methi Paneer, Malai Kofta,
                        Paneer Butter Masala, Paneer Tikka Masala, Palak Paneer, Kadai Paneer */}
                    <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Veg Curries</h2>
                        {renderToastMenuItems(menu, "Veg Curries")}
                        <div style={{ marginTop: "15px" }}>
                            <img
                                src="/_images/promos/goat-curry.jpg"
                                alt="Goat Curry"
                                style={{ width: "100%", height: "200px", objectFit: "cover", borderRadius: "8px" }}
                            />
                        </div>
                    </Col>

                    {/* Column 2: Non-Veg Curries
                        Andhra Chicken Curry, Chowrastha Spl Chicken Curry,
                        Kerala Style Chicken Curry, Chettinad Chicken Curry,
                        Kadai Chicken Curry, Mughlai Chicken Curry, Gongura Chicken Curry,
                        Butter Chicken, Chicken Tikka Masala, Chicken Jalfrezi,
                        Chicken Vindaloo, Palak Chicken Curry, Gongura Goat Curry,
                        Andhra Goat Curry, Chowrastha Spl Goat Curry,
                        Kerala Style Goat Curry, Chettinad Goat Curry, Goat Mandakini,
                        Palak Goat Curry, Goat Rara, Goat Kheema Curry,
                        Fish Curry (Kuzhambu), Chettinad Shrimp Masala */}
                    <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Non-Veg Curries</h2>
                        {renderToastMenuItems(menu, "Non-Veg Curries")}
                    </Col>

                    {/* Column 3: Breads + Indian Wok
                        Breads: Plain Naan, Butter Naan, Garlic Naan, Bullet Naan,
                        Plain Kulcha, Paneer Kulcha, Methi Paratha, Lachha Paratha,
                        Aloo Paratha, Paneer Paratha, Butter Roti, Tandoori Roti
                        Indian Wok: Street Style Fried Rice, Fried Rice, Schezwan Fried Rice,
                        Hot Garlic Rice, Hakka Noodles, Hot Garlic Noodles, Schezwan Noodles
                        Extras: Paneer +$1.99, Egg +$1.00, Chicken +$2.00, Shrimp +$3.00, Goat Keema +$4.00 */}
                    <Col style={{ flex: '0 0 33.2%', maxWidth: '33.2%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Breads</h2>
                        {renderToastMenuItems(menu, "Breads")}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Indian Wok</h2>
                        <h5 style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", color: "rgb(1, 137, 0)" }}>
                            (Fried Rice / Noodles)
                        </h5>
                        {renderToastMenuItems(menu, "Indian Wok")}
                        <p style={{ fontFamily: "Lobster", fontSize: "1.6rem", color: "black", marginTop: "10px" }}>
                            <span style={{ color: "red" }}>Extra: </span>
                            Paneer +$1.99 | Egg +$1.00 | Chicken +$2.00 | Shrimp +$3.00 | Goat Keema +$4.00
                        </p>
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

export default MenuPage3;
