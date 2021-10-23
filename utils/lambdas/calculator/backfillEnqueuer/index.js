const MongoData = require('./MongoData');
const { ObjectId } = require("mongodb");
const AWS = require('aws-sdk');
const SQS = new AWS.SQS({ region: 'us-east-1' });
const { v4: uuidv4 } = require('uuid');

const IS_DEV_LOCAL_ENV = false;
const SEND_TO_SQS_MICRO = false;
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
        catch (error) { return reject(getErrorObject(error, "Backfiller.initClass(): ")) }
      })();
    });
  }

  async addBackfillEvent(orgs) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const MS_PER_MINUTE = 60000;
          const MS_PER_HOUR = MS_PER_MINUTE * 60;
          let now = new Date()
          now.setSeconds(0,0)
          const newestTimestamp = now.getTime() - (MS_PER_HOUR);
          const oldestTimestamp = newestTimestamp - (MS_PER_HOUR * 27)
          orgs = orgs.map(o => {
            if (o.backfillQueue === undefined) o.backfillQueue = [];
            o.backfillQueue.push({
              oldestDate: new Date(oldestTimestamp),
              newestDate: new Date(newestTimestamp),
              isEventsComplete: false,
              isCalcsQueued : false,
              created: new Date(),
            });
            return o
          })
          return resolve(orgs)
        } catch (err) { return reject(getErrorObject(err, "Backfiller.addBackfillEvent")) }
      })();
    })
  }

  async updateData() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          this.orgs = await this.mongo.getOrgs();
          this.orgs = await this.addBackfillEvent(this.orgs);
          this.piTags = await this.mongo.getPiTags(this.orgs);
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "Backfiller.updateData")) }
      })();
    })
  }

  async _createTickets_(org, item, is15) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let newTicket = {
            org: org._id, //groups contain orgid already.
            refreshSets: [],
          }
          let schema = {
            "p": null,
            "v": [],
            "t": [],
            "d": false, //hardcoding that you can only backfill calc on PROD
            "o": null,
            "retDateString": ""
          }
          schema.o = org._id.toString();
          let tag = this.piTags.find(p => p.org.toString() === org._id.toString());
          schema.p = tag.name;

          let oldestTimestamp = item.oldestDate.getTime();
          let newestTimestamp = item.newestDate.getTime();
          let itStartDate = new Date(oldestTimestamp);
          let itEndDate = new Date(newestTimestamp);
          let it = new Date(oldestTimestamp);
          // console.log("range: ", `${itStartDate} - ${itEndDate}`)

          let allSets = [];
          let set = [];
          let maxGroupsPerSet = 10; //10 hours worth of data, or rather, (10 * 60 = 720) timestamps
          let newGroup = JSON.parse(JSON.stringify(schema));
          newGroup.retDateString += it.toISOString();
          let maxMinutesPerGroup = 60;
          let expectedTotal = 0;
          while (it <= itEndDate) {
            let temp = new Date(it.getTime())
            temp = addMinutes(temp, 1)
            // console.log("it: ", is15 ,it)
            let minuteTypeMatch = is15 ? it.getMinutes() % 15 === 0 : it.getMinutes() % 15 !== 0;
            if (minuteTypeMatch) {
              expectedTotal++;
              newGroup.v.push(1);
              newGroup.t.push(it.getTime())
              if (newGroup.t.length >= maxMinutesPerGroup) {
                newGroup.retDateString += ` - ${it.toISOString()}`
                set.push(newGroup);
                newGroup = JSON.parse(JSON.stringify(schema))
                newGroup.retDateString += `${temp.toISOString()}`
              }
              if (set.length >= maxGroupsPerSet) {
                allSets.push(set);
                set = [];
              }
            }
            if (temp > itEndDate) {
              newGroup.retDateString += ` - ${it.toISOString()}`
              set.push(newGroup);
              allSets.push(set);
            }
            it = addMinutes(it, 1);
          }
          // if (is15) {
          //   for (let s of allSets) console.log("set: ", s)
          // }
          newTicket.refreshSets = allSets;
          return resolve(newTicket)
        } catch (err) { return reject(getErrorObject(err, "Backfiller.updateData")) }
      })();
    })
  }

  async createRefreshTickets() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let refreshTickets = [];
          for (let org of this.orgs) {
            let queueableItems = QUEUE_ALL ? org.backfillQueue : org.backfillQueue.filter(i => !i.isCalcsQueued);
            if (queueableItems.length === 0) continue;
            for (let item of queueableItems) {
              //Random thought: A possible issue is that we queue for the refresh items that have already been queued
              //this would only happen if this code runs again before the first twin is done. This is because
              //isCalcsComplete would still be false... BUT I'm leaving as is for now. The backfill limit is
              //1 day, and I don't plan on invoking this more than once per hour. That should be way more than
              //enough time for isCalcsComplete to be updated to true. It could become an issue later on though.

              //in all probablity there should be at most 1 queable item... more is possible though...

              let minuteTicket = await this._createTickets_(org, item, false);
              let quarterHourTicket = await this._createTickets_(org, item, true);
              refreshTickets.push(minuteTicket);
              refreshTickets.push(quarterHourTicket);
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
          for (let ticket of tickets) { //must to iteratively becuause order matters FIFO, 1-min then quarter hour
            let { refreshSets } = ticket;
            for (let set of refreshSets) {
              var sqsParams = {
                QueueUrl: process.env.BACKFILL_TICKET_FIFO_QUEUE,
                Entries: []
              };
              set.map(group => {
                sqsParams.Entries.push({
                  Id: uuidv4(),
                  MessageGroupId: uuidv4(),
                  MessageDeduplicationId: uuidv4(),
                  MessageBody: JSON.stringify(group)
                });
              });
              if (SEND_TO_SQS_MICRO) await SQS.sendMessageBatch(sqsParams).promise();
            }
          }
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "Backfiller.enqueueRefreshTickets")) }
      })();
    })
  }

  /**
   * Removes items from backfillQueue field of an org if it's older than 24 hours
   * @returns 
   */
  async updateOrgInfo() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          console.log("updating org info")
          let oneDayAgo = new Date(Date.now() - (60000 * 1440));
          for (let org of this.orgs) {
            let orgID = org._id.toString()
            let filter = { _id: ObjectId(orgID) };
            let update = {};
            let uploadNeeded = false;

            let newBackfillQueue = org.backfillQueue.filter(item => {
              // console.log(`created: ${item.created} \noneDayAgo: ${oneDayAgo}`)
              return (item.created > oneDayAgo)
            }); //remove old items
            for (let item of newBackfillQueue) { //flag as queued
              if (!item.isCalcsQueued) {
                item.isCalcsQueued = true;
                uploadNeeded = true;
              }
            }
            if (newBackfillQueue.length !== org.backfillQueue.length) { //update/remove old items
              // console.log(newBackfillQueue.length, org.backfillQueue.length)
              update.backfillQueue = newBackfillQueue;
              uploadNeeded = true;
            }
            if (uploadNeeded) {
              update = { backfillQueue: newBackfillQueue };
              // let updateArg = {'$set': update}
              let updateRes = await this.mongo.updateOrg(orgID, update);
              // console.log("updateRes: ", updateRes)
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
          /**
          - get the orgs
          - check for items in the queue that have not been calculated over.
          - create refresh queue
          - create queue items over 1-min values and enquque
          - create queue items over 15-min values and enqueue
          - send off enqueed items to FIFO SQS
          - if an queue item is older than 24 hours then delete. also make any other
          additional changes to the queue in db
          */
          await this.updateData();
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
    if (BACKFILLER == null) {
      BACKFILLER = new BackfillerInvoker();
      await BACKFILLER.initClass();
    }
    if (BACKFILLER.mongo.mongooseStatus() == 0) await BACKFILLER.initClass();
    await BACKFILLER.run();
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
