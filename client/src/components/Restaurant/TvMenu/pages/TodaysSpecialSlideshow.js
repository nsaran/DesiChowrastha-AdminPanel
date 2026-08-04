import React, { useState, useEffect } from "react";
import GoogleFontLoader from "react-google-font";
import logo from '../../../../assets/images/dc-nashua-logo.webp';

/**
 * TodaysSpecialSlideshow - Animated slideshow for Today's Special items
 * 
 * Shows each special item with its AI-generated image, name, price,
 * and date range in an animated sequence. Loops continuously.
 * 
 * Props:
 * - items: array of { name, price, description, startDate, endDate, id }
 * - location: restaurant location name
 */
const TodaysSpecialSlideshow = ({ items, location }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [animPhase, setAnimPhase] = useState('fadeIn'); // fadeIn, display, zoomIn, fadeOut
    const [imageUrl, setImageUrl] = useState(null);

    useEffect(() => {
        if (!items || items.length === 0) return;

        const sequence = () => {
            // Phase 1: Fade in (1s)
            setAnimPhase('fadeIn');

            // Phase 2: Display (2s)
            setTimeout(() => setAnimPhase('display'), 1000);

            // Phase 3: Zoom in on food (3s)
            setTimeout(() => setAnimPhase('zoomIn'), 3000);

            // Phase 4: Fade out (1s)
            setTimeout(() => setAnimPhase('fadeOut'), 6000);

            // Phase 5: Next item
            setTimeout(() => {
                setCurrentIndex(prev => (prev + 1) % items.length);
            }, 7000);
        };

        sequence();
        const intervalId = setInterval(sequence, 7000);

        return () => clearInterval(intervalId);
    }, [items, currentIndex]);

    // Fetch/generate image for current item
    useEffect(() => {
        if (!items || items.length === 0) return;
        const item = items[currentIndex];

        const fetchImage = async () => {
            // Try the cached dish image first
            const cachedUrl = `/_images/dishes/${item.id}.jpg`;
            try {
                const res = await fetch(cachedUrl, { method: 'HEAD' });
                if (res.ok) {
                    setImageUrl(cachedUrl);
                    return;
                }
            } catch (e) {}

            // If not found, call AI to generate it
            try {
                const API_BASE_URL = '';
                const res = await fetch(`${API_BASE_URL}/api/menu/item/${item.id}?name=${encodeURIComponent(item.name)}&type=dish&category=Specials`);
                const data = await res.json();
                if (data.imageUrl) {
                    setImageUrl(data.imageUrl);
                } else {
                    setImageUrl(null);
                }
            } catch (e) {
                setImageUrl(null);
            }
        };

        if (item) fetchImage();
    }, [items, currentIndex]);

    if (!items || items.length === 0) return null;

    const item = items[currentIndex];

    const getAnimStyle = () => {
        switch (animPhase) {
            case 'fadeIn':
                return { opacity: 0, transform: 'scale(1)' };
            case 'display':
                return { opacity: 1, transform: 'scale(1)' };
            case 'zoomIn':
                return { opacity: 1, transform: 'scale(1.15)' };
            case 'fadeOut':
                return { opacity: 0, transform: 'scale(1.2)' };
            default:
                return { opacity: 0, transform: 'scale(1)' };
        }
    };

    return (
        <div style={containerStyle}>
            <GoogleFontLoader fonts={[{ font: "Lobster" }, { font: "Bree Serif" }]} />

            {/* Background image with animation */}
            <div style={{
                ...bgImageStyle,
                backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
                backgroundColor: imageUrl ? 'transparent' : '#1a1a1a',
                ...getAnimStyle(),
                transition: 'opacity 1s ease, transform 3s ease',
            }} />

            {/* Dark overlay */}
            <div style={overlayStyle} />

            {/* Logo - top right */}
            <img src={logo} alt="Chowrastha" style={logoStyle} />

            {/* Content */}
            <div style={contentStyle}>
                {/* Badge */}
                <div style={badgeStyle}>TODAY'S SPECIAL</div>

                {/* Item name */}
                <h1 style={{
                    ...titleStyle,
                    opacity: animPhase === 'fadeIn' ? 0 : 1,
                    transform: animPhase === 'fadeIn' ? 'translateY(20px)' : 'translateY(0)',
                    transition: 'opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s',
                }}>
                    {item.name}
                </h1>

                {/* Price */}
                <div style={{
                    ...priceStyle,
                    opacity: animPhase === 'fadeIn' ? 0 : 1,
                    transform: animPhase === 'fadeIn' ? 'translateY(20px)' : 'translateY(0)',
                    transition: 'opacity 0.8s ease 0.5s, transform 0.8s ease 0.5s',
                }}>
                    {item.price ? `$ ${parseFloat(item.price).toFixed(2)}` : ''}
                </div>

                {/* Description */}
                {item.description && (
                    <p style={{
                        ...descStyle,
                        opacity: animPhase === 'fadeIn' ? 0 : 1,
                        transition: 'opacity 0.8s ease 0.7s',
                    }}>
                        {item.description}
                    </p>
                )}

                {/* Date range - removed, items show as long as valid */}

                {/* Dots indicator */}
                {items.length > 1 && (
                    <div style={dotsStyle}>
                        {items.map((_, idx) => (
                            <div
                                key={idx}
                                style={{
                                    width: idx === currentIndex ? '24px' : '8px',
                                    height: '8px',
                                    borderRadius: '4px',
                                    backgroundColor: idx === currentIndex ? '#fd590d' : 'rgba(255,255,255,0.5)',
                                    transition: 'all 0.3s ease',
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Location */}
            <div style={locationStyle}>
                Desi Chowrastha • {location}
            </div>
        </div>
    );
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Styles
const containerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
};

const bgImageStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
};

const overlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)',
};

const logoStyle = {
    position: 'absolute',
    top: '20px',
    right: '20px',
    width: '60px',
    height: 'auto',
    opacity: 0.9,
    zIndex: 10,
};

const contentStyle = {
    position: 'absolute',
    bottom: '40px',
    left: '40px',
    right: '40px',
    zIndex: 10,
};

const badgeStyle = {
    display: 'inline-block',
    fontFamily: "'Bree Serif', serif",
    fontSize: '0.9rem',
    color: '#fff',
    backgroundColor: '#fd590d',
    padding: '6px 16px',
    borderRadius: '20px',
    letterSpacing: '2px',
    marginBottom: '12px',
};

const titleStyle = {
    fontFamily: "'Lobster', cursive",
    fontSize: '3rem',
    color: '#fff',
    margin: '0 0 8px',
    textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
};

const priceStyle = {
    fontFamily: "'Bree Serif', serif",
    fontSize: '2rem',
    color: '#ffd700',
    marginBottom: '10px',
    textShadow: '1px 1px 4px rgba(0,0,0,0.5)',
};

const descStyle = {
    fontFamily: "'Bree Serif', serif",
    fontSize: '1.2rem',
    color: 'rgba(255,255,255,0.8)',
    maxWidth: '600px',
    lineHeight: '1.4',
    marginBottom: '12px',
};

const dateStyle = {
    fontFamily: "'Bree Serif', serif",
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.6)',
};

const dotsStyle = {
    display: 'flex',
    gap: '6px',
    marginTop: '20px',
};

const locationStyle = {
    position: 'absolute',
    top: '20px',
    left: '20px',
    fontFamily: "'Bree Serif', serif",
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.6)',
    zIndex: 10,
};

export default TodaysSpecialSlideshow;
