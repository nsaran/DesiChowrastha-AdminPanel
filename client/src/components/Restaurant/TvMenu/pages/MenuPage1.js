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
import { useMenuItemDetail } from '../useMenuItemDetail';
import VEG from "../assets/images/veg.png";
import NONVEG from "../assets/images/nonveg.png";
import EGG from "../assets/images/egg.png";
import CHILLI from "../assets/images/chilli.png";

/**
 * MenuPage1 - Converted from _images/Menu-Page-1.jpg
 * 
 * Layout: 3 equal columns on white background with centered watermark logo
 * Column 1: Tiffins/Dosas (Idly, Vada, Dosa, Uthappam, Rava Dosa variants)
 * Column 2: Dosas (Benne, Pesarattu, Poori, Extras, Add-ons) + Non-Veg Combo
 * Column 3: Snacks (Available From 5PM) + Chaat Section
 * 
 * Designed for 55-inch TV display (16:9 aspect ratio)
 * Original image: 14370x8100px
 * Font sizes: Headers 3rem (orange), Items 1.8rem (black)
 * Icons: veg/non-veg/egg ~20px, chilli ~20px
 */
const MenuPage1 = () => {
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

    // Fetch menu data
    const fetchMenuData = useCallback(async () => {
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
    }, [restaurantId]);

    useStockUpdates(restaurantId, handleStockUpdate, setMenu);

    const { setSelectedItem, DetailModal } = useMenuItemDetail();

    useEffect(() => {
        fetchMenuData();
    }, [fetchMenuData]);

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
                        onClick={() => setSelectedItem && setSelectedItem(item)}
                        style={{ cursor: 'pointer' }}
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

        let tiffins = getMenuItemsByCategory(groups, "Tiffins");
        let dosas = getMenuItemsByCategory(groups, "Dosa");
        let snacks = getMenuItemsByCategory(groups, "Snacks (Available from 4:00 PM)");
        let chaat = getMenuItemsByCategory(groups, "Chaat");
        let nonVegCombo = getMenuItemsByCategory(groups, "Non-Veg Combo");

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
                        {/* Column 1: Tiffins/Dosas - 33.4% width */}
                        <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Tiffins/Dosas</h2>
                            {renderMenuItemsFromArray(tiffins)}
                            {renderMenuItemsFromArray(dosas)}
                        </Col>

                        {/* Column 2: Dosas + Add-ons + Non-Veg Combo - 33.4% width */}
                        <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Dosas</h2>
                            <p style={{
                                fontFamily: "Lobster",
                                marginLeft: "-4px",
                                marginTop: "-8px",
                                fontSize: "1.6rem",
                                color: "black"
                            }}>
                                <span style={{ color: "red" }}>Add on: </span>
                                Ghee +$1.00 | Onion +$1.00 | Podi +$0.99 | Karam +$0.99 | Cheese +$2.00
                            </p>
                            {renderMenuItemsFromArray(dosas)}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Non-Veg Combo</h2>
                            {renderMenuItemsFromArray(nonVegCombo)}
                            <div style={{ marginTop: "15px" }}>
                                <img
                                    src="/_images/promos/tv_screen_1.jpeg"
                                    alt="Idly Combo"
                                    style={{ width: "100%", height: "250px", objectFit: "cover", borderRadius: "8px" }}
                                />
                            </div>
                        </Col>

                        {/* Column 3: Snacks + Chaat Section - 33.2% width */}
                        <Col style={{ flex: '0 0 33.2%', maxWidth: '33.2%' }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Snacks</h2>
                            <h5 style={{
                                fontFamily: "Lobster",
                                marginLeft: "-4px",
                                marginTop: "-8px",
                                color: "rgb(1, 137, 0)"
                            }}>
                                (Available from 5 PM)
                            </h5>
                            {renderMenuItemsFromArray(snacks)}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Chaat Section</h2>
                            {renderMenuItemsFromArray(chaat)}
                        </Col>
                    </Row>
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
                    {/* Column 1: Tiffins/Dosas - 33.4% width
                        Items: Idly, Ghee Idly, Sambar Idly, Ghee Karam Idly, Idly Vada Combo,
                        Vada, Sambar Vada, Plain Dosa, Onion Dosa, Chocolate Cone Dosa,
                        Masala Dosa, Ghee Karam Dosa, Podi Masala Karam Dosa, Guntur Karam Dosa,
                        Mysore Masala Dosa, Hot Garlic Dosa, Cheese Dosa, Paneer Dosa,
                        Plain Uthappam, Onion Uthappam, Onion Chilli Uthappam, Paneer Uthappam,
                        Rava Dosa, Rava Onion Dosa, Rava Masala Dosa */}
                    <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Tiffins</h2>
                        {renderToastMenuItems(menu, "Tiffins", setSelectedItem)}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Non-Veg Combo</h2>
                        {renderToastMenuItems(menu, "Non-Veg Combo", setSelectedItem)}
                        <div style={{ marginTop: "15px" }}>
                            <img
                                src="/_images/promos/tv_screen_1.jpeg"
                                alt="Idly Combo"
                                style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "8px" }}
                            />
                        </div>
                    </Col>

                    {/* Column 2: More Dosas + Add-on pricing + Non-Veg Combo - 33.4% width
                        Dosa items: Benne Dosa, Benne Masala Dosa, Pesarattu, Onion Pesarattu,
                        Poori Bhaji, Chole Poori, Extra Poori, Extra Masala, Extra Sambar
                        Add-on note: Ghee +$1.00 | Onion +$1.00 | Podi +$0.99 | Karam +$0.99 | Cheese +$2.00
                        Non-Veg Combo: Poori + Chicken Curry, Poori + Goat Curry,
                        Poori + Goat Keema Curry, Dosa + Chicken Curry, Dosa + Chicken Tikka,
                        Dosa + Chicken 65, Dosa + Goat Curry, Dosa + Goat Keema Curry */}
                    <Col style={{ flex: '0 0 33.4%', maxWidth: '33.4%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Dosas</h2>
                        <p style={{
                            fontFamily: "Lobster",
                            marginLeft: "-4px",
                            marginTop: "-8px",
                            fontSize: "1.6rem",
                            color: "black"
                        }}>
                            <span style={{ color: "red" }}>Add on: </span>
                            Ghee +$1.00 | Onion +$1.00 | Podi +$0.99 | Karam +$0.99 | Cheese +$2.00
                        </p>
                        {renderToastMenuItems(menu, "Dosa", setSelectedItem)}                        
                    </Col>

                    {/* Column 3: Snacks (Available From 5PM) + Chaat Section - 33.2% width
                        Snacks: Samosa, Onion Samosa, Cut Mirchi, Punugulu, Mysore Bonda,
                        Mirchi Bajji, Stuffed Mirchi, Onion Spinach Pakora, Masala Vada
                        Chaat: Pani Puri, Aloo Tikki Chaat, Samosa Ragada, Dahi Puri,
                        Papadi Chaat, Bhel Puri, Spl Bhel Puri, Sev Puri,
                        Murukku Sandwich, Vada Pav, Pav Bhaji, Masala Peanuts, Extra Pav */}
                    <Col style={{ flex: '0 0 33.2%', maxWidth: '33.2%' }}>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Chaat Section</h2>
                        {renderToastMenuItems(menu, "Chaat", setSelectedItem)}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Street Style</h2>
                        {renderToastMenuItems(menu, "Street Style", setSelectedItem)}
                    </Col>
                </Row>
            </Container>
        </div>
    );

    return (
        <>
            <DetailModal />
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

export default MenuPage1;
