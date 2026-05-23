import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import GoogleFontLoader from 'react-google-font';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/css/custom-tv-menu-styles.css';
import LoaderIcon from './assets/images/loader_icon.gif';
import VEG from './assets/images/veg.png';
import NONVEG from './assets/images/nonveg.png';
import EGG from './assets/images/egg.png';
import {
    fetchCustomMenuItems,
    fetchCustomTvPages,
    resolveTvPagesForDisplay,
    getPageColumnCategories,
} from '../CustomMenu/customMenuApi';

const getItemTypeImage = (itemType) => {
    const value = String(itemType || '').trim().toLowerCase();
    if (value === 'veg' || value === 'vegetarian') {
        return VEG;
    }
    if (value === 'non-veg' || value === 'nonveg' || value === 'non veg') {
        return NONVEG;
    }
    if (value === 'egg') {
        return EGG;
    }
    return null;
};

const CustomTvMenuPageView = () => {
    const { restaurantId, pageId } = useParams();
    const [menu, setMenu] = useState([]);
    const [pageConfig, setPageConfig] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadPage = async () => {
            setIsLoading(true);
            setMenu([]);
            setPageConfig(null);

            if (!restaurantId || !pageId) {
                setIsLoading(false);
                return;
            }

            try {
                const [{ menuItems, categories }, savedPages] = await Promise.all([
                    fetchCustomMenuItems(restaurantId),
                    fetchCustomTvPages(restaurantId),
                ]);

                const pages = resolveTvPagesForDisplay(savedPages, categories);
                const selectedPage = pages.find((page) => page.id === pageId);

                setMenu(menuItems);
                setPageConfig(selectedPage || null);
            } catch (error) {
                console.error('Error loading custom TV menu page:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadPage();
    }, [restaurantId, pageId]);

    const renderMenuItems = (category) =>
        menu
            .filter((item) => item.category === category)
            .map((item) => {
                const itemTypeImage = getItemTypeImage(item.itemType);
                const isAvailable = item.availability === 'available';

                return (
                    <div key={`${category}-${item.id}`} className="menu-item">
                        <h4 className={!isAvailable ? 'sold-out-menu-item-name' : ''}>
                            {itemTypeImage && (
                                <img
                                    src={itemTypeImage}
                                    alt={item.name}
                                    className="menu-item-icon"
                                />
                            )}
                            <span>{item.name}</span>
                            <span className="menu-item-price">
                                {isAvailable
                                    ? `$ ${parseFloat(item.price).toFixed(2)}`
                                    : 'N/A'}
                            </span>
                        </h4>
                    </div>
                );
            });

    const renderColumn = (categoryList) =>
        (categoryList || []).map((category) => (
            <div key={category}>
                <h2 className="cat-title" style={{ fontFamily: 'Lobster' }}>
                    {category}
                </h2>
                {renderMenuItems(category)}
            </div>
        ));

    if (isLoading) {
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                }}
            >
                <img src={LoaderIcon} alt="Loading..." style={{ width: 100, height: 100 }} />
            </div>
        );
    }

    if (!pageConfig) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <h2>TV page not found</h2>
                <p>
                    <Link to={`/dashboard/${restaurantId}/customTvMenu`}>
                        Back to Custom TV Menu
                    </Link>
                </p>
            </div>
        );
    }

    const columnLayout = pageConfig.columnLayout || 2;
    const columnCategories = getPageColumnCategories(pageConfig);
    const bootstrapColSize = Math.floor(12 / columnLayout);

    return (
        <Container fluid>
            <GoogleFontLoader
                fonts={[{ font: 'Lobster' }, { font: 'Bree Serif' }]}
            />
            <Row>
                {columnCategories.map((categories, columnIndex) => (
                    <Col
                        key={`col-${columnIndex}`}
                        xs={12}
                        md={bootstrapColSize}
                        lg={bootstrapColSize}
                    >
                        {renderColumn(categories)}
                    </Col>
                ))}
            </Row>
        </Container>
    );
};

export default CustomTvMenuPageView;
