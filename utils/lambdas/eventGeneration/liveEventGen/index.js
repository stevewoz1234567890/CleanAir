const { Event, DebugEvent, EventRule, FormulaValue, DebugFormulaValue } = require('./FRTModels');
// require('dotenv').config();
const { Mongo, strToOid, strToDate, objPrint, hasDuplicates } = require('./utils');
const { ObjectId } = require('mongodb');
const cloneDeep = require('lodash.clonedeep');
const util = require('util'); //for full-form printing of object

const UPLOAD_EVENTS = true;
const DEBUG_LOGS_1 = false;
const DEBUG_LOGS_2 = false; //print the actions on eventFound
const DEV_MODE = false; //(process.env.isProd == 'true') ? false : true;
if (DEV_MODE) console.log("Running in Development Mode");
if (DEBUG_LOGS_1) console.log("Running with debug mode (print statements)")

const DEBUG_X = false;

var MONGO = null;
var RULES = null;

function printArrIfMoreThanOne(arr, name) {
  if (arr.length > 1) console.log(`Array '${name}' has more than one event: ${arr}`)
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
          if (MONGO === null || MONGO.mongooseStatus() === 0) {
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
            let rules = await EventRule.find({}, { subscribers: 0, createdDate: 0, lastUpdate: 0 }).lean().exec();
            rules.forEach((rule, index, array) => {
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

  addWrappertoEvents(events, isDebug, isFromRemote) {
    return events.map(event => {
      if (isFromRemote) event.debug = isDebug;
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
          let containingRemoteEvent = await eventCollection.find(containingFilter).lean().exec();
          let leftSideRemote = await eventCollection.find(leftSideFilter).sort({ "end": -1 }).lean().exec();
          let rightSideRemote = await eventCollection.find(rightSideFilter).sort({ "start": 1 }).lean().exec();

          containingRemoteEvent = this.addWrappertoEvents(containingRemoteEvent, violation.debug, true);
          leftSideRemote = this.addWrappertoEvents(leftSideRemote, violation.debug, true);
          rightSideRemote = this.addWrappertoEvents(rightSideRemote, violation.debug, true);

          containingRemoteEvent = this.removeLocalEvents(containingRemoteEvent, localEvents);
          leftSideRemote = this.removeLocalEvents(leftSideRemote, localEvents);
          rightSideRemote = this.removeLocalEvents(rightSideRemote, localEvents);

          printArrIfMoreThanOne(containingRemoteEvent, "containingRemoteEvent");
          printArrIfMoreThanOne(leftSideRemote, "leftSideRemote");
          printArrIfMoreThanOne(rightSideRemote, "rightSideRemote");

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
          let chunkResolutionMS = RULES[ruleId].resolution * 60000;
          for (const violation of violations) {
            let updateRequired = await this.getEventToUpdate(ruleId, violation, events); //returns null or {event, isRemote, remove (optional)}
            if (DEBUG_LOGS_2) console.log("processing violation: ", violation)
            console.log(`updateRequired returns: `, util.inspect(updateRequired, { depth: null }))
            if (updateRequired) { /** Update an existing event(s) */
              if (updateRequired.skip) {
                if (DEBUG_LOGS_2) console.log("skipping event")
                continue;
              }
              let eventToUpdate = updateRequired.event;
              if (updateRequired.hasOwnProperty('flag') && updateRequired.flag === "already exists") { //if chunk bool unchanged but may need val update
                if (DEBUG_LOGS_2) console.log("updating exisitng event (already exists)")
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
                for (const chunk of eventToUpdate.chunks) {
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
                if (lastChunkIndex === 0 && chunkIndexToRemove === 0 && eventToUpdate.chunks.length === 1) { //delete the whole event (event is only one chunk big)

                  console.log("Single chunk event, deleting the whole event...")
                  if (updateRequired.fromRemote) {
                    eventToUpdate.removeRemoteEvent = true;
                    events.push(eventToUpdate);
                  }
                  else { //local

                    let eventIndexToRemove = events.findIndex(event => event.end.getTime() === violation.end.getTime() && event.debug === violation.debug);
                    events.splice(eventIndexToRemove, 1);
                  }
                  continue;
                }
                else if ((chunkFound.date.getTime() === (eventToUpdate.start.getTime() + chunkResolutionMS)
                  || chunkFound.date.getTime() === eventToUpdate.end.getTime()) && (eventToUpdate.chunks.length > 1)) { //reducing the size of an event
                  console.log("reducing event by 1 (edge)");
                  eventToUpdate.chunks.splice(chunkIndexToRemove, 1);
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
                  let removingIndex = allPopulatedChunks.findIndex(chunk => chunk.formulaValue == chunkFound.formulaValue);
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
                if (DEBUG_LOGS_2) console.log("joining events")
                //NOTE: this logic assumes that the eventToUpdate is to the left (earlier than) of the joinEvent 
                if (DEBUG_LOGS_2) console.log("Joining: ", updateRequired.joinEvent)
                if (DEBUG_LOGS_2) console.log("joinging to: ", eventToUpdate)

                if (DEBUG_LOGS_1) console.log("Joining two events because of new violation");
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
                  if (DEBUG_LOGS_2) console.log("Deleting join event:", joinEvent)
                }
                else { //if local, remove by iteration

                  for (let i = events.length - 1; i >= 0; i--) {
                    if (events[i].start == joinEvent.event.start) { //Here we are comparing REFERENCES of Dates not values (getTime()). So in theory this works.
                      events.splice(i, 1);
                      break;
                    }
                  }
                }
                continue;
              } //======================================== END Join two events because of a new violation =====================================
              else { /** Adding a new chunk to existing event */
                if (DEBUG_LOGS_2) console.log("adding to event")
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
                continue;
              }
            } //======================================== END Adding a new chunk to existing event =====================================
            else { /** create a new Event */
              if (DEBUG_LOGS_2) console.log("creating new event")
              if (DEBUG_LOGS_1) console.log("Checking if we have a violation.")
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
                newEvent.values = violation.withNumValue;
              }
              events.push(newEvent);
              continue;
            }
          }
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
          if (DEBUG_LOGS_2) console.log("generatedEvents: ", util.inspect(generatedEvents, { depth: null, maxArrayLength: null}));
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
          let uploadResponse = await this.uploadEventsToMongo(generatedEvents);
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
    let main = new WidgetMain(records);
    let res = await main.main();
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



