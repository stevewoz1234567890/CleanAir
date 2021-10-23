import React from "react";
import { Link } from "react-router-dom";
import { Layout, Menu, Switch } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { usernameSelector } from "../../redux/slices/userReducer";
import { logout } from "../../redux/slices/userReducer";
import { setMode } from "../../redux/slices/modeReducer";
import usePermissions from "../../utilities/usePermissions";
import { ADMIN_PERMISSON } from "../../constants/permissions";
import styled from "styled-components";
import { useLocation } from "react-router-dom";
const { SubMenu } = Menu;
const { Header: RHeader } = Layout;

const HeaderWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  height: 65px;
  z-index: 1;
  ${(props) => props.showShadow && "box-shadow: 0px 0px 5px 3px lightgrey;"}

  &>div {
    flex: 1;
    justify-content: flex-end;
  }
`;

const Logo = styled.img`
  width: 180px;
  height: 35px;
  margin-left: 30px;
`;

const MenuWrapper = styled(Menu)`
  border-bottom: 0;
  margin-right: 30px;
  display: flex;
  align-items: center;
  text-align: end;

  @media screen and (max-width: 800px) {
    width: 60px;
    margin-right: 20px;
  }
`;

const MenuLink = styled(Link)`
  color: #4ca0d5 !important;
  font-size: 18px;
  font-weight: 500;

  &:hover {
    text-decoration: none;
  }
`;

export const Header = () => {
  const dispatch = useDispatch();
  const { checkHasDevPermission } = usePermissions();
  const mode = useSelector((state) => state.mode.mode);
  const userState = useSelector((state) => state.user);
  const userName = useSelector(usernameSelector);
  const isDev = checkHasDevPermission();
  const { loggedIn } = userState;
  const location = useLocation();

  const onLogout = () => {
    dispatch(logout());
  };

  const onDevModeChange = (value) => {
    dispatch(setMode(!mode));
  };

  const publicLinks = (
    <MenuWrapper
      theme="light"
      mode="horizontal"
      defaultSelectedKeys={[]}
      key="public-links"
    >
      <Menu.Item key="home">
        <MenuLink to="/">Home</MenuLink>
      </Menu.Item>
      <Menu.Item key="contact">
        <MenuLink to="/contact">Contact</MenuLink>
      </Menu.Item>
      <Menu.Item key="login">
        <MenuLink to="/login">Login</MenuLink>
      </Menu.Item>
    </MenuWrapper>
  );

  const loggedInLinks = (
    <MenuWrapper
      theme="light"
      mode="horizontal"
      defaultSelectedKeys={["account"]}
      key="private-links"
    >
      <Menu.Item key="contact">
        <MenuLink to="/contact">Contact</MenuLink>
      </Menu.Item>

      <SubMenu
        key="account"
        title={userName}
        style={{
          fontSize: "18px",
          color: "#4ca0d5",
          fontWeight: 500,
          display: "flex",
        }}
      >
        <Menu.Item key="myaccount">
          <MenuLink to="/myaccount">Account</MenuLink>
        </Menu.Item>
        <Menu.Item key="logout" onClick={onLogout}>
          Logout
        </Menu.Item>
      </SubMenu>
    </MenuWrapper>
  );

  return (
    <HeaderWrapper showShadow={location.pathname === "/"}>
      <Logo src="/images/CleanCloud_Logo_Color.png" alt="CleanAir"></Logo>
      <div className="d-flex align-items-center">
        {loggedIn && isDev && (
          <Switch
            onChange={onDevModeChange}
            checkedChildren="Dev"
            unCheckedChildren="Live"
            checked={mode}
            className="bg-primary mr-4"
          />
        )}
        {loggedIn ? loggedInLinks : publicLinks}
      </div>
    </HeaderWrapper>
  );
};
export default Header;
