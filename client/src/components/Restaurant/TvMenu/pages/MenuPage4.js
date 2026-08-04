import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { useStockUpdates } from '../useStockUpdates';
import { useMenuItemDetail } from '../useMenuItemDetail';
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

    const { setSelectedItem, detailModal } = useMenuItemDetail();

    const [readyOrderNum, setReadyOrderNum] = useState(null);
    const [animState, setAnimState] = useState('idle'); // idle, slideIn, display, slideOut
    const orderQueueRef = useRef([]);
    const knownOrdersRef = useRef(new Set());
    const processingRef = useRef(false);

    // Display orders one by one with animation
    const showNextOrder = useCallback(() => {
        if (orderQueueRef.current.length === 0) {
            processingRef.current = false;
            return;
        }

        processingRef.current = true;
        const orderNum = orderQueueRef.current.shift();

        // Slide in
        setAnimState('slideIn');
        setReadyOrderNum(orderNum);

        // Hold for display
        setTimeout(() => setAnimState('display'), 600);

        // Slide out after 10 seconds
        setTimeout(() => {
            setAnimState('slideOut');
            // Show next order after slide out completes
            setTimeout(() => {
                setReadyOrderNum(null);
                setAnimState('idle');
                showNextOrder();
            }, 600);
        }, 10000);
    }, []);

    // SSE connection to /api/orders/stream for real-time order ready notifications
    useEffect(() => {
        if (restaurantId?.toLowerCase() !== 'westborough') return;

        const SSE_URL = `${API_BASE_URL || window.location.origin}/api/orders/stream?location=${restaurantId}`;
        let eventSource = null;
        let reconnectTimeout = null;
        let fallbackInterval = null;

        const connectSSE = () => {
            try {
                eventSource = new EventSource(SSE_URL);

                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'order_ready' && data.orderNumber) {
                            if (!knownOrdersRef.current.has(data.orderNumber)) {
                                knownOrdersRef.current.add(data.orderNumber);
                                orderQueueRef.current.push(data.orderNumber);
                                if (!processingRef.current) {
                                    showNextOrder();
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing order stream event:', e);
                    }
                };

                eventSource.onerror = () => {
                    eventSource.close();
                    // SSE failed (likely IIS proxy issue) - fall back to polling
                    console.warn('Order SSE failed, falling back to polling');
                    startPolling();
                };
            } catch (e) {
                // SSE not supported or failed - fall back to polling
                startPolling();
            }
        };

        const startPolling = () => {
            if (fallbackInterval) return; // already polling

            const fetchCompletedOrders = async () => {
                const hour = new Date().getHours();
                if (hour < 10 || hour >= 22) return;

                try {
                    const response = await fetch(`${API_BASE_URL}/api/completedOrders?location=${restaurantId}`);
                    const data = await response.json();

                    if (Array.isArray(data)) {
                        const newOrders = data.filter(order => !knownOrdersRef.current.has(order.orderNumber));
                        newOrders.forEach(order => {
                            knownOrdersRef.current.add(order.orderNumber);
                            orderQueueRef.current.push(order.orderNumber);
                        });
                        if (newOrders.length > 0 && !processingRef.current) {
                            showNextOrder();
                        }
                    }
                } catch (error) {
                    console.error("Error fetching completed orders:", error);
                }
            };

            fetchCompletedOrders();
            fallbackInterval = setInterval(fetchCompletedOrders, 300000); // 5 minutes
        };

        connectSSE();

        // Reset cache at 10pm
        const resetInterval = setInterval(() => {
            const hour = new Date().getHours();
            if (hour === 22) {
                knownOrdersRef.current.clear();
                orderQueueRef.current = [];
                setReadyOrderNum(null);
                setAnimState('idle');
            }
        }, 60000);

        return () => {
            if (eventSource) eventSource.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (fallbackInterval) clearInterval(fallbackInterval);
            clearInterval(resetInterval);
        };
    }, [restaurantId, showNextOrder]);

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

    const iconFor = type => (type === 'Veg' ? VEG : type === 'Egg' ? EGG : NONVEG);
    const HPAD = { padding: '4px 15px 0px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

    const renderBiryaniTable = (title, items, families, key, showSpice = false) => {
        const headerClass = key === 'pulao' ? 'pulao-table-font' : 'biryani-table-font';
        return (
            <>
            {detailModal}
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
                                <tr key={item.id || idx} onClick={() => setSelectedItem && setSelectedItem(item)} style={{ cursor: 'pointer' }}>
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
                    <div key={item.id || item.guid || Math.random()} className="menu-item reduced-spacing" onClick={() => setSelectedItem && setSelectedItem(item)} style={{ cursor: 'pointer' }}>
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
                                    style={{ width: "100%", maxWidth: "100%", height: "100%", borderRadius: "8px" }}
                                />
                            </div>
                        </Col>
                        <Col style={{ flex: "0 0 33.4%", maxWidth: "33.4%", overflow: "hidden", paddingLeft: "5px", paddingRight: "5px" }}>
                            {renderBiryaniTable("Non-Veg Special Biryani", nonVegbiryaniG?.menuItems || [], nonVegfamBiryaniG?.menuItems || [], "biryani", true)}
                        </Col>
                        <Col style={{ flex: "0 0 33.2%", maxWidth: "33.2%", paddingLeft: "5px", overflow: "hidden" }}>
                            {renderBiryaniTable("Pulao", pulaoG?.menuItems || [], famPulaoG?.menuItems || [], "pulao")}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: "20px" }}>Rice</h2>
                            {renderToastMenuItems(menu, "Rice", setSelectedItem)}
                        </Col>
                    </Row>
                </Container>

                {/* Order Ready Animated Banner - permanent at bottom */}
                <div style={{
                    marginTop: '15px',
                    width: '100%',
                    height: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    borderRadius: '8px',
                    background: readyOrderNum ? 'linear-gradient(135deg, #fd590d 0%, #ff8c42 50%, #fd590d 100%)' : 'transparent',
                    backgroundSize: '200% 200%',
                    animation: readyOrderNum ? 'gradientShift 2s ease infinite' : 'none',
                }}>
                    {readyOrderNum ? (
                        <div style={{
                            transform: animState === 'slideIn' ? 'translateX(100%)' : animState === 'slideOut' ? 'translateX(-100%)' : 'translateX(0)',
                            transition: 'transform 0.6s ease-in-out',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                        }}>
                            <span style={{ fontSize: '3rem' }}>🔔</span>
                            <span style={{
                                fontFamily: "'Lobster', cursive",
                                fontSize: '3.5rem',
                                color: '#fff',
                                textShadow: '3px 3px 6px rgba(0,0,0,0.3)',
                                letterSpacing: '2px',
                                animation: 'pulseText 1s ease-in-out infinite',
                            }}>
                                Order #{readyOrderNum} is Ready!
                            </span>
                            <span style={{ fontSize: '3rem' }}>🎉</span>
                        </div>
                    ) : (
                        <video
                            src="/_images/promos/Food_preparation.mp4"
                            autoPlay
                            loop
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    )}
                </div>

                <style>{`
                    @keyframes gradientShift {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                    @keyframes pulseText {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); }
                    }
                `}</style>
            </div>
        );
    };

    return (
        <>
            {detailModal}
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




