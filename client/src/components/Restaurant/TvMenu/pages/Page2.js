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

const Page2 = () => {
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

    const { setSelectedItem, DetailModal } = useMenuItemDetail();

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

    const renderHerndonMenu = () => (
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
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Tiffins</h2>
                        {renderToastMenuItems(menu, "Tiffins", setSelectedItem)}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Street Style</h2>
                        <h5 style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", color: "rgb(1, 137, 0)" }}>
                            (Frankie / Sandwich)
                        </h5>
                        {renderToastMenuItems(menu, "Street Style(Frankie/Sandwich)", setSelectedItem)}
                    </Col>
                    <Col>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Dosa</h2>
                        {renderToastMenuItems(menu, "Dosa", setSelectedItem)}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Indian Wok</h2>
                        <h5 style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", color: "rgb(1, 137, 0)" }}>
                            (Fried Rice / Noodles)
                        </h5>
                        <p style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", fontSize: "2rem", color: "black" }}>
                         <span style={{color: "red"}}> Extra </span> (Egg + $1, Paneer/Chicken/DoubleEgg + $2, Shrimp + $3)
                        </p>
                        {renderToastMenuItems(menu, "Indian Wok(Fried Rice/Noodles)", setSelectedItem)}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster", marginTop: '30px' }}>Lunch Combo - Weekdays Only(11AM-2:30)</h2>
                        <p style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", fontSize: "2rem", color: "black" }}>
                         <span style={{color: "red"}}> Extra </span> (Chicken + $2, Goat + $3)
                        </p>
                        {renderToastMenuItems(menu, "Lunch Combo - Weekdays Only(11AM-1:30)", setSelectedItem)}
                    </Col>
                    <Col>
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Snacks</h2>
                        <h5 style={{ fontFamily: "Lobster", marginLeft: "-4px", marginTop: "-8px", color: "rgb(1, 137, 0)" }}>
                            (Available from 4 PM)
                        </h5>
                        {renderToastMenuItems(menu, "Snacks (Available from 4:00 PM)", setSelectedItem)}
                        <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Chaat</h2>
                        {renderToastMenuItems(menu, "Chaat", setSelectedItem)}
                    </Col>
                </Row>
            </Container>
        </div>
    );

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
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Dosa</h2>
                    {renderToastMenuItems(menu, "Dosa", setSelectedItem)}
                </Col>
                <Col>
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Tiffins</h2>
                    {renderToastMenuItems(menu, "Tiffins", setSelectedItem)}
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Sides</h2>
                    {renderToastMenuItems(menu, "Sides", setSelectedItem)}
                </Col>
                <Col>
                    <h2 className="cat-title" style={{ fontFamily: "Lobster" }}>Non-Veg Curries</h2>
                    {renderToastMenuItems(menu, "Non-Veg  Curries", setSelectedItem)}
                </Col>
            </Row>
        </Container>
    );

    return (
        <>
            <DetailModal />
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

export default Page2;

