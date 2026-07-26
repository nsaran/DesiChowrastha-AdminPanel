import { useEffect, useCallback } from 'react';
import API_BASE_URL from '../../../config/api';

/**
 * Hook to listen for real-time stock updates via SSE.
 * When an item goes out of stock or back in stock, calls the provided callback.
 * 
 * @param {string} restaurantId - Location name (Westborough, Nashua)
 * @param {function} onStockUpdate - Callback: ({ type, itemGuid, itemName }) => void
 */
export function useStockUpdates(restaurantId, onStockUpdate) {
    const stableCallback = useCallback(onStockUpdate, []);

    useEffect(() => {
        const sseBaseUrl = API_BASE_URL || window.location.origin;
        const eventSource = new EventSource(`${sseBaseUrl}/api/stock/stream?location=${restaurantId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'out_of_stock' || data.type === 'in_stock') {
                stableCallback(data);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => eventSource.close();
    }, [restaurantId, stableCallback]);
}
