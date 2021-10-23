import React from 'react';
import FlareConnectionsDatabase from './flareConnectionsDatabase';
import FlarePlan from './flarePlan';

const FMP = () => {
  return (
    <div className="mt-2 mb-4 container">
      <FlarePlan />
      <FlareConnectionsDatabase />
    </div>
  );
};

export default FMP;
