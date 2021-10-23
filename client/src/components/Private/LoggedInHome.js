import React from 'react'
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { usernameSelector } from '../../redux/slices/userReducer';

const WelcomeWrapper = styled.h2`
  margin-top: 10%;
  font-size: 40px;
`;

const LoggedInHome = (props) => {
    const userName = useSelector(usernameSelector);
    return <WelcomeWrapper>Welcome {userName}</WelcomeWrapper>
}

export default LoggedInHome