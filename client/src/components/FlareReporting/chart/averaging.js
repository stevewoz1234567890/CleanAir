import React from 'react';
import { Select } from 'antd';
const { Option } = Select;

const Averaging = (props) => {
  const setAveraging = props.setAveraging;

  const changeAveraging = (value) => {
    setAveraging(value);
  };

  return (
    <div
      className="col-lg-3 justify-content-center"
      style={{ display: 'flex' }}
    >
      <div className="card" style={{ width: '100%' }}>
        <h5 className="card-header">Averaging</h5>
        <div className="card-body" style={{ textAlign: 'center' }}>
          <Select
            id="rangeType"
            style={{ width: '50%' }}
            defaultValue="dynamic"
            size={'large'}
            onChange={changeAveraging}
          >
            <Option value="raw">Raw</Option>
            <Option value="daily">Daily</Option>
            <Option value="hourly">Hourly</Option>
            <Option value="dynamic">Dynamic</Option>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default Averaging;
