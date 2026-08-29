import React, { useContext } from 'react';
import { Switch, Tooltip } from 'antd';
import { BulbOutlined, BulbFilled } from '@ant-design/icons';
import { ThemeContext } from '../../utils/ThemeProvider';

/**
 * A light/dark theme toggle switch. Reads and updates the global theme mode.
 */
const ThemeToggle = () => {
    const { isDark, toggleTheme } = useContext(ThemeContext);

    return (
        <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <Switch
                checked={isDark}
                onChange={toggleTheme}
                checkedChildren={<BulbFilled />}
                unCheckedChildren={<BulbOutlined />}
            />
        </Tooltip>
    );
};

export default ThemeToggle;
