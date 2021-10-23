import React from "react";
import moment from "moment";

import DateRangePicker from "../utilityComponents/dateRangePicker";

const Dates = (props) => {
  const ranges = {
    YTD: [moment().startOf("year"), moment()],
    MTD: [moment().startOf("month"), moment()],
    WTD: [moment().startOf("week"), moment()],
    "Last 7 Days": [moment().add(-7, "days"), moment()],
    "Last 30 Days": [moment().add(-30, "days"), moment()],
    "Last 365 Days": [moment().add(-365, "days"), moment()],
    "Previous Year": [moment().subtract(1, 'years').startOf('year'), moment().subtract(1, 'years').endOf('year')],
  };
  const setDateRangePicker = props.setDateRangePicker;

  return (
    <div
      className="col-lg-3 justify-content-center"
      style={{ display: "flex" }}
    >
      <div className="card " style={{ width: "100%" }}>
        <h5 className="card-header">Dates</h5>
        <div
          className="card-body"
          style={{ display: "flex", justifyContent: "center" }}
        >
          <DateRangePicker setDateRangePicker={setDateRangePicker} ranges={ranges} />
        </div>
      </div>
    </div>
  );
};

export default Dates;
