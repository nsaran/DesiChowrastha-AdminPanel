import React, { useState, useContext } from "react";
import GoogleFontLoader from "react-google-font";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import "bootstrap/dist/css/bootstrap.min.css";
import "../assets/css/tvmenu-styles.css";
import logo from '../../../../assets/images/dc-nashua-logo.webp';
import API_BASE_URL from '../../../../config/api';
import { useParams } from 'react-router-dom';
import { ThemeContext } from '../../../../utils/ThemeProvider';

/**
 * MenuPage8 - Customer Feedback Page
 * 
 * Allows customers to submit complaints, suggestions, or reviews.
 * Includes a "Write a Google Review" button that redirects to the Google review page.
 * 
 * Designed for 55-inch TV display (16:9 aspect ratio)
 */
const MenuPage8 = () => {
    const { restaurantId } = useParams();
    const { isDark } = useContext(ThemeContext);
    // Theme-aware colors
    const pageBg = isDark ? '#16130f' : '#fff';
    const cardBg = isDark ? '#211c17' : '#fff';
    const inputBg = isDark ? '#2a241d' : '#fff';
    const inputBorder = isDark ? '#3a332a' : '#ddd';
    const textPrimary = isDark ? '#f3ede7' : '#333';
    const textSecondary = isDark ? '#c9beb2' : '#555';
    const textMuted = isDark ? '#a89a8c' : '#777';
    const textFaint = isDark ? '#8f8478' : '#888';
    const infoBoxBg = isDark ? '#2a241d' : '#f9f9f9';
    const [feedbackType, setFeedbackType] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [message, setMessage] = useState("");
    const [subscribePromo, setSubscribePromo] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState("");

    const GOOGLE_REVIEW_URL = "https://g.page/r/CRXCUfBy-TMMEAI/review";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);
        setSendError("");

        if (subscribePromo && !email && !phone) {
            setSendError("Please provide your email or phone number to subscribe for promotions.");
            setSending(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedbackType, name, email, phone, message, subscribePromo, location: restaurantId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send feedback');
            }

            setSubmitted(true);
            setTimeout(() => {
                setSubmitted(false);
                setFeedbackType("");
                setName("");
                setEmail("");
                setPhone("");
                setMessage("");
                setSubscribePromo(false);
            }, 5000);
        } catch (error) {
            console.error("Error sending feedback:", error);
            setSendError("Unable to send feedback. Please try again.");
            setTimeout(() => setSendError(""), 5000);
        } finally {
            setSending(false);
        }
    };

    const containerStyle = {
        position: 'relative',
        minHeight: '100vh',
        backgroundColor: pageBg,
    };

    const cardStyle = {
        backgroundColor: cardBg,
        borderRadius: '12px',
        padding: '30px',
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.1)',
        border: '2px solid #fd590d',
    };

    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        fontSize: '1.1rem',
        borderRadius: '8px',
        border: `1px solid ${inputBorder}`,
        backgroundColor: inputBg,
        color: textPrimary,
        marginBottom: '15px',
        fontFamily: "'Bree Serif', serif",
        outline: 'none',
    };

    const selectStyle = {
        ...inputStyle,
        cursor: 'pointer',
    };

    const textareaStyle = {
        ...inputStyle,
        minHeight: '120px',
        resize: 'vertical',
    };

    const submitBtnStyle = {
        width: '100%',
        padding: '14px',
        fontSize: '1.3rem',
        fontFamily: "'Lobster', cursive",
        backgroundColor: '#fd590d',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        marginTop: '10px',
    };

    const googleReviewBtnStyle = {
        display: 'inline-block',
        width: '100%',
        padding: '16px',
        fontSize: '1.4rem',
        fontFamily: "'Lobster', cursive",
        backgroundColor: '#4285F4',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'center',
        textDecoration: 'none',
        marginTop: '20px',
    };

    const thankYouStyle = {
        textAlign: 'center',
        padding: '40px',
        fontFamily: "'Lobster', cursive",
        fontSize: '2rem',
        color: '#28a745',
    };

    return (
        <div style={containerStyle}>
            {/* Background watermark logo */}
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
                    backgroundSize: '600px auto',
                    opacity: 0.1,
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />
            <Container fluid style={{ padding: '2rem', position: 'relative', zIndex: 1 }}>
                <GoogleFontLoader fonts={[{ font: "Lobster" }, { font: "Bree Serif" }]} />

                {/* Header */}
                <Row className="justify-content-center" style={{ marginBottom: '20px' }}>
                    <Col xs={12} style={{ textAlign: 'center' }}>
                        <h1 style={{
                            fontFamily: "'Lobster', cursive",
                            fontSize: '3rem',
                            color: '#fd590d',
                            marginBottom: '5px',
                        }}>
                            We Value Your Feedback
                        </h1>
                        <p style={{
                            fontFamily: "'Bree Serif', serif",
                            fontSize: '1.3rem',
                            color: textSecondary,
                        }}>
                            Your opinions help us serve you better!
                        </p>
                        <p style={{
                            fontFamily: "'Bree Serif', serif",
                            fontSize: '1.1rem',
                            color: textMuted,
                        }}>
                            Your feedback will be shared directly with our management team and they will get back to you personally.
                        </p>
                    </Col>
                </Row>

                <Row className="justify-content-center">
                    {/* Left Column: Feedback Form */}
                    <Col md={6} style={{ maxWidth: '550px', marginBottom: '30px' }}>
                        <div style={cardStyle}>
                            <h2 style={{
                                fontFamily: "'Lobster', cursive",
                                fontSize: '2rem',
                                color: '#fd590d',
                                textAlign: 'center',
                                marginBottom: '20px',
                            }}>
                                Share Your Experience
                            </h2>

                            {submitted ? (
                                <div style={thankYouStyle}>
                                    <p>🎉 Thank You!</p>
                                    <p style={{ fontSize: '1.2rem', color: textSecondary }}>
                                        Your feedback has been received. We appreciate your time!
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit}>
                                    <select
                                        style={selectStyle}
                                        value={feedbackType}
                                        onChange={(e) => setFeedbackType(e.target.value)}
                                        required
                                        aria-label="Feedback type"
                                    >
                                        <option value="" disabled>Select Feedback Type</option>
                                        <option value="complaint">Complaint</option>
                                        <option value="suggestion">Suggestion</option>
                                        <option value="review">Review</option>
                                        <option value="compliment">Compliment</option>
                                    </select>

                                    <input
                                        type="text"
                                        style={inputStyle}
                                        placeholder="Your Name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        aria-label="Your name"
                                    />

                                    <p style={{ fontSize: '0.9rem', color: textFaint, fontStyle: 'italic', marginBottom: '10px' }}>
                                        Please provide your email or phone number so we can get back to you.
                                    </p>

                                    <input
                                        type="email"
                                        style={inputStyle}
                                        placeholder="Your Email (optional)"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        aria-label="Your email"
                                    />

                                    <input
                                        type="tel"
                                        style={inputStyle}
                                        placeholder="Your Phone Number (optional)"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        aria-label="Your phone number"
                                    />

                                    <textarea
                                        style={textareaStyle}
                                        placeholder="Tell us more..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        required
                                        aria-label="Your feedback message"
                                    />

                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '1rem',
                                        fontFamily: "'Bree Serif', serif",
                                        color: textSecondary,
                                        marginBottom: '15px',
                                        cursor: 'pointer',
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={subscribePromo}
                                            onChange={(e) => setSubscribePromo(e.target.checked)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                            aria-label="Subscribe to promotions"
                                        />
                                        Yes, I'd like to receive promotions, special offers, and updates!
                                    </label>

                                    <button type="submit" style={submitBtnStyle} disabled={sending}>
                                        {sending ? 'Sending...' : 'Submit Feedback'}
                                    </button>
                                    {sendError && (
                                        <p style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '10px', fontSize: '0.9rem' }}>
                                            {sendError}
                                        </p>
                                    )}
                                </form>
                            )}
                        </div>
                    </Col>

                    {/* Right Column: Google Review CTA */}
                    <Col md={6} style={{ maxWidth: '550px', marginBottom: '30px' }}>
                        <div style={{ ...cardStyle, textAlign: 'center' }}>
                            <h2 style={{
                                fontFamily: "'Lobster', cursive",
                                fontSize: '2rem',
                                color: '#fd590d',
                                marginBottom: '15px',
                            }}>
                                Love Our Food?
                            </h2>
                            <p style={{
                                fontFamily: "'Bree Serif', serif",
                                fontSize: '1.2rem',
                                color: textPrimary,
                                marginBottom: '10px',
                            }}>
                                Leave us a Google Review and let others know about your experience!
                            </p>
                            <p style={{
                                fontSize: '4rem',
                                marginBottom: '10px',
                            }}>
                                ⭐⭐⭐⭐⭐
                            </p>
                            <p style={{
                                fontFamily: "'Bree Serif', serif",
                                fontSize: '1rem',
                                color: textMuted,
                                marginBottom: '20px',
                            }}>
                                Your review helps us grow and serve our community better.
                                It only takes a moment!
                            </p>
                            <a
                                href={GOOGLE_REVIEW_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={googleReviewBtnStyle}
                            >
                                ✍️ Write a Google Review
                            </a>

                            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: infoBoxBg, borderRadius: '8px' }}>
                                <h3 style={{
                                    fontFamily: "'Lobster', cursive",
                                    fontSize: '1.5rem',
                                    color: '#fd590d',
                                    marginBottom: '10px',
                                }}>
                                    Have a Complaint?
                                </h3>
                                <p style={{
                                    fontFamily: "'Bree Serif', serif",
                                    fontSize: '1rem',
                                    color: textSecondary,
                                }}>
                                    We're sorry if something wasn't right. Please use the feedback form
                                    to let us know, and we'll do our best to make it right!
                                </p>
                            </div>
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default MenuPage8;
