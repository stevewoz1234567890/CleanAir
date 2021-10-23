import moment from 'moment';

const ranges = (flareTimes) => {
  const start = moment(new Date(flareTimes[0].start));
  const end = moment(new Date(flareTimes[0].end)).add(1, 'days');

  const defaultRanges = {
    Today: [moment(), moment()],
    Yesterday: [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
    'Last 7 Days': [end.clone().subtract(6, 'days'), end.clone()],
    'Last 30 Days': [end.clone().subtract(29, 'days'), end.clone()],
    'Last 90 Days': [end.clone().subtract(89, 'days'), end.clone()],
    'Last 180 Days': [end.clone().subtract(179, 'days'), end.clone()],
    'Last 365 Days': [end.clone().subtract(364, 'days'), end.clone()],

    'Current Week': [moment().startOf('week'), moment()],
    'Current Month': [moment().startOf('month'), moment().endOf('month')],
    'Current Quarter': [
      moment().quarter(moment().quarter()).startOf('quarter'),
      moment().quarter(moment().quarter()).endOf('quarter'),
    ],
    'Current Semester': [
      moment().month() >= 5
        ? moment().startOf('year').add(6, 'months')
        : moment().startOf('year'),
      moment().month() >= 5
        ? moment().endOf('year')
        : moment().startOf('year').add(6, 'months').subtract(1, 'day'),
    ],
    'Current Year': [moment().startOf('year'), moment()],
    'Previous Week': [moment().subtract(1, 'week'), moment()],
    'Previous Month': [
      moment().startOf('month').subtract(1, 'month'),
      moment().startOf('month').subtract(1, 'month').endOf('month'),
    ],
    'Previous Quarter': [
      moment()
        .quarter(moment().quarter())
        .subtract(1, 'quarter')
        .startOf('quarter'),
      moment()
        .quarter(moment().quarter())
        .subtract(1, 'quarter')
        .endOf('quarter'),
    ],
    'Previous Semester': [
      moment().month() >= 5
        ? moment().startOf('year')
        : moment().startOf('year').subtract(6, 'month'),
      moment().month() >= 5
        ? moment().startOf('year').add(6, 'months').subtract(1, 'day')
        : moment().startOf('year').subtract(6, 'month').endOf('year'),
    ],
    'Previous Year': [
      moment().startOf('year').subtract(1, 'year'),
      moment().startOf('year').subtract(1, 'year').endOf('year'),
    ],
  };

  let dates = {};
  if (flareTimes) {
    for (let range in defaultRanges) {
      if (defaultRanges[range][0] >= start && defaultRanges[range][1] <= end) {
        dates[range] = defaultRanges[range];
      }
    }
  }

  return dates;
};

export default ranges;
