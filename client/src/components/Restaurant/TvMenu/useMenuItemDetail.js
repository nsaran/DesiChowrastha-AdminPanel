import React, { useState } from 'react';
import MenuItemDetail from './MenuItemDetail';

/**
 * Hook to manage menu item detail modal.
 * 
 * Usage in any page:
 *   const { selectedItem, setSelectedItem, DetailModal } = useMenuItemDetail();
 *   
 *   // In your item click handler:
 *   onClick={() => setSelectedItem({ id, name, price, itemType, isAvailable })}
 *   
 *   // In your render:
 *   <DetailModal />
 */
export function useMenuItemDetail() {
    const [selectedItem, setSelectedItem] = useState(null);

    const DetailModal = () => (
        selectedItem ? (
            <MenuItemDetail
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
            />
        ) : null
    );

    return { selectedItem, setSelectedItem, DetailModal };
}
