import React, { useContext } from "react";
import { useParams } from 'react-router-dom';
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
    const { restaurantId } = useParams();
    const { isDark } = useContext(ThemeContext);

    const bg = isDark ? '#16130f' : '#fffaf5';
    const cardBg = isDark ? '#211c17' : '#ffffff';
    const heading = '#fd590d';
    const body = isDark ? '#e8ddd2' : '#4a4a4a';
    const muted = isDark ? '#a89a8c' : '#8a8078';

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

                <h1 style={{
                    fontFamily: "'Lobster', cursive",
                    color: heading,
                    fontSize: '2.6rem',
                    margin: '0 0 8px',
                }}>
                    Welcome to Desi Chowrastha
                </h1>
                <p style={{
                    fontFamily: "'Bree Serif', serif",
                    color: muted,
                    fontSize: '1.15rem',
                    margin: '0 0 28px',
                    letterSpacing: '0.5px',
                }}>
                    {restaurantId} &middot; Now Open (Soft Launch)
                </p>

                <div style={{
                    fontFamily: "'Bree Serif', serif",
                    color: body,
                    fontSize: '1.2rem',
                    lineHeight: '1.7',
                }}>
                    <p style={{ margin: '0 0 18px' }}>
                        We're delighted to welcome you during our soft launch! As we fine-tune
                        our kitchen and service, we're currently offering a <strong style={{ color: heading }}>curated,
                        limited menu</strong>.
                    </p>
                    <p style={{ margin: '0 0 18px' }}>
                        Every dish is prepared with the same care and authentic flavors you can
                        expect from Desi Chowrastha. Our full menu will be rolling out very soon.
                    </p>
                    <p style={{ margin: '0' }}>
                        Thank you for your patience and support &mdash; we can't wait to serve you.
                    </p>
                </div>

                <div style={{
                    marginTop: '32px',
                    paddingTop: '20px',
                    borderTop: isDark ? '1px solid #362f26' : '1px solid #f0e6dc',
                    fontFamily: "'Bree Serif', serif",
                    color: muted,
                    fontSize: '1rem',
                }}>
                    Please ask our staff for today's available items. Enjoy your meal! &#127869;
                </div>
            </div>
        </div>
    );
};

export default SoftLaunch;
