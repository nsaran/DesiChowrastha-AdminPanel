import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';

export const ThemeContext = createContext();

const BRAND = {
    light: '#fd590d',
    dark: '#ff6a1f',
};

const STORAGE_KEY = 'dc-theme-mode';

/**
 * ThemeProvider wraps the app with an Ant Design ConfigProvider and exposes
 * a light/dark toggle. The chosen mode is persisted to localStorage.
 *
 * Brand: Desi Chowrastha orange, Lobster (display) + Bree Serif (body) fonts.
 */
export const ThemeProvider = ({ children }) => {
    const [mode, setMode] = useState(() => {
        return localStorage.getItem(STORAGE_KEY) || 'light';
    });

    // Persist and reflect the mode on <body> for global CSS hooks
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, mode);
        document.body.setAttribute('data-theme', mode);
    }, [mode]);

    const toggleTheme = useCallback(() => {
        setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
    }, []);

    const themeConfig = useMemo(() => {
        const isDark = mode === 'dark';
        const brand = isDark ? BRAND.dark : BRAND.light;

        return {
            algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
            token: {
                colorPrimary: brand,
                colorLink: brand,
                colorLinkHover: isDark ? '#ff9455' : '#d94708',
                colorInfo: brand,
                borderRadius: 10,
                fontFamily: "'Bree Serif', 'Poppins', -apple-system, sans-serif",
            },
            components: {
                Button: { borderRadius: 10, controlHeight: 38 },
                Card: { borderRadiusLG: 14 },
                Table: { borderRadiusLG: 14 },
                Modal: { borderRadiusLG: 14 },
                Input: { borderRadius: 10, controlHeight: 40 },
            },
        };
    }, [mode]);

    return (
        <ThemeContext.Provider value={{ mode, toggleTheme, isDark: mode === 'dark' }}>
            <ConfigProvider theme={themeConfig}>
                {children}
            </ConfigProvider>
        </ThemeContext.Provider>
    );
};
