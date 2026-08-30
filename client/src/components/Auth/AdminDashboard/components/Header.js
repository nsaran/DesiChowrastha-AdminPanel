import React, { useContext } from 'react';
import { Button, Avatar, Popover, Tooltip } from 'antd';
import ThemeToggle from '../../../common/ThemeToggle';
import { AuthContext } from '../../../../utils/AuthProvider';

const Header = ({ adminEmail, popoverContent }) => {
  const { currentUser } = useContext(AuthContext);

  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  const avatarColor = getRandomColor();
  // Prefer the account's display name, fall back to the email
  const displayName = currentUser?.displayName || currentUser?.email || adminEmail || 'User';
  const avatarLetter = displayName ? displayName.charAt(0).toUpperCase() : '?';

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        <img src="https://iili.io/HeKYJkB.png" alt="Logo" className="admin-logo" />
      </div>
      <div className="admin-header-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ThemeToggle />
        <Popover content={popoverContent} trigger="click" placement="bottomRight">
          <Tooltip title={displayName}>
            <Button type="text" className="admin-avatar-button">
              <Avatar style={{ backgroundColor: avatarColor }}>
                {avatarLetter}
              </Avatar>
            </Button>
          </Tooltip>
        </Popover>
      </div>
    </header>
  );
};

export default Header;
