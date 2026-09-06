import React, { useContext } from "react";
import GoogleFontLoader from "react-google-font";
import logo from '../../../../assets/images/dc-nashua-logo.webp';
import { ThemeContext } from '../../../../utils/ThemeProvider';

/**
 * SoftLaunch - Temporary notice page shown during the Westborough soft launch.
 * Communicates that a limited menu is available while the restaurant ramps up.
 *
 * Route: /dashboard/:restaurantId/SoftLaunch
 */
const SoftLaunch = () => {
    const { isDark } = useContext(ThemeContext);

    const bg = isDark ? '#16130f' : '#fffaf5';
    const cardBg = isDark ? '#211c17' : '#ffffff';
    const heading = '#fd590d';
    const body = isDark ? '#e8ddd2' : '#4a4a4a';

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
        }}>
            <GoogleFontLoader fonts={[{ font: "Lobster" }, { font: "Bree Serif" }]} />
            <div style={{
                maxWidth: '640px',
                width: '100%',
                backgroundColor: cardBg,
                borderRadius: '18px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                padding: '48px 40px',
                textAlign: 'center',
                borderTop: `6px solid ${heading}`,
            }}>
                <img src={logo} alt="Desi Chowrastha" style={{ width: '110px', height: 'auto', marginBottom: '24px' }} />

                <p style={{
                    fontFamily: "'Bree Serif', serif",
                    color: body,
                    fontSize: '1.4rem',
                    lineHeight: '1.7',
                    margin: 0,
                }}>
                    During our soft launch, we're offering a limited menu &mdash; thank you for your patience and support.
                </p>
            </div>
        </div>
    );
};

export default SoftLaunch;
