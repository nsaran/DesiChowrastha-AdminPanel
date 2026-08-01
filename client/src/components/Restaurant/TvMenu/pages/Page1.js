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

const Page1 = () => {
    const { restaurantId } = useParams();
    const [menu, setMenu] = useState([]);
    const [previousMenu, setPreviousMenu] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

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

    useStockUpdates(restaurantId, handleStockUpdate, setMenu);

    useEffect(() => {
        const fetchData = async () => {
            try {
                //const response = await fetch(`https://desichowrastha-admin.azurewebsites.net/api/menu?location=${restaurantId}`);
                const response = await fetch(`${API_BASE_URL}/api/menu?location=${restaurantId}`);
                const data = await response.json();

                if (JSON.stringify(data) !== JSON.stringify(previousMenu)) {
                    setPreviousMenu(menu);
                    setMenu(data);
                }
            } catch (error) {
                console.error("Error fetching menu:", error);
            }
            setIsLoading(false);
        };

        fetchData();
    }, [restaurantId, menu, previousMenu]);

    const renderHerndonMenu = () => {

        const groups = menu[1]?.menuGroups ?? [];
         // Utility function to find menu group by name for herndon menu
         const findMenuGroupByName = (groups, groupName) => {
            if (!groups || !Array.isArray(groups)) {
                console.warn(`Invalid groups data for category: ${groupName}`);
                return null;
            }
            const group = groups.find(group => group.name === groupName);
            if (!group) {
                console.warn(`Menu group not found: ${groupName}`);
                console.log('Available groups:', groups.map(g => g.name));
            }
            return group;
        };
        // Utility function to get menu items by category name for herndon menu
        const getMenuItemsByCategory = (groups, categoryName) => {
            const group = findMenuGroupByName(groups, categoryName);
            if (!group) {
                console.warn(`No menu items found for category: ${categoryName}`);
                return [];
            }
            return group.menuItems ?? [];
        };
        let chowrasthaSpecials = getMenuItemsByCategory(groups, "Chowrastha Specials(Mandi/Haleem/Tiffins/Rice)");
        console.log('Chowrastha Specials:', chowrasthaSpecials);

        // Function to render menu items directly from an array (same UI as renderToastMenuItems)
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
                                    {item.isAvailable === false ? "N/A" : `$ ${parseFloat(item.price).toFixed(2)}`}
                                </span>
                            </h4>
                        </div>
                    );
                });
        };

        return (
            <div style={{ position: 'relative', minHeight: '100vh' }}>
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
                <Container fluid>
                    <GoogleFontLoader
                        fonts={[
                            {
                                font: "Lobster",
                            },
                            {
                                font: "Bree Serif",
                            },
                        ]}
                    />
                    <Row>
                        <Col>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Pastries</h2>
                            {renderToastMenuItems(menu, "Pastries")}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Desserts</h2>
                            {renderToastMenuItems(menu, "Desserts")}
                        </Col>
                        <Col>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Drinks</h2>
                            {renderToastMenuItems(menu, "Drinks")}
                        </Col>
                        <Col>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Falooda</h2>
                            {renderToastMenuItems(menu, "Falooda")}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Chowrastha Specials</h2>
                            {renderMenuItemsFromArray(chowrasthaSpecials)}
                        </Col>
                    </Row>
                </Container>
            </div>
        );
    };

    const renderNashuaMenu = () => (
        <Container fluid>
            <GoogleFontLoader
                fonts={[
                    {
                        font: "Lobster",
                    },
                    {
                        font: "Bree Serif",
                    },
                ]}
            />
            <Row>
                <Col>
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Snacks</h2>
                    <h5 style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", color: "rgb(1, 137, 0)" }}>
                        ( Available from 5 PM )
                    </h5>
                    {renderToastMenuItems(menu, `Snacks (Available from 5 PM)`)}
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Tandoor</h2>
                    {renderToastMenuItems(menu, "Tandoor")}
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Bakery</h2>
                    {renderToastMenuItems(menu, "Bakery")}
                </Col>
                <Col>
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Chaat</h2>
                    {renderToastMenuItems(menu, "Chaat")}
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Indian Wok</h2>
                    {renderToastMenuItems(menu, "Indian Wok")}
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Desserts</h2>
                    {renderToastMenuItems(menu, "Desserts")}
                </Col>
                <Col>
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Street Style</h2>
                    {renderToastMenuItems(menu, "Street Style")}
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Breads</h2>
                    {renderToastMenuItems(menu, "Breads")}
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Drinks</h2>
                    {renderToastMenuItems(menu, "Drinks")}
                </Col>
            </Row>
        </Container>
    );

    return (
        <>
            {isLoading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
                    <img src={LoaderIcon} alt="Loading..." style={{ width: '100px', height: '100px' }} />
                </div>
            ) : (
                restaurantId === "Herndon" ? renderHerndonMenu() : renderNashuaMenu()
            )}
        </>
    );
};

export default Page1;
