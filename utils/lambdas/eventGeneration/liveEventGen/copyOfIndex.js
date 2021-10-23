const { Event, DebugEvent, EventRule, FormulaValue, DebugFormulaValue } = require('./FRTModels');
// require('dotenv').config();
const { Mongo, strToOid, strToDate, objPrint, hasDuplicates } = require('./utils');
const { ObjectId } = require('mongodb');
const cloneDeep = require('lodash.clonedeep');
const util = require('util'); //for full-form printing of object

const UPLOAD_EVENTS = true;
const DEBUG_LOGS_1 = false;
const DEV_MODE = false; //(process.env.isProd == 'true') ? false : true;
if (DEV_MODE) console.log("Running in Development Mode");
if (DEBUG_LOGS_1) console.log("Running with debug mode (print statements)")

var MONGO = null;
var RULES = null;

function sortNearestEvent(a, b) {
  //sort to get nearest event (not to sort by chronological order)
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
  if (selection === 0) {
    // console.log(`ORDER DIF: ${a.start - b.start}`)
    return (a.start - b.start); //The earlier event goes first
  }
  return selection;
}


class WidgetMain {
  constructor(violations) {
    this.violations = violations;

    //Initalized in this.initMain()
    this.ruleIdsToProcces;
    this.numRulesToProccess;
    this.grouped_violations_dict;
  }

  /** **********************************************************************************************
   * @desc
   * 1. Connect to Mongo if not already connected
   * 2. Convert payload from strings to Date/ObjIDs + change the structure to a dict + sort
   * 3. Get all the rules if null, and store num rules
   * - Initalize Class Vars: this.ruleIdsToProcces, this.numRulesToProccess, this.grouped_violations_dict;
   * @return None
  */
  async initMain() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          /** 1. Connect to MongoDB */
          if (MONGO === null) {
            MONGO = new Mongo();
            await MONGO.initClient();
          }
          else if (MONGO.mongooseStatus() == 0) {
            MONGO = new Mongo();
            await MONGO.initClient();
          }

          this.violations = this.violations.filter(v => !v.debug)

          /** 2. Convert Datatypes. to Dates and OIDs from strings */
          this.violations.forEach((violation, index, array) => {
            array[index].start = strToDate(violation["start"]);
            array[index].end = strToDate(violation["end"]);
            // console.log("HAS VALEUS", array[index])
            if (array[index].withNumValue) {
              if (!Array.isArray(array[index].withNumValue)) array[index].withNumValue = [array[index].withNumValue];
              array[index].withNumValue.forEach((v, i, a) => {
                a[i].date = strToDate(a[i].date)
              })
            }
          });

          /** 2.1 Convert data structure to an object to use as a dictionary (ruleId as key) */
          // var grp_vio_arr = []; //Group Violation, Array
          var grp_vio_dict = {}; //Group Violation, Object/Dictionary
          var ruleIdsToProcces = []; //Rules that input violations correspond to

          //create dictionary from array
          this.violations.forEach(violation => {
            let ruleId = violation.ruleId;
            if (ruleId in grp_vio_dict) {
              grp_vio_dict[ruleId].push(violation);
            } else {
              grp_vio_dict[ruleId] = [violation];
            }
          });

          //sort the events in the dict. Create array of rules being proccessed based on input violations.
          for (const ruleId in grp_vio_dict) {
            // grp_vio_dict[ruleId].sort(function (a, b) {
            //   return (a.end - b.end);
            // });
            ruleIdsToProcces.push(ruleId);
          }
          this.ruleIdsToProcces = ruleIdsToProcces;
          this.numRulesToProccess = ruleIdsToProcces.length;
          this.grouped_violations_dict = grp_vio_dict;

          /** 3.Get rules into the global space */
          if (RULES == null) {
            RULES = {};
            let rules = await EventRule.find({}, { subscribers: 0, createdDate: 0, lastUpdate: 0 }).exec();
            rules.forEach((rule, index, array) => {
              rule = rule.toObject();
              let oidKeys = ['_id', 'org', 'formula', 'checkForValue'];
              oidKeys.forEach(key => {
                if (rule[key]) {
                  rule[key] = rule[key].toString();
                }
              });
              array[index] = rule;
            });
            for (const rule of rules) {
              RULES[rule._id] = rule;
            }
          }
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
          let eventCollection = violation.debug ? DebugEvent : Event;
          let chunkResolution = RULES[ruleId].resolution; //in minutes
          let proximitySensitivity = RULES[ruleId].sensitivity; //in minutes
          let eventFound = null;

          /** First we want to check the local events. We don't want to pull data if we don't have to +
           * other passes in a run might call for deleting a remote event that is local... etc...
           */
          let pastAdjecentLocalEvent, futureAdjecentLocalEvent, pastAdjecentRemoteEvent, futureAdjecentRemoteEvent = null;
          let relevantLocalEvents = [];
          let offset = chunkResolution * proximitySensitivity * 60000;
          let violationInclusiveFuturemostCutoff = violation.end.getTime() + offset;
          let violationInclusivePastmostCutoff = violation.start.getTime() - offset;
          localEvents.forEach(event => {
            if (event.hasOwnProperty('removeRemoteEvent')) { return }
            if (event.start.getTime() > violationInclusiveFuturemostCutoff || event.end.getTime() < violationInclusivePastmostCutoff) return;
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
          if (relevantLocalEvents.length > 0) {
            relevantLocalEvents.sort(sortNearestEvent);

            //case: local event where violation is within it's date range
            let containingLocalEvent = relevantLocalEvents.find(e => {
              return (violation.start >= e.start && violation.end <= e.end)
            });
            if (containingLocalEvent) {
              if (violation.formulaValue.value === RULES[ruleId].checkFor) { //If the violation (new chunk) is already a part of the event ignore only if NOT with valuse, else check if withvalues needs update
                nearestEvent.flag = "already exists"
                return resolve(containingLocalEvent);
              }
              else { //Value has changed from true to false, so we need to delete it from the event
                nearestEvent.remove = true;
                return resolve(containingLocalEvent);
                return resolve(containingLocalEvent);
              }
            }

            //case: at least 1 local eventis adjecent to violation
            pastAdjecentLocalEvent = relevantLocalEvents.find(e => { //violation append-able to an event
              return (violation.start >= e.end && violation.start <= violationInclusiveFuturemostCutoff);
            });
            futureAdjecentLocalEvent = relevantLocalEvents.find(e => { //violation prepend-able to an event
              return (violation.end <= e.start && violation.end >= violationInclusivePastmostCutoff);
            });
            if (pastAdjecentLocalEvent && futureAdjecentLocalEvent) { //we will be joining to local events
              pastAdjecentLocalEvent.joinEvent = futureAdjecentLocalEvent;
              return resolve(pastAdjecentLocalEvent)
            }
            // else if (pastAdjecentLocalEvent) return resolve(pastAdjecentLocalEvent);
            // else if (futureAdjecentLocalEvent) return resolve(futureAdjecentLocalEvent);

          }
          /**
          - get remote events
          - check for remote engulfed/containing (fitler)
          - check for mixed joins (filter)
          - check for remote join (filter)
          - check for local append and prepend
          - check for remote append and prepend (filter)
           */


          //** We will now be checking for relevant remote events */
          //recall we want to be inclusive in case an event exists already for this violation --means it may be an update.
          //Case: Nearest Adjecent Future Event
          var cutoff = new Date(violation.start.getTime() + (chunkResolution * 60000) + (proximitySensitivity * chunkResolution * 60000)); //anymore than the chunk+sensitivity resolution means new event
          let futureStart = await eventCollection.find({ start: { $gte: violation.start, $lte: cutoff }, eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header }).sort({ "start": 1 }).limit(1).lean().exec();
          //Case: Nearest Adjecent Past Event
          cutoff = new Date(violation.end.getTime() - (chunkResolution * 60000) - (proximitySensitivity * chunkResolution * 60000))
          let pastEnd = await eventCollection.find({ end: { $lte: violation.end, $gte: cutoff }, eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header }).sort({ "end": -1 }).limit(1).lean().exec();
          //Case: Nearest Englufed Event by Start 
          let engulfedStart = await eventCollection.find({ start: { $lte: violation.start }, end: { $gte: violation.start }, eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header }).sort({ "start": -1 }).limit(1).lean().exec();
          //Case: Nearest Englufed Event by End
          let engulfedEnd = await eventCollection.find({ end: { $gte: violation.end }, start: { $lte: violation.end }, eventRule: ruleId, flare: violation.formulaValue.flare, header: violation.formulaValue.header }).sort({ "end": 1 }).limit(1).lean().exec();

          let remoteEventsPre = [...futureStart, ...pastEnd, ...engulfedStart, ...engulfedEnd];
          let remoteEvents = []
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

          if (remoteEvents.length > 0) {

          }






          if (remoteEvents.length > 0) {
            remoteEvents.sort(sortNearestEvent);
            //case: at least 1 remote event is adjecent to violation
            let pastAdjecentRemoteEvent = relevantRemoteEvents.find(e => { //violation append-able to an event
              return (violation.start >= e.end && violation.start <= violationInclusiveFuturemostCutoff);
            });
            let futureAdjecentRemoteEvent = relevantRemoteEvents.find(e => { //violation prepend-able to an event
              return (violation.end <= e.start && violation.end >= violationInclusivePastmostCutoff);
            });
            if (pastAdjecentRemoteEvent && futureAdjecentRemoteEvent) { //we will be joining to remote events
              pastAdjecentRemoteEvent.joinEvent = futureAdjecentRemoteEvent;
              return resolve(pastAdjecentRemoteEvent)
            }
            else if (pastAdjecentRemoteEvent) return resolve(pastAdjecentRemoteEvent);
            else if (futureAdjecentRemoteEvent) return resolve(futureAdjecentRemoteEvent);

            //case: remote event where violation is within it's date range
            let containingRemoteEvent = relevantRemoteEvents.find(e => {
              return (violation.start >= e.start && violation.end <= e.end)
            });
            if (containingRemoteEvent) {
              if (violation.formulaValue.value === RULES[ruleId].checkFor) { //If the violation (new chunk) is already a part of the event ignore only if NOT with valuse, else check if withvalues needs update
                nearestEvent.flag = "already exists"
                return resolve(containingRemoteEvent);
              }
              else { //Value has changed from true to false, so we need to delete it from the event
                nearestEvent.remove = true;
                return resolve(containingRemoteEvent);
              }
            }
          }



          // let allEvents = [];
          // allEvents.push(...relevantLocalEvents, ...remoteEvents);
          // if (DEBUG_LOGS_1) console.log("Checking the events")
          // if (relevantLocalEvents.length === 0 && remoteEvents.length === 0) {
          //   if (DEBUG_LOGS_1) console.log("resolving. No events found.");
          //   if (DEBUG_LOGS_1) console.log("Completely new event...")
          //   return resolve();
          // }
          // if (DEBUG_LOGS_1) console.log("sorting events by proximity...");
          // relevantLocalEvents.

          // allEvents.sort(sortNearestEvent);
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

  /** **********************************************************************************************
   * @desc Generate events for all violations of a specific EventRule
   * @param string ruleId 
   */
  async generateEventsFromRuleId(ruleId) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let violations = this.grouped_violations_dict[ruleId];
          let events = []; //initalize array of events to be updated in DB
          // console.log("rules: ", RULES)
          // console.log("ruleId: ", ruleId)

          let chunkResolutionMS = RULES[ruleId].resolution * 60000;
          // console.log("chunk res: ", `ms: ${chunkResolutionMS}`, `min: ${chunkResolutionMS / 60000}`);
          for (const violation of violations) {
            let updateRequired = await this.getEventToUpdate(ruleId, violation, events); //returns null or {event, isRemote, remove (optional)}
            // console.log(`update required is: `, util.inspect(updateRequired, { depth: null }))
            if (updateRequired) { /** Update an existing event(s) */
              let eventToUpdate = updateRequired.event;
              if (updateRequired.hasOwnProperty('flag') && updateRequired.flag === "already exists") { //if chunk bool unchanged but may need val update
                if (!RULES[ruleId].withValues) continue;
                else {
                  let numChanges = 0;
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


                  // if (DEBUG_LOGS_1 || temp == 1) match = {formulaValue: chunk.formulaValue, date :  new Date("2021-05-03T03:00:00.000Z")}
                  // if (DEBUG_LOGS_1 || temp == 2) match = {formulaValue: chunk.formulaValue, date :  new Date("2021-05-03T03:15:00.000Z")}
                  // if (DEBUG_LOGS_1 || temp == 3) match = {formulaValue: chunk.formulaValue, date :  new Date("2021-05-03T03:30:00.000Z")}
                  // if (temp == 3) match = {_id: chunk.formulaValue, date :  new Date(violation.end.getTime() + (15*60000*(temp-2)))}
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
                if (updateRequired.fromRemote) events.push(eventToUpdate);
                if (joinEvent.event.hasOwnProperty('_id')) { //flag remote joiner event for deletion
                  joinEvent.removeRemoteEvent = true;
                  events.push(joinEvent);
                  // console.log("JOIN EVENT IS FROM REMOTE:", joinEvent)
                }
                else { //if local, remove by iteration

                  for (let i = events.length - 1; i >= 0; i--) {
                    // console.log("event :", i, events[i])
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
                if (DEBUG_LOGS_1) console.log("Adding chunk to an existing event");
                eventToUpdate.chunks.push({ formulaValue: violation.formulaValue._id });
                if (violation.end > eventToUpdate.end) {
                  eventToUpdate.end = violation.end;
                }
                else if (violation.start < eventToUpdate.start) {
                  eventToUpdate.start = violation.start;
                }
                if (RULES[ruleId].withValues) {
                  // console.log("ERICK")
                  // console.log("eventTOUpdate: ",util.inspect(eventToUpdate, { depth: null}))
                  // console.log("violation: ", util.inspect(violation, { depth: null}));
                  // console.log("about to push...");
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
              // console.log("new event: ", newEvent)
              events.push(newEvent);
              continue;
            }
          }
          // console.log("lowest-layer events: ", util.inspect(events, { depth: null}));
          // console.log("events: ", events )

          resolve(events);
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
          if (DEBUG_LOGS_1) console.log("uploading events...")
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
  async main() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await this.initMain();
          let generatedEvents = await this.generateEvents();
          // console.log("top-layer events: ", util.inspect(generatedEvents, { depth: null }));
          // console.log("generated events: ", generatedEvents)
          // return resolve(generatedEvents)
          let uploadResponse = await this.uploadEventsToMongo(generatedEvents);
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


exports.handler = async (event) => {
  // async function main(event) {
  try {
    let records;
    if (event.Records) {
      records = event.Records.map((value, index, array) => {
        return JSON.parse(array[index].body)
      })
    } else records = event;

    console.log("records: ", util.inspect(records, { depth: null }));
    records = adaptRecords(records);
    // for (let r of records) console.log(r)
    // return;

    let main = new WidgetMain(records);
    let res = await main.main();
    // console.log(`FINAL RESPONSE: `, util.inspect(res, { depth: null }));
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

  /*If Dev mode, then close the mongo client */
  if (DEV_MODE) {
    try {
      await MONGO.closeClient();
    } catch (error) {
      console.log("Connection was already closed", `Error: ${error}`); //Nothing happens if already closed, so we can probably remove this
    }
  }
}



