const { Event, DebugEvent, EventRule, Formula, FormulaValue, DebugFormulaValue, Flare, Header } = require('./FRTModels');
const { Mongo, strToOid, strToDate, objPrint, hasDuplicates } = require('./utils');
const { ObjectId } = require('mongodb');
const cloneDeep = require('lodash.clonedeep');
const util = require('util'); //for full-form printing of object

const DEBUG_LOGS_1 = false;
const DEBUG_LOG_ACTION = false;
const DEBUG_LOG_ACTION_2 = true;
const DEV_MODE = (process.env.isProd == 'true') ? false : true;
if (DEV_MODE) console.log("Running in Development Mode");
if (DEBUG_LOGS_1) console.log("Running with debug mode (print statements)")

const UPLOAD_VALUES_MICRO = false

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
  async fillWithValueIfMissing(period, ruleID, debug) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let rule = RULES[ruleID];
          if (rule.resolution === 1 && rule.withValues && rule.checkFor && period.withNumValue === null) {
            let collection = debug === true ? DebugFormulaValue : FormulaValue;
            let filter = {
              formula: rule.checkForValue,
              date: period.end,
              org: period.org,
              flare: period.formulaValue.flare,
              header: period.formulaValue.header
            }
            let v = await collection.findOne(filter).select('value date').lean().exec();
            period.withNumValue = [{ value: v.value, _id: v._id, date: v.date }] //my assumtion is that it will not be a problem... in theory it could be undefined or null
            return resolve(period)
          } else {
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

          /** 3.Get all the periods (raw/calculated data) and group the in a dictionary by rule */
          let grp_vio_dict = {};
          let collection = options.dev === true ? DebugFormulaValue : FormulaValue;
          for (let rule of Object.values(RULES)) {
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
                let rulePeriods = await collection.find(filter).sort({ flare: -1, header: -1, date: 1 }).lean().exec();
                if (rulePeriods.length > 0) {
                  // console.log("formula: ", filter.formula, "flare: ", filter.flare)
                  // console.log("num items: ", rulePeriods.length)
                  periodGroup.periods = rulePeriods.map(period => this.formulaValueToLocalFormat(period, ruleID, options.dev))
                  periodGroup.periods = await Promise.all(periodGroup.periods.map(period => this.fillWithValueIfMissing(period, ruleID, options.dev)))
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
                    periodGroup.periods = rulePeriods.map(period => this.formulaValueToLocalFormat(period, ruleID, options.dev));;
                    periodGroup.periods = await Promise.all(periodGroup.periods.map(period => this.fillWithValueIfMissing(period, ruleID, options.dev)))
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
          // console.log("Finished pulling all sets!")
          this.grouped_violations_dict = grp_vio_dict

          let myout = Object.values(grp_vio_dict).map(i => {
            return {
              eventRule: i.formula.eventRule,
              periodGroups: i.periodGroups
            }
          })

          // const fsPromises = require('fs').promises;
          // await fsPromises.writeFile('ericksOutput.json', JSON.stringify(myout))
          // throw new Error("")

          // for (let i in this.grouped_violations_dict) console.log("group: ", i, this.grouped_violations_dict[i])
          // console.log("grouped violations: ", this.grouped_violations_dict)
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

  /** **********************************************************************************************
   * @desc Get the continuing event th at will be extended by the input violation
   * @param string ruleId 
   * @param object violation 
   */
  async getEventToUpdate(ruleId, violation, localEvents) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let chunkResolution = RULES[ruleId].resolution; //in minutes
          let proximitySensitivity = RULES[ruleId].sensitivity; //in minutes
          let eventFound = null;

          //===========================================================
          let eventCollection = violation.debug ? DebugEvent : Event;

          //Case: Nearest Adjecent Future Event
          // console.log("1. ", chunkResolution, typeof violation.start, violation.start instanceof Date)
          var cutoff = new Date(violation.start.getTime() + (chunkResolution * 60000) + (proximitySensitivity * chunkResolution * 60000)); //anymore than the chunk+sensitivity resolution means new event
          let futureStart = await eventCollection.find({ start: { $gte: violation.start.toISOString(), $lte: cutoff.toISOString() }, eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header }).sort({ "start": 1 }).limit(1).lean().exec();
          // console.log("futureStart: ", Array.isArray(futureStart))
          //Case: Nearest Adjecent Past Event
          // console.log("2. ", violation.end)
          cutoff = new Date(violation.end.getTime() - (chunkResolution * 60000) - (proximitySensitivity * chunkResolution * 60000))
          let pastEnd = await eventCollection.find({ end: { $lte: violation.end, $gte: cutoff }, eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header }).sort({ "end": -1 }).limit(1).lean().exec();
          // console.log("pastEnd: ", Array.isArray(pastEnd))
          //Case: Nearest Englufed Event by Start 
          let engulfedStart = await eventCollection.find({ start: { $lte: violation.start }, eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header }).sort({ "start": -1 }).limit(1).lean().exec();
          // console.log("engulfedStart: ", Array.isArray(engulfedStart))
          //Case: Nearest Englufed Event by End
          let engulfedEnd = await eventCollection.find({ end: { $gte: violation.end }, eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header }).sort({ "end": 1 }).limit(1).lean().exec();
          // console.log("engulfedEnd: ", Array.isArray(engulfedEnd))

          let withinEvents = await eventCollection.find({start : { $lte : violation.start}, end : {$gte: violation.end} , eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header}).lean().exec();
          if (withinEvents.length > 1) {
            console.log("multiple withins")
            console.log("vio: ", violation)
            console.log("withinEvents: ", withinEvents)
          }
          // console.log("withinEvents: ", withinEvents.length)
          // let counter = 0
          // for (let e of withinEvents) {
          //   counter++;
          //   if (e.start <= violation.start && e.end >= violation.end ) console.log(`existing found #${counter}`)
          // }
          //QUESTION: In theory, two or more could be duplicates of each other.
          //Does this cause a problem? I don't think it would. We end up only picking one,
          //we take the first vaild/matching eventm
          let remoteEventsPre = [...futureStart, ...pastEnd, ...engulfedStart, ...engulfedEnd];
          // console.log("remote events pre: ", util.inspect(remoteEventsPre, { depth: null }));
          let remoteEvents = []

          //Only want the non-null events
          //QUESTION: Does find ever return an empty array? I think mongoose returns null -> ! returns empty arr
          remoteEventsPre.forEach(event => {
            event.debug = violation.debug
            for (const element of remoteEvents) { //don't get duplicates
              if (element.event.start.getTime() === event.start.getTime() && element.event.end.getTime() === event.end.getTime()) return;
            }
            remoteEvents.push({
              event,
              fromRemote: true, //Need to know because it effects how we update an event in return user func.
            });
          });

          //===========================================================

          let allEvents = [];
          let offset = chunkResolution * proximitySensitivity * 60000;
          let violationInclusiveFuturemostCutoff = violation.end.getTime() + offset;
          let violationInclusivePastmostCutoff = violation.start.getTime() - offset;
          localEvents.forEach(event => {
            try {
              if (event.hasOwnProperty('removeRemoteEvent')) { return } // TODO, moving this up one line is a change that needs to be applied to the other scripts too
              if (event.start.getTime() > violationInclusiveFuturemostCutoff || event.end.getTime() < violationInclusivePastmostCutoff) return;
              if (event.header !== null) event.header = event.header.toString();
              if (violation.formulaValue.header !== null) violation.formulaValue.header = violation.formulaValue.header.toString();
              if (event.flare.toString() === violation.formulaValue.flare.toString() && event.header === violation.formulaValue.header) {
                allEvents.push(
                  {
                    event,
                    fromRemote: false, //EXPLINATION: event if a remote event, we want to treat it as now local (because it is and) because we don't want to push it twice into our list
                  });
              }
            } catch (e) {
              console.log("EVENT: ", event)
              console.log(e)
              throw e
            }
          });

          // console.log("total: ", localEvents.length)
          // console.log(" events found: ",allEvents.length)
          allEvents.push(...remoteEvents);
          if (DEBUG_LOGS_1) console.log("Checking the events")
          if (allEvents.length === 0) {
            if (DEBUG_LOGS_1) console.log("resolving. No events found.");
            if (DEBUG_LOGS_1) console.log("Completely new event...")
            return resolve();
          }
          // console.log("We found more than zero events: ", allEvents.length, util.inspect(allEvents, { depth: null }))
          // console.log("We found more than zero events: ", allEvents, allEvents.length, typeof allEvents)
          if (DEBUG_LOGS_1) console.log("sorting events by proximity...");
          allEvents.sort((left, right) => { //sort to get nearest event (not to sort by chronological order)
            /** Since events are blocks of multiple Dates (i.e. a range of dates)
             * We must take into account the start AND the end. Doing only one will
             * create a bias. e.g. Starts-only will favor future events , in particular when it's
             * a very large range that pushes the start far back into the past even though
             * the end is adjecent to the date. Other issues also arise.
             * */
            let a = left.event;
            let b = right.event;
            let distanceFromStartA = Math.abs(violation.start - a.start);
            let distanceFromEndA = Math.abs(violation.end - a.end);
            let smallestDistanceA = Math.min(distanceFromStartA, distanceFromEndA);

            let distanceFromStartB = Math.abs(violation.start - b.start);
            let distanceFromEndb = Math.abs(violation.end - b.end);
            let smallestDistanceB = Math.min(distanceFromStartB, distanceFromEndb);
            let selection = smallestDistanceA - smallestDistanceB
            // console.log("selection: ", selection, smallestDistanceA, smallestDistanceB, [distanceFromStartB, distanceFromEndb], violation.start - b.start, violation.start, b.start);
            if (selection == 0) {
              // console.log(`ORDER DIF: ${a.start - b.start}`)
              return (a.start - b.start); //The earlier event goes first
            }
            return selection;
          });
          // console.log("finished sorting events: ", allEvents) //util.inspect(allEvents, { depth: null }));
          let nearestEvent = allEvents.find(v => v.event.debug == violation.debug);
          //CASE: violation is within the event
          if ((violation.start.getTime() >= nearestEvent.event.start.getTime()) && (violation.end.getTime() <= nearestEvent.event.end.getTime())) {
            if (violation.formulaValue.value === RULES[ruleId].checkFor) { //If the violation (new chunk) is already a part of the event ignore only if NOT with valuse, else check if withvalues needs update
              nearestEvent.flag = "already exists"
              return resolve(nearestEvent);
            }
            else { //Value has changed from true to false, so we need to delete it from the event
              nearestEvent.remove = true;
              // console.log("removal...")
              return resolve(nearestEvent);
            }
          }

          //Check if we are joining together two events...
          if (allEvents.length > 1) {
            let nearestLeftEvent = allEvents.find(e => violation.start >= e.event.end && violation.debug === e.event.debug);
            let nearestRightEvent = allEvents.find(e => violation.end <= e.event.start && violation.debug === e.event.debug);
            if (nearestLeftEvent && nearestRightEvent) {
              let leftEndCutoff = new Date(violation.start.getTime() - (proximitySensitivity * chunkResolution * 60000));
              let rightStartCutoff = new Date(violation.end.getTime() + (proximitySensitivity * chunkResolution * 60000));
              // console.log({nearestLeftEvent,nearestRightEvent,leftEndCutoff, rightStartCutoff})
              // console.log(nearestLeftEvent.event.end, leftEndCutoff , nearestRightEvent.event.start , rightStartCutoff)
              // console.log(nearestLeftEvent.event.end >= leftEndCutoff, nearestRightEvent.event.start <= rightStartCutoff)
              if (nearestLeftEvent.event.end >= leftEndCutoff && nearestRightEvent.event.start <= rightStartCutoff) {
                nearestLeftEvent.joinEvent = nearestRightEvent;
                return resolve(nearestLeftEvent)
              }
            }
          }

          // console.log("ALL EVENTS: ",  allEvents)
          /* If the violation/chunk is within in existing event or adjecent (where sensitivity has an impact)*/
          let startLimit = new Date(nearestEvent.event.start.getTime() - (chunkResolution * 60000) - (proximitySensitivity * chunkResolution * 60000)); //acounts for adjecent left
          let endLimit = new Date(nearestEvent.event.end.getTime() + (chunkResolution * 60000) + (proximitySensitivity * chunkResolution * 60000)); //accounts for adjecent right
          //CASE: The violation (new chunk) is adjecent to an existing event, so we need to extend the event
          // console.log("start-end: ", violation.start, violation.end)
          // console.log({startLimit, endLimit})
          // console.log(`${violation.start >= startLimit} ${violation.end <= nearestEvent.event.start} ${violation.start >= nearestEvent.event.end} ${violation.end <= endLimit} `)


          if ((violation.start >= startLimit) && (violation.end <= nearestEvent.event.start)) { //adjecent before n
            // console.log("Adding new chunk to existing event (before)...")
            return resolve(nearestEvent);
          }
          else if ((violation.start >= nearestEvent.event.end) && (violation.end <= endLimit)) { //adjecent after
            // console.log("Adding new chunk to existing event (after)...")
            return resolve(nearestEvent);
          }
          else {
            //CASE: The violation (new chunk) is a seperate, new event
            // console.log("Completely newevent...")
            return resolve();
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
      (async () => {
        try {
          if (typeof foundEventPreceeds !== "boolean") throw new Error(`foundEventPreceeds is not of type boolean: ${foundEventPreceeds}`);
          // let resolution = RULES[ruleID].resolution;
          // let proximitySensitivity = RULES[ruleID].sensitivity;
          // let offset = resolution * proximitySensitivity * 60000;

          let newEvent = {
            eventRule: ruleID,
            flare: edgeEvent.flare,
            header: edgeEvent.header,
            start: foundEventPreceeds ? foundEvent.start : edgeEvent.start,
            end: foundEventPreceeds ? edgeEvent.end : foundEvent.end,
            chunks: foundEventPreceeds ? foundEvent.chunks.concat(edgeEvent.chunks) : edgeEvent.chunks.concat(foundEvent.chunks),
            debug: edgeEvent.debug,
          }

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
          foundEvent.removeRemoteEvent = true;
          foundEvent.debug = newEvent.debug;
          console.log("Event for Removal: ", events[index])
          console.log("Event that will replace: ", newEvent)
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
              console.log("EDGE EVENT MATCHES FOUND: ", found.length)
              await this.joinEvents(ruleID, oldest, found[0], events, true);
            } else {
              console.log("EDGE EVENT MATCHES FOUND: ", found.length)
            }
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
              console.log("EDGE EVENT MATCHES FOUND: ", found.length)
              await this.joinEvents(ruleID, newest, found[0], events, false);
            } else {
              console.log("EDGE EVENT MATCHES FOUND: ", found.length)
            }
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
          // console.log("violations: ", ruleId, ruleGroupInfo.periodGroups )
          let allEvents = [];
          for (let periodGroup of ruleGroupInfo.periodGroups) {
            let events = [];
            let violations = periodGroup.periods;
            for (const violation of violations) {
              let updateRequired = await this.getEventToUpdate(ruleId, violation, events); //returns null or {event, isRemote, remove (optional)}
              if (updateRequired) { /** Update an existing event(s) */
                if (DEBUG_LOG_ACTION) console.log("updating an existing event")
                let eventToUpdate = updateRequired.event;
                if (updateRequired.hasOwnProperty('flag') && updateRequired.flag === "already exists") { //if chunk bool unchanged but may need val update
                  if (!RULES[ruleId].withValues) continue;
                  else {
                    let numChanges = 0;
                    for (let vioVal of violation.withNumValue) {
                      try {
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

                      } catch (e) {
                        console.log("violation: ", violation);
                        console.log("vioVal: ", vioVal);
                        console.log("eventToUpdate: ", eventToUpdate)
                        console.log("updateRequired: ", updateRequired)
                        console.log(e)
                        throw e
                      }

                    }
                  }
                } //TODO this next line needs to be "else if" not 
                else if (updateRequired.hasOwnProperty('remove') && updateRequired.remove) { /** Remove a chunk/period from existing event*/
                  if (DEBUG_LOG_ACTION) console.log("removing a period/chunk from an existing event")
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
                  if (DEBUG_LOGS_1 || DEBUG_LOG_ACTION) console.log("Joining to events because of new violation");
                  let joinEvent = updateRequired.joinEvent;
                  console.log("shifting chunks")
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
                  this.updateEdgeEventTracker(ruleId, eventToUpdate, periodGroup._id.toString());
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
                  continue;
                } //======================================== END Join two events because of a new violation =====================================
                else { /** Adding a new chunk to existing event */
                  if (DEBUG_LOGS_1 || DEBUG_LOG_ACTION) console.log("Adding chunk to an edge of existing event");
                  console.log("Adding a new chunk to existing event")
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
                  continue;
                }
              } //======================================== END Adding a new chunk to existing event =====================================
              else { /** create a new Event */
                if (DEBUG_LOGS_1) console.log("Checking if we have a violation.")
                // if (DEBUG) console.log(violation, RULES[ruleId])
                if (violation.formulaValue.value !== RULES[ruleId].checkFor) {
                  if (DEBUG_LOGS_1 || DEBUG_LOG_ACTION) console.log("Not a violation. Skipping.")
                  continue;
                }
                if (DEBUG_LOGS_1) console.log("Confirmed. We have a violation.")
                if (DEBUG_LOGS_1 || DEBUG_LOG_ACTION) console.log("Creating a new event.")
                console.log("Creating a new event.")
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
                console.log("newEvent Here: ", newEvent)
                events.push(newEvent);
                this.updateEdgeEventTracker(ruleId, newEvent, periodGroup._id.toString());
                continue;
              }
            }
            // await this.handleEdgeEvents(ruleId, ruleGroupInfo.formula.to, periodGroup._id, events);
            allEvents = allEvents.concat(events);
          }
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
          // console.log(eventsArray)
          // console.log("mid-layer events: ", util.inspect(eventsArray, { depth: null}));
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
          if (!UPLOAD_VALUES_MICRO) {
            console.log("Generated Events")
            let numEvents = 0;
            for (let arr of generatedEvents) {
              arr.map(a => numEvents++);
              console.log(arr)
            }
            console.log("Total Generated Events: ", numEvents)
            return resolve()
          }
          let promises = []
          generatedEvents.forEach(eventsArray => {
            promises.push(MONGO.uploadEventsToMongo(eventsArray));
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

          await this.initMain(input);
          // console.log("removing events")
          // await this.removeEvents(input);
          // console.log("starting to generate events")
          let generatedEvents = await this.generateEvents();
          // console.log("finished genrating events")
          // console.log("top-layer events: ", util.inspect(generatedEvents, { depth: null }));
          // console.log("generated events: ", generatedEvents)
          // return resolve(generatedEvents)
          let uploadResponse = null;
          // console.log("uploading to mongo")
          uploadResponse = await this.uploadEventsToMongo(generatedEvents);
          // console.log("finished uploading to mongo")
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

  async updateOrgInfo(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // console.log("updating orgs info...")
          if (this.orgs === undefined) {
            this.orgs = await MONGO.getOrgs();
          }
          for (let org of this.orgs) {
            if (!org.hasOwnProperty("backfillQueue")) continue;
            let uploadNeeded = false;
            let newBackfillQueue = org.backfillQueue.map(item => {
              // console.log(item.isEventsQueued , !item.isEventComplete, payload.startDate === item.oldestDate.getTime() , payload.endDate === item.newestDate.getTime())
              if ((item.isEventsQueued && !item.isEventComplete && payload.startDate === item.oldestDate.getTime() && payload.endDate === item.newestDate.getTime())  || (item._id.toString() === payload._id.toString())) {
                uploadNeeded = true;
                item.isEventsComplete = true;
                return item;
              }
              return item
            });
            if (uploadNeeded) {
              org.backfillQueue = newBackfillQueue;
              let update = { backfillQueue: newBackfillQueue };
              let updateRes = await MONGO.updateOrg(org._id.toString(), update);
              console.log("update res: ", updateRes)
            }
          }
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "Backfiller.updateOrgInfo")) }
      })();
    })
  }

  async removeEvents(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let filter = { //TODO, events will need to have org field added... so we can fitler by org...
            start: { "$gte": new Date(payload.startDate) }, //my inital conclusion is that start should shift over left 1
            end: { "$lt": payload.end },
          }
          await MONGO.removeEvents(filter);
          return resolve()
        } catch (err) {
          return reject(getErrorObject(err, "Backfiller.removeEvents"))
        }
      })();
    })
  }

  // async removeEvents(payload) {
  //   return new Promise((resolve, reject) => {
  //     (async () => {
  //       try {

  //       } catch (err) {
  //         return reject(getErrorObject(err, "Backfiller.removeEvents"))
  //       }
  //     })();
  //   })
  // }

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


// exports.handler = async (event) => {
async function main(event) {
  try {
    console.log(event)
    let payloads = [];
    let main = null;
    for (let record of event.Records) {
      let payload = JSON.parse(record.body);
      payloads.push(payload);
      payload.start = new Date(payload.startDate);
      payload.end = new Date(payload.endDate);
      payload.org = ObjectId(payload.org);
      payload.dev = false;
      main = new WidgetMain();

      let res = await main.main(payload);
    }
    for (let payload of payloads) {
      await main.updateOrgInfo(payload);
    }
    if (DEV_MODE) {
      await MONGO.closeClient();
    }
    const response = {
      statusCode: 200,
      body: "complete",
    }
    return response;
  } catch (error) {
    console.log("\n\n- - - - - - - - -")
    if (error.hasOwnProperty('printPath')) {
      console.log(`ERROR CAUGHT: \n${error.printPath}${error.error}`);
      console.log(`\nSTACK TRACE: ${error.error.stack}`);
    }
    else {
      console.log("ERROR in main: ", error)
    }
  }
}

Date.prototype.addDays = function (days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
}

// main({
//   "Records": [
//     {
//       "body": "{\"startDate\":1624762800000,\"endDate\":1624941000000,\"org\":\"5fb6b7ea6b029226f07d2677\",\"_id\":\"60dba846a4c3af000898104a\"}"
//     }
//   ]
// })

//1624851000000
main({
  "Records": [
    {
      "body": "{\"startDate\":1624852860000,\"endDate\":1624939260000,\"org\":\"5fb6b7ea6b029226f07d2677\",\"_id\":\"60dba846a4c3af000898104a\"}"
    }
  ]
})