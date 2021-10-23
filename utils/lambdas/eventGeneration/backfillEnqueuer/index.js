const MongoData = require('./MongoData');
const { ObjectId } = require("mongodb");
const AWS = require('aws-sdk');
const SQS = new AWS.SQS({ region: 'us-east-1' });
const { v4: uuidv4 } = require('uuid');

const IS_DEV_LOCAL_ENV = false;
const SEND_TO_SQS_MICRO = true;
const QUEUE_ALL = false;

let BACKFILLER = null;

function getErrorObject(error, path) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  return { printPath: path, error };
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + (minutes * 60000))
}

class BackfillerInvoker {
  constructor() {
    this.mongo = new MongoData();
  }

  async initClass() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await this.mongo.initClient();
          return resolve();
        }
        catch (error) { 
          console.log(error)
          return reject(getErrorObject(error, "Backfiller.initClass(): ")) }
      })();
    });
  }

  async updateData() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          this.orgs = await this.mongo.getOrgs();
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "Backfiller.updateData")) }
      })();
    })
  }

  async createRefreshTickets() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let thirtyMinAgo = new Date(Date.now() - (60000 * 30));
          let refreshTickets = [];
          for (let org of this.orgs) {
            if (!org.hasOwnProperty("backfillQueue")) continue;
            for (let item of org.backfillQueue) {
              try {
                let isEventsQueued = QUEUE_ALL ? true : !item.isEventsQueued
                if (item.isCalcsComplete["1"] && item.isCalcsComplete["15"] && isEventsQueued) {
                  if (item.isCalcsComplete.lastCalc && item.isCalcsComplete.lastCalc < thirtyMinAgo) {
                    refreshTickets.push({
                      startDate: item.oldestDate.getTime(),
                      endDate: item.newestDate.getTime(),
                      org: org._id.toString(),
                      _id: item._id ? item._id.toString() : null,
                    });
                  }
                }
              } catch (error) {
                console.log("handled error: ", error)
              }
            }
          }
          return resolve(refreshTickets);
        } catch (err) { return reject(getErrorObject(err, "Backfiller.createRefreshTickets")) }
      })();
    })
  }

  async enqueueRefreshTickets(tickets) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (tickets.length === 0) return resolve();
          let batches = [];
          for (let ticket of tickets) { //must to iteratively becuause order matters FIFO, 1-min then quarter hour
            var sqsParams = {
              QueueUrl: process.env.BACKFILL_EVENT_FIFO_QUEUE,
              Entries: []
            };
            sqsParams.Entries.push({
              Id: uuidv4(),
              MessageGroupId: uuidv4(),
              MessageDeduplicationId: uuidv4(),
              MessageBody: JSON.stringify(ticket)
            });
            if (SEND_TO_SQS_MICRO) await SQS.sendMessageBatch(sqsParams).promise();
          }
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "Backfiller.enqueueRefreshTickets")) }
      })();
    })
  }

  /**
   * Flag as queued
   * @returns 
   */
  async updateOrgInfo() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          for (let org of this.orgs) {
            if (!org.hasOwnProperty("backfillQueue")) continue;
            let uploadNeeded = false;
            let newBackfillQueue = org.backfillQueue.map(item => {
              if (item.isCalcsComplete["1"] && item.isCalcsComplete["15"] && !item.isEventsQueued) {
                uploadNeeded = true;
                item.isEventsQueued = true;
                return item;
              }
            });
            if (uploadNeeded) {
              let update = { backfillQueue: newBackfillQueue };
              let updateRes = await this.mongo.updateOrg(org._id.toString(), update);
            }
          }
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "Backfiller.updateOrgInfo")) }
      })();
    })
  }

  async run() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          console.log("done getting data")
          await this.updateData();
          console.log("done getting data")
          if (this.orgs.length === 0) {
            console.log("No orgs with backfillQueue");
            return resolve();
          }
          let tickets = await this.createRefreshTickets();
          await this.enqueueRefreshTickets(tickets);
          await this.updateOrgInfo(); //you can really only delete old ones. The calculator is the only one that can update after its done...
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "Backfiller.run")) }
      })();
    })
  }


}

exports.handler = async (event) => {
  // async function mymain(event) {
  try {
    console.log("event: ", event)
    if (BACKFILLER == null) {
      console.log("first init of class")
      BACKFILLER = new BackfillerInvoker();
      await BACKFILLER.initClass();
    }
    if (BACKFILLER.mongo.mongooseStatus() == 0) {
      console.log("renewed init of class")
      await BACKFILLER.initClass();
    }
    console.log("starting run")
    await BACKFILLER.run();
    console.log("finished run")
    const response = {
      statusCode: 200,
      body: "done"
    }
    if (IS_DEV_LOCAL_ENV) {
      await MongoData.closeClient();
    }
    return response;
  }
  catch (error) {
    console.log(error)
    if (IS_DEV_LOCAL_ENV) {
      await MongoData.closeClient();
    }
    return;
  }
}
