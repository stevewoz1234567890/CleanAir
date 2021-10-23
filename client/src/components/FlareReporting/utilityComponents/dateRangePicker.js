import React from "react";
import { DatePicker } from "antd";
import moment from "moment";

const { RangePicker } = DatePicker;

const DateRangePicker = (props) => {
  const { setDateRangePicker, ranges } = props;

  const dateRangePickerChange = (value, dateString) => {
    let dateRange;

    if (dateString[0] === "" || dateString[1] === "") {
      dateRange = null;
    } else {
      dateRange = [
        moment(dateString[0], "YY-MM-DD").format("YYYY-MM-DD"),
        moment(dateString[1], "YY-MM-DD").format("YYYY-MM-DD"),
      ];
    }

    setDateRangePicker(dateRange);
  };

  return (
    <span>
      <RangePicker
        format="YY-MM-DD"
        onChange={dateRangePickerChange}
        style={{ maxWidth: "220px", height: "fit-content" }}
        size={"large"}
        ranges={ranges}
      />
    </span>
  );
};

export default DateRangePicker;
