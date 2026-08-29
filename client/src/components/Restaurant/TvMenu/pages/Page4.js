import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import { ThemeContext } from '../../../../utils/ThemeProvider';
import GoogleFontLoader from "react-google-font";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Table from "react-bootstrap/Table";
import Col from "react-bootstrap/Col";
import Carousel from "react-bootstrap/Carousel";
import "bootstrap/dist/css/bootstrap.min.css";
import "../assets/css/tvmenu-styles.css";
import { renderToastMenuItems } from "../renderMenuItems";
import { useParams } from 'react-router-dom';
import LoaderIcon from '../assets/images/loader_icon.gif';
import { firestore } from '../../../../config/firebase';
import { Tag } from 'antd';
import API_BASE_URL from '../../../../config/api';
import { useStockUpdates } from '../useStockUpdates';
import { useMenuItemDetail } from '../useMenuItemDetail';
// import fillergif from '../../../../assets/images/filler.gif';
import CHILLI from "../assets/images/chilli.png";
import { FB_ACCESS_TOKEN, FB_PAGE_ID, FB_API_VERSION } from '../../../../config/facebook';

// Importing Nashua Signature Dishes
import SamosaImg from "../assets/images/SignatureDishesNashua/Samosa-2-PCS.png";
// import MysoreBondaImg from "../assets/images/SignatureDishesNashua/Mysore Bonda (3 PCS).png";
import MirchiBajiImg from "../assets/images/SignatureDishesNashua/Mirchi Bajji (4 PCS).png";
import PaneerTikkaKebabImg from "../assets/images/SignatureDishesNashua/Paneer Tikka Kebab.webp";
import ChickenTandoorImg from "../assets/images/SignatureDishesNashua/Chicken Tandoor (4 pcs) with Bone.webp";
import ChickenTikkaImg from "../assets/images/SignatureDishesNashua/Chicken Tikka (7 pcs) Boneless.webp";
import PaniPuriImg from "../assets/images/SignatureDishesNashua/Pani Puri(8 Puri).webp";
import DahiPuriImg from "../assets/images/SignatureDishesNashua/Dahi Puri.webp";
import RasamalaiImg from "../assets/images/SignatureDishesNashua/Rasmalai.webp";
import GulabJamunImg from "../assets/images/SignatureDishesNashua/Gulab Jamoon.webp";
import GrilledVegSandwichImg from "../assets/images/SignatureDishesNashua/Grilled Veg Sandwich.jpg";
import DCChickenSandwichImg from "../assets/images/SignatureDishesNashua/DC Chicken Sandwich.png";
import ButterNaanImg from "../assets/images/SignatureDishesNashua/Butter Naan.png";
import LassiImg from "../assets/images/SignatureDishesNashua/Lassi.webp";
import MasalaChaiImg from "../assets/images/SignatureDishesNashua/Masala-Chai.png";

// Importing Herndon Signature Dishes
import Appetizer from "../assets/images/SignatureDishesHerndon/Appetizer.jpeg";
import Bhelpuri from "../assets/images/SignatureDishesHerndon/Bhelpuri.jpeg";
import Biryani from "../assets/images/SignatureDishesHerndon/Biryani.jpeg";
import Naan from "../assets/images/SignatureDishesHerndon/Curry-and-Naan.jpeg";
import Dahipuri from "../assets/images/SignatureDishesHerndon/Dahipuri.jpeg";
import Falooda from "../assets/images/SignatureDishesHerndon/Falooda.jpeg";
import Frankie from "../assets/images/SignatureDishesHerndon/Frankie.jpeg";
import GoatHaleem from "../assets/images/SignatureDishesHerndon/Goat-Haleem.jpeg";
import Idly from "../assets/images/SignatureDishesHerndon/Idly.jpeg";
import OnionSamosa from "../assets/images/SignatureDishesHerndon/IraniChai-and-OnionSamosa.jpeg";
import Kebab from "../assets/images/SignatureDishesHerndon/Kebab.jpeg";
import LunchCombo from "../assets/images/SignatureDishesHerndon/Lunch-Combo.jpeg";
import Mandi from "../assets/images/SignatureDishesHerndon/Mandi.jpeg";
import OnionDosa from "../assets/images/SignatureDishesHerndon/Onion-Dosa.jpeg";
import Panipuri from "../assets/images/SignatureDishesHerndon/Panipuri.jpeg";


import VEG from "../assets/images/veg.png";
import NONVEG from "../assets/images/nonveg.png";
import EGG from "../assets/images/egg.png";
import logo from '../../../../assets/images/dc-nashua-logo.webp';
import SignatureDish from "../assets/images/signature-dish-herndon.jpeg";
import SugarCane from "../assets/images/sugarcane-juice.png";

const Page4 = () => {
    const { restaurantId } = useParams();
    const { isDark } = useContext(ThemeContext);
    const bodyTextColor = isDark ? '#f3ede7' : 'black';
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

    const { setSelectedItem, detailModal } = useMenuItemDetail();

    const [dcLogoUrl, setDcLogoUrl] = useState('');
    const [previousLogoUrl, setPreviousLogoUrl] = useState('');
    const [orderNum, setOrderNum] = useState(null);
    const [pendingOrders, setPendingOrders] = useState([]);
    const [timers, setTimers] = useState({});
    const [completedOrders, setCompletedOrders] = useState(() => {
        const stored = localStorage.getItem('completedOrders');
        return stored ? JSON.parse(stored) : [];
    });

    // Order Ready state for Nashua
    const [readyOrderNum, setReadyOrderNum] = useState(null);
    const [animState, setAnimState] = useState('idle');
    const orderQueueRef = useRef([]);
    const knownOrdersRef = useRef(new Set());
    const processingRef = useRef(false);

    // Facebook posts slideshow
    const [fbPostImages, setFbPostImages] = useState([]);
    const [fbCurrentIndex, setFbCurrentIndex] = useState(0);

    useEffect(() => {
        const fetchFbPosts = async () => {
            try {
                const url = `https://graph.facebook.com/${FB_API_VERSION}/${FB_PAGE_ID}/posts?fields=full_picture&limit=10&access_token=${FB_ACCESS_TOKEN}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    const images = (data.data || [])
                        .filter(post => post.full_picture)
                        .map(post => post.full_picture);
                    if (images.length > 0) {
                        setFbPostImages(images);
                    }
                }
            } catch (e) {
                console.error('Error fetching FB posts for Page4:', e);
            }
        };

        fetchFbPosts();
        // Refresh once a day
        const dayInterval = setInterval(fetchFbPosts, 24 * 60 * 60 * 1000);
        return () => clearInterval(dayInterval);
    }, []);

    // Auto-advance FB slideshow every 5 seconds
    useEffect(() => {
        if (fbPostImages.length <= 1) return;
        const slideshowInterval = setInterval(() => {
            setFbCurrentIndex(prev => (prev + 1) % fbPostImages.length);
        }, 5000);
        return () => clearInterval(slideshowInterval);
    }, [fbPostImages.length]);

    const showNextOrder = useCallback(() => {
        if (orderQueueRef.current.length === 0) {
            processingRef.current = false;
            return;
        }
        processingRef.current = true;
        const orderNum = orderQueueRef.current.shift();
        setAnimState('slideIn');
        setReadyOrderNum(orderNum);
        setTimeout(() => setAnimState('display'), 600);
        setTimeout(() => {
            setAnimState('slideOut');
            setTimeout(() => {
                setReadyOrderNum(null);
                setAnimState('idle');
                showNextOrder();
            }, 600);
        }, 10000);
    }, []);

    // SSE connection for order ready notifications (Nashua)
    useEffect(() => {
        if (restaurantId?.toLowerCase() === 'herndon') return; // Herndon uses different layout

        const SSE_URL = `${API_BASE_URL || window.location.origin}/api/orders/stream?location=${restaurantId}`;
        let eventSource = null;
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
                                if (!processingRef.current) showNextOrder();
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing order stream:', e);
                    }
                };
                eventSource.onerror = () => {
                    eventSource.close();
                    startPolling();
                };
            } catch (e) {
                startPolling();
            }
        };

        const startPolling = () => {
            if (fallbackInterval) return;
            const fetchOrders = async () => {
                const hour = new Date().getHours();
                if (hour < 10 || hour >= 22) return;
                try {
                    const res = await fetch(`${API_BASE_URL}/api/completedOrders?location=${restaurantId}`);
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        const newOrders = data.filter(o => !knownOrdersRef.current.has(o.orderNumber));
                        newOrders.forEach(o => {
                            knownOrdersRef.current.add(o.orderNumber);
                            orderQueueRef.current.push(o.orderNumber);
                        });
                        if (newOrders.length > 0 && !processingRef.current) showNextOrder();
                    }
                } catch (e) {
                    console.error('Error fetching completed orders:', e);
                }
            };
            fetchOrders();
            fallbackInterval = setInterval(fetchOrders, 300000);
        };

        connectSSE();

        // Mark existing completed orders as known so only new ones show
        const markExistingOrders = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/completedOrders?location=${restaurantId}&noAlert=true`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    data.forEach(o => knownOrdersRef.current.add(o.orderNumber));
                }
            } catch (e) {}
        };
        markExistingOrders();

        const resetInterval = setInterval(() => {
            if (new Date().getHours() === 22) {
                knownOrdersRef.current.clear();
                orderQueueRef.current = [];
                setReadyOrderNum(null);
                setAnimState('idle');
            }
        }, 60000);

        return () => {
            if (eventSource) eventSource.close();
            if (fallbackInterval) clearInterval(fallbackInterval);
            clearInterval(resetInterval);
        };
    }, [restaurantId, showNextOrder]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(
                    `${API_BASE_URL}/api/menu?location=${restaurantId}`
                );
                const data = await res.json();
                if (JSON.stringify(data) !== JSON.stringify(previousMenu)) {
                    setPreviousMenu(menu);
                    setMenu(data);
                }
                const logoDoc = await firestore
                    .collection('restaurants')
                    .doc(restaurantId)
                    .collection('filler')
                    .doc('imageData')
                    .get();
                if (logoDoc.exists && logoDoc.data().imageUrl !== previousLogoUrl) {
                    setPreviousLogoUrl(dcLogoUrl);
                    setDcLogoUrl(logoDoc.data().imageUrl);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
            }
            setIsLoading(false);
            console.log('Menu fetched:', menu);
        };

        fetchData();
    }, [restaurantId, menu, previousMenu, dcLogoUrl, previousLogoUrl]);

    useEffect(() => {
        const tick = setInterval(() => {
            setTimers(prev =>
                Object.fromEntries(
                    Object.entries(prev).map(([k, t]) => [k, Math.max(t - 1, 0)])
                )
            );
        }, 1000);
        return () => clearInterval(tick);
    }, []);

    const signatureDishesNashua = [
        SamosaImg,
        // MysoreBondaImg,
        MirchiBajiImg,
        PaneerTikkaKebabImg,
        ChickenTandoorImg,
        ChickenTikkaImg,
        PaniPuriImg,
        DahiPuriImg,
        RasamalaiImg,
        GulabJamunImg,
        GrilledVegSandwichImg,
        DCChickenSandwichImg,
        ButterNaanImg,
        MasalaChaiImg,
    ].map(src => ({ src }));


    const signatureDishesHerndon = [
        Appetizer,
        Bhelpuri,
        Biryani,
        Naan,
        Dahipuri,
        Falooda,
        Frankie,
        GoatHaleem,
        Idly,
        OnionSamosa,
        Kebab,
        LunchCombo,
        Mandi,
        OnionDosa,
        Panipuri,
    ].map(src => ({ src }));

    const iconFor = type => (type === 'Veg' ? VEG : type === 'Egg' ? EGG : NONVEG);
    const HPAD = { padding: '4px 15px 0px 4px' };

    const renderHerndonTable = (title, items, families, key, showSpice = false) => {
        const headerClass = key === 'pulao' ? 'pulao-table-font' : 'biryani-table-font';
        return (
            <>
            {detailModal}
                <h2 className="cat-title" style={{ fontFamily: 'Lobster' }}>
                    {title}
                </h2>
                <Table borderless size="sm" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                        <col style={{ width: '58%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th className={headerClass}>Item</th>
                            <th className={headerClass}>Single</th>
                            <th className={headerClass}>Family Pack</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => {
                            let spiceLevelImages = [];
                            if (showSpice) {
                                const fam = families[idx];
                                if (fam?.spiceLevel) {
                                    const lvl = fam.spiceLevel.toLowerCase();
                                    if (lvl === 'medium') {
                                        spiceLevelImages.push(
                                            <img key="medium-1" src={CHILLI} alt="Medium" className="menu-item-icon" />
                                        );
                                    } else if (lvl === 'spicy') {
                                        spiceLevelImages.push(
                                            <img key="spicy-1" src={CHILLI} alt="Spicy" className="menu-item-icon" />,
                                            <img key="spicy-2" src={CHILLI} alt="Spicy" className="menu-item-icon" />
                                        );
                                    }
                                }
                            }
                            const fam = families[idx];
                            const rowClass = item.isAvailable ? headerClass : `sold-out-menu-item-${key}`;
                            return (
                                <tr key={item.id}>
                                    <td style={HPAD} className={rowClass}>
                                        <img src={iconFor(item.itemType)} alt={item.itemType} className="menu-item-icon" />
                                        {item.name}
                                        {spiceLevelImages}
                                    </td>
                                    <td style={{ ...HPAD, textAlign: 'left' }} className={rowClass}>
                                        {item.isAvailable ? `$ ${item.price.toFixed(2)}` : 'N/A'}
                                    </td>
                                    <td
                                        style={{ ...HPAD, textAlign: 'left' }}
                                        className={fam?.isAvailable === false ? `sold-out-menu-item-${key}` : headerClass}
                                    >
                                        {fam
                                            ? fam.isAvailable
                                                ? `$ ${fam.price.toFixed(2)}`
                                                : 'N/A'
                                            : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            </>
        );
    };

    const NPAD = { padding: '4px 15px 0px 4px' };

    const renderNashuaTable = (title, items, families, key, showSpice = false) => {
        const headerClass = key === 'pulao' ? 'pulao-nashua-table-font' : 'biryani-nashua-table-font';
        return (
            <>
            {detailModal}
                <h2 className="cat-title" style={{ fontFamily: 'Lobster' }}>
                    {title}
                </h2>
                <Table borderless size="sm" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                        <col style={{ width: '58%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th className={headerClass}>Item</th>
                            <th className={headerClass}>Single</th>
                            <th className={headerClass}>Family Pack</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => {
                            // build spice icons from the *single* item now
                            let spiceLevelImages = [];
                            if (showSpice && item.spiceLevel) {
                                const lvl = item.spiceLevel.toLowerCase();
                                if (lvl === 'medium') {
                                    spiceLevelImages.push(
                                        <img key="medium-1" src={CHILLI} alt="Medium" className="menu-item-icon" />
                                    );
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
                                <tr key={item.id}>
                                    <td style={NPAD} className={rowClass}>
                                        <img
                                            src={iconFor(item.itemType)}
                                            alt={item.itemType}
                                            className="menu-item-icon"
                                        />
                                        {item.name}
                                        {spiceLevelImages}
                                    </td>
                                    <td style={{ ...NPAD, textAlign: 'left' }} className={rowClass}>
                                        {item.isAvailable ? `$ ${item.price.toFixed(2)}` : 'N/A'}
                                    </td>
                                    <td
                                        style={{ ...NPAD, textAlign: 'left' }}
                                        className={fam?.isAvailable === false ? `sold-out-menu-item-${key}` : headerClass}
                                    >
                                        {fam
                                            ? fam.isAvailable
                                                ? `$ ${fam.price.toFixed(2)}`
                                                : 'N/A'
                                            : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            </>
        );
    };


    const renderHerndonMenu = () => {
        const groups = menu[1]?.menuGroups ?? [];
        console.log('Groups:', groups);
        const biryaniG = groups.find(g => g.name.toLowerCase().includes('biryani') && !g.name.toLowerCase().includes('familypack'));
        const famBiryaniG = groups.find(g => g.name.toLowerCase().includes('familypack'));
        const pulaoG = groups.find(g => g.name.toLowerCase().includes('pulao') && !g.name.toLowerCase().includes('familypack'));
        const famPulaoG = groups.find(g => g.name.toLowerCase().includes('familypack') && g.name.toLowerCase().includes('pulao'));

        // // Utility function to find menu group by name for herndon menu
        // const findMenuGroupByName = (groups, groupName) => {
        //     if (!groups || !Array.isArray(groups)) {
        //         console.warn(`Invalid groups data for category: ${groupName}`);
        //         return null;
        //     }
        //     const group = groups.find(group => group.name === groupName);
        //     if (!group) {
        //         console.warn(`Menu group not found: ${groupName}`);
        //         console.log('Available groups:', groups.map(g => g.name));
        //     }
        //     return group;
        // };
        // // Utility function to get menu items by category name for herndon menu
        // const getMenuItemsByCategory = (groups, categoryName) => {
        //     const group = findMenuGroupByName(groups, categoryName);
        //     if (!group) {
        //         console.warn(`No menu items found for category: ${categoryName}`);
        //         return [];
        //     }
        //     return group.menuItems ?? [];
        // };

        // let chowrasthaSpecials = getMenuItemsByCategory(groups, "Chowrastha Specials(Mandi/Haleem/Tiffins/Rice)");
        // console.log('Chowrastha Specials:', chowrasthaSpecials);

        // // Function to render menu items directly from an array (same UI as renderToastMenuItems)
        // const renderMenuItemsFromArray = (menuItems) => {
        //     if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
        //         return <div>No items available</div>;
        //     }

        //     return menuItems
        //         .filter(item => item.name)
        //         .map(item => {

        //             const itemTypeImage = item.itemType === "Veg" ?
        //                 VEG :
        //                 item.itemType === "Non-Veg" ?
        //                     NONVEG :
        //                     item.itemType === "Egg" ?
        //                         EGG : null;

        //             let spiceLevelImages = [];
        //             if (item.spiceLevel) {
        //                 const spiceLevel = item.spiceLevel.toLowerCase();
        //                 if (spiceLevel === 'medium') {
        //                     spiceLevelImages.push(
        //                         <img key="medium-1" src={CHILLI} alt="Medium" className="menu-item-icon" />
        //                     );
        //                 } else if (spiceLevel === 'spicy') {
        //                     spiceLevelImages.push(
        //                         <img key="spicy-1" src={CHILLI} alt="Spicy" className="menu-item-icon" />,
        //                         <img key="spicy-2" src={CHILLI} alt="Spicy" className="menu-item-icon" />
        //                     );
        //                 }
        //             }

        //             return (
        //                 <div
        //                     key={item.id || item.guid || Math.random()}
        //                     className="menu-item reduced-spacing"
        //                 >
        //                     <h4 className={item.isAvailable === false ? "sold-out-menu-item-name" : ""}>
        //                         {itemTypeImage && (
        //                             <img
        //                                 src={itemTypeImage}
        //                                 alt={item.name}
        //                                 className="menu-item-icon"
        //                             />
        //                         )}
        //                         <span style={{ paddingLeft: !itemTypeImage ? "30px" : "0px" }}>
        //                             {item.name}
        //                         </span>
        //                         {spiceLevelImages}
        //                         <span className="menu-item-price">
        //                             {item.isAvailable === false ? "N/A" : `$ ${parseFloat(item.price).toFixed(2)}`}
        //                         </span>
        //                     </h4>
        //                 </div>
        //             );
        //         });
        // };

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
                <Container fluid style={{ position: 'relative', zIndex: 1 }}>
                    <GoogleFontLoader fonts={[{ font: 'Lobster' }, { font: 'Bree Serif' }]} />
                    <Row>
                        <Col style={{ flex: "0 0 56%", maxWidth: "56%", marginRight: '50px' }}
                            className="pr-4">
                            <div style={{ background: 'transparent' }}>
                                {renderHerndonTable('Biryani', biryaniG?.menuItems || [], famBiryaniG?.menuItems || [], 'biryani')}
                                {renderHerndonTable('Pulao', pulaoG?.menuItems || [], famPulaoG?.menuItems || [], 'pulao')}
                            </div>
                        </Col>
                        <Col style={{ flex: "0 0 40%", maxWidth: "40%" }}>
                            {/* <h2 className="cat-title" style={{ fontFamily: 'Lobster' }}>Average Waiting Time</h2>
                        <h4 style={{ marginBottom: 30 }}>30 Minutes</h4>
                        <h2 className="cat-title" style={{ fontFamily: 'Lobster' }}>We Take Party Orders</h2>
                        <h4 style={{ marginBottom: 30 }}>
                            Host your next big event with ease! Our restaurant specializes in catering to large groups and parties, offering customizable menus to suit all your celebration needs.
                        </h4> */}
                            <h2 className="cat-title" style={{ fontFamily: 'Lobster', marginBottom: 30, textAlign: "center", alignItems: "center" }}>
                                Signature Dishes
                            </h2>
                            <div className="d-flex flex-column justify-content-center align-items-center">
                                {/* <Carousel style={{ marginBottom: 30 }}>
                                    {signatureDishesHerndon.map((img, i) => (
                                        <Carousel.Item key={i}>
                                            <img src={img.src} alt={`dish-${i}`} style={{ width: 600, height: 500, borderRadius: '8px' }} />
                                             <div className="carousel-badge">Signature Dish</div> 
                                        </Carousel.Item>
                                    ))}
                                </Carousel> */}
                                <img src={SugarCane} alt="Sugarcane Juice" style={{ width: 700, height: 'auto', borderRadius: '8px' }} />
                                {/* {dcLogoUrl && <img src={dcLogoUrl} alt="Logo" style={{ width: 500, height: 500 }} />} */}
                            </div>
                        </Col>
                    </Row>
                </Container>
            </div>
        );
    };

    const renderNashuaMenu = () => {
        const groups = menu[0]?.menuGroups || [];
        const biryaniG = groups.find(g => g.name.toLowerCase().includes('biryani') && !g.name.toLowerCase().includes('familypack'));
        const famBiryaniG = groups.find(g => g.name.toLowerCase().includes('familypack') && g.name.toLowerCase().includes('biryani'));
        const pulaoG = groups.find(g => g.name.toLowerCase().includes('pulao') && !g.name.toLowerCase().includes('familypack'));
        const famPulaoG = groups.find(g => g.name.toLowerCase().includes('familypack') && g.name.toLowerCase().includes('pulao'));
        return (
            <div className={isDark ? 'tv-dark' : ''}>
            <Container fluid>
                <GoogleFontLoader fonts={[{ font: "Lobster" }, { font: "Bree Serif" }]} />

                {/* Top‐level: 2 columns */}
                <Row>
                    {/* ───── Column 1 ───── */}
                    <Col
                        style={{ flex: "0 0 56%", maxWidth: "56%", marginRight: '50px' }}
                        className="pr-4"
                    >
                        {renderNashuaTable(
                            "Biryani's",
                            biryaniG?.menuItems || [],
                            famBiryaniG?.menuItems || [],
                            "biryani",
                            true
                        )}

                        <Row className="mt-4">
                            {/* Text half */}
                            {/* <Col style={{ flex: "0 0 45%", maxWidth: "45%", marginRight: '50px' }} className="pr-4" > */}
                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>
                                Average Waiting Time
                            </h2>
                            <h4 style={{ marginBottom: 30, fontSize: '1.5rem', color: bodyTextColor }}>25 Minutes</h4>

                            <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>
                                We Take Party Orders
                            </h2>
                            <h4 style={{ fontSize: '1.5rem', color: bodyTextColor }}>
                                Host your next big event with ease! Our restaurant specializes
                                in catering to large groups and parties, offering customizable
                                menus to suit all your celebration needs.
                            </h4>
                            {/* </Col> */}

                            {/* Carousel half */}
                            {/* <Col style={{ flex: "0 0 50%", maxWidth: "50%" }} className="pr-4" >
                                <h2 className="cat-title" style={{ fontFamily: "Lobster", alignItems: "center", display: "flex", justifyContent: "center", marginBottom: '15px' }}>
                                    Signature Dishes
                                </h2>
                                <Carousel style={{ marginBottom: '15px' }}>
                                    {signatureDishesNashua.map((img, i) => (
                                        <Carousel.Item key={i}>
                                            <img
                                                className="d-block w-100 carousel-image fluid"
                                                src={img.src}
                                                alt={`sig-${i}`}
                                                style={{ width: 120, height: 360 }}
                                            />
                                            <div className="carousel-badge">Signature Dish</div>
                                        </Carousel.Item>
                                    ))}
                                </Carousel>
                                <b className="disclaimer">
                                    Disclaimer: Images displayed are for representational purposes only.
                                    Actual dishes may vary
                                </b>
                            </Col> */}
                        </Row>
                    </Col>

                    {/* ───── Column 2 ───── */}
                    <Col style={{ flex: "0 0 40%", maxWidth: "40%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {readyOrderNum ? (
                                <div style={{
                                    height: '100%',
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '16px',
                                    background: 'linear-gradient(135deg, #fd590d 0%, #ff8c42 50%, #fd590d 100%)',
                                    backgroundSize: '200% 200%',
                                    animation: 'gradientShift 2s ease infinite',
                                }}>
                                    <div style={{
                                        transform: animState === 'slideIn' ? 'translateY(50px)' : animState === 'slideOut' ? 'translateY(-50px)' : 'translateY(0)',
                                        opacity: animState === 'slideIn' || animState === 'slideOut' ? 0 : 1,
                                        transition: 'transform 0.6s ease-in-out, opacity 0.6s ease-in-out',
                                        textAlign: 'center',
                                    }}>
                                        <span style={{ fontSize: '3.5rem', marginRight: '15px' }}>🔔</span>
                                        <span style={{
                                            fontFamily: "'Lobster', cursive",
                                            fontSize: '4rem',
                                            color: '#fff',
                                            textShadow: '3px 3px 6px rgba(0,0,0,0.3)',
                                            letterSpacing: '2px',
                                            animation: 'pulseText 1s ease-in-out infinite',
                                        }}>
                                            Order #{readyOrderNum} is Ready!
                                        </span>
                                        <span style={{ fontSize: '3.5rem', marginLeft: '15px' }}>🎉</span>
                                    </div>
                                </div>
                            ) : (
                                fbPostImages.length > 0 ? (
                                    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: '12px' }}>
                                        {fbPostImages.map((img, index) => (
                                            <img
                                                key={index}
                                                src={img}
                                                alt={`FB post ${index + 1}`}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'fill',
                                                    opacity: index === fbCurrentIndex ? 1 : 0,
                                                    transition: 'opacity 1s ease-in-out',
                                                }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <img
                                        src={logo}
                                        alt="logo"
                                        style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                                    />
                                )
                            )}
                        </div>
                    </Col>
                </Row>

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
            </Container>
            </div>
        );
    };

    return (
        <>
            {detailModal}
            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <img src={LoaderIcon} alt="Loading..." style={{ width: 100, height: 100 }} />
                </div>
            ) : restaurantId === 'Herndon' ? (
                renderHerndonMenu()
            ) : (
                renderNashuaMenu()
            )}
        </>
    );
};

export default Page4;




