import React, { useContext } from "react";
import GoogleFontLoader from "react-google-font";
import logo from '../../../../assets/images/dc-nashua-logo.webp';
import { ThemeContext } from '../../../../utils/ThemeProvider';

/**
 * SoftLaunch - Temporary notice + limited menu shown during the soft launch.
 *
 * Route: /dashboard/:restaurantId/SoftLaunch
 */
const MENU = [
    {
        category: 'Veg Appetizers',
        items: [
            'Pepper Corn Masala',
            'Baby Corn Manchuria',
            'Gobi 65',
            'Chili Garlic Paneer',
            'Chowrastha Fried Paneer',
        ],
    },
    {
        category: 'Non-Veg Appetizers',
        items: [
            'Pepper Chicken',
            'Jalapeno Chicken',
            'Karam Podi Chicken',
            'Chicken 65',
        ],
    },
    {
        category: 'Indo-Chinese',
        items: [
            'Veg Fried Rice',
            'Chicken Fried Rice',
            'Veg Noodles',
            'Chicken Noodles',
        ],
    },
    {
        category: "Biryani's",
        items: [
            'Chicken Dum Biryani',
            'Goat Dum Biryani',
            'Guttivankaya Biryani',
            'Paneer Biryani',
            'Vijayawada Boneless Chicken Biryani',
            'Konaseema Chicken Biryani',
            'Kaju Goat Keema Biryani',
            'Veg Biryani',
            'Pulao',
        ],
    },
];

const SoftLaunch = () => {
    const { isDark } = useContext(ThemeContext);

    const bg = isDark ? '#16130f' : '#fffaf5';
    const cardBg = isDark ? '#211c17' : '#ffffff';
    const heading = '#fd590d';
    const body = isDark ? '#e8ddd2' : '#4a4a4a';
    const divider = isDark ? '#362f26' : '#f0e6dc';

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: bg,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '24px',
        }}>
            <GoogleFontLoader fonts={[{ font: "Lobster" }, { font: "Bree Serif" }]} />
            <div style={{
                maxWidth: '720px',
                width: '100%',
                backgroundColor: cardBg,
                borderRadius: '18px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                padding: '40px 40px 48px',
                textAlign: 'center',
                borderTop: `6px solid ${heading}`,
            }}>
                <img src={logo} alt="Desi Chowrastha" style={{ width: '100px', height: 'auto', marginBottom: '20px' }} />

                <p style={{
                    fontFamily: "'Bree Serif', serif",
                    color: body,
                    fontSize: '1.25rem',
                    lineHeight: '1.6',
                    margin: '0 0 32px',
                }}>
                    During our soft launch, we're offering a limited menu &mdash; thank you for your patience and support.
                </p>

                <div style={{ textAlign: 'left' }}>
                    {MENU.map((section) => (
                        <div key={section.category} style={{ marginBottom: '28px' }}>
                            <h2 style={{
                                fontFamily: "'Lobster', cursive",
                                color: heading,
                                fontSize: '2rem',
                                margin: '0 0 12px',
                                borderBottom: `2px solid ${divider}`,
                                paddingBottom: '6px',
                            }}>
                                {section.category}
                            </h2>
                            <ul style={{
                                listStyle: 'none',
                                padding: 0,
                                margin: 0,
                                fontFamily: "'Bree Serif', serif",
                                color: body,
                                fontSize: '1.2rem',
                                lineHeight: '2',
                            }}>
                                {section.items.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SoftLaunch;
