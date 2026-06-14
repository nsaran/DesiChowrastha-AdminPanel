import React, { useState, useEffect } from "react";
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
    const [previousMenu, setPreviousMenu] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                //const response = await fetch(`https://desichowrastha-admin.azurewebsites.net/api/menu?location=${restaurantId}`);
                const response = await fetch(`http://localhost:3010/api/menu?location=${restaurantId}`);
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
        const intervalId = setInterval(fetchData, 1800000);

        return () => clearInterval(intervalId);
    }, [restaurantId, menu, previousMenu]);

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
                                {item.isAvailable === false ? "N/A" : `$ ${parseFloat(item.price).toFixed(2)}`}
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

    const renderNashuaMenu = () => (
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

export default MenuPage3;
