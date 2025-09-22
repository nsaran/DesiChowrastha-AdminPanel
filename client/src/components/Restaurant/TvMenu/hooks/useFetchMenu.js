import { useState, useEffect } from 'react';
import axios from 'axios';

export const useFetchMenu = (url) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        axios.get(url)
            .then((response) => {
                const menuData = response.data[0].menuGroups;
                const quarterLength = Math.ceil(menuData.length / 4);
                const splitData = {
                    page1Data: menuData.slice(0, quarterLength),
                    page2Data: menuData.slice(quarterLength, 2 * quarterLength),
                    page3Data: menuData.slice(2 * quarterLength, 3 * quarterLength),
                    page4Data: menuData.slice(3 * quarterLength)
                };
                setData(splitData);
                setLoading(false);
            })
            .catch((error) => {
                setError(error);
                setLoading(false);
            });
    }, [url]);

    return { data, loading, error };
};
