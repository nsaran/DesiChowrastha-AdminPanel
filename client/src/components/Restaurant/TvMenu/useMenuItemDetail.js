import React, { useState, useCallback, useRef, useEffect } from 'react';
import MenuItemDetail from './MenuItemDetail';

/**
 * Hook to manage menu item detail modal.
 * Returns detailModal as JSX to render directly.
 * 
 * Usage:
 *   const { setSelectedItem, detailModal } = useMenuItemDetail();
 *   onClick={() => setSelectedItem(item)}
 *   return <>{detailModal} ... </>
 */
export function useMenuItemDetail() {
    const [selectedItem, setSelectedItem] = useState(null);

    const closeModal = useCallback(() => setSelectedItem(null), []);

    const detailModal = selectedItem ? (
        <MenuItemDetail
            item={selectedItem}
            onClose={closeModal}
        />
    ) : null;

    // Backward compat: DetailModal as a no-op wrapper
    const DetailModal = () => detailModal;

    return { selectedItem, setSelectedItem, DetailModal, detailModal };
}
