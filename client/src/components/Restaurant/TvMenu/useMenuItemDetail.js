import { useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import MenuItemDetail from './MenuItemDetail';

/**
 * Hook to manage menu item detail modal.
 * Uses a portal to render the modal outside the component tree,
 * preventing it from being affected by parent re-renders.
 */
export function useMenuItemDetail() {
    const [selectedItem, setSelectedItem] = useState(null);

    const closeModal = useCallback(() => setSelectedItem(null), []);

    // Render modal via portal to document.body so parent re-renders don't affect it
    const detailModal = selectedItem
        ? ReactDOM.createPortal(
            <MenuItemDetail item={selectedItem} onClose={closeModal} />,
            document.body
          )
        : null;

    return { selectedItem, setSelectedItem, detailModal };
}
