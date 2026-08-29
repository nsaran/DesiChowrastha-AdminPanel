import React, { useContext } from "react";
import { useParams } from 'react-router-dom';
import GoogleFontLoader from "react-google-font";
import logo from '../../../../assets/images/dc-nashua-logo.webp';
import { ThemeContext } from '../../../../utils/ThemeProvider';

/**
 * QRCodes Page - Displays QR codes for menu and feedback pages
 * Location-specific: shows different QR codes for Nashua vs Westborough
 * 
 * Designed to be displayed on a TV/screen at the restaurant
 */
const QRCodes = () => {
    const { restaurantId } = useParams();
    const { isDark } = useContext(ThemeContext);
    const locationKey = restaurantId?.toLowerCase() || 'nashua';

    // Theme-aware style overrides merged onto the base styles below
    const themedPageStyle = { ...pageStyle, backgroundColor: isDark ? '#16130f' : '#fff' };
    const themedSubtitleStyle = { ...subtitleStyle, color: isDark ? '#c9beb2' : '#555' };
    const themedCardStyle = {
        ...qrCardStyle,
        backgroundColor: isDark ? '#211c17' : '#fafafa',
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.08)',
    };
    const themedImageWrapper = { ...qrImageWrapper, backgroundColor: '#fff' };
    const themedDescStyle = { ...qrDescStyle, color: isDark ? '#a89a8c' : '#666' };
    const themedFooterStyle = { ...footerStyle, color: isDark ? '#8f8478' : '#999' };

    const qrConfig = {
        nashua: {
            menu: '/_images/nashua-menu-qr-code.png',
            feedback: '/_images/nashua-feedback-qr-code.png',
            orderTracker: '/_images/nashua-order-tracker-qr-code.png',
            locationName: 'Nashua, NH'
        },
        westborough: {
            menu: '/_images/westborough-menu-qr-code.png',
            feedback: '/_images/westborough-feedback-qr-code.png',
            orderTracker: '/_images/westborough-order-tracker-qr-code.png',
            locationName: 'Westborough, MA'
        }
    };

    const config = qrConfig[locationKey] || qrConfig.nashua;

    return (
        <div style={themedPageStyle}>
            <GoogleFontLoader fonts={[{ font: "Lobster" }, { font: "Bree Serif" }]} />

            {/* Header */}
            <div style={headerStyle}>
                <img src={logo} alt="Desi Chowrastha" style={{ width: '80px', height: 'auto' }} />
                <h1 style={titleStyle}>Desi Chowrastha</h1>
                <p style={themedSubtitleStyle}>{config.locationName}</p>
            </div>

            {/* QR Codes */}
            <div style={qrContainerStyle}>
                {/* Menu QR */}
                <div style={themedCardStyle}>
                    <div style={themedImageWrapper}>
                        <img src={config.menu} alt="Menu QR Code" style={qrImageStyle} />
                    </div>
                    <h2 style={qrLabelStyle}>📋 Detailed Menu</h2>
                    <p style={themedDescStyle}>
                        Scan to explore our full menu with descriptions and images
                    </p>
                </div>

                {/* Feedback QR */}
                <div style={themedCardStyle}>
                    <div style={themedImageWrapper}>
                        <img src={config.feedback} alt="Feedback QR Code" style={qrImageStyle} />
                    </div>
                    <h2 style={qrLabelStyle}>💬 Feedback Form</h2>
                    <p style={themedDescStyle}>
                        Scan to share your experience with us
                    </p>
                </div>

                {/* Order Tracker QR */}
                <div style={themedCardStyle}>
                    <div style={themedImageWrapper}>
                        <img src={config.orderTracker} alt="Order Tracker QR Code" style={qrImageStyle} />
                    </div>
                    <h2 style={qrLabelStyle}>📦 Order Tracker</h2>
                    <p style={themedDescStyle}>
                        Scan to track your order status in real-time
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div style={themedFooterStyle}>
                <p>Point your phone camera at the QR code to open</p>
            </div>
        </div>
    );
};

// Styles
const pageStyle = {
    minHeight: '100vh',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
};

const headerStyle = {
    textAlign: 'center',
    marginBottom: '50px',
};

const titleStyle = {
    fontFamily: "'Lobster', cursive",
    fontSize: '3rem',
    color: '#fd590d',
    margin: '10px 0 5px',
};

const subtitleStyle = {
    fontFamily: "'Bree Serif', serif",
    fontSize: '1.3rem',
    color: '#555',
};

const qrContainerStyle = {
    display: 'flex',
    gap: '60px',
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
};

const qrCardStyle = {
    textAlign: 'center',
    padding: '30px',
    borderRadius: '16px',
    backgroundColor: '#fafafa',
    border: '2px solid #fd590d',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    maxWidth: '350px',
};

const qrImageWrapper = {
    padding: '15px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    display: 'inline-block',
    marginBottom: '15px',
};

const qrImageStyle = {
    width: '250px',
    height: '250px',
};

const qrLabelStyle = {
    fontFamily: "'Lobster', cursive",
    fontSize: '1.8rem',
    color: '#fd590d',
    marginBottom: '8px',
};

const qrDescStyle = {
    fontFamily: "'Bree Serif', serif",
    fontSize: '1rem',
    color: '#666',
    lineHeight: '1.4',
};

const footerStyle = {
    marginTop: '40px',
    fontFamily: "'Bree Serif', serif",
    fontSize: '1.1rem',
    color: '#999',
};

export default QRCodes;
