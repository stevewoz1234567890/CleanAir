const MongoData = require('./MongoData');
const { ObjectId } = require("mongodb");
const { DateTime } = require('luxon');
const util = require('util');
const AWS = require('aws-sdk');
const SES = new AWS.SESV2({
  accessKeyId: process.env.AWS_ACCSSKEY,
  secretAccessKey: process.env.AWS_SECRETKEY,
  region: 'us-east-1',
});

const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = MS_PER_MINUTE * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

//Main class object
var NUM_ALARM_GENERATOR = null;

//testing variables
var IS_DEV_LOCAL_ENV = false;
var PROGRESS_DEBUG_LOGS = false;
var SEND_EMAIL = true;


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
  if (event.hasOwnProperty("invokerArgs")) {
    let e = event.invokerArgs;
    IS_DEV_LOCAL_ENV = e.settings.IS_DEV_LOCAL_ENV;
    PROGRESS_DEBUG_LOGS = e.settings.PROGRESS_DEBUG_LOGS;
    SEND_EMAIL = e.settings.SEND_EMAIL;
    return e.body;
  }
  return event;
}

function groupItems(items, groupSize) {
  let groups = [[]];
  let lastGroupIndex = 0;
  for (let item of items) {
    if (groups[lastGroupIndex].length === groupSize) {
      groups.push([]);
      lastGroupIndex++;
    }
    groups[lastGroupIndex].push(item);
  }
  return groups;
}

class numericAlarmGenerator {
  constructor() {
    this.mongo = new MongoData(IS_DEV_LOCAL_ENV);
  }

  async template() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "numericAlarmGenerator.template:()")) }
      })();
    })
  }

  async initClass() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await this.mongo.initClient();
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "numericAlarmGenerator.initClass():")) }
      })();
    })
  }

  async getBaseData() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          //We are filter Users and NumRules so we can use of loops. Orgs we can just use as lookup resources
          this.flares = await this.mongo.getFlares();
          this.header = await this.mongo.getHeaders();
          this.users = await this.mongo.getUsers();
          this.numericRules = await this.mongo.getNumericEventRules();
          this.orgs = await this.mongo.getOrgs();
          this.users = this.users.filter(u => {
            return this.numericRules.some(rule =>
              rule.subscribers.some(suber =>
                suber.toString() === u._id.toString()
              )
            )
          });
          this.numericRules = this.numericRules.filter(rule => {
            return rule.subscribers.some(suber => {
              return this.users.some(user => user._id.toString() === suber.toString())
            })
          });
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "numericAlarmGenerator.getBaseData:()")) }
      })();
    })
  }

  async determineAlarms() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          /**
          let alarms = [];
          for each event rule
            pull the relevant input data
            determine if its alarm worthy
            if it is alarmworthy
              alarms.push(newAlarm)
          return alarms
           */
          let alarms = [];
          for (const rule of this.numericRules) {
            rule.alarmworthy = false;
            let zone = this.orgs.find(org => org._id.toString() === rule.org.toString()).timezone;
            let filter = {
              start: DateTime.now().setZone(zone).startOf('day').toJSDate(),
              parameter: rule.parameter,
              parameterType: rule.parameterType,
            }
            let dataDocs = await this.mongo.getDailyNumericData(filter);
            for (let dataDoc of dataDocs) {
              let dailySum = null;
              if (dataDoc.data && dataDoc.data.length > 0) {
                let values = dataDoc.data.map(v => {
                  if (isNaN(v.value)) return 0;
                  return v.value
                });
                dailySum = values.reduce((a, v) => a + v);
              }
              if (dailySum === null) continue; //not something we can alarm on... not enough data...
              let alarmworthy = false;
              // console.log(dailySum)
              switch (rule.actionInequality) {
                case '>':
                  if (dailySum > rule.actionValue) alarmworthy = true;
                  break;
                case '<':
                  if (dailySum < rule.actionValue) alarmworthy = true;
                  break;
                case '>=':
                  if (dailySum >= rule.actionValue) alarmworthy = true;
                  break;
                case '<=':
                  if (dailySum <= rule.actionValue) alarmworthy = true;
                  break;
                default:
                  throw new Error(`Unexpected value for actionInequality: ${rule.actionInequality}`);
              }
              if (alarmworthy) {
                if (!rule.alarmworthy) {
                  rule.alarms = [];
                  rule.alarmworthy = true;
                }
                let newAlarm = {
                  flare: dataDoc.flare,
                  header: dataDoc.header,
                  start: DateTime.fromJSDate(dataDoc.start, { zone }),
                  triggerValue: dailySum,
                  rule: rule,
                }
                alarms.push(newAlarm)
              }
            }
          }
          return resolve(alarms)
        } catch (err) { return reject(getErrorObject(err, "numericAlarmGenerator.determineAlarms:()")) }
      })();
    })
  }

  async getHTMLBody(user, alarms) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const newFormatOptions = {
            year: 'numeric', month: '2-digit', day: '2-digit',
            // hour: '2-digit', minute: '2-digit',
            // hourCycle: 'h23',
          }
          let dataRows = [];
          let rowNum = 0;
          for (let alarm of alarms) {
            rowNum++;
            //We want to display: date, rule name, rule rule, flare name, header name
            let flareName, headerName = "N/A"
            let dateString = alarm.start.setLocale('en-US').toLocaleString(newFormatOptions);
            let ruleName = alarm.rule.name;
            // console.log(alarm)
            let ruleCondition = `${alarm.rule.actionPeriod} ${alarm.rule.actionOperation} ${alarm.rule.actionInequality} ${alarm.rule.actionValue}`;
            try {
              flareName = this.flares.find(f => f._id.toString() === alarm.flare.toString()).name ?? "N/A";
            } catch (e) { }
            try {
              headerName = alarm.header == null ? "N/A" : (this.headers.find(h => h._id.toString() === alarm.header.toString()).name);
              headerName = headerName.split(" ");
              headerName.shift();
              headerName = headerName.join(" ");
            } catch (e) { }

            // throw "got to point..."
            let rowStyle = rowNum % 2 === 0 ? 'background-color: #017ec721;' : "background-color: #f3f3f3;";
            dataRows.push(`
              <tr ${rowStyle}>
                <td>${ruleName}</td>
                <td>${ruleCondition}</td>
                <td>${flareName}</td>
                <td>${headerName}</td>
                <td>${dateString}</td>
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
                          <th>Event</th>
                          <th>Condition</th>
                          <th>Flare</th>
                          <th>Header</th>
                          <th>Date</th>
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
        } catch (err) { return reject(getErrorObject(err, "AlarmBot.getHTMLBody")) }
      })();
    })
  }

  async sendEmail(user, HTML) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let from = "portaladmin@cleanair.com";
          let to = [user.email];
          let subject = "CleanCloud Alarm";
          let html = HTML;
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
                    Data: HTML,
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
              if (IS_DEV_LOCAL_ENV) console.log(res)
            }
          } catch (e) {
            console.log("ERROR: ", e)
          }
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "numericAlarmGenerator.sendEmail:()")) }
      })();
    })
  }

  async sendAlarms(alarms) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          /**
           *             
          for each user
            for each alarm
              if user is interesed of this alarm
                compose email
            send email
          return alarms
           */
          if (alarms.length === 0) return resolve(alarms);
          for (const user of this.users) {
            user.alarmsSent = [];
            let interestedAlarms = alarms.filter(alarm => {
              let interest = alarm.rule.subscribers.some(sub => sub.toString() === user._id.toString());
              interest = interest && !(user.recentNumRuleAlarms.some(a => {
                return (a.start.getTime() === alarm.start.toMillis() &&
                  String(a.flare) === String(alarm.flare) &&
                  String(a.header) === String(alarm.header) &&
                  String(a.rule) === String(alarm.rule._id)
                )
              }))
              if (interest) user.alarmsSent.push(alarm); //we're going to use this later to update the db user doc
              return interest;
            });
            if (interestedAlarms.length === 0) continue;
            let HTML = await this.getHTMLBody(user, interestedAlarms);
            await this.sendEmail(user, HTML);
          }
          return resolve(alarms)
        } catch (err) { return reject(getErrorObject(err, "numericAlarmGenerator.sendAlarms:()")) }
      })();
    })
  }

  async updateUsers(alarms) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          /**
           * 
          let ops = [];
          for each user
            updateMade = false
            user.alarms = filter out alarms that are older than 24 hours

            for each alarms
              if user is interested of this alarms
                add the alarms to recent alarms
            
            if updateMade(ops.push(newOp))
          
          await bulkOperations()
           */
          let ops = [];
          for (const user of this.users) {
            let updateMade = false;
            let zone = this.orgs.find(org => org._id.toString() === user.defaultOrg.toString()).timezone;
            let startOfDay = DateTime.now().setZone(zone).startOf('day').toJSDate()
            if (!user.recentNumRuleAlarms) user.recentNumRuleAlarms = [];

            /*** First we want to remove any alarms not pertaining to today  */
            let initalNumAlarms = user.recentNumRuleAlarms.length;
            user.recentNumRuleAlarms = user.recentNumRuleAlarms.filter(a => {
              if (a.start < startOfDay) return false; //we want to remove alarms not pertaining to today
              else return true;
            });
            let finalNumAlarms = user.recentNumRuleAlarms.length;
            if (initalNumAlarms !== finalNumAlarms) updateMade = true;

            /*** next we want to add the sent alarms to the users recent history */
            if (user.alarmsSent && user.alarmsSent.length > 0) {
              updateMade = true;
              user.recentNumRuleAlarms.push(...user.alarmsSent)
            }

            if (updateMade) {
              let newOp = {
                updateOne: {
                  filter: { _id: user._id },
                  update: { $set: { recentNumRuleAlarms: user.recentNumRuleAlarms } },
                }
              }
              ops.push(newOp);
            }
          }
          if (ops.length > 0) await this.mongo.bulkUpdateUser(ops);
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "numericAlarmGenerator.updateUsers:()")) }
      })();
    })
  }

  async run(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await this.getBaseData();
          let alarms = await this.determineAlarms();
          alarms = await this.sendAlarms(alarms);
          await this.updateUsers(alarms);
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "numericAlarmGenerator.run()):")) }
      })();
    })
  }
}

exports.handler = async (event) => {
  try {
    let payload = setSettings(event);
    if (IS_DEV_LOCAL_ENV) require('dotenv').config();
    if (NUM_ALARM_GENERATOR === null) {
      NUM_ALARM_GENERATOR = new numericAlarmGenerator();
      await NUM_ALARM_GENERATOR.initClass();
    }
    if (NUM_ALARM_GENERATOR.mongo.mongooseStatus() === 0) await NUM_ALARM_GENERATOR.initClass();
    let statusBody = await NUM_ALARM_GENERATOR.run(payload);
    const response = {
      statusCode: 200,
      body: { data: statusBody }
    }
    if (IS_DEV_LOCAL_ENV) {
      await MongoData.closeClient();
      console.log("response: ", response);
    }
    return response;
  }
  catch (error) {
    const response = { status: 400, body: error };
    if (IS_DEV_LOCAL_ENV) {
      try {
        await MongoData.closeClient();
        console.log("response: ", response);
      } catch (e) { }
    }
    console.log("ERROR: ", error)
    return response;
  }
}
