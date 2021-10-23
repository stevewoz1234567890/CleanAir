import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { PAGE_PERMISSIONS } from '../../constants/permissions';
import usePermissions from '../../utilities/usePermissions';
import styled from 'styled-components';
import { dashboardFlaresSelector, fetchDashboardFlares } from '../../redux/slices/FMT/dashboardFlareSlice';
import Spinner from './Spinner';

const { Sider } = Layout;
const { SubMenu } = Menu;

const SidebarContainer = styled.div`
  background: rgb(0, 123, 193);
  background: linear-gradient(0deg, rgba(0, 53, 94, 1) 0%, rgba(0, 54, 96, 1) 60%,  rgba(0, 123, 193, 1) 100%);

  .ant-menu, .ant-layout-sider {
    background: transparent!important;
    color: #ffffff;
  }

  .ant-menu-item a {
    color: #ffffff;

    &:hover {
      color: #ffffff;
    }
  }

  .ant-menu-submenu-title {
    .ant-menu-submenu-arrow::before, .ant-menu-submenu-arrow::after {
      background: #ffffff!important;
    }
  }

  .ant-menu-item-selected {
    background-color: #007cc3 !important;
  }

  .ant-menu-submenu-title:hover {
    color: #ffffff;
  }

  .ant-menu-submenu-selected {
    color: #ffffff;
  }

`;

const Sidebar = () => {
  const dispatch = useDispatch();
  const { checkPermission } = usePermissions();
  const userState = useSelector((state) => state.user);
  const { loggedIn } = userState;
  const { flares, loading: flaresLoading } = useSelector(dashboardFlaresSelector);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (loggedIn) {
      dispatch(fetchDashboardFlares());
    }
  }, [dispatch, loggedIn])

  if (!loggedIn) {
    return null;
  }

  const sidebarMenu = [
    {
      title: 'Dashboard',
      icon: 'fas fa-chart-line',
      link: '/fmt/dashboard',
      subs: null,
    },
    {
      title: 'Flares',
      icon: 'fas fa-burn fa-lg',
      link: "/home",
      subs: flares.length > 0
        ? flares.map(flare => ({
          title: flare.name,
          icon: null,
          link: `/fmt/status/${flare.flare}`
        }))
        : null,
      loading: flaresLoading
    },
    {
      title: 'Charts',
      icon: 'fas fa-chart-line',
      link: '/fmt/charts',
      subs: null,
    },
    {
      title: 'Data',
      icon: 'fas fa-database',
      link: null,
      subs: [
        {
          title: 'Data Upload',
          icon: null,
          link: '/fmt/data/upload',
          permission: PAGE_PERMISSIONS.DATA_UPLOAD
        },
        {
          title: 'Data Export',
          icon: null,
          link: '/fmt/data/export',
          permission: PAGE_PERMISSIONS.DATA_EXPORT
        },
        {
          title: 'Plant Structure',
          icon: null,
          link: '/fmt/data/plantStructure',
        },
      ],
    },
    {
      title: 'Aggregation',
      icon: 'fas fa-cubes',
      link: null,
      permission: PAGE_PERMISSIONS.AGGREGATION,
      subs: [
        {
          title: 'Cumulative Aggregation',
          icon: null,
          link: '/fmt/aggregation/cumulative',
        },
        {
          title: 'Rolling Aggregation',
          icon: null,
          link: '/fmt/aggregation/rolling',
        },
      ],
    },
    {
      title: 'Formulas',
      icon: 'fas fa-calculator',
      link: '/fmt/formulas',
      subs: null,
    },
    {
      title: 'Parameters',
      icon: 'fas fa-book-open',
      link: null,
      subs: [
        { title: 'Constants', icon: null, link: '/fmt/parameters/constants' },
        { title: 'Raw Data', icon: null, link: '/fmt/parameters/rawData' },
        { title: 'Compounds', icon: null, link: '/fmt/parameters/compounds' },
      ],
    },
    {
      title: 'Events',
      icon: 'fas fa-bell',
      link: null,
      subs: [
        {
          title: 'Event Types',
          icon: null,
          link: '/fmt/events/eventTypes',
        },
        {
          title: 'Subscriptions',
          icon: null,
          link: '/fmt/events/subscriptions',
        },
      ],
    },
    {
      title: 'Reports',
      icon: 'fas fa-columns',
      link: null,
      subs: [
        {
          title: 'Generate Reports',
          icon: null,
          link: '/fmt/reports/generate',
        },
      ],
    },
    {
      title: 'Visible Emissions',
      icon: 'fa fa-history',
      link: '/fmt/visibleEmissions'
    },
    {
      title: 'Flare Mangement Plan',
      icon: 'fas fa-atlas',
      link: '/fmt/fmp',
      subs: null,
    },
  ];
  const iconStyles = {
    pointerEvents: 'none',
    color: '#ffffff',
    width: '33px',
  };
  const textStyles = {
    fontSize: '16px'
  };

  const loadingMenuStyles = {
    fontSize: '16px',
    display: 'flex',
    justifyContent: 'space-between'
  };
  const linkStyles = { fontSize: '14px' };

  const sideBarItems = () => {
    const items = [];
    for (const item of sidebarMenu) {
      if (item.subs) {
        const allowDisplay = item.permission !== undefined ? checkPermission(item.permission) : true;
        if (allowDisplay) {
          const subs = [];
          for (const sub of item.subs) {
            if (checkPermission(sub.permission)) {
              const subEl = (
                <Menu.Item key={sub.title} title={sub.title}>
                  <Link to={sub.link} style={linkStyles}>
                    {sub.title}
                  </Link>
                </Menu.Item>
              );
              subs.push(subEl);
            }
          }
          const element = (
            <SubMenu
              key={item.title}
              title={item.title}
              icon={<i className={item.icon} style={iconStyles} />}
              style={textStyles}
            >
              {subs}
            </SubMenu>
          );
          items.push(element);
        }
      } else {
        const allowDisplay = item.permission !== undefined ? checkPermission(item.permission) : true;
        if (allowDisplay) {
          const element = (
            <Menu.Item
              key={item.title}
              icon={<i className={item.icon} style={iconStyles} />}
              title={item.title}
              style={textStyles}
            >
              <Link to={item.link} style={loadingMenuStyles}>
                {item.title} {item.loading && <Spinner size="sm" />}
              </Link>
            </Menu.Item>
          );
          items.push(element);
        }
      }
    }
    return items;
  };

  return (
    <SidebarContainer>
      <Sider
        breakpoint="lg"
        collapsible
        collapsed={collapsed}
        onCollapse={() => setCollapsed(!collapsed)}
        style={{ textAlign: 'center' }}
        width={266}
        theme="dark"
      >
        <Menu
          defaultSelectedKeys={['FMT']}
          defaultOpenKeys={['FMT']}
          mode="inline"
        >
          <SubMenu
            key="FMT"
            title={
              collapsed ? (
                <span>
                  <i
                    className={'fa fa-burn fa'}
                    style={{
                      pointerEvents: 'none',
                      color: '#ccc',
                      fontSize: '150%',
                    }}
                  />
                </span>
              ) : (
                <div style={textStyles}>
                  Flare Monitoring Tool
                </div>
              )
            }
          >
            {sideBarItems()}
          </SubMenu>
        </Menu>
      </Sider>
    </SidebarContainer>
  );
};

export default Sidebar;
