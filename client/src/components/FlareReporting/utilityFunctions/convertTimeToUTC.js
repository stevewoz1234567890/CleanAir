import moment from 'moment';
import 'moment-timezone';

const convertTimetoUTC = (time_string) => {
  const time = moment.tz(time_string, moment.tz.guess());
  time.format();
  return time;
};

export default convertTimetoUTC;
