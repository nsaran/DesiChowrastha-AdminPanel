import React from 'react';
import { Button, Avatar, Popover } from 'antd';

const Header = ({ adminEmail, popoverContent }) => {
  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  const avatarColor = getRandomColor();
  const avatarLetter = adminEmail ? adminEmail.charAt(0).toUpperCase() : '?';

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        <img src="https://iili.io/HeKYJkB.png" alt="Logo" className="admin-logo" />
      </div>
      <div className="admin-header-right">
        <Popover content={popoverContent} trigger="click" placement="bottomRight">
          <Button type="text" className="admin-avatar-button">
            <Avatar style={{ backgroundColor: avatarColor }}>
              {avatarLetter}
            </Avatar>
          </Button>
        </Popover>
      </div>
    </header>
  );
};

export default Header;
