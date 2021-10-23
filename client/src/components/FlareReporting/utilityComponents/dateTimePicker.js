import React from 'react';
import { DatePicker, TimePicker } from 'antd';
import moment from 'moment';

const DateTimePicker = (props) => {
  const setDatePicker = props.setDatePicker;
  const setTimePicker = props.setTimePicker;

  const datePickerChange = (value, dateString) => {
    console.log('datestring', dateString);
    let dateRange;

    if (dateString === '' || !dateString) {
      dateRange = null;
    } else {
      dateRange = moment(dateString, 'YY-MM-DD').format('YYYY-MM-DD');
    }

    setDatePicker(dateRange);
  };

  const timePickerChange = (value, timeString) => {
    console.log('dateTime', timeString);
    let time;

    if (timeString === '' || !timeString) {
      time = null;
    } else {
      time = timeString;
    }

    setTimePicker(time);
  };

  return (
    <div>
      <DatePicker
        format="YY-MM-DD"
        onChange={datePickerChange}
        style={{ width: '100%' }}
      />
      <TimePicker
        minuteStep={15}
        format="HH:mm"
        placeholder="Time (optional)"
        onChange={timePickerChange}
        style={{ width: '100%' }}
        className="mt-3"
      />
    </div>
  );
};

export default DateTimePicker;
