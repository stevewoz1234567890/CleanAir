// require('dotenv').config();
const MongoData = require('./MongoData');
const { ObjectId } = require("mongodb");
const { DateTime } = require('luxon');
const AWS = require('aws-sdk');
const SES = new AWS.SESV2({
  accessKeyId: process.env.AWS_ACCSSKEY,
  secretAccessKey: process.env.AWS_SECRETKEY
});

var TESTING_MODE_EMAIL = false;
var UPDATE_USER_INFO = true;
var IS_DEV_LOCAL_ENV = false;
const SEND_EMAIL = true;
const MACRO_SEND_EMAIL = true;
const MACRO_UPDATE_USER = true;
const ERICK_ONLY = false;

var LOGS = false;

let ALARM_BOT = null;
const START_LIMIT_MAX_MINUTES_AGO = 30;
const END_LIMIT_MAX_MINUTES_AGO = 60;
const MS_PER_MIN = 60000;

function getErrorObject(error, path) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  return { printPath: path, error };
}

function setSettings(event) {
  if (event.hasOwnProperty("cleanCloudArgs")) {
    let s = event.cleanCloudArgs.settings;
    TESTING_MODE_EMAIL = s.TESTING_MODE_EMAIL;
    IS_DEV_LOCAL_ENV = s.IS_DEV_LOCAL_ENV;
    UPDATE_USER_INFO = s.UPDATE_USER_INFO;
  }
}

/**
   * 
   * @param {Date} date 
   * @param {String} timezone 
   * @returns {String} string
   */
function UTCDateToLocalString(date, timezone) {
  try {
    /**
     * There is a bug in javascript that is supposed to be fixed in the 2021 version, but it's unreleased
     * the bug, for us, is causing 00 hour to display at 24.
     * As related to luxon: https://github.com/moment/luxon/issues/726
     * fix: use this as the formatting options : { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' };
     */
    if (!date || !timezone) return null;
    const FORMAT_OPTIONS = { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' };
    date = DateTime.fromISO(date.toISOString())
    let stringDate = date.setZone(timezone).setLocale('en-US').toLocaleString(DateTime.DATE_MED_WITH_WEEKDAY);
    let stringTime = date.setZone(timezone).setLocale('en-US').toLocaleString(FORMAT_OPTIONS);
    let stringDT = stringDate + " " + stringTime;
    return stringDT
  } catch (err) { throw getErrorObject(err, "UTCDateToLocalString") }
}

class AlarmBot {
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
        catch (error) { return reject(getErrorObject(error, "AlarmBot.initClass(): ")) }
      })();
    });
  }

  async updateData() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          this.END_LIMT_DATE = new Date(Date.now() - END_LIMIT_MAX_MINUTES_AGO * MS_PER_MIN);
          this.START_LIMT_DATE = new Date(Date.now() - START_LIMIT_MAX_MINUTES_AGO * MS_PER_MIN);
          this.ONE_HOUR_AGO = new Date(Date.now() - 60 * MS_PER_MIN);
          this.headersMap = await this.mongo.getHeadersMap();
          this.flaresMap = await this.mongo.getFlaresMap();
          this.usersInfo = await this.mongo.getUsers();
          this.orgsInfo = await this.mongo.getOrgs();
          this.rulesInfo = await this.mongo.getEventRules();
          this.formulasInfo = await this.mongo.getFormulas(this.rulesInfo);
          this.eventData = await this.mongo.getEvents(this.rulesInfo, Object.values(this.flaresMap), Object.values(this.headersMap), this.formulasInfo, START_LIMIT_MAX_MINUTES_AGO);
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "AlarmBot.updateData")) }
      })();
    })
  }

  /**
   * We are linking users to events that qualify to be alarmed.
   * @returns 
   */
  async determineAlarms() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          var alarmTicketsByUser = {};
          for (let rule of this.rulesInfo) {
            let orgID = rule.org.toString();
            let ruleID = rule._id.toString();
            let events = this.eventData[orgID][ruleID]; //in retrospect, you probably did not need to split by org... rules contain org id as attribute...
            if (events.length === 0) continue;
            for (let event of events) {
              if (!event) continue; //this can be removed...
              for (let subscriber of rule.subscribers) {
                let subscriberID = subscriber.toString();
                if (ERICK_ONLY) {
                  if (subscriberID !== "5fb423068e53172a740761a1") continue
                }
                let user;
                if (alarmTicketsByUser[subscriberID] === undefined) {
                  user = this.usersInfo[subscriberID];
                  alarmTicketsByUser[subscriberID] = {
                    userInfo: user,
                    events: []
                  }
                } else user = this.usersInfo[subscriberID];
                let alreadyNotified;
                
                //hot fix for multiple email sends. This really should be placed somewhere where it's done once at most... here it does it for each event found
                if (user.recentAlarms) {
                  for (let alarm of user.recentAlarms) {
                    if (true){
                      let foundEvent = await this.mongo.getEvent(alarm.eventID);
                      if (foundEvent) {
                        alarm.eventRule = foundEvent.eventRule ? foundEvent.eventRule.toString() : null;
                        alarm.header = foundEvent.header ? foundEvent.header.toString() : null;
                        alarm.flare = foundEvent.flare ? foundEvent.flare.toString() : null;
                        alarm.end = foundEvent.end
                      } else {
                        alarm.eventRule = null;
                        alarm.header = null;
                        alarm.end = null;
                        alarm.delete = true;
                        console.log("Alarm flagged for deletion: ", alarm)
                      }
                    }
                  }
                  user.recentAlarms = user.recentAlarms.filter(a=>a.delete !== true);
                }
                if (user.hasOwnProperty("recentAlarms") && user.recentAlarms.length !== 0) {
                  alreadyNotified = user.recentAlarms.find(a => {
                    let startDateMatch, IdMatch, containedWithin = false;
                    let alarmsRule = a.eventRule ? a.eventRule.toString() : null;
                    let headerId = a.header ? a.header.toString() : null;
                    if (a.start.getTime() === event.start.getTime() && alarmsRule === event.eventRule.toString() && headerId === event.header && a.flare === event.flare) startDateMatch = true;
                    if (a.eventID.toString() === event._id.toString()) IdMatch = true;
                    if (event.start >= a.start.getTime() && event.end <= a.end.getTime() && alarmsRule === event.eventRule.toString() && headerId === event.header) containedWithin = true;
                    return startDateMatch || IdMatch || containedWithin;
                  });
                  //Below we want to not send an alarm if there's already been one
                  // sent for a rule in a given hour
                  if (!alreadyNotified) { 
                    let latestAlarmsForRule = user.recentAlarms.filter(a=>{
                      if (a.start < this.ONE_HOUR_AGO) return false;
                      return (a.eventRule === ruleID && a.flare === event.flare && a.header === event.header);
                    });
                    if (latestAlarmsForRule.length > 0) alreadyNotified = true;
                  }
                } else {
                  if (!user.hasOwnProperty("recentAlarms")) console.log(`recentAlarms is missing for user: ${subscriberID}`)
                  else console.log(`recentAlarms is of length 0 for user: ${subscriberID}`)
                  //we don't want to send old alarms assuming this is a first-time subscriber
                  if (event.start < this.START_LIMT_DATE) {
                    alreadyNotified = true
                  } else {
                    alreadyNotified = false;
                  }
                }
                if (!alreadyNotified) alarmTicketsByUser[subscriberID].events.push(event);
              }
            }
          }
          return resolve(Object.values(alarmTicketsByUser));
        } catch (err) { return reject(getErrorObject(err, "AlarmBot.determineAlarms")) }
      })();
    })
  }

  async getHTMLBody(userInfo, events, rulesInfo = this.rulesInfo, formulasInfo = this.formulasInfo, orgs = this.orgsInfo) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let dataRows = [];
          let rowNum = 0;
          let timezone = orgs[userInfo.defaultOrg.toString()].timezone;
          for (let event of events) {
            rowNum++;
            let values, avg, min, max;
            let start, end, periods, rule, ruleName, formula, resolution, resolutionString = null;
            let flareName, headerName = "N/A";
            start = UTCDateToLocalString(new Date(event.start.getTime()), timezone);
            end = UTCDateToLocalString(new Date(event.end.getTime()), timezone);

            rule = rulesInfo.find(r => r._id.toString() === event.eventRule.toString());
            if (rule) {
              ruleName = rule.name;
              // formula = formulasInfo[rule.formula.toString()];
              resolution = rule ? rule.resolution : null;
              resolutionString = resolution ? resolution.toString() + " min." : "___";

            } else {
              ruleName = resolutionString = "___";
            }
            
            try {
              if (event.flare) {
                flareName = this.flaresMap[event.flare.toString()].name;
              }
              if (event.header) {
                headerName = this.headersMap[event.header.toString()].name;
                headerName = headerName.split(" ");
                headerName.shift();
                headerName = headerName.join(" ");
                
              }
              let flareID = event.flare.toString()
            } catch (e) {
              console.log("ERROR (getting flare and header name):", e);
              console.log("flareMap: ", event.flare.toString(), this.flaresMap)
              console.log("headerMap: ", event.header.toString(), this.headersMap)
            }

            try {
              let diffInMilliSeconds = (event.end.getTime() - event.start.getTime());
              const minutes = Math.floor(diffInMilliSeconds / MS_PER_MIN);
              periods = Math.floor(minutes / resolution).toString();
            } catch (e) {
              console.log("ERROR: ", e)
              periods = "___"
            }

            try {
              let valuesData = event.valuesData;
              if (!valuesData) {
                values = avg = min = max = "N/A";
              } else {
                values = valuesData.values.toString();
                if (valuesData.info === null) avg = min = max = "N/A";
                else {
                  avg = valuesData.info.average;
                  min = valuesData.info.min;
                  max = valuesData.info.max;
                }
              }
            } catch (e) {
              console.log("ERROR: Could not load access numberical data.", e);
            }
            // throw "got to point..."
            let rowStyle = rowNum % 2 === 0 ? 'background-color: #017ec721;' : "background-color: #f3f3f3;";
            dataRows.push(`
              <tr ${rowStyle}>
                <td>${ruleName}</td>
                <td>${flareName}</td>
                <td>${headerName}</td>
                <td>${start}</td>
                <td>${end}</td>
                <td>${avg}</td>
                <td>${max}</td>
                <td>${min}</td>
              </tr>
            `)
          }
          dataRows = dataRows.join('');
          let body = `
          <html>
          <head>
          <style>
          body {
            color: black;
          }
          .styled-table {
              border-collapse: collapse;
              margin: 25px 0;
              font-size: 1em;
              font-family: sans-serif;
              min-width: 400px;
              box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
          }
          .styled-table thead tr {
              background-color: #007cc2;
              color: #ffffff;
              text-align: left;
          }
          .styled-table th,
          .styled-table td {
              padding: 12px 15px;
          }
          .styled-table tbody tr {
              border-bottom: 1px solid #9c8d8d;
          }
          
          .styled-table tbody tr:nth-of-type(even) {
              background-color: #017ec721;
          }
          
          .styled-table tbody tr:nth-of-type(odd) {
              background-color: #f3f3f3;
          }
          
          .styled-table tbody tr:last-of-type {
              border-bottom: 2px solid #007cc2;
          }
          </style>
          </head>
          <body>
              <h1 style="color: #007cc2; text-align: center;">CleanCloud</h1>
              <h2 style="text-align: center;">Alarming Notification</h2>
              <div style="text-align: center;">
                  The following events have been detected:
              </div>
              <table style="width:100%" class="styled-table">
                  <thead>
                      <tr>
                          <th>Alarm Name</th>
                          <th>Flare</th>
                          <th>Header</th>
                          <th>Start</th>
                          <th>End (Ongoing)</th>
                          <th>Average</th>
                          <th>Max</th>
                          <th>Min</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${dataRows}
                      <!-- and so on... -->
                  </tbody>
              </table>
              <div style="text-align: center;">
                  <span>If you would like to unsubscribe to these alarms,</span>
                  <a style="color: #007cc2;" href="https://cleancloud.cleanair.com/login">please login to CleanCloud and
                      unsubscribe. </a>
                  <br>
                  <span>Contact CleanAir for additional assistance.</span>
              </div>
          </body>
          </html>`
          return resolve(body)
        } catch (err) { return reject(getErrorObject(err, "AlarmBot.sendEmails")) }
      })();
    })
  }

  /**
   * Pass by reference. Provided event objects are directly modified
   * @param {} events 
   * @returns 
   */
  async loadNumericalData(events) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          for (let event of events) {
            if (event.chunks.length === 0) continue;
            let chunks = event.chunks;
            let isFormulaValue, hasChunkTypeMatch, hasChunkTypeKey, version;
            if (event.hasOwnProperty('chunkType')) { //the new 
              hasChunkTypeKey = true;
              if (event.chunkType === 'formulaValue') isFormulaValue = true;
              else if (event.chunkType === 'piValue') isFormulaValue = false;

              if (isFormulaValue === undefined) hasChunkTypeMatch = false;
              else version = 2;

            } else if ((!hasChunkTypeKey) || (hasChunkTypeKey && hasChunkTypeMatch === false)) {
              if (chunks[0].hasOwnProperty('formulaValue')) isFormulaValue = true;
              else if (chunks[0].hasOwnProperty('piValue')) isFormulaValue = false;
              if (isFormulaValue !== undefined && version === undefined) version = 1
            }
            if (isFormulaValue === undefined) {
              console.log("ERROR: Could not determine chunk data type (piValue or FormulaValue). Skipping.");
              continue;
            }
            let valuesData;
            if (isFormulaValue) {
              valuesData = await this.mongo.getFormulaValues(chunks, version);
            } else {
              valuesData = await this.mongo.getPiValues(chunks, version);
            }
            event.valuesData = valuesData;
          }
          return resolve();
        } catch (error) { return reject(getErrorObject(error, "AlarmBot.loadNumericalData():")) }
      })();
    })
  }

  async sendEmails(alarmTickets, rulesInfo = this.rulesInfo, formulasInfo = this.formulasInfo, orgs = this.orgsInfo) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          for (let ticket of alarmTickets) {
            let { userInfo, events } = ticket;
            if (events.length === 0) continue;
            await this.loadNumericalData(events); //This is not ideal here because it will get values for each event for each user rather than once per event
            let from = "portaladmin@cleanair.com";
            let to = [userInfo.email];
            let subject = "CleanCloud Alarm";
            let text = await this.getHTMLBody(userInfo, events, rulesInfo, formulasInfo, orgs);
            let html = text;
            const CCs = []
            const bCCs = []
            const tos = Array.isArray(to) ? to : [to]
            const replyTos = []
            const charSet = 'UTF-8'
            const params = {
              Content: {
                Simple: {
                  Body: {
                    Html: {
                      Data: html,
                      Charset: charSet
                    },
                    Text: {
                      Data: text,
                      Charset: charSet
                    }
                  },
                  Subject: {
                    Data: subject,
                    Charset: charSet
                  }
                },
              },
              Destination: {
                BccAddresses: bCCs,
                CcAddresses: CCs,
                ToAddresses: tos
              },
              FromEmailAddress: from,
              ReplyToAddresses: replyTos
            };
            try {
              if (SEND_EMAIL) {
                const res = await SES.sendEmail(params).promise()
                if(IS_DEV_LOCAL_ENV) console.log(res)
              }
            } catch (e) {
              console.log("ERROR: ", e)
            }
          }
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "AlarmBot.sendEmails")) }
      })();
    })
  }

  async updateUserData(alarmTicketsByUser) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let ops = [];
          for (let group of alarmTicketsByUser) {
            let recentAlarmsUpdated = [];
            let { userInfo, events } = group;
            if (events.length === 0) continue;
            let hasAlarmKey = userInfo.hasOwnProperty("recentAlarms")
            //first queue up (for update) past alarms that are not stale.
            if (hasAlarmKey) {
              for (let event of userInfo.recentAlarms) {
                if (event.end >= this.END_LIMT_DATE) recentAlarmsUpdated.push(event);
              }
            }
            //update newly created/sent alarms to db format and add to list
            let newAlarmsReformatted = events.map(event => {
              return { start: event.start, end: event.end, header : event.header, flare : event.flare, eventID: event._id, created: new Date(), eventRule : event.eventRule }
            })
            recentAlarmsUpdated.push(...newAlarmsReformatted)
            let filter = { _id: userInfo._id };
            let update = { '$set': { recentAlarms: recentAlarmsUpdated } };
            let newOp = { "updateOne": { filter, update } };
            ops.push(newOp);
          }
          if (UPDATE_USER_INFO) await this.mongo.bulkWriteOnUsers(ops);
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "AlarmBot.updateUserData")) }
      })();
    })
  }

  async run() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (LOGS) console.log("inside run starting");
          await this.updateData();
          if (LOGS) console.log("finished udating data")
          if (!this.eventData){
            // if (LOGS) console.log("")
            if (LOGS) console.log("no new events. returning...")
            return resolve("No New Events...");
          }
          let alarmTicketsByUser = await this.determineAlarms(); ///returns array
          // console.log("alarmTicketsByUser: ", alarmTicketsByUser)
          if (MACRO_SEND_EMAIL) await this.sendEmails(alarmTicketsByUser);
          if (MACRO_UPDATE_USER) await this.updateUserData(alarmTicketsByUser);
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "AlarmBot.run")) }
      })();
    })
  }

}

exports.handler = async (event) => {
  try {
    if (LOGS) console.log("starting...")
    setSettings(event);
    if (LOGS) console.log("finished settings")
    let res = "";
    if (ALARM_BOT === null) {
      if (LOGS) console.log("first init")
      ALARM_BOT = new AlarmBot();
      await ALARM_BOT.initClass();
      if (LOGS) console.log("first init done")
    }
    if (ALARM_BOT.mongo.mongooseStatus() === 0) await ALARM_BOT.initClass();
    if (IS_DEV_LOCAL_ENV && TESTING_MODE_EMAIL) {
      let b = event.cleanCloudArgs.body;
      await ALARM_BOT.sendEmails(b.alarmTickets, b.rulesInfo, b.formulasInfo, b.orgs);
    }
    else {
      if (LOGS) console.log("starting run")
      res = await ALARM_BOT.run();
      if (LOGS) console.log("finished run")
    }
    const response = {
      statusCode: 200,
      body: "Complete"
    }
    if (IS_DEV_LOCAL_ENV) {
      await MongoData.closeClient();
    }
    return response;
  }
  catch (error) {
    console.log("ERROR: ", error)
    return;
  }
}
