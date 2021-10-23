const MongoData = require('./MongoData');
const { ObjectId } = require("mongodb");
const { DateTime } = require('luxon');
const util = require('util');
const { start } = require('repl');

//Main class object
var REFRESHER = null;

//testing variables
var IS_DEV_LOCAL_ENV = false;
var PARSE_INPUT = true;
var PROGRESS_DEBUG_LOGS = false;

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

function roundToMinute(datetime) {
  return datetime.plus({ seconds: -1 * datetime.second, milliseconds: -1 * datetime.millisecond });
}

function getDateGroups(start, end, groupSize) {
  if (groupSize < 1) return [];
  start = start.startOf('day');
  end = end.startOf('day');
  let pivot = start.plus({ days: 0 }); //need a copy
  let groups = [];
  let group = [];

  while (pivot <= end) {
    if (group.length === groupSize) {
      groups.push(group);
      group = [];
    }
    group.push(pivot);
    pivot = pivot.plus({ days: 1 })
    
  }
  if (group.length > 0) groups.push(group);
  return groups;
}

class DailyNumDataRefresher {
  constructor() {
    this.mongo = new MongoData(IS_DEV_LOCAL_ENV);
  }

  async template() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.template:()")) }
      })();
    })
  }

  async initClass() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await this.mongo.initClient();
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.initClass():")) }
      })();
    })
  }

  async updateBaseInfo() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          this.orgs = await this.mongo.getOrgs();
          this.orgsMap = {};
          this.orgs.forEach(o => {
            this.orgsMap[o._id.toString()] = o;
            o.numericRules = [];
          });
          this.flares = await this.mongo.getFlares();
          this.headers = await this.mongo.getHeaders();
          let allRules = await this.mongo.getNumericEventRules();
          this.rules = [];
          //this is because we cant have rules with same param or it causes problems (and its unessesary)
          allRules.forEach(rule => {
            if (!this.rules.find(r => String(r.parameter) === String(rule.parameter))) this.rules.push(rule);
          });
          this.pitags = await this.mongo.getPitags();
          this.rulesMap = {};
          this.rules.forEach(r => {
            this.rulesMap[r._id.toString()] = r;
            let org = this.orgs.find(o => String(o._id) === String(r.org));
            if (org) org.numericRules.push(r);
          });
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.updateBaseInfo:()")) }
      })();
    })
  }

  async getRawParamData(org, dateGroup) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let rawData = {};
          let formulaRules = org.numericRules.filter(r => r.parameterType === "formula");
          let formulaOIDs = formulaRules.map(r => r.parameter);
          //assumes that the dates are already in the correct chronological order (asc)
          let n = dateGroup.length;
          rawData.formula = await this.mongo.getFormulaData({
            formula: { $in: formulaOIDs },
            //recall the dateGroup dates are all at the start of the day
            //also recall that each datum's timestamp refers to when it ends (not when it starts).
            date: { $gt: dateGroup[0].toJSDate(), $lte: dateGroup[n - 1].plus({ days: 1 }).toJSDate() }
          })
          return resolve(rawData)
        } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.getRawParamData:()")) }
      })();
    })
  }

  async getDailyDocs(org, dateGroup) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let dailyDocs = {};
          let formulaRules = org.numericRules.filter(r => r.parameterType === "formula");
          let formulaOIDs = formulaRules.map(r => r.parameter);
          //assumes that the dates are already in the correct chronological order (asc)
          let n = dateGroup.length;
          let filter = {
            parameter: { $in: formulaOIDs },
            //recall the dateGroup dates are all at the start of the day
            //also recall that each datum's timestamp refers to when it ends (not when it starts).
            start: { $gte: dateGroup[0].toJSDate(), $lte: dateGroup[n - 1].toJSDate() }
          };
          dailyDocs.formula = await this.mongo.getDailyNumericData(filter);
          return resolve(dailyDocs);
        } catch (err) { return reject(getErrorObject(err, "getDaiyDocs.template:()")) }
      })();
    })
  }

  //creates an update for a document (does not do the update itself)
  async updateDocument(date, doc, rawParamsData, documents) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          /**
          for each minute in a day
            get param minute data
            get daily doc minute
            if they are not equal, then dailydoc[index] = param data for that minute
           */
          let updateMade = false;
          for (let offsetMinutes = 0; offsetMinutes < 1440; offsetMinutes++) { //recall that data dates are the END, and recall date is the START of the day
            let dt = date.plus({ minutes: (offsetMinutes + 1) });
            let paramDatum = rawParamsData.formula.find(d => {
              return (
                d.date.getTime() === dt.toMillis() &&
                String(d.formula) === String(doc.parameter) &&
                String(d.flare) === String(doc.flare) &&
                String(d.header) === String(doc.header)
              )
            });
            if (!paramDatum) {
              if (doc.data[offsetMinutes]?.value !== null ) updateMade = true;
              doc.data[offsetMinutes] = {
                value: null,
                date: dt.toJSDate(),
                start: dt.plus({ minutes: -1 }).toJSDate(),
              };
            }
            else if (doc.data[offsetMinutes].value !== paramDatum.value || doc.data[offsetMinutes].date.getTime() !== dt.toMillis()) {
              doc.data[offsetMinutes] = {
                value: paramDatum.value,
                date: dt.toJSDate(),
                start: dt.plus({ minutes: -1 }).toJSDate(),
              };
              updateMade = true;
            }
          }
          if (updateMade) documents.updated.push(doc);
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.updateDocument:()")) }
      })();
    })
  }

  async createNewDocument(date, rule, flare, header, rawParamsData, documents) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          var data = [];
          for (let offsetMinutes = 0; offsetMinutes < 1440; offsetMinutes++) { //recall that data dates are the END, and recall date is the START of the day
            let dt = date.plus({ minutes: (offsetMinutes + 1) });
            let paramDatum = rawParamsData.formula.find(d => {
              return (
                d.date.getTime() === dt.toMillis() &&
                String(d.formula) === String(rule.parameter) &&
                String(d.flare) === String(flare) &&
                String(d.header) === String(header)
              )
            });
            let newDatum = {
              value: paramDatum?.value ?? null,
              date: dt.toJSDate(),
              start: dt.plus({ minutes: -1 }).toJSDate(),
            };
            data.push(newDatum);
          }
          let newDocument = {
            org: rule.org,
            parameter: rule.parameter,
            parameterType: rule.parameterType,
            start: date.toJSDate(),
            end: date.plus({ days: 1 }).toJSDate(),
            flare,
            header,
            data,
          };
          documents.new.push(newDocument);
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.createNewDocument:()")) }
      })();
    })
  }

  async uploadDocs(documents) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let updates = documents.updated.map(doc => {
            let filter = { _id: doc._id };
            let update = { '$set': { data: doc.data } };
            let op = { 'updateOne': { filter, update } };
            return op
          });
          let inserts = documents.new.map(doc => {
            return { 'insertOne': { 'document': doc } }
          });
          let r = documents.new.length + documents.updated.length === 0 ? "nothing uploaded" : null;
          if (updates.length > 0 || inserts.length > 0) r = await this.mongo.bulkUpdateDailyNumData([...updates, ...inserts]);
          console.log("upload response: ", r);
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.uploadDocs:()")) }
      })();
    })
  }

  async refreshDailyNumericData(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {

          for (let org of this.orgs) {
            if (!org.numericRules || org.numericRules.length === 0) continue;
            let zone = org.timezone;
            let temp = DateTime.now().startOf('day').plus({ days: -4 }).setZone(zone);
            let startDate = DateTime.fromJSDate(temp.toJSDate(), { zone });
            // let startDate = DateTime.fromJSDate(org.dataRangeStart, { zone });
            let endDate = DateTime.now().plus({ hours: -1 }).setZone(zone);
            startDate = roundToMinute(startDate);
            endDate = roundToMinute(endDate)
            let dateGroups = getDateGroups(startDate, endDate, 7);
            for (let dateGroup of dateGroups) {
              if (PROGRESS_DEBUG_LOGS) {
                console.log(`Running dates: ${dateGroup[0].toISO()}-${dateGroup[dateGroup.length - 1].toISO()}`)
              }
              /** 
               * 
              - pull the raw rule data
              - pull the daily data
              - for each (MAPPED) daily datum sheet, do comparisons, if update the update/upsert...
              MAKE SURE WE HAVE UNIQUE KEYS
              - print progress, when done we done...
              */
              let rawParamsData = await this.getRawParamData(org, dateGroup);
              let dailyDocs = await this.getDailyDocs(org, dateGroup);
              let documents = {
                updated: [],
                new: [],
              }
              await Promise.all(dateGroup.map(date => {
                return new Promise((resolve, reject) => {
                  (async () => {
                    try {
                      for (let rule of org.numericRules) {
                        if (rule.parameterType === "pitag") {
                          // let matchingDailyDoc = dailyDocs['pitag'].find(doc => String(rule.parameter) === String(doc.parameter));
                          //unfinished... 
                        } else if (rule.parameterType === "formula") {
                          let formulaDocs = dailyDocs['formula'].filter(doc => String(rule.parameter) === String(doc.parameter) && date.toMillis() === doc.start.getTime());
                          let hasHeaders = Boolean(formulaDocs[0]?.header) != false;
                          for (let flare of this.flares) {
                            if (hasHeaders) {
                              let headers = this.headers.filter(h => String(h.flare) === String(flare._id));
                              for (let header of headers) {
                                let matchingDailyDoc = formulaDocs.find(doc => {
                                  return (
                                    String(rule.parameter) === String(doc.parameter) &&
                                    String(header._id) === String(doc.header)
                                  )
                                });
                                if (matchingDailyDoc) await this.updateDocument(date, matchingDailyDoc, rawParamsData, documents);
                                else await this.createNewDocument(date, rule, flare._id, header._id, rawParamsData, documents);
                              }
                            } else {
                              let matchingDailyDoc = formulaDocs.find(doc => {
                                return (
                                  String(rule.parameter) === String(doc.parameter) &&
                                  String(flare._id) === String(doc.flare)
                                )
                              });
                              if (matchingDailyDoc) await this.updateDocument(date, matchingDailyDoc, rawParamsData, documents);
                              else await this.createNewDocument(date, rule, flare._id, null, rawParamsData, documents);
                            }
                          }
                        }
                      }

                      return resolve();
                    } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.refreshDailyNumericData.map:()")) }
                  })();
                })
              }))
              console.log("uploading...");
              await this.uploadDocs(documents);
            }
          }

          return resolve()
        } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.refreshDailyNumericData:()")) }
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
      } catch (e) { console.log("caught error for pitag rule handling", e) }
      records = records.filter(r => !(r.updateInfo.debug)); // we should not be handling debug data
      return records;
    } catch (err) { throw getErrorObject(err, "DailyNumDataRefresher.updateBaseInfo:()") }
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
      console.log("ERROR: ", err)
      throw getErrorObject(err, "DailyNumDataRefresher.getRecordGroups:()", false)
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
                } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.template:()")) }
              })();
            })
          }))
          return resolve(docs)
        } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.getDailyNumericData:()")) }
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
    } catch (err) { getErrorObject(err, "DailyNumDataRefresher.updateDailyNumDocs:()") }
  }


  async run(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          /**
          get the numeric event rules
          get the org and org earliest availabnel time
          do all rules, but do 1 week of daily files at a time of checkign files and updatine
          then done
           */
          console.log("payload: ", payload);
          await this.updateBaseInfo();
          await this.refreshDailyNumericData(payload);
          console.log("completed...")
          return resolve("complete");
        } catch (err) { return reject(getErrorObject(err, "DailyNumDataRefresher.run()):")) }
      })();
    })
  }
}

exports.handler = async (event) => {
  try {
    let payload = setSettings(event);
    if (IS_DEV_LOCAL_ENV) require('dotenv').config();
    if (REFRESHER === null) {
      REFRESHER = new DailyNumDataRefresher();
      await REFRESHER.initClass();
    }
    if (REFRESHER.mongo.mongooseStatus() === 0) await REFRESHER.initClass();
    let statusBody = await REFRESHER.run(payload);
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
