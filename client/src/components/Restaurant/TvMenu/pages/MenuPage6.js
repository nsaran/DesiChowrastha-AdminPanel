import React, { useState, useEffect, useCallback } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../assets/css/tvmenu-styles.css";
import LoaderIcon from '../assets/images/loader_icon.gif';
import { FB_ACCESS_TOKEN, FB_PAGE_ID, FB_API_VERSION, FB_POSTS_LIMIT } from '../../../../config/facebook';
import API_BASE_URL from '../../../../config/api';

/**
 * MenuPage6 - Facebook Posts Image Slideshow
 * 
 * Fetches images from Facebook Graph API posts and displays them
 * as an animated slideshow (GIF-like auto-advancing carousel).
 * 
 * - Pulls post images from the configured Facebook page
 * - Displays them full-screen, cycling automatically every 5 seconds
 * - Smooth crossfade transition between images
 * - Refreshes data from the API every 30 minutes
 * - Falls back to local promo images from _images/promos/ when Facebook API fails
 * 
 * Designed for 55-inch TV display (16:9 aspect ratio)
 */
const MenuPage6 = () => {
    const [images, setImages] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load local promo images from _images/promos/ as fallback
    const loadLocalPromoImages = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/promos`);
            if (response.ok) {
                const filenames = await response.json();
                const promoImages = filenames
                    .filter(name => /\.(jpg|jpeg)$/i.test(name))
                    .map((name, index) => ({
                        id: `promo-${index}`,
                        imageUrl: `/_images/promos/${name}`,
                        message: name.replace(/\.(jpg|jpeg)$/i, '').replace(/[-_]/g, ' ')
                    }));
                if (promoImages.length > 0) {
                    setImages(promoImages);
                    setError(null);
                    return true;
                }
            }
        } catch (promoErr) {
            console.error("Error loading local promo images:", promoErr);
        }
        return false;
    }, []);

    const fetchImages = useCallback(async () => {
        try {
            const url = `https://graph.facebook.com/${FB_API_VERSION}/${FB_PAGE_ID}/posts?fields=id,message,story,created_time,full_picture,permalink_url&limit=${FB_POSTS_LIMIT}&access_token=${FB_ACCESS_TOKEN}`;
            const response = await fetch(url, { method: 'GET' });

            if (!response.ok) {
                throw new Error(`Facebook API error: ${response.status}`);
            }

            const data = await response.json();
            const postImages = (data.data || [])
                .filter(post => post.full_picture)
                .map(post => ({
                    id: post.id,
                    imageUrl: post.full_picture,
                    message: post.message || post.story || '',
                    createdTime: post.created_time,
                    permalink: post.permalink_url
                }));

            if (postImages.length > 0) {
                setImages(postImages);
                setError(null);
            } else {
                // No images from Facebook, try local promos
                const loaded = await loadLocalPromoImages();
                if (!loaded) {
                    setError("No images found in recent posts.");
                }
            }
        } catch (err) {
            console.error("Error fetching Facebook posts:", err);
            // Facebook API failed, fall back to local promo images
            const loaded = await loadLocalPromoImages();
            if (!loaded) {
                setError(err.message);
            }
        }
        setIsLoading(false);
    }, [loadLocalPromoImages]);

    // Fetch images on mount and refresh every 30 minutes
    useEffect(() => {
        fetchImages();
        const intervalId = setInterval(fetchImages, 1800000);
        return () => clearInterval(intervalId);
    }, [fetchImages]);

    // Auto-advance slideshow every 5 seconds
    useEffect(() => {
        if (images.length <= 1) return;

        const slideshowInterval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % images.length);
        }, 5000);

        return () => clearInterval(slideshowInterval);
    }, [images.length]);

    if (isLoading) {
        return (
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                backgroundColor: "#000"
            }}>
                <img src={LoaderIcon} alt="Loading..." style={{ width: '100px', height: '100px' }} />
            </div>
        );
    }

    if (error || images.length === 0) {
        return (
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                backgroundColor: "#000",
                color: "#fff",
                fontSize: "1.5rem",
                fontFamily: "sans-serif"
            }}>
                <p>{error || "No images available."}</p>
            </div>
        );
    }

    return (
        <div style={{
            position: "relative",
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            backgroundColor: "#000"
        }}>
            {images.map((image, index) => (
                <div
                    key={image.id}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        opacity: index === currentIndex ? 1 : 0,
                        transition: "opacity 1s ease-in-out",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center"
                    }}
                >
                    <img
                        src={image.imageUrl}
                        alt={image.message || `Post ${index + 1}`}
                        style={{
                            width: "100vh",
                            height: "100vw",
                            objectFit: "cover",
                            transform: "rotate(90deg)"
                        }}
                    />
                </div>
            ))}

            {/* Progress indicator dots */}
            <div style={{
                position: "absolute",
                right: "20px",
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                zIndex: 10
            }}>
                {images.map((_, index) => (
                    <div
                        key={index}
                        style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            backgroundColor: index === currentIndex ? "#fd590d" : "rgba(255,255,255,0.5)",
                            transition: "background-color 0.3s ease"
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default MenuPage6;
