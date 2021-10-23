const { Event, DebugEvent, EventRule, Formula, FormulaValue, DebugFormulaValue, Flare, Header } = require('./FRTModels');
require('dotenv').config();
const mongoose = require('mongoose')
const { Mongo, strToOid, strToDate, objPrint, hasDuplicates } = require('./utils');
const { Model } = require('mongoose');
const { ObjectId } = require('mongodb');
const cloneDeep = require('lodash.clonedeep');
const util = require('util'); //for full-form printing of object

UPLOAD_EVENTS = true;
const DEBUG_LOGS_1 = false;
const DEBUG_LOGS_3 = true;
const DEV_MODE = (process.env.isProd == 'true') ? false : true;
if (DEV_MODE) console.log("Running in Development Mode");
if (DEBUG_LOGS_1) console.log("Running with debug mode (print statements)")

var MONGO = null;
var RULES = null;

function getErrorObject(error, path) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  return { printPath: path, error };
}

class WidgetMain {
  constructor() {
    //Initalized in this.initMain()
    this.ruleIdsToProcces = []; //array of ruleIDs as strings
    this.grouped_violations_dict;
    this.localEdgeEventsByRule = {};
    this.formulasIDtoObj = {};
    this.headerIDtoFlareID = {};
  }

  /**
   * Change formula value to new format required for parsing
   * @param {Array} period 
   */
  formulaValueToLocalFormat(period, ruleID, debug) {
    try {
      return {
        ruleId: new ObjectId(ruleID),
        formulaValue: {
          _id: period._id,
          flare: period.flare,
          header: period.header,
          value: period.value
        },
        withNumValue: period.withValues ? period.withValues : null,
        start: period.start,
        end: period.date,
        org: period.org,
        debug
      }
    } catch (err) { return getErrorObject(err, "WidgetMain.formulaValuesToLocalRecords()") }
  }

  /** **********************************************************************************************
   * @desc The entrypoint for the class.
   */
   async fillWithValueIfMissing(period, ruleID, debug, allPeriods) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let rule = RULES[ruleID];
          // if (rule._id.toString === "60dc6b7c2397b445c8f02797") {
          //   console.log("period:", period);
          //   console.log("rule:", rule)
          // }


          // if (rule.resolution === 1 && rule.withValues && rule.checkFor && period.withNumValue === null) {
          //   let collection = debug === true ? DebugFormulaValue : FormulaValue;
          //   let filter = {
          //     formula: rule.checkForValue,
          //     date: period.end,
          //     org: period.org,
          //     flare: period.formulaValue.flare,
          //     header: period.formulaValue.header
          //   }
          //   let v = await collection.findOne(filter).select('value date').lean().exec();
          //   period.withNumValue = [{ value: v.value, _id: v._id, date: v.date }] //my assumtion is that it will not be a problem... in theory it could be undefined or null
          //   return resolve(period)
          // }
          if (rule.resolution === 15 && rule.withValues && rule.checkFor) { // && period.withNumValue === null
            let collection = debug === true ? DebugFormulaValue : FormulaValue;
            let filter = {
              formula: rule.checkForValue,
              date: { $gt: period.start, $lte: period.end },
              org: period.org,
              flare: period.formulaValue.flare,
              header: period.formulaValue.header
            }
            let vals = await collection.find(filter).select('value date').sort({ date: 1 }).lean().exec();
            period.withNumValue = vals.map(v => {
              return { value: v.value, valID: v._id }
            })
            allPeriods.push(period)
            return resolve(period)
          }
          else {
            // if (rule.resolution === 15 && rule._id.toString() === "5fde89a93518d54f48176647") console.log("OB: ", period)
            return resolve(period)
          }
        } catch (error) { return reject(getErrorObject(error, "WidgetMain.fillWithValueIfMissing()")) }
      })();
    });
  }



  /** **********************************************************************************************
   * @desc
   * 1. Connect to Mongo if not already connected
   * 2. Convert payload from strings to Date/ObjIDs + change the structure to a dict + sort
   * 3. Get all the rules if null, and store num rules
   * - Initalize Class Vars: this.ruleIdsToProcces, this.numRulesToProccess, this.grouped_violations_dict;
   * @return None
  */
  async initMain(options) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (options.dev === undefined) throw new Error("options.dev is undefined")

          /** 1. Connect to MongoDB */
          if (MONGO === null || MONGO.mongooseStatus() === 0) {
            MONGO = new Mongo();
            await MONGO.initClient();
          }

          //we need the below to take advantage of existing indexes for pulling formulaValues
          let flares = await Flare.find({ org: options.org }).lean().exec();
          let headers = await Header.find({ org: options.org }).lean().exec();
          let formulas = await Formula.find({ org: options.org }).lean().exec();
          for (let flare of flares) {
            flare.headerIDs = [];
            for (let header of headers) {
              if (header.flare.toString() === flare._id.toString()) {
                this.headerIDtoFlareID[header._id.toString()] = flare._id.toString();
                flare.headerIDs.push(header._id.toString())
              }
            }
          }
          for (let formula of formulas) {
            this.formulasIDtoObj[formula._id.toString()] = formula;
          }

          /** 2.Get rules into the global space */
          if (RULES === null) {
            RULES = {};
            let rules = await EventRule.find({}, { subscribers: 0, createdDate: 0, lastUpdate: 0 }).sort({ date: 1 }).lean().exec();
            for (const rule of rules) {
              let ruleID = rule._id.toString();
              RULES[ruleID] = rule;
            }
          }
          for (const rule of Object.values(RULES)) {
            let ruleID = rule._id.toString();
            this.ruleIdsToProcces.push(ruleID)
            let to = this.formulasIDtoObj[rule.formula.toString()].to;
            this.localEdgeEventsByRule[ruleID] = {};
            for (let flare of flares) {
              if (to === "flare") {
                this.localEdgeEventsByRule[ruleID][flare._id.toString()] = { oldest: null, newest: null };
              } else if (to === "headers") {
                for (let headerID of flare.headerIDs) {
                  this.localEdgeEventsByRule[ruleID][headerID] = { oldest: null, newest: null };
                }
              }
            }
          }

          // console.log("RULES: ", RULES);
          // throw new Error("stopped")
          let allPeriods = []

          /** 3.Get all the periods and group the in a dictionary by rule */
          let grp_vio_dict = {};
          let collection = options.dev === true ? DebugFormulaValue : FormulaValue;
          for (let rule of Object.values(RULES)) {
            if (rule.resolution !== 15) continue;
            let ruleID = rule._id.toString();
            grp_vio_dict[ruleID] = {
              formula: this.formulasIDtoObj[rule.formula.toString()],
              periodGroupsMap: {},
              periodGroups: [],
            };
            let to = this.formulasIDtoObj[rule.formula.toString()].to;
            for (let flare of flares) {
              if (to === "flare") {
                let periodGroup = {
                  _id: flare._id,
                  periods: []
                }
                let filter = {
                  org: options.org,
                  date: { $gte: options.start, $lt: options.end },
                  formula: rule.formula,
                  flare: flare._id,
                  header: null,
                  value: rule.checkFor
                }
                // console.log("filter: ", filter)
                let rulePeriods = await collection.find(filter).lean().exec();
                if (rulePeriods.length > 0) {
                  // console.log("formula: ", filter.formula, "flare: ", filter.flare)
                  // console.log("num items: ", rulePeriods.length)
                  periodGroup.periods = rulePeriods.map(period => this.formulaValueToLocalFormat(period, ruleID, options.dev));
                  periodGroup.periods = await Promise.all(periodGroup.periods.map(period => this.fillWithValueIfMissing(period, ruleID, options.dev, allPeriods)))
                } else {
                  // console.log("No items pulled/found from db") 
                }
                grp_vio_dict[ruleID].periodGroups.push(periodGroup);
                grp_vio_dict[ruleID].periodGroupsMap[periodGroup._id.toString()] = periodGroup;

              } else if (to === "headers") {
                for (let headerID of flare.headerIDs) {
                  let periodGroup = {
                    _id: headerID,
                    periods: []
                  }
                  let filter = {
                    org: options.org,
                    date: { $gte: options.start, $lte: options.end },
                    formula: rule.formula,
                    flare: flare._id,
                    header: headerID,
                    value: rule.checkFor
                  }
                  // console.log("filter: ", filter)
                  let rulePeriods = await collection.find(filter).lean().exec();
                  if (rulePeriods.length > 0) {
                    // console.log("num items: ", rulePeriods.length)
                    periodGroup.periods = rulePeriods.map(period => this.formulaValueToLocalFormat(period, ruleID, options.dev));
                    periodGroup.periods = await Promise.all(periodGroup.periods.map(period => this.fillWithValueIfMissing(period, ruleID, options.dev, allPeriods)))
                  } else {
                    // console.log("No items pulled/found from db") 
                  }
                  // console.log("group: ", periodGroup)
                  grp_vio_dict[ruleID].periodGroups.push(periodGroup);
                  grp_vio_dict[ruleID].periodGroupsMap[periodGroup._id.toString()] = periodGroup;
                }
              }
            }
            // console.log("Finished pulling a set...")
          }


          console.log("all periods len: ", allPeriods.length)
          console.log("HERE: ", util.inspect(allPeriods, { depth: null, maxArrayLength: 1}));

          await Promise.all(allPeriods.map(period => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  let r = await FormulaValue.findOneAndUpdate({_id:period.formulaValue._id}, {withValues : period.withNumValue})
                  console.log(r)
                  return resolve()
                } catch (e) { return reject(getErrorObject(e, "dumbspot")) }
              })()
            })
          }))
          // throw new Error("hi")


          resolve();
        } catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "WidgetMain.initMain(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          reject({ printPath: "WidgetMain.initMain(): ", error })
        }
      })();
    })
  }

  addWappertoEvents(events, isFromRemote) {
    return events.map(event => {
      return { event, fromRemote: isFromRemote, }
    });
  }

  removeLocalEvents(remoteEvents, localEvents) {
    return remoteEvents.filter(remoteEvent => {
      let localVersion = localEvents.find(localEvent => {
        if (localEvent.fromRemote !== true) return false
        return (localEvent.event._id.toString() === remoteEvent.event._id.toString())
      })
      if (localVersion) {
        if (DEBUG_X) console.log("removing local event")
        return false;
      }
      else return true;
    });
  }

  /** **********************************************************************************************
   * @desc Get the continuing event th at will be extended by the input violation
   * @param string ruleId 
   * @param object violation 
   */
  async getEventToUpdate(ruleId, violation, localEvents) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let eventCollection = violation.debug ? DebugEvent : Event;
          let chunkResolution = RULES[ruleId].resolution; //in minutes
          let proximitySensitivity = RULES[ruleId].sensitivity; //in minutes

          let offset = chunkResolution * proximitySensitivity * 60000;
          let violationInclusiveFuturemostCutoff = new Date(violation.end.getTime() + offset);
          let violationInclusivePastmostCutoff = new Date(violation.start.getTime() - offset);
          let relevantLocalEvents = [];
          localEvents.forEach(event => {
            if (event.hasOwnProperty('removeRemoteEvent')) { return }
            if (event.start > violationInclusiveFuturemostCutoff || event.end < violationInclusivePastmostCutoff) return;
            if (event.header !== null) event.header = event.header.toString();
            if (violation.formulaValue.header !== null) violation.formulaValue.header = violation.formulaValue.header.toString();
            if (event.flare.toString() === violation.formulaValue.flare.toString() && event.header === violation.formulaValue.header) {
              relevantLocalEvents.push(
                {
                  event,
                  fromRemote: false,
                });
            }
          });

          //First we are checking for completely encompassed local events. it's the easiest case to check (but also less likley)
          let containingLocalEvent = relevantLocalEvents.filter(e => {
            return (violation.start >= e.event.start && violation.end <= e.event.end)
          });
          if (containingLocalEvent.length > 0) {
            let selectedEvent = containingLocalEvent[0];
            if (containingLocalEvent.length > 1) {
              console.log("Found more that one local containing event: ", containingLocalEvent)
            }
            if (violation.formulaValue.value === RULES[ruleId].checkFor) { //If the violation (new chunk) is already a part of the event ignore only if NOT with valuse, else check if withvalues needs update
              selectedEvent.flag = "already exists"
              return resolve(selectedEvent);
            }
            else { //Value has changed from true (match) to false (non match), so we need to delete it from the event
              selectedEvent.remove = true;
              return resolve(selectedEvent);
            }
          }

          //Next we check if it joins two existing local events
          let leftSideLocal = relevantLocalEvents.find(e => {
            return e.event.end >= violationInclusivePastmostCutoff && e.event.end <= violation.start
          });
          let rightSideLocal = relevantLocalEvents.find(e => {
            return e.event.start >= violation.end && e.event.start <= violationInclusiveFuturemostCutoff
          })
          if (leftSideLocal && rightSideLocal) {
            leftSideLocal.joinEvent = rightSideLocal;
            return resolve(leftSideLocal)
          }

          //Next we get the remote events
          let containingFilter = { start: { $lte: violation.start }, end: { $gte: violation.end }, eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header };
          let leftSideFilter = { end: { $gte: violationInclusivePastmostCutoff, $lte: violation.start }, eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header };
          let rightSideFilter = { start: { $gte: violation.end, $lte: violationInclusiveFuturemostCutoff }, eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header };
          let containingRemoteEvent = [] //await eventCollection.find(containingFilter).lean().exec();
          let leftSideRemote = [] //await eventCollection.find(leftSideFilter).sort({ "end": -1 }).lean().exec();
          let rightSideRemote = [] //await eventCollection.find(rightSideFilter).sort({ "start": 1 }).lean().exec();

          containingRemoteEvent = this.addWappertoEvents(containingRemoteEvent, true);
          leftSideRemote = this.addWappertoEvents(leftSideRemote, true);
          rightSideRemote = this.addWappertoEvents(rightSideRemote, true);

          containingRemoteEvent = this.removeLocalEvents(containingRemoteEvent, localEvents);
          leftSideRemote = this.removeLocalEvents(leftSideRemote, localEvents);
          rightSideRemote = this.removeLocalEvents(rightSideRemote, localEvents);

          // printArrIfMoreThanOne(containingRemoteEvent, "containingRemoteEvent");
          // printArrIfMoreThanOne(leftSideRemote, "leftSideRemote");
          // printArrIfMoreThanOne(rightSideRemote, "rightSideRemote");

          if (containingRemoteEvent.length > 0) {
            let selectedEvent = containingRemoteEvent[0];
            if (violation.formulaValue.value === RULES[ruleId].checkFor) { //If the violation (new chunk) is already a part of the event ignore only if NOT with valuse, else check if withvalues needs update
              selectedEvent.flag = "already exists"
              return resolve(selectedEvent);
            }
            else { //Value has changed from true (match) to false (non match), so we need to delete it from the event
              selectedEvent.remove = true;
              return resolve(selectedEvent);
            }
          }
          if (leftSideRemote.length > 0) leftSideRemote = leftSideRemote[0];
          else leftSideRemote = null;
          if (rightSideRemote.length > 0) rightSideRemote = rightSideRemote[0];
          else rightSideRemote = null;

          // if (leftSideLocal && rightSideLocal) { //already did this above
          // }
          if (leftSideLocal && rightSideRemote) { //join
            leftSideLocal.joinEvent = rightSideRemote;
            return resolve(leftSideLocal);
          } else if (leftSideRemote && rightSideLocal) { //join
            leftSideRemote.joinEvent = rightSideLocal;
            return resolve(leftSideRemote);
          } else if (leftSideRemote && rightSideRemote) { //join
            leftSideRemote.joinEvent = rightSideRemote;
            return resolve(leftSideRemote);
          } else if (leftSideLocal) { //append
            return resolve(leftSideLocal)
          } else if (rightSideLocal) { //prepend
            return resolve(rightSideLocal)
          } else if (leftSideRemote) { //append
            return resolve(leftSideRemote)
          } else if (rightSideRemote) { //prepend
            return resolve(rightSideRemote)
          } else { //is either a new event or skippable
            if (violation.formulaValue.value !== RULES[ruleId].checkFor) { //skippable event
              return resolve({ skip: true })
            } else {
              return resolve() //completely new event
            }
          }
        } catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "WidgetMain.getEventToUpdate(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          reject({ printPath: "WidgetMain.getEventToUpdate(): ", error })
        }
      })();
    });
  }

  /**
   * This will update the edge tracker when needed based on the input event. 
   * @param {string} ruleID 
   * @param {object} event 
   */
  async updateEdgeEventTracker(ruleID, event, periodGroupID) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let oldest = this.localEdgeEventsByRule[ruleID][periodGroupID].oldest;
          let newest = this.localEdgeEventsByRule[ruleID][periodGroupID].newest;
          if (oldest === null && newest === null) {
            this.localEdgeEventsByRule[ruleID][periodGroupID].oldest = event;
            this.localEdgeEventsByRule[ruleID][periodGroupID].newest = event;
            return resolve();
          }
          if (event.start <= oldest.start) {
            this.localEdgeEventsByRule[ruleID][periodGroupID].oldest = event;
          }
          if (event.end >= newest.end) {
            this.localEdgeEventsByRule[ruleID][periodGroupID].newest = event;
          }
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "WidgetMain.updateEdgeEventTracker()")) }
      })();
    })
  }

  /**
   * 
   * @param {String} ruleID 
   * @param {Object} edgeEvent 
   * @param {Object} foundEvent 
   * @param {Array} events 
   * @param {Boolean} foundEventPreceeds 
   * @returns null
   */
  async joinEvents(ruleID, edgeEvent, foundEvent, events, foundEventPreceeds) {
    return new Promise((resolve, reject) => {
      console.log("joiningEvents!!!")
      (async () => {
        try {
          if (typeof foundEventPreceeds !== "boolean") throw new Error(`foundEventPreceeds is not of type boolean: ${foundEventPreceeds}`);
          let resolution = RULES[ruleId].resolution;
          let proximitySensitivity = RULES[ruleId].sensitivity;
          let offset = resolution * proximitySensitivity * 60000;

          let newEvent = {
            eventRule: ruleID,
            flare: edgeEvent.flare,
            header: edgeEvent.header,
            start: foundEventPreceeds ? foundEvent.start : edgeEvent.start,
            end: foundEventPreceeds ? edgeEvent.end : foundEvent.end,
            chunks: foundEventPreceeds ? foundEvent.chunks.concat(edgeEvent.chunks) : edgeEvent.chunks.concat(foundEvent.chunks),
            debug: edgeEvent.debug,
          }

          //this doesnt make sense. if its from remote you need e.event.variable. Also why would start and end match with the/
          // old to new event when the event should be smaller not equal
          let index = events.findIndex(e => {
            return (
              e.eventRule.toString() === newEvent.eventRule.toString() &&
              e.flare.toString() === newEvent.flare.toString() &&
              e.header.toString() === newEvent.header.toString() &&
              e.start === newEvent.start &&
              e.end === newEvent.end &&
              e.debug === newEvent.debug
            )
          });
          if (index === -1) throw new Error("Event index could not be found in joinEvents.")
          foundEvent.removeRemoteEvent = true; //or this to be removed as a remote it needs to be in a wrapper, which its not
          foundEvent.debug = newEvent.debug;
          events[index] = newEvent;
          events.push(foundEvent);
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "WidgetMain.joinEvents()")) }
      })();
    })
  }

  /**
   * This will update the edge tracker when needed based on the input event. 
   * @param {string} ruleID 
   */
  async handleEdgeEvents(ruleID, to, periodGroupID, events) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let resolution = RULES[ruleID].resolution;
          let proximitySensitivity = RULES[ruleID].sensitivity;
          let offset = resolution * proximitySensitivity * 60000;
          // console.log(this.localEdgeEventsByRule)

          let oldest = this.localEdgeEventsByRule[ruleID][periodGroupID].oldest;
          let newest = this.localEdgeEventsByRule[ruleID][periodGroupID].newest;
          let collection = null;
          if (oldest) {
            collection = oldest.debug === true ? Event : collection;
            collection = oldest.debug === false ? DebugEvent : collection;
          }
          if (oldest !== null) {
            let filter = {
              eventRule: new ObjectId(ruleID),
              flare: to === "flare" ? periodGroupID : this.headerIDtoFlareID[periodGroupID],
              header: to === "flare" ? null : periodGroupID,
              end: { $gte: new Date(oldest.start.getTime() - offset), $lte: oldest.start }
            }
            let found = await collection.find(filter).sort({ "end": -1 }).limit(1).lean().exec();
            if (found.length === 1) {
              await this.joinEvents(ruleID, oldest, found[0], events, true);
            } else console.log("no oldest to join")
          }
          if (newest !== null) {
            let filter = {
              eventRule: new ObjectId(ruleID),
              flare: to === "flare" ? periodGroupID : this.headerIDtoFlareID[periodGroupID],
              header: to === "flare" ? null : periodGroupID,
              start: { $gte: newest.end, $lte: new Date(newest.end.getTime() + offset) }
            }
            let found = await collection.find(filter).sort({ "start": 1 }).limit(1).lean().exec();
            if (found.length === 1) {
              await this.joinEvents(ruleID, newest, found[0], events, false);
            } else console.log("no newest to join")
          }
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "WidgetMain.handleEdgeEvents()")) }
      })();
    })
  }

  /** **********************************************************************************************
   * @desc Generate events for all violations of a specific EventRule
   * @param string ruleId 
   */
  async generateEventsFromRuleId(ruleId) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let chunkResolutionMS = RULES[ruleId].resolution * 60000;
          let ruleGroupInfo = this.grouped_violations_dict[ruleId];
          let allEvents = [];
          // console.log("num periods groups: ", ruleGroupInfo.periodGroups.length)

          let periodGroups = ruleGroupInfo.periodGroups.filter(g => g.periods.length > 0);
          await Promise.all(periodGroups.map(periodGroup => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  {
                    // console.log(ruleGroupInfo.periodGroups.length)
                    // throw new Error("hi")
                    let events = [];
                    let violations = periodGroup.periods;
                    // let vN = 0;
                    // let vLen = violations.length;
                    for (const violation of violations) {
                      // vN++;
                      // if (vN % 100 === 0) console.log(`${ruleId} : ${vN}/${vLen}`)
                      let updateRequired = await this.getEventToUpdate(ruleId, violation, events); //returns null or {event, isRemote, remove (optional)}
                      if (updateRequired) { /** Update an existing event(s) */
                        if (updateRequired.skip) {
                          if (DEBUG_LOGS_2) console.log("skipping event")
                          continue;
                        }
                        let eventToUpdate = updateRequired.event;
                        if (updateRequired.hasOwnProperty('flag') && updateRequired.flag === "already exists") { //if chunk bool unchanged but may need val update
                          if (!RULES[ruleId].withValues) continue;
                          else {
                            let numChanges = 0;
                            // console.log(violation)
                            for (let vioVal of violation.withNumValue) {
                              let matchedVal = eventToUpdate.values.find(val => {
                                return val.date.getTime() === vioVal.date.getTime()
                              })
                              if (matchedVal) {
                                if (matchedVal.value !== vioVal.value) {
                                  matchedVal.value = vioVal.value;
                                  numChanges++;
                                }
                              }
                              if (updateRequired.fromRemote && (numChanges > 0)) events.push(eventToUpdate);
                            }
                          }
                        }
                        else if (updateRequired.hasOwnProperty('remove') && updateRequired.remove) { /** Remove a chunk from existing event*/
                          //remove chunk/violation from event because of change from violation to non-violation
                          console.log("Remove flag: ")
                          console.log("violation: ", violation)
                          console.log("updateRequired: ", updateRequired)

                          //Populate the chunks, as needed
                          let chunkFound = null;
                          let chunkIndexToRemove = -1;
                          let allPopulatedChunks = [];
                          // let temp = 0;

                          // console.log("chunks here!: ", eventToUpdate.chunks)

                          for (const chunk of eventToUpdate.chunks) {
                            // temp++;
                            if (!(chunkFound)) chunkIndexToRemove++;
                            let match = null;
                            if (violation.debug) {
                              match = await DebugFormulaValue.findOne({ _id: chunk.formulaValue }).select('date').exec();
                            } //ASSUMPTION, pivalue is upserted not inserted
                            else {
                              match = await FormulaValue.findOne({ _id: chunk.formulaValue }).select('date').exec();;
                            }
                            allPopulatedChunks.push(match);
                            if (match.date.getTime() === violation.end.getTime()) {
                              chunkFound = match;
                              chunkFound.formulaValue = chunkFound._id;
                              delete chunkFound._id;
                              if ((chunkIndexToRemove === 0) && (eventToUpdate.chunks.length === 1)) break; //only one chunk in the event
                              if (
                                (chunkFound.date.getTime() === (eventToUpdate.start.getTime() + chunkResolutionMS) || chunkFound.date.getTime() === eventToUpdate.end.getTime()) //is not the first chunk
                                && (eventToUpdate.chunks.length > 1)) break;
                            }
                          }

                          if ((!chunkFound) || (chunkIndexToRemove == -1)) { throw "Chunk not found for removal"; }
                          let lastChunkIndex = eventToUpdate.chunks.length - 1;
                          // console.log("delete whole event?: ", lastChunkIndex, chunkIndexToRemove, eventToUpdate)
                          if (lastChunkIndex === 0 && chunkIndexToRemove === 0 && eventToUpdate.chunks.length === 1) { //delete the whole event (event is only one chunk big)

                            console.log("Single chunk event, deleting the whole event...")
                            if (updateRequired.fromRemote) {
                              // await Events.deleteOne({ _id: eventToUpdate._id });
                              eventToUpdate.removeRemoteEvent = true;
                              events.push(eventToUpdate);
                            }
                            else { //local

                              let eventIndexToRemove = events.findIndex(event => event.end.getTime() === violation.end.getTime() && event.debug === violation.debug);
                              events.splice(eventIndexToRemove, 1);
                            }
                            continue;
                          }
                          //else if: remove from edge --start or end
                          else if ((chunkFound.date.getTime() === (eventToUpdate.start.getTime() + chunkResolutionMS)
                            || chunkFound.date.getTime() === eventToUpdate.end.getTime()) && (eventToUpdate.chunks.length > 1)) { //reducing the size of an event
                            console.log("reducing event by 1 (edge)");
                            eventToUpdate.chunks.splice(chunkIndexToRemove, 1);
                            // eventsToUpdate.chunks.sort((piValueA, piValueB) => piValueA.date - piValueB.date); //sort so we can pick start and end
                            if (eventToUpdate.start.getTime() === violation.start.getTime()) {
                              eventToUpdate.start = new Date(eventToUpdate.start.getTime() + chunkResolutionMS);
                            }
                            else {
                              console.log("end: ", typeof eventToUpdate.end, eventToUpdate.end, eventToUpdate.end.getTime(), chunkResolutionMS)
                              eventToUpdate.end = new Date(eventToUpdate.end.getTime() - chunkResolutionMS);
                              console.log("end res: ", eventToUpdate.end, eventToUpdate.end.getTime(), chunkResolutionMS);
                            }
                            if (RULES[ruleId].withValues) {
                              eventToUpdate.values = eventToUpdate.values.filter(vObj => {
                                return (vObj.date.getTime() >= (eventToUpdate.start.getTime() + chunkResolutionMS)) && (vObj.date <= eventToUpdate.end)
                              })
                            }
                            if (updateRequired.fromRemote) events.push(eventToUpdate);
                            continue;
                          }
                          else if (chunkIndexToRemove < lastChunkIndex || chunkIndexToRemove > 0) { //splitting an event into two (by the other ifs >2 chunks)
                            allPopulatedChunks.sort((chunkA, chunkB) => chunkA.date.getTime() - chunkB.date.getTime());
                            // console.log({allPopulatedChunks})
                            let removingIndex = allPopulatedChunks.findIndex(chunk => chunk.formulaValue == chunkFound.formulaValue);
                            // console.log("removingIndex: ", removingIndex)
                            // console.log({chunkFound, violation})
                            let e1Start = new Date(allPopulatedChunks[0].date.getTime() - chunkResolutionMS);
                            let e1End = allPopulatedChunks[(removingIndex - 1)].date;
                            let e2Start = new Date(allPopulatedChunks[(removingIndex + 1)].date.getTime() - chunkResolutionMS);
                            let e2End = allPopulatedChunks[(allPopulatedChunks.length - 1)].date;
                            let formattedChunks = allPopulatedChunks.map(x => { return { formulaValue: x.formulaValue } });
                            let newEventChunks = formattedChunks.splice(removingIndex); //SPLIT

                            let eventClone = cloneDeep(eventToUpdate);
                            if (eventClone.hasOwnProperty('_id')) delete eventClone._id; // treat the clone as a new event
                            //event 1
                            eventToUpdate.chunks = formattedChunks;
                            eventToUpdate.start = e1Start;
                            eventToUpdate.end = e1End;
                            //event 2
                            newEventChunks.shift()
                            eventClone.chunks = newEventChunks;
                            eventClone.start = e2Start;
                            eventClone.end = e2End;
                            //Handle if withValues
                            if (RULES[ruleId].withValues) {
                              eventToUpdate.values = eventToUpdate.values.filter(vObj => {
                                return (vObj.date.getTime() >= (eventToUpdate.start.getTime() + chunkResolutionMS)) && (vObj.date <= eventToUpdate.end)
                              })
                              eventClone.values = eventClone.values.filter(vObj => {
                                return (vObj.date.getTime() >= (eventClone.start.getTime() + chunkResolutionMS)) && (vObj.date <= eventClone.end)
                              })
                            }
                            if (updateRequired.fromRemote) {
                              events.push(eventToUpdate);
                            }
                            events.push(eventClone);
                            continue;
                          }
                          else { //Error
                            throw `Unexpected Error in generateEventsFromRuleId(): Index out of rage: ${chunkIndexToRemove}`;
                          }
                        }//======================================== END remove chunk =====================================
                        else if (updateRequired.hasOwnProperty('joinEvent') && updateRequired.joinEvent) { /** Join two events because of a new violation */
                          //NOTE: this logic assumes that the eventToUpdate is to the left (earlier than) of the joinEvent 
                          if (DEBUG_LOGS_1) console.log("Joining to events because of new violation");
                          let joinEvent = updateRequired.joinEvent;
                          eventToUpdate.chunks.push({ formulaValue: violation.formulaValue._id });
                          joinEvent.event.chunks.forEach((chunk, index, chunks) => {
                            eventToUpdate.chunks.push(chunks[index]);
                          });
                          eventToUpdate.end = joinEvent.event.end;
                          if (RULES[ruleId].withValues) {
                            for (let val of violation.withNumValue) {
                              eventToUpdate.values.push(val) //should just be the id?
                            }
                            joinEvent.event.values.forEach((val, index, vals) => {
                              eventToUpdate.values.push(vals[index]);
                            });
                          }
                          //event is updated, add to events if from remote. else, if local, we're good, do nothing.
                          // this.updateEdgeEventTracker(ruleId, eventToUpdate, periodGroup._id.toString());
                          if (updateRequired.fromRemote) events.push(eventToUpdate);
                          if (joinEvent.event.hasOwnProperty('_id')) { //flag remote joiner event for deletion
                            joinEvent.removeRemoteEvent = true;
                            events.push(joinEvent);
                            // console.log("JOIN EVENT IS FROM REMOTE:", joinEvent)
                          }
                          else { //if local, remove by iteration

                            for (let i = events.length - 1; i >= 0; i--) {
                              // console.log("event :", i, events[i  ])
                              if (events[i].start == joinEvent.event.start) { //Here we are comparing REFERENCES of Dates not values (getTime()). So in theory this works.
                                events.splice(i, 1);
                                break;
                              }
                            }
                            // console.log("EVENTS: ", events);
                          }
                          // let periodGroupID = eventToUpdate.header === null ? eventToUpdate.flare.toString() : eventToUpdate.header.toString();
                          await this.updateEdgeEventTracker(ruleId, eventToUpdate, periodGroup._id.toString())
                          continue;
                        } //======================================== END Join two events because of a new violation =====================================
                        else { /** Adding a new chunk to existing event */
                          if (DEBUG_LOGS_1) console.log("Adding chunk to an existing event");
                          eventToUpdate.chunks.push({ formulaValue: violation.formulaValue._id });
                          if (violation.end > eventToUpdate.end) {
                            eventToUpdate.end = violation.end;
                          }
                          else if (violation.start < eventToUpdate.start) {
                            eventToUpdate.start = violation.start;
                          }
                          if (RULES[ruleId].withValues) {

                            try {
                              for (let val of violation.withNumValue) {
                                eventToUpdate.values.push(val) //should just be the id?
                              }
                            }
                            catch (err) {
                              console.log("violation: ", violation)
                              throw err
                            }


                          }
                          /*
                              There are two types of returns:
                              1. its an object found from db, then just push to events.
                              2. its from the existing list of events, so we are directly manipulating. 
                              Do not push. Otherwise you have two of the same reference in your array. 
                              Solution: Do nothing. You already did your manipulation
                          */
                          if (updateRequired.fromRemote) events.push(eventToUpdate);
                          else await this.updateEdgeEventTracker(ruleId, eventToUpdate, periodGroup._id.toString())
                          continue;
                        }
                      } //======================================== END Adding a new chunk to existing event =====================================
                      else { /** create a new Event */
                        if (DEBUG_LOGS_1) console.log("Checking if we have a violation.")
                        // if (DEBUG) console.log(violation, RULES[ruleId])
                        if (violation.formulaValue.value !== RULES[ruleId].checkFor) {
                          if (DEBUG_LOGS_1) console.log("Not a violation. Skipping.")
                          continue;
                        }
                        if (DEBUG_LOGS_1) console.log("Confirmed. We have a violation.")
                        if (DEBUG_LOGS_1) console.log("Creating a new event.")
                        let chunk = { formulaValue: violation.formulaValue._id };
                        let newEvent = {
                          eventRule: ruleId,
                          flare: violation.formulaValue.flare,
                          header: violation.formulaValue.header,
                          start: violation.start,
                          end: violation.end,
                          chunks: [chunk], //violation.Pivalue is the piValue ID (#?)
                          debug: violation.debug
                        }
                        if (RULES[ruleId].withValues) {
                          // let {_id, value, date} = violation.withNumValue
                          // let valChunk = { formulaValue: _id, value, date };
                          newEvent.values = violation.withNumValue;
                        }
                        // console.log("new event")
                        events.push(newEvent);
                        // this.updateEdgeEventTracker(ruleId, newEvent, periodGroup._id.toString());
                        // let periodGroupID = eventToUpdate.header === null ? eventToUpdate.flare.toString() : eventToUpdate.header.toString();
                        await this.updateEdgeEventTracker(ruleId, newEvent, periodGroup._id.toString())
                        continue;
                      }
                    }
                    await this.handleEdgeEvents(ruleId, ruleGroupInfo.formula.to, periodGroup._id, events);
                    allEvents = allEvents.concat(events);
                    return resolve();
                  }
                } catch (e) { return reject(getErrorObject(e, "generateEventsFromRuleId.map:")) }
              })();
            })
          }))
          // for (let periodGroup of ruleGroupInfo.periodGroups) 
          
          resolve(allEvents);
        } catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "WidgetMain.generateEventsFromRuleId(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          reject({ printPath: "WidgetMain.generateEventsFromRuleId(): ", error })
        }
      })();
    });
  }

  /** **********************************************************************************************
   * @desc generate events for all violations queued
   */
  async generateEvents() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let promises = []
          this.ruleIdsToProcces.forEach(ruleId => {
            promises.push(this.generateEventsFromRuleId(ruleId));
          });
          let eventsArray = await Promise.all(promises);
          // console.log("mid-layer events: ", util.inspect(eventsArray, { depth: null, maxArrayLength: 5}));
          resolve(eventsArray);
        } catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "WidgetMain.generateEvents(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          reject({ printPath: "WidgetMain.generateEvents()", error })
        }
      })();
    });
  }

  async uploadEventsToMongo(generatedEvents) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let promises = []
          generatedEvents.forEach(eventsArray => {
            promises.push(MONGO.uploadEventsToMongo(eventsArray, (!UPLOAD_EVENTS)));
          })
          let uploadResponses = await Promise.all(promises);
          // console.log("uploadResponses: ", uploadResponses);
          return resolve(uploadResponses);
        } catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "WidgetMain.uploadEventsToMongo(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`;
            return reject(errObj);
          }
          reject({ printPath: "WidgetMain.uploadEventsToMongo(): ", error })
        }
      })();
    });
  }


  /** **********************************************************************************************
   * @desc The entrypoint for the class.
   */
  async main(input) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (DEBUG_LOGS_3) console.log("getting data")
          await this.initMain(input);
          return resolve();
          if (DEBUG_LOGS_3) console.log("generating events")
          let generatedEvents = await this.generateEvents();
          // console.log("top-layer events: ", util.inspect(generatedEvents, { depth: null }));
          // console.log("generated events: ", generatedEvents)
          // return resolve(generatedEvents)
          let uploadResponse = null;
          if (DEBUG_LOGS_3) console.log("uploading data")
          uploadResponse = await this.uploadEventsToMongo(generatedEvents);
          // console.log("last uploadResponse: ", uploadResponse)
          return resolve(uploadResponse);
        } catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "WidgetMain.main(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          reject({ printPath: "WidgetMain.main(): ", error })
        }
      })();
    });
  }

}

function adaptRecords(records) {
  return records.map(record => {
    return {
      ruleId: record.ruleInfo.eventRule._id,
      formulaValue: {
        _id: record.updateInfo.calcID,
        flare: record.updateInfo.flare,
        header: record.updateInfo.header ? record.updateInfo.header : null,
        value: record.updateInfo.value
      },
      withNumValue: record.ruleInfo.withValue,
      start: record.updateInfo.start,
      end: record.updateInfo.date,
      org: record.updateInfo.org,
      debug: record.updateInfo.debug
    }
  });
}


//  exports.handler = async (event) => {
async function main(event) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        event.start = new Date(event.start);
        event.end = new Date(event.end);
        event.org = new ObjectId(event.org);

        let main = new WidgetMain();
        let res = await main.main(event);
        // console.log(`FINAL RESPONSE: `, util.inspect(res, { depth: null }));
        /*If Dev mode, then close the mongo client */
        // if (DEV_MODE) {
        //   try {
        //     if (MONGO.mongooseStatus() === 1) await MONGO.closeClient();
        //   } catch (error) {
        //     console.log("Connection was already closed", `Error: ${error}`); //Nothing happens if already closed, so we can probably remove this
        //   }
        // }
        return resolve("success")
      } catch (error) {
        console.log("\n\n- - - - - - - - -")
        if (error.hasOwnProperty('printPath')) {
          console.log(`ERROR CAUGHT: \n${error.printPath}${error.error}`);
          console.log(`\nSTACK TRACE: ${error.error.stack}`);
        }
        else {
          console.log("ERROR in main: ", error)
        }
        return reject("failed");
      }
    })();
  })

}

Date.prototype.addDays = function (days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
}

// let input = {
//   start: 1577854800000,
//   end: 1577941200000,
//   dev: false,
//   org: "5fb6b7ea6b029226f07d2677"
// }
// main(input)

async function runAllSets(dateSets, dev, org) {
  let i = 1;
  for (let set of dateSets) {
    console.log(`starting ${i}`)
    let args = {
      start: set.start,
      end: set.end,
      dev,
      org
    }
    console.log(args)
    args.start = args.start.getTime();
    args.end = args.end.getTime();
    let r = await main(args)
    console.log(`finished with ${i}: ${r}`)
    i++;
  }



  if (DEV_MODE) {
    try {
      if (MONGO.mongooseStatus() === 1) await MONGO.closeClient();
    } catch (error) {
      console.log("Connection was already closed", `Error: ${error}`); //Nothing happens if already closed, so we can probably remove this
    }
  }

}


try {
  let input = {
    start: 1577854800000,
    end: 1626840000000,
    dev: false,
    org: "5fb6b7ea6b029226f07d2677"
  }
  let { start, end, dev, org } = input;
  let startDate = new Date(start);
  let endDate = new Date(end);

  let startPivot = new Date(start);
  let endPivot = new Date(start);
  endPivot = endPivot.addDays(30);


  // let dateSets = [{
  //   start: startPivot,
  //   end: new Date(end),
  // }];

  let dateSets = [];
  while (startPivot.getTime() <= endDate.getTime()) {
    if (endPivot > endDate) endPivot = new Date(endDate.getTime());
    dateSets.push({
      start : startPivot,
      end : endPivot,
    });
    startPivot = startPivot.addDays(30);
    endPivot = endPivot.addDays(30);
  }
  console.log(dateSets.length, dateSets);
  runAllSets(dateSets, dev, org)
} catch (error) { console.log("Error Encounterd: , ", error) }



/**
1577854800000  // Wednesday, January 1, 2020 5:00:00 AM - Offical Start
1577941200000  //Thursday, January 2, 2020 5:00:00 AM

1619841600000  // Saturday, May 1, 2021 4:00:00 AM - Official End
1619842500000 // Saturday, May 1, 2021 4:15:00 AM

1622520000000 // Monday, May 31, 2021 11:00:00 PM GMT-05:00
1625112000000 // Wednesday, June 30, 2021 11:00:00 PM GMT-05:00
1627650000000 // Friday, July 30 2021 8 AM
 */