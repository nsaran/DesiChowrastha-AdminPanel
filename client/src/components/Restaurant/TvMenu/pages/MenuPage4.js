import React, { useState, useEffect } from "react";
import GoogleFontLoader from "react-google-font";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Table from "react-bootstrap/Table";
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
 * MenuPage4 - Converted from _images/Menu-Page-4.jpg
 * 
 * Layout: 3 columns on white background with centered watermark logo
 * Column 1: Rice Junction - Hyderabadi Dum Biryani + Veg Special Biryani
 * Column 2: Special Biryani Non-Veg + Pulao + Rice (with Single/Family Pack prices)
 * Column 3: Prices column (Single and Family Pack prices aligned with Col 1 & 2)
 * 
 * NOTE: This page uses a TABLE layout for Biryani/Pulao with Item | Single | Family Pack columns
 * 
 * Designed for 55-inch TV display (16:9 aspect ratio)
 * Original image: 14370x8100px
 */
const MenuPage4 = () => {
    const { restaurantId } = useParams();
    const [menu, setMenu] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);

    useEffect(() => {
        const isWithinOperatingHours = () => {
            const hour = new Date().getHours();
            return hour >= 10 && hour < 22;
        };

        const fetchData = async () => {
            if (!isWithinOperatingHours()) return;
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
        const intervalId = setInterval(fetchData, 600000);

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

    const iconFor = type => (type === 'Veg' ? VEG : type === 'Egg' ? EGG : NONVEG);
    const HPAD = { padding: '4px 15px 0px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

    const renderBiryaniTable = (title, items, families, key, showSpice = false) => {
        const headerClass = key === 'pulao' ? 'pulao-table-font' : 'biryani-table-font';
        return (
            <>
                <h2 className="cat-title" style={{ fontFamily: 'Lobster' }}>{title}</h2>
                <Table borderless size="sm" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead>
                        <tr>
                            <th className={headerClass} style={{ width: '60%' }}>Item</th>
                            <th className={headerClass} style={{ width: '20%' }}>Single</th>
                            <th className={headerClass} style={{ width: '20%' }}>Family Pack</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => {
                            let spiceLevelImages = [];
                            if (showSpice && item.spiceLevel) {
                                const lvl = item.spiceLevel.toLowerCase();
                                if (lvl === 'medium') {
                                    spiceLevelImages.push(<img key="medium-1" src={CHILLI} alt="Medium" className="menu-item-icon" />);
                                } else if (lvl === 'spicy') {
                                    spiceLevelImages.push(
                                        <img key="spicy-1" src={CHILLI} alt="Spicy" className="menu-item-icon" />,
                                        <img key="spicy-2" src={CHILLI} alt="Spicy" className="menu-item-icon" />
                                    );
                                }
                            }
                            const fam = families[idx];
                            const rowClass = item.isAvailable ? headerClass : `sold-out-menu-item-${key}`;
                            return (
                                <tr key={item.id || idx}>
                                    <td style={HPAD} className={rowClass}>
                                        <img src={iconFor(item.itemType)} alt={item.itemType} className="menu-item-icon" />
                                        {item.name}
                                        {spiceLevelImages}
                                    </td>
                                    <td style={{ ...HPAD, textAlign: 'left' }} className={rowClass}>
                                        {item.isAvailable ? `$ ${parseFloat(item.price || 0).toFixed(2)}` : 'N/A'}
                                    </td>
                                    <td style={{ ...HPAD, textAlign: 'left' }}
                                        className={fam?.isAvailable === false ? `sold-out-menu-item-${key}` : headerClass}>
                                        {fam ? fam.isAvailable ? `$ ${parseFloat(fam.price || 0).toFixed(2)}` : 'N/A' : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            </>
        );
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
        const biryaniG = groups.find(g => g.name.toLowerCase().includes('biryani') && !g.name.toLowerCase().includes('familypack') && !g.name.toLowerCase().includes('special'));
        const famBiryaniG = groups.find(g => g.name.toLowerCase().includes('familypack') && g.name.toLowerCase().includes('biryani'));
        const pulaoG = groups.find(g => g.name.toLowerCase().includes('pulao') && !g.name.toLowerCase().includes('familypack'));
        const famPulaoG = groups.find(g => g.name.toLowerCase().includes('familypack') && g.name.toLowerCase().includes('pulao'));
        let rice = getMenuItemsByCategory(groups, "Rice");
        let vegSpecialBiryani = getMenuItemsByCategory(groups, "Veg Special Biryani");
        let nonVegSpecialBiryani = getMenuItemsByCategory(groups, "Non-Veg Special Biryani");

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
                        <Col style={{ flex: "0 0 33.4%", maxWidth: "33.4%" }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Rice Junction</h2>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Hyderabadi Dum Biryani</h2>
                            {renderMenuItemsFromArray(biryaniG?.menuItems || [])}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Veg Special Biryani</h2>
                            {renderMenuItemsFromArray(vegSpecialBiryani)}
                        </Col>
                        <Col style={{ flex: "0 0 33.4%", maxWidth: "33.4%", paddingLeft: "15px" }}>
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Special Biryani Non-Veg</h2>
                            {renderMenuItemsFromArray(nonVegSpecialBiryani)}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Pulao</h2>
                            {renderMenuItemsFromArray(pulaoG?.menuItems || [])}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Rice</h2>
                            {renderMenuItemsFromArray(rice)}
                        </Col>
                        <Col style={{ flex: "0 0 33.2%", maxWidth: "33.2%" }}>
                            {/* Column 3 shows Family Pack prices aligned with Col 1 & 2 items.
                                Using table format for proper alignment */}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Family Pack</h2>
                            {renderMenuItemsFromArray(famBiryaniG?.menuItems || [])}
                            {renderMenuItemsFromArray(famPulaoG?.menuItems || [])}
                        </Col>
                    </Row>
                </Container>
            </div>
        );
    };

    const renderWestboroughMenu = () => {
        const groups = menu[0]?.menuGroups || [];
        const biryaniG = groups.find(g => g.name.toLowerCase().includes('veg special biryani') && !g.name.toLowerCase().includes('family pack'));
        const famBiryaniG = groups.find(g => g.name.toLowerCase().includes('veg special biryani family pack') && g.name.toLowerCase().includes('biryani'));
        const nonVegbiryaniG = groups.find(g => g.name.toLowerCase().includes('non-veg special biryani') && !g.name.toLowerCase().includes('family pack'));
        const nonVegfamBiryaniG = groups.find(g => g.name.toLowerCase().includes('non-veg special biryani family pack') && g.name.toLowerCase().includes('biryani'));        
        const pulaoG = groups.find(g => g.name.toLowerCase().includes('pulao') && !g.name.toLowerCase().includes('family pack'));
        const famPulaoG = groups.find(g => g.name.toLowerCase().includes('family pack') && g.name.toLowerCase().includes('pulao'));
        
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
                    {/* Rice Junction - Table layout with Single and Family Pack pricing
                        Biryani: Veg Dum Biryani, Gongura Veg Biryani, Ulavacharu Veg Biryani,
                        Chicken Dum Biryani, Gongura Chicken Biryani, Ulavacharu Chicken Biryani,
                        Goat Dum Biryani, Gongura Goat Biryani, Ulavacharu Goat Biryani
                        Special Non-Veg: Egg Biryani, Konaseema Chicken Fry Biryani,
                        Chicken 65 Biryani, Vijayawada Boneless Biryani, Goat Fry Biryani,
                        Konaseema Goat Keema Biryani, Fish Biryani, Shrimp Biryani
                        Pulao: Chef Spl Veg Pulao, Guttivankaya Pulao, Paneer Pulao,
                        Konaseema Chicken Fry Pulao, Pachimirchi Chicken Pulao,
                        Konaseema Goat Fry Pulao, Goat Keema Pulao
                        Veg Special Biryani: Guttivankaya Biryani, Paneer Biryani,
                        Gongura Paneer Biryani, Ulavacharu Paneer Biryani, Kaju Gobi Biryani
                        Rice: Boiled Rice, Curd Rice, Jeera Rice, Dal Khichdi */}
                    <Row>
                        <Col style={{ flex: "0 0 33.4%", maxWidth: "33.4%", overflow: "hidden", paddingRight: "5px" }}>
                            {renderBiryaniTable("Veg Special Biryani", biryaniG?.menuItems || [], famBiryaniG?.menuItems || [], "biryani", true)}
                            <div style={{ marginTop: "20px", textAlign: "center" }}>
                                <img
                                    src="/_images/promos/veg-biryani.jpg"
                                    alt="Veg Biryani"
                                    style={{ width: "90%", maxWidth: "90%", height: "450px", borderRadius: "8px" }}
                                />
                            </div>
                        </Col>
                        <Col style={{ flex: "0 0 33.4%", maxWidth: "33.4%", overflow: "hidden", paddingLeft: "5px", paddingRight: "5px" }}>
                            {renderBiryaniTable("Non-Veg Special Biryani", nonVegbiryaniG?.menuItems || [], nonVegfamBiryaniG?.menuItems || [], "biryani", true)}
                        </Col>
                        <Col style={{ flex: "0 0 33.2%", maxWidth: "33.2%", paddingLeft: "5px", overflow: "hidden" }}>
                            {renderBiryaniTable("Pulao", pulaoG?.menuItems || [], famPulaoG?.menuItems || [], "pulao")}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Rice</h2>
                            {renderToastMenuItems(menu, "Rice")}
                        </Col>
                    </Row>
                </Container>
            </div>
        );
    };

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

export default MenuPage4;
