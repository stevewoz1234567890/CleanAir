const { DateTime } = require('luxon');

/**
 * Takes ISO string like '2017-04-20T11:32:00.000' and outputs '2017-04-20'
 * There is an option to change the delimiter but default is dash
 * @returns string
 */
const ISOStringLongToShort = async (ISOString, newDelimiter=null) => {
  let dt = DateTime.fromISO(ISOString);
  let shortISO = dt.toISODate();
  if (newDelimiter === null) return shortISO;
  let regex = new RegExp('/-','g');
  shortISO = dt.replace(regex, "/")
  return shortISO;
}


module.exports = {
  ISOStringLongToShort,
}