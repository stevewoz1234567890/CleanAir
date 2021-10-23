import React from 'react';
import { Layout } from 'antd';
import HeaderRightPanel from './headerRightPanel';

const { Header } = Layout;

const SiteHeader = () => {
  return (
    <div style={{ backgroundColor: '#001529', height: '48px' }}>
      <HeaderRightPanel />
    </div>
  );
};

export default SiteHeader;
