import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../../../config/api';

/**
 * MenuItemDetail - Modal that shows AI-generated description and image
 * when a user taps/clicks on a menu item.
 * 
 * Props:
 * - item: { id, name, price, itemType, isAvailable }
 * - onClose: function to close the modal
 */
const MenuItemDetail = ({ item, onClose }) => {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!item) return;

        const fetchDetail = async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/menu/item/${item.id}?name=${encodeURIComponent(item.name)}&type=${encodeURIComponent(item.itemType || 'dish')}`
                );
                const data = await response.json();
                setDetail(data);
            } catch (error) {
                console.error('Error fetching item detail:', error);
                setDetail({ error: 'Unable to load details' });
            }
            setLoading(false);
        };

        fetchDetail();
    }, [item]);

    if (!item) return null;

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button style={closeButtonStyle} onClick={onClose}>✕</button>

                {/* Image */}
                <div style={imageContainerStyle}>
                    {loading ? (
                        <div style={placeholderStyle}>
                            <span style={{ fontSize: '2rem' }}>🍽️</span>
                            <p style={{ color: '#999', marginTop: '10px' }}>Generating image...</p>
                        </div>
                    ) : detail?.imageUrl ? (
                        <img
                            src={detail.imageUrl}
                            alt={item.name}
                            style={imageStyle}
                        />
                    ) : (
                        <div style={placeholderStyle}>
                            <span style={{ fontSize: '3rem' }}>🍛</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div style={contentStyle}>
                    <h2 style={titleStyle}>{item.name}</h2>

                    <div style={metaStyle}>
                        {item.itemType && (
                            <span style={{
                                ...tagStyle,
                                backgroundColor: item.itemType === 'Veg' ? '#4caf50' : item.itemType === 'Non-Veg' ? '#f44336' : '#ff9800'
                            }}>
                                {item.itemType}
                            </span>
                        )}
                        {item.price && (
                            <span style={priceStyle}>$ {parseFloat(item.price).toFixed(2)}</span>
                        )}
                    </div>

                    {loading ? (
                        <p style={descLoadingStyle}>Generating description...</p>
                    ) : detail?.description ? (
                        <p style={descriptionStyle}>{detail.description}</p>
                    ) : detail?.error ? (
                        <p style={{ color: '#999', fontStyle: 'italic' }}>{detail.error}</p>
                    ) : null}

                    {!item.isAvailable && (
                        <div style={unavailableStyle}>Currently Unavailable</div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Styles
const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '20px',
};

const modalStyle = {
    backgroundColor: '#fff',
    borderRadius: '16px',
    maxWidth: '450px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    position: 'relative',
};

const closeButtonStyle = {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    fontSize: '1rem',
    cursor: 'pointer',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const imageContainerStyle = {
    width: '100%',
    height: '250px',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
};

const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
};

const placeholderStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
};

const contentStyle = {
    padding: '20px',
};

const titleStyle = {
    fontFamily: "'Lobster', cursive",
    fontSize: '1.8rem',
    color: '#fd590d',
    marginBottom: '10px',
};

const metaStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '15px',
};

const tagStyle = {
    color: '#fff',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
};

const priceStyle = {
    fontSize: '1.4rem',
    fontWeight: 'bold',
    color: '#333',
};

const descriptionStyle = {
    fontSize: '1rem',
    lineHeight: '1.6',
    color: '#555',
    fontFamily: "'Bree Serif', serif",
};

const descLoadingStyle = {
    color: '#999',
    fontStyle: 'italic',
    animation: 'pulse 1.5s ease-in-out infinite',
};

const unavailableStyle = {
    marginTop: '15px',
    padding: '8px 16px',
    backgroundColor: '#fff3f3',
    color: '#ff4d4f',
    borderRadius: '8px',
    textAlign: 'center',
    fontWeight: 'bold',
};

export default MenuItemDetail;
