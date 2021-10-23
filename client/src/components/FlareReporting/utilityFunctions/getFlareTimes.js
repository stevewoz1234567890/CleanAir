import { MongoClient } from '../mongo';
import moment from 'moment';

async function getFlareTimes(flareId) {
  async function get_start_date() {
    let params = {
      query: {
        flare_id: flare_id,
      },
      options: {
        projection: {
          _id: 0,
          end_time: 1,
        },
        sort: {
          end_time: 1,
        },
      },
    };
    let response = await mongo.find_one(params);
    return response ? moment.utc(response.end_time.toUTCString()) : null;
  }
  async function get_end_date() {
    let params = {
      query: {
        flare_id: flare_id,
      },
      options: {
        projection: {
          _id: 0,
          end_time: 1,
        },
        sort: {
          end_time: -1,
        },
      },
    };

    let response = await mongo.find_one(params);
    return response ? moment.utc(response.end_time.toUTCString()) : null;
  }
  const mongo = new MongoClient('pi_data');
  await mongo.init();
  const flare_id = mongo.object_id(flareId);
  const [start, end] = await Promise.all([get_start_date(), get_end_date()]);
  return { start, end };
}

export default getFlareTimes;
