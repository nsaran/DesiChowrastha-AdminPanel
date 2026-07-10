import React from 'react';

/**
 * ErrorBoundary for TV Menu Pages
 * 
 * Catches uncaught runtime errors and displays a friendly message
 * instead of a white/blank screen on the TV display.
 * Auto-retries by reloading the page after 30 seconds.
 */
class TvMenuErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("TvMenu ErrorBoundary caught:", error, errorInfo);
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.hasError && !prevState.hasError) {
            // Auto-reload after 30 seconds to recover
            this.reloadTimer = setTimeout(() => {
                window.location.reload();
            }, 30000);
        }
    }

    componentWillUnmount() {
        if (this.reloadTimer) {
            clearTimeout(this.reloadTimer);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    backgroundColor: '#fff',
                    fontFamily: 'sans-serif',
                    textAlign: 'center',
                    padding: '40px',
                }}>
                    <h1 style={{ fontSize: '3rem', color: '#fd590d', marginBottom: '20px' }}>
                        Desi Chowrastha
                    </h1>
                    <p style={{ fontSize: '1.5rem', color: '#555', marginBottom: '10px' }}>
                        Menu is refreshing...
                    </p>
                    <p style={{ fontSize: '1rem', color: '#999' }}>
                        This page will reload automatically in a few seconds.
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default TvMenuErrorBoundary;
