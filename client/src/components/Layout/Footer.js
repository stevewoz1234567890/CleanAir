
import { Layout } from 'antd';
import React from 'react';
import styled from 'styled-components';
const { Footer : RFooter } = Layout;

const FooterWrapper = styled.div`
  background-color: #262626;
  text-align: center;
  color: #6f6f6f;
  font-size: 18px;
  position: fixed;
  bottom: 0;
  padding: 20px 40px;
  width: 100%;
  font-weight: 500;
  height: 70px;
  background-size: contain;

  span {
    text-decoration: underline;
    cursor: pointer;
  }

  @media screen and (max-width: 800px) {
    font-size: 14PX;
    padding: 10px 30px;
  }
`;

export const Footer = () => {
  return (
    <FooterWrapper>
    By using this software you are agreeing to our <span >Terms of Service.</span>
  </FooterWrapper>
  );
};
export default Footer;

