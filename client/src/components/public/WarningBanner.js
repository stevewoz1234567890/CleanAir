import React from 'react';
import { Card } from 'antd';

const WarningBanner = () => {
  return (
    <Card
      title={
        <center>
          <span style={{ fontSize: '18px' }}>NOTICE</span>
        </center>
      }
      bordered={false}
      style={{
        borderRadius: '10px',
        border: '2px solid black',
        backgroundColor: '#FF9A00',
      }}
      className="mb-4"
    >
      This software is the property of the CleanAir Engineering Inc and is for
      authorized use only.  By using this software, all users acknowledge notice
      of, and agree to comply with, the Acceptable Use Policy.{' '}
      <a
        href="https://www.cleanair.com/"
        style={{ color: '#0065ff' }}
        target="_blank"
        rel="noreferrer"
      >
        Read the Acceptable Use Police by clicking here.
      </a>{' '}
      Unauthorized or improper use of this system may result in administrative
      disciplinary action, civil charges/criminal penalties, and/or other
      sanctions. By continuing to use this software you indicate your awareness
      of and consent to these terms and conditions of use.{' '}
      <b>LEAVE IMMEDIATELY</b> if you do not agree to the conditions stated in
      this warning.
    </Card>
  );
};

export default WarningBanner;
