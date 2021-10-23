import React from 'react';

import { Avatar, Menu, Dropdown } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { logout, usernameSelector } from '../../redux/slices/userReducer';

const HeaderRightPanel = () => {
  const dispatch = useDispatch();
  const username = useSelector(usernameSelector);

  const avatarDropdownMenu = (
    <Menu>
      <Menu.Item key="settings">Settings</Menu.Item>
      <Menu.Item key="logout" onClick={() => dispatch(logout())}>
        Logout
      </Menu.Item>
    </Menu>
  );

  const avatar = (
    <Dropdown
      overlay={avatarDropdownMenu}
      icon={<i className="far fa-user"></i>}
    >
      <span>
        <span style={{ paddingRight: '15px', color: '#ccc' }}>{username}</span>
        <Avatar icon={<i className="far fa-user"></i>} />
      </span>
    </Dropdown>
  );

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '10px',
        paddingRight: '25px',
      }}
    >
      {avatar}
    </div>
  );
};

export default HeaderRightPanel;
