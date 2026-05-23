import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button, Empty, Typography } from 'antd';
import LoaderIcon from './assets/images/loader_icon.gif';
import {
    fetchCustomMenuItems,
    fetchCustomTvPages,
    resolveTvPagesForDisplay,
} from '../CustomMenu/customMenuApi';

const { Paragraph } = Typography;

const CustomTvMenuLanding = () => {
    const navigate = useNavigate();
    const { restaurantId } = useParams();
    const [pages, setPages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMenuItems, setHasMenuItems] = useState(false);

    useEffect(() => {
        const loadLanding = async () => {
            setIsLoading(true);

            if (!restaurantId) {
                setIsLoading(false);
                return;
            }

            try {
                const [{ categories }, savedPages] = await Promise.all([
                    fetchCustomMenuItems(restaurantId),
                    fetchCustomTvPages(restaurantId),
                ]);

                setHasMenuItems(categories.length > 0);
                setPages(resolveTvPagesForDisplay(savedPages, categories));
            } catch (error) {
                console.error('Error loading custom TV menu landing:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadLanding();
    }, [restaurantId]);

    const handleNavigate = (path) => {
        navigate(`/dashboard/${restaurantId}/${path}`);
    };

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

    return (
        <div className="TV-Menu" style={{ textAlign: 'center', padding: 40 }}>
            <img
                className="dc-logo-img"
                src="https://iili.io/HeKYJkB.png"
                alt="Restaurant Logo"
                style={{ maxWidth: 280, marginBottom: 24 }}
            />

            {!hasMenuItems ? (
                <Empty description="No custom menu items found for this restaurant." />
            ) : pages.length === 0 ? (
                <Empty description="No TV pages available." />
            ) : (
                pages.map((page, index) => (
                    <div key={page.id} style={{ marginBottom: 16 }}>
                        <Button
                            type="primary"
                            size="large"
                            onClick={() => handleNavigate(`customTvMenu/${page.id}`)}
                        >
                            {page.name || `Page ${index + 1}`}
                        </Button>
                    </div>
                ))
            )}

            <Paragraph type="secondary" style={{ marginTop: 24 }}>
                Configure pages and category layout in{' '}
                <Link to={`/dashboard/${restaurantId}/customMenu`}>Custom Menu</Link>.
            </Paragraph>
        </div>
    );
};

export default CustomTvMenuLanding;
