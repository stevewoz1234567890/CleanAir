import React from 'react';
import styled from 'styled-components';
import FlareCompressors from './flareCompressors';
import FlaringEmissions from './flaringEmissions';
import FlaringEvents from './flaringEvents';
import OtherEmissions from './otherEmissions';

const Banner = styled.div`
  position: absolute;
  width: 100%;
  text-align: center;
  padding: 5px 0;
  background-color: #FF9A00;
`;

const User = () => {
  return (
    <>
      <Banner>This static page is a for demonstration purposes only and does not use real or live data. This feature is coming soon.</Banner>
      <div className="mt-5 mb-4 container">
        <FlaringEmissions />
        <div className="row" style={{ display: 'flex' }}>
          <FlaringEvents />
          <FlareCompressors />
        </div>
        <OtherEmissions />
      </div>
    </>
  );
};

export default User;
