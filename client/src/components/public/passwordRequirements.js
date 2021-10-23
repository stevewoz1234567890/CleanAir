import React from 'react';
import { Collapse } from 'antd';

const { Panel } = Collapse;

const PasswordRequirements = () => {
  return (
    <Collapse style={{ textAlign: 'left' }} ghost>
      <Panel header="Password Requirements" key="1">
        <div style={{ textAlign: 'left' }}>
          <li>Minimum length: 11</li>
          And at least three of the following:
          <li>English uppercase characters (A through Z)</li>
          <li>English lowercase characters (a through z)</li>
          <li>Base 10 digits (0 through 9)</li>
          <li>OR</li>
          <li>Non-alphabetic characters (e.g. !, $, #, %)</li>
        </div>
      </Panel>
    </Collapse>
  );
};

export default PasswordRequirements;
