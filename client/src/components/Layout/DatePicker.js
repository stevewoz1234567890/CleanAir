import React from "react";
import { DatePicker, TimePicker } from "antd";

export const DateSelector = (props) => {
  return <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />;
};

export const TimeSelector = (props) => {
  return (
    <TimePicker
      minuteStep={15}
      format="HH:mm"
      placeholder="Time (optional)"
      style={{ width: "100%" }}
    />
  );
};
