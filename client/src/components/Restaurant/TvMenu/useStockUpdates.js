import { useEffect, useCallback, useRef } from 'react';
import API_BASE_URL from '../../../config/api';

/**
 * Hook to listen for real-time stock updates via SSE.
 * Falls back to polling the menu API every 5 minutes if SSE fails,
 * and calls onStockUpdate with the full refreshed menu data.
 * 
 * @param {string} restaurantId - Location name (Westborough, Nashua)
 * @param {function} onStockUpdate - Callback: ({ type, itemGuid, itemName }) => void
 * @param {function} setMenu - setState function to update menu directly on poll fallback
 */
export function useStockUpdates(restaurantId, onStockUpdate, setMenu) {
    const stableCallback = useCallback(onStockUpdate, []);
    const pollIntervalRef = useRef(null);

    useEffect(() => {
        const sseBaseUrl = API_BASE_URL || window.location.origin;
        let eventSource;

        // Fallback: re-fetch full menu to get updated stock
        const pollMenuForStock = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/menu?location=${restaurantId}`);
                const data = await response.json();
                if (setMenu && data) {
                    setMenu(data);
                }
            } catch (e) {
                // silently fail
            }
        };

        try {
            eventSource = new EventSource(`${sseBaseUrl}/api/stock/stream?location=${restaurantId}`);

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'out_of_stock' || data.type === 'in_stock') {
                    stableCallback(data);
                }
            };

            eventSource.onerror = () => {
                eventSource.close();
                // SSE failed — fall back to polling every 5 minutes
                if (!pollIntervalRef.current) {
                    pollIntervalRef.current = setInterval(pollMenuForStock, 300000);
                }
            };
        } catch (e) {
            // SSE not supported — use polling
            if (!pollIntervalRef.current) {
                pollIntervalRef.current = setInterval(pollMenuForStock, 300000);
            }
        }

        return () => {
            if (eventSource) eventSource.close();
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [restaurantId, stableCallback, setMenu]);
}
