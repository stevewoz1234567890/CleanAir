const MongoData = require('./MongoData');
const { ObjectId } = require("mongodb");
const { DateTime } = require('luxon');
const util = require('util');

//Main class object
var PROCESSOR = null;

//testing variables
var IS_DEV_LOCAL_ENV = false;
var PROGRESS_DEBUG_LOGS = false;
var PARSE_INPUT = true;

function getErrorObject(error, path, isAsync = true) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  let ret = { printPath: path, error }
  if (!isAsync) return new Error(JSON.stringify(ret));
  return ret;
}


function setSettings(event) {
  if (event.hasOwnProperty("invokerArgs")) {
    let { settings, body } = event.invokerArgs;
    IS_DEV_LOCAL_ENV = settings.IS_DEV_LOCAL_ENV;
    PROGRESS_DEBUG_LOGS = settings.PROGRESS_DEBUG_LOGS;
    PARSE_INPUT = settings.PARSE_INPUT;
    return body;
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

class NumEventProcessor {
  constructor() {
    this.mongo = new MongoData(IS_DEV_LOCAL_ENV);
  }

  async template() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "NumEventProcessor.template:()")) }
      })();
    })
  }

  async initClass() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await this.mongo.initClient();
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "NumEventProcessor.initClass():")) }
      })();
    })
  }

  async updateBaseInfo() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          this.orgs = await this.mongo.getOrgs();
          this.orgsMap = {};
          this.orgs.forEach(o => this.orgsMap[o._id.toString()] = o);
          this.flares = await this.mongo.getFlares();
          this.headers = await this.mongo.getHeaders();
          this.rules = await this.mongo.getNumericEventRules();
          this.pitags = await this.mongo.getPitags();
          this.rulesMap = {};
          this.rules.forEach(r => this.rulesMap[r._id.toString()] = r);
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "NumEventProcessor.updateBaseInfo:()")) }
      })();
    })
  }

  getRecords(payload) {
    try {
      let records = payload.Records.map(r => {
        let record = PARSE_INPUT ? JSON.parse(r.body) : r;
        let zone = this.orgsMap[record.updateInfo.org].timezone
        let isFormula = record.ruleInfo.parameterType === "formula";
        if (isFormula) {
          record.ruleInfo.resolution = this.rulesMap[record.ruleInfo.numericEventRules[0]].resolution;
          record.updateInfo.parameter = record.updateInfo.formula;
          record.updateInfo.ts = [DateTime.fromISO(record.updateInfo.date, { zone })];
          record.updateInfo.values = [record.updateInfo.value];
        } else { //works for tags
          /**
           * In theory, a user could give a total mix of timestamps so we have to be able to handle each ts
           */
          let matchingTag = this.pitags.find(t => String(t._id) === record.updateInfo.parameter);
          record.ruleInfo.resolution = matchingTag.resolution ?? 1;
          record.updateInfo.ts = record.updateInfo.ts.map(t => DateTime.fromMillis(t, { zone }));
          record.updateInfo.flare = String(matchingTag.flare);
          record.updateInfo.header = String(matchingTag.header);
        }
        return record;
      });
      try {
        let pitagData = records.filter(r => r.ruleInfo.parameterType === "pitag");
        // if (pitagData.length > 0 || true) console.log("pitag data: ", pitagData);
      } catch (e) { console.log("caught error for pitag rule handling", e) }
      records = records.filter(r => !(r.updateInfo.debug)); // we should not be handling debug data
      return records;
    } catch (err) { throw getErrorObject(err, "NumEventProcessor.updateBaseInfo:()") }
  }

  /**
   * Here we try to get the inputs into they're corresponding groups by startDay.
   * @param {*} payload 
   * @returns 
   */
  getRecordGroups(payload) {
    try {
      let records = this.getRecords(payload);
      let groups = []; // org, parameter, parameterType, flare, header, startDay; values ({start,end,value})
      for (const record of records) {
        let rui = record.updateInfo;
        let rri = record.ruleInfo;
        let valuesByDayStart = [];
        for (let i = 0; i < rui.values.length; i++) {
          let dayStart = rui.ts[i].startOf('day');
          let date = rui.ts[i];
          let match = valuesByDayStart.find(o => o.dayStart.toMillis() === dayStart.toMillis());
          let newVal = {
            value: rui.values[i],
            date: date.toJSDate(),
            start: date.plus({ minutes: (-1 * rri.resolution) }).toJSDate(),
          }
          if (rri.resolution === 15 && date.minute % 15 !== 0) throw new Error(`15-min resolution date is not valid: ${date.toISO()}`)
          if (date.toMillis() % 60000 !== 0) throw new Error(`Date is not strictly on a minute mark: ${date.toISO()}`)
          if (!match) {
            let newEntry = {
              dayStart,
              values: [newVal]
            }
            valuesByDayStart.push(newEntry);
          }
          else match.values.push(newVal);
        }
        for (const dayEntry of valuesByDayStart) {
          let groupMatch = groups.find(g => {
            let gi = g.info;
            return (
              rui.org === gi.org &&
              rui.parameter === gi.parameter &&
              rri.parameterType === gi.parameterType &&
              rui.flare === gi.flare &&
              rui.header === gi.header &&
              dayEntry.dayStart.toMillis() === gi.dayStart.toMillis()
            )
          });
          if (!groupMatch) {
            let group = {
              info: {
                org: rui.org,
                parameter: rui.parameter,
                parameterType: record.ruleInfo.parameterType,
                flare: rui.flare,
                header: rui.header,
                dayStart: dayEntry.dayStart,
              },
              values: [...dayEntry.values],
            }
            groups.push(group);
          }
          else groupMatch.values.push(...dayEntry.values);
        }
      }
      return groups;
    } catch (err) {
      console.log(err)
      throw getErrorObject(err, "NumEventProcessor.getRecordGroups:()", false)
    }
  }

  /**
   * Here we pull the day-based records
   * @param {*} recordGroups 
   * @param {*} directlyAssign 
   * @returns 
   */
  async getDailyNumericData(recordGroups, directlyAssign = false) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let docs = [];
          await Promise.all(recordGroups.map(group => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  let gi = group.info;
                  let filter = { //We have to expand because otherwise gi.start becomes permanently changed --we want to keept it as a DateTime
                    org: gi.org,
                    parameter: gi.parameter,
                    parameterType: gi.parameterType,
                    header: gi.header,
                    flare: gi.flare,
                    start: gi.dayStart.toMillis(),
                  }
                  let doc = await this.mongo.getDailyNumericData(filter, true);
                  if (doc) docs.push(doc);
                  if (directlyAssign) group.doc = doc ?? null;
                  return resolve();
                } catch (err) { return reject(getErrorObject(err, "NumEventProcessor.template:()")) }
              })();
            })
          }))
          return resolve(docs)
        } catch (err) { return reject(getErrorObject(err, "NumEventProcessor.getDailyNumericData:()")) }
      })();
    })
  }

  dailyNumDocMatch(group) {
    return function (doc) {
      return (
        doc.org.toString() === group.updateInfo.org &&
        doc.start.getTime() === group.updateInfo.start.toMillis() &&
        doc.parameter.toString() === group.updateInfo.parameter &&
        doc.flare.toString() === group.updateInfo.flare &&
        doc.header.toString() === group.updateInfo.header
      )
    }
  }

  updateDailyNumDocs(recordGroups, dailyNumericDocs = null, directAccess = true) { //directAccess=false is not implemented
    try {
      /**
      for each record group, check if it has a matching document. Maybe attach document if yes else null
      if null, the create the new document,
      else add to document
      return documents
      */
      let returnDocs = recordGroups.map(group => { //In theory, eveything works such that there are no duplicate groups...
        group.values.sort((a, b) => a.date.getTime() - b.date.getTime())
        let matchingDoc = group.doc; //: dailyNumericDocs.find(this.dailyNumDocMatch(group));
        if (matchingDoc) {
          group.values.forEach(o => {
            let matchingValueIndex = matchingDoc.data.findIndex(datum => datum.date.getTime() === o.date.getTime());
            if (matchingValueIndex !== -1) matchingDoc.data[matchingValueIndex] = o;
            else matchingDoc.data.push(o);
          })
          matchingDoc.data.sort((a, b) => a.date.getTime() - b.date.getTime())
          matchingDoc.op = "update";
          return matchingDoc;
        }
        else {
          let dayStart = group.info.dayStart;
          let dayStartMS = dayStart.toMillis();
          // let dayEndMS = DateTime.fromMillis(dayStartMS, { zone: this.orgsMap[group.info.org].timezone }).plus({ days: 1 }).toMillis();
          let newDoc = {
            org: group.info.org,
            start: dayStart.toJSDate(),
            end: dayStart.plus({ days: -1 }).toJSDate(),
            parameter: group.info.parameter,
            parameterType: group.info.parameterType,
            flare: group.info.flare,
            header: group.info.header,
            data: group.values,
            op: "insert",
          }
          group.doc = newDoc;
          return newDoc;
        }
      })
      return returnDocs;
    } catch (err) { getErrorObject(err, "NumEventProcessor.updateDailyNumDocs:()") }
  }

  async uploadToDb(docs) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let insertOps = docs.filter(d => d.op === "insert");
          let updateOps = docs.filter(d => d.op === "update");
          updateOps = updateOps.map(d => {
            if (!d._id) throw new Error("no _id in the docs")
            return {
              updateOne: {
                filter: { _id: d._id },
                update: { $set: { data: d.data } },
                upsert: false,
              }
            }
          });
          insertOps = insertOps.map(d => {
            delete d.op;
            return { insertOne: { document: d } }
          });
          let bulkOps = [...insertOps, ...updateOps];
          let res = await this.mongo.bulkUpdateDailyNumData(bulkOps);
          // console.log("response: ", res);
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "NumEventProcessor.uploadToDb")) }
      })();
    })
  }

  async run(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // console.log("payload: ", payload);
          if (payload.Records.length === 0) return resolve();
          await this.updateBaseInfo();
          let recordGroups = this.getRecordGroups(payload);
          // console.log("recordGroups: ", util.inspect(recordGroups, {depth:null, maxArrayLength:null}))
          await this.getDailyNumericData(recordGroups, true);
          let updatedDocs = this.updateDailyNumDocs(recordGroups);
          // console.log("updatedDocs: ", util.inspect(updatedDocs, { depth: null, maxArrayLength: null }))
          let response = await this.uploadToDb(updatedDocs);
          return resolve("complete");
        } catch (err) { return reject(getErrorObject(err, "NumEventProcessor.run()):")) }
      })();
    })
  }
}

exports.handler = async (event) => {
  try {
    let payload = setSettings(event);
    if (IS_DEV_LOCAL_ENV) require('dotenv').config();
    if (PROCESSOR === null) {
      PROCESSOR = new NumEventProcessor();
      await PROCESSOR.initClass();
    }
    if (PROCESSOR.mongo.mongooseStatus() === 0) await PROCESSOR.initClass();
    let statusBody = await PROCESSOR.run(payload);
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
