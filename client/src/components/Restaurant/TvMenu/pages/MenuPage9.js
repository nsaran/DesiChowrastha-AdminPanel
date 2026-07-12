import React, { useState, useEffect } from "react";
import GoogleFontLoader from "react-google-font";
import "bootstrap/dist/css/bootstrap.min.css";
import "../assets/css/tvmenu-styles.css";
import { useParams } from 'react-router-dom';
import API_BASE_URL from '../../../../config/api';

/**
 * MenuPage9 - Today's Special
 * 
 * Displays 2-3 special items for the day in a chalkboard style.
 * Fetches data from /api/todaysSpecial?location=<restaurantId>
 * Supports Westborough and Nashua locations.
 * 
 * Designed for 55-inch TV display (16:9 aspect ratio)
 */
const MenuPage9 = () => {
    const { restaurantId } = useParams();
    const [specials, setSpecials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSpecials = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/todaysSpecial?location=${restaurantId}`);
                const data = await response.json();
                setSpecials(data);
            } catch (error) {
                console.error("Error fetching today's specials:", error);
            }
            setIsLoading(false);
        };

        fetchSpecials();
        const intervalId = setInterval(fetchSpecials, 300000); // refresh every 5 minutes

        return () => clearInterval(intervalId);
    }, [restaurantId]);

    const boardStyle = {
        minHeight: '100vh',
        backgroundColor: '#2c2c2c',
        backgroundImage: `
            radial-gradient(ellipse at center, rgba(50,50,50,1) 0%, rgba(20,20,20,1) 100%),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23333' fill-opacity='0.4' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E")
        `,
        border: '20px solid #5c3a1e',
        borderRadius: '4px',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 8px 30px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        position: 'relative',
        overflow: 'hidden',
    };

    const titleStyle = {
        fontFamily: "'Permanent Marker', cursive",
        fontSize: '5rem',
        color: '#f5e6c8',
        textShadow: '2px 2px 4px rgba(0,0,0,0.5), 0 0 10px rgba(255,255,255,0.1)',
        marginBottom: '10px',
        textAlign: 'center',
        letterSpacing: '3px',
    };

    const subtitleStyle = {
        fontFamily: "'Indie Flower', cursive",
        fontSize: '2rem',
        color: '#ccc',
        textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
        marginBottom: '50px',
        textAlign: 'center',
    };

    const itemContainerStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '30px',
        width: '100%',
        maxWidth: '900px',
    };

    const itemStyle = {
        width: '100%',
        padding: '20px 30px',
        borderBottom: '2px dashed rgba(255,255,255,0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    };

    const itemNameStyle = {
        fontFamily: "'Permanent Marker', cursive",
        fontSize: '3rem',
        color: '#fff',
        textShadow: '1px 1px 3px rgba(0,0,0,0.5), 0 0 8px rgba(255,255,255,0.05)',
    };

    const itemPriceStyle = {
        fontFamily: "'Permanent Marker', cursive",
        fontSize: '2.8rem',
        color: '#ffd700',
        textShadow: '1px 1px 3px rgba(0,0,0,0.5)',
    };

    const itemDescStyle = {
        fontFamily: "'Indie Flower', cursive",
        fontSize: '1.5rem',
        color: '#aaa',
        textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
        marginTop: '5px',
    };

    const chalkDustStyle = {
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: "'Indie Flower', cursive",
        fontSize: '1.2rem',
        color: 'rgba(200,200,200,0.4)',
        textAlign: 'center',
    };

    if (isLoading) {
        return (
            <div style={{ ...boardStyle, justifyContent: 'center', alignItems: 'center' }}>
                <p style={{ fontFamily: "'Indie Flower', cursive", fontSize: '2rem', color: '#ccc' }}>
                    Loading today's specials...
                </p>
            </div>
        );
    }

    return (
        <div style={boardStyle}>
            <GoogleFontLoader fonts={[{ font: "Permanent Marker" }, { font: "Indie Flower" }]} />

            {/* Decorative chalk stars */}
            <div style={{ position: 'absolute', top: '30px', left: '40px', fontSize: '2rem', color: 'rgba(255,255,255,0.15)' }}>✦</div>
            <div style={{ position: 'absolute', top: '50px', right: '60px', fontSize: '1.5rem', color: 'rgba(255,255,255,0.12)' }}>✧</div>
            <div style={{ position: 'absolute', bottom: '80px', left: '80px', fontSize: '1.8rem', color: 'rgba(255,255,255,0.1)' }}>✦</div>

            <h1 style={titleStyle}>Today's Special</h1>
            <p style={subtitleStyle}>~ Chef's Recommendation ~</p>

            <div style={itemContainerStyle}>
                {specials.length > 0 ? (
                    specials.map((item, index) => (
                        <div key={item.id || index} style={itemStyle}>
                            <div>
                                <div style={itemNameStyle}>{item.name}</div>
                                {item.description && (
                                    <div style={itemDescStyle}>{item.description}</div>
                                )}
                            </div>
                            <div style={itemPriceStyle}>
                                {item.price ? `$ ${parseFloat(item.price).toFixed(2)}` : ''}
                            </div>
                        </div>
                    ))
                ) : (
                    <p style={{ ...subtitleStyle, color: '#888' }}>
                        No specials today — check back tomorrow!
                    </p>
                )}
            </div>

            <div style={chalkDustStyle}>
                ~ Desi Chowrastha ~
            </div>
        </div>
    );
};

export default MenuPage9;
