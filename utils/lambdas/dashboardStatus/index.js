const MongoData = require('./MongoData');
const { ObjectId } = require("mongodb");
const { DateTime } = require('luxon');
const util = require('util');

const COLORS = {
  RED: {
    name: "red",
    hex: "#DC3545",
    glow: true,
  },
  YELLOW: {
    name: "yellow",
    hex: "#FFC107",
    glow: true,
  },
  GREEN: {
    name: "green",
    hex: "#28A745",
    glow: true,
  },
  GREY: {
    name: "grey",
    hex: "#999999",
    glow: false,
  },
}

var STATUS_CALCULATOR = null;

//testing variables
var IS_DEV_LOCAL_ENV = false;
var PROGRESS_DEBUG_LOGS = false;

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

class StatusGenerator {
  constructor() {
    this.mongo = new MongoData(IS_DEV_LOCAL_ENV);
  }

  async template() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "StatusGenerator.:")) }
      })();
    })
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

  /**
   * 
   * @param {string} period 
   * @returns DateTime
   */
  getPeriodStart(period) {
    try {
      let today = DateTime.fromObject({
        zone: this.timezone,
      });
      let thisMonth = today.month;
      let thisYear = today.year;
      switch (period) {
        case "QTD":
          let i = 0;
          while (i < 4) {
            if ([1, 4, 7, 10].includes(thisMonth)) break;
            if (thisMonth === 1) { thisMonth = 12; thisYear--; }
            else thisMonth--;
            i++;
          }
          return DateTime.fromObject({ year: thisYear, month: thisMonth, zone: this.timezone })
        case "MTD":
          return DateTime.fromObject({ year: thisYear, month: thisMonth, zone: this.timezone })
        case "72 Hours":
          let threeDaysAgo = today.plus({ days: -3 });
          return DateTime.fromObject({ year: threeDaysAgo.year, month: threeDaysAgo.month, day: threeDaysAgo.day, zone: this.timezone })
        default:
          throw new Error("No valid period selected");
      }
    } catch (err) { throw getErrorObject(err, "StatusGenerator.getPeriodStart:") }
  }

  async updateBaseInfo(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          this.payload = payload;
          const org = payload.org; //org ID
          let orgObject = await this.mongo.getOrgs({ _id: org });
          orgObject = orgObject[0];
          this.timezone = orgObject.timezone;
          this.periods = ["QTD", "MTD", "72 Hours"]
          const periodStart = await this.getPeriodStart("QTD");
          this.today = DateTime.fromObject({
            zone: this.timezone,
          });

          let dashboardInfo = await this.mongo.getOrgInfo({ org, content: "stoplightDashboard" }, true);
          dashboardInfo = dashboardInfo[0];

          let allParameters = [];
          dashboardInfo.data.parameters.forEach(param => {
            param.parameters.forEach(item => {
              item.displayName = param.displayName;
              item.section = param.section;
              allParameters.push(item);
            });
          });
          this.eventRuleParameters = allParameters.filter(p => p.type === "eventRule");
          this.visibleEmissionsParameters = allParameters.filter(p => p.type === "visibleEmissions");
          this.so2EmissionsParameters = allParameters.filter(p => p.type.includes("so2EmissionsDeviation") || p.type.includes("so2EmissionsNearMiss"));

          let uniqueEventRuleIDs = [];
          this.eventRuleParameters.forEach(p => {
            let found = uniqueEventRuleIDs.find(id => id === p._id.toString())
            if (!found) uniqueEventRuleIDs.push(p._id.toString());
          });

          let so2NumRuleIDs = ["61377f37e4a3fb4b98911d24", "613ea045546e958d4452e901"];
          this.numericEventRules = await this.mongo.getNumericEventRules({
            _id: { $in: so2NumRuleIDs },
          });

          this.flares = await this.mongo.getFlares({ org });
          this.eventRules = await this.mongo.getEventRules({
            org,
            _id: { $in: uniqueEventRuleIDs },
          });
          this.visibleEmissionsData = {};
          for (let flare of this.flares) {
            this.visibleEmissionsData[flare._id.toString()] = await this.mongo.getVisibleEmissionsEvents({
              org,
              flare: flare._id,
              startDate: { $gt: periodStart.toMillis() }
            });
          }
          this.so2EmissionsDocs = {};
          let startOfDay = this.today.startOf("day")
          for (let flare of this.flares) {
            let filter = {
              parameter: { $in: this.numericEventRules.map(r => r.parameter) },
              flare: flare._id,
              start: { $gte: startOfDay.startOf('quarter').toJSDate(), $lte: startOfDay.toJSDate() }
            }
            this.so2EmissionsDocs[flare._id.toString()] = await this.mongo.getDailyNumericData(filter);
          }
          this.events = {};
          for (let ruleID of uniqueEventRuleIDs) {
            this.events[ruleID] = {};
            for (let flare of this.flares) {
              this.events[ruleID][flare._id.toString()] = await this.mongo.getEvents({
                flare: flare._id,
                start: { $gt: periodStart.toMillis() },
                eventRule: ruleID,
              });
            }
          }
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "StatusGenerator.updateBaseInfo:")) }
      })();
    })
  }

  makeObject(section, rowID, flareID, period, color) {
    try {
      color = COLORS[color.toUpperCase()];
      let object = {
        section,
        rowID,
        flareID,
        period,
        color,
      }
      return object;
    } catch (err) { throw getErrorObject(err, "StatusGenerator.makeObject:") }
  }

  isConditionMet(value, op, constraint) {
    try {
      switch (op) {
        case ">":
          return value > constraint;
        case "<":
          return value < constraint;
        case ">=":
          return value >= constraint;
        case "<=":
          return value <= constraint;
        case "=":
          return value === constraint;
        default:
          throw getErrorObject(err, "StatusGenerator.isConditionMet:")
      }

    } catch (err) { throw getErrorObject(err, "StatusGenerator.isConditionMet:") }
  }

  generateVisibleEmissionObjects() {
    try {
      let statusObjects = [];
      this.visibleEmissionsParameters.sort((a, b) => a.order - b.order);
      for (let flare of this.flares) {
        let flareID = flare._id.toString();
        let periodEvents = this.visibleEmissionsData[flareID];
        for (let period of this.periods) {
          let startDate = this.getPeriodStart(period);
          periodEvents = periodEvents.filter(e => e.startDate.getTime() > startDate.toMillis())
          for (let i = 0; i < this.visibleEmissionsParameters.length; i++) {
            let param = this.visibleEmissionsParameters[i];
            let numEvents = periodEvents.length;
            let isConditionMet = this.isConditionMet(numEvents, param.rule.sym, param.rule.value);
            if (isConditionMet) {
              statusObjects.push(this.makeObject("compliance", "VISIBLE_EMISSIONS", flareID, period, param.color))
              break;
            }
          }
        }
      }
      return statusObjects
    } catch (err) { throw getErrorObject(err, "StatusGenerator.generateVisibleEmissionObjects:") }
  }

  generateSo2EmissionObjects() {
    try {
      const myReducer = (accumulator, currentValue) => { return { value: accumulator.value + currentValue.value } };
      let statusObjects = [];
      this.so2EmissionsParameters.sort((a, b) => a.order - b.order);
      for (let flare of this.flares) {
        let flareID = flare._id.toString();
        let dailyDocsForFlare = this.so2EmissionsDocs[flareID];
        for (let period of this.periods) {
          let startDate = this.getPeriodStart(period);
          console.log("period", period, startDate.toISO());
          dailyDocsForFlare = dailyDocsForFlare.filter(d => d.start.getTime() >= startDate.toMillis())
          for (let i = 0; i < this.so2EmissionsParameters.length; i++) {
            let param = this.so2EmissionsParameters[i];
            let rule = this.numericEventRules.find(r => String(r._id) === String(param._id));
            let paramDocs = dailyDocsForFlare.filter(d => String(d.parameter) === String(rule.parameter))
            let numEvents = 0;
            let numdays = 0;
            paramDocs.map(d => {
              console.log(d.start)
              let dailyTotal = d.data.reduce(myReducer).value;
              numdays++;
              if (dailyTotal > rule.actionValue) { console.log("MEETS!"); numEvents++;}
            });
            console.log("numdays: ", numdays)
            let isConditionMet = this.isConditionMet(numEvents, param.rule.sym, param.rule.value);
            if (isConditionMet) {
              statusObjects.push(this.makeObject("compliance", "SO2_EMISSIONS", flareID, period, param.color))
              break;
            }
          }
        }
      }
      return statusObjects
    } catch (err) { throw getErrorObject(err, "StatusGenerator.generateVisibleEmissionObjects:") }
  }

  async generateEventRuleObjects() {
    try {
      let statusObjects = [];
      this.eventRuleParameters.sort((a, b) => a.order - b.order);
      this.displayNames = [];
      this.eventRuleParameters.forEach(p => {
        if (!this.displayNames.includes(p.displayName)) this.displayNames.push(p.displayName);
      })
      for (let displayName of this.displayNames) {
        let parameters = this.eventRuleParameters.filter(p => {
          return p.displayName === displayName;
        })
        parameters.sort((a, b) => a.order - b.order);
        for (let flare of this.flares) {
          let flareID = flare._id.toString();
          for (let period of this.periods) {
            let startDate = this.getPeriodStart(period);
            for (let i = 0; i < parameters.length; i++) {
              let param = parameters[i];
              let eventRuleID = param._id.toString()
              let periodEvents = this.events[eventRuleID][flareID].filter(e => e.start.getTime() > startDate.toMillis())
              let numEvents = periodEvents.length;
              let isConditionMet = this.isConditionMet(numEvents, param.rule.sym, param.rule.value);
              if (isConditionMet) {
                statusObjects.push(this.makeObject(param.section, displayName, flareID, period, param.color))
                break;
              }
            }
          }
        }
      }
      return statusObjects
    } catch (err) { throw getErrorObject(err, "StatusGenerator.generateEventRuleObjects:") }
  }

  async getStatusObjects() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let visibleEmissionsObjects = await this.generateVisibleEmissionObjects();
          let so2EmissionsObjects = await this.generateSo2EmissionObjects();
          let eventRuleObjects = await this.generateEventRuleObjects();
          let allObjects = [...visibleEmissionsObjects, ...eventRuleObjects, ...so2EmissionsObjects];
          return resolve(allObjects);
        } catch (err) { return reject(getErrorObject(err, "StatusGenerator.updateBaseInfo:")) }
      })();
    })
  }

  async run(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await this.updateBaseInfo(payload);
          let statusObjects = await this.getStatusObjects();
          return resolve(statusObjects);
        } catch (err) { return reject(getErrorObject(err, "StatusGenerator.run:")) }
      })();
    })
  }
}

exports.handler = async (event) => {
  try {
    let payload = setSettings(event);
    if (IS_DEV_LOCAL_ENV) require('dotenv').config();
    if (STATUS_CALCULATOR === null) {
      STATUS_CALCULATOR = new StatusGenerator();
      await STATUS_CALCULATOR.initClass();
    }
    if (STATUS_CALCULATOR.mongo.mongooseStatus() === 0) await STATUS_CALCULATOR.initClass();
    let statusBody = await STATUS_CALCULATOR.run(payload);
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
