import React from "react";
import NumericEventTypes from "./NumericEventTypes";
import GeneralEventTypes from "./GeneralEventTypes";
import { Alert } from "antd";

const EventTypes = (props) => {

  return (
    <div className="container mt-4">
      <GeneralEventTypes />
      <div className="card mt-4">
        <Alert
          message="'Numeric Event Types' is a preview with pending functionality"
          type="warning"
          showIcon
        />
      </div>
      <NumericEventTypes />
    </div>
  );
};

export default EventTypes;
