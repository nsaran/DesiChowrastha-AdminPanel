import { firestore } from '../../../config/firebase';

export const getRestaurantMenuItemsPathPrefix = (restaurantId) =>
    `restaurants/${restaurantId}/custom menu/`;

export const normalizeItemType = (raw) => {
    const value = String(raw || '').trim().toLowerCase();
    if (value === 'veg' || value === 'vegetarian') {
        return 'Veg';
    }
    return 'Non-Veg';
};

const mapItemDocToMenuRow = (itemDoc) => {
    const itemData = itemDoc.data();
    const categoryName = itemDoc.ref.parent.parent.id;

    return {
        id: itemDoc.id,
        name: itemData.name || itemDoc.id,
        category: categoryName,
        itemType: normalizeItemType(itemData.itemType),
        price: itemData.price,
        availability: itemData.availability || 'available',
    };
};

export const fetchCustomMenuItems = async (restaurantId) => {
    const menuPathPrefix = getRestaurantMenuItemsPathPrefix(restaurantId);
    const itemsSnapshot = await firestore.collectionGroup('items').get();
    const restaurantItems = itemsSnapshot.docs.filter((itemDoc) =>
        itemDoc.ref.path.startsWith(menuPathPrefix)
    );

    const menuItems = restaurantItems.map(mapItemDocToMenuRow);
    const categories = [];

    menuItems.forEach((item) => {
        if (!categories.includes(item.category)) {
            categories.push(item.category);
        }
    });

    return { menuItems, categories };
};

const TV_CONFIG_DOC_ID = '_tvMenuConfig';

export const getCustomTvMenuConfigRef = (restaurantId) =>
    firestore
        .collection('restaurants')
        .doc(restaurantId)
        .collection('custom menu')
        .doc(TV_CONFIG_DOC_ID);

const getLegacyCustomTvMenuConfigRef = (restaurantId) =>
    firestore
        .collection('restaurants')
        .doc(restaurantId)
        .collection('settings')
        .doc('customTvMenu');

export const fetchCustomTvPages = async (restaurantId) => {
    const configDoc = await getCustomTvMenuConfigRef(restaurantId).get();
    if (configDoc.exists) {
        return configDoc.data().pages || [];
    }

    const legacyDoc = await getLegacyCustomTvMenuConfigRef(restaurantId).get();
    if (legacyDoc.exists) {
        return legacyDoc.data().pages || [];
    }

    return [];
};

export const saveCustomTvPages = async (restaurantId, pages) => {
    const serializedPages = serializeTvPagesForSave(pages);

    if (!serializedPages.length && (pages || []).length > 0) {
        throw new Error('No valid TV pages to save. Each page must have an id and name.');
    }

    await getCustomTvMenuConfigRef(restaurantId).set({
        pages: serializedPages,
        updatedAt: new Date().toISOString(),
    });
};

export const COLUMN_LAYOUT_OPTIONS = [1, 2, 3, 4];

export const splitCategoriesAcrossColumns = (categories, columnLayout) => {
    const layout = Math.min(Math.max(columnLayout, 1), 4);
    const columns = Array.from({ length: layout }, () => []);

    categories.forEach((category, index) => {
        columns[index % layout].push(category);
    });

    return columns;
};

const parseStoredColumnCategories = (page, columnLayout) => {
    let parsedColumns = [];

    if (Array.isArray(page.columns)) {
        parsedColumns = page.columns.map((column) =>
            Array.isArray(column?.categories) ? column.categories.filter(Boolean) : []
        );
    } else if (Array.isArray(page.columnCategories)) {
        parsedColumns = page.columnCategories.map((column) => {
            if (Array.isArray(column)) {
                return column.filter(Boolean);
            }
            if (column && Array.isArray(column.categories)) {
                return column.categories.filter(Boolean);
            }
            return [];
        });
    }

    const columnCategories = parsedColumns.slice(0, columnLayout);
    while (columnCategories.length < columnLayout) {
        columnCategories.push([]);
    }

    return columnCategories;
};

const toColumnLayout = (value) => {
    const layout = Number(value);
    if (!Number.isFinite(layout)) {
        return 2;
    }
    return Math.min(Math.max(Math.round(layout), 1), 4);
};

export const normalizeTvPage = (page) => {
    if (!page) {
        return page;
    }

    const columnLayout = toColumnLayout(page.columnLayout);
    const hasStoredColumns =
        Array.isArray(page.columns) || Array.isArray(page.columnCategories);

    if (hasStoredColumns) {
        return {
            id: page.id,
            name: page.name || '',
            columnLayout,
            columnCategories: parseStoredColumnCategories(page, columnLayout),
        };
    }

    const leftCategories = Array.isArray(page.leftCategories) ? page.leftCategories : [];
    const rightCategories = Array.isArray(page.rightCategories) ? page.rightCategories : [];
    const legacyCategories = [...leftCategories, ...rightCategories];

    return {
        id: page.id,
        name: page.name || '',
        columnLayout,
        columnCategories: splitCategoriesAcrossColumns(legacyCategories, columnLayout),
    };
};

export const normalizeTvPages = (pages) =>
    (pages || []).map(normalizeTvPage).filter((page) => page && page.id);

export const serializeTvPageForSave = (page) => {
    const normalized = normalizeTvPage(page);
    if (!normalized?.id) {
        return null;
    }

    return {
        id: String(normalized.id),
        name: String(normalized.name || '').trim(),
        columnLayout: normalized.columnLayout,
        columns: normalized.columnCategories.map((categories) => ({
            categories: (Array.isArray(categories) ? categories : []).map(String),
        })),
    };
};

export const serializeTvPagesForSave = (pages) =>
    normalizeTvPages(pages)
        .map(serializeTvPageForSave)
        .filter(Boolean);

export const buildDefaultTvPages = (categories) => {
    if (!categories.length) {
        return [];
    }

    const columnLayout = 2;
    return [
        normalizeTvPage({
            id: 'page-1',
            name: 'Page 1',
            columnLayout,
            columnCategories: splitCategoriesAcrossColumns(categories, columnLayout),
        }),
    ];
};

export const resolveTvPagesForDisplay = (savedPages, allCategories) => {
    if (savedPages && savedPages.length > 0) {
        return normalizeTvPages(savedPages);
    }
    return buildDefaultTvPages(allCategories);
};

export const getPageColumnCategories = (page) => {
    const normalized = normalizeTvPage(page);
    return normalized.columnCategories.slice(0, normalized.columnLayout);
};

export const getAssignedCategories = (pages) => {
    const assigned = new Set();
    normalizeTvPages(pages).forEach((page) => {
        getPageColumnCategories(page).forEach((column) => {
            column.forEach((cat) => assigned.add(cat));
        });
    });
    return assigned;
};

export const getUnassignedCategories = (pages, allCategories) =>
    allCategories.filter((category) => !getAssignedCategories(pages).has(category));
