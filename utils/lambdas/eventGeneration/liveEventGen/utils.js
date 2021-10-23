// require('dotenv').config();
const mongoose = require('mongoose')
const { ObjectId } = require('mongodb');
const assert = require('assert').strict;
const { Event, DebugEvent, EventRule } = require('./FRTModels')
const util = require('util'); //for full-form printing of object

function getErrorObject(error, path) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  return { printPath: path, error };
}

class Mongo {
  constructor() {
    this.databaseName = 'test';
    this.connectionString = process.env.DBURI;
    this.client = null;
  }

  mongooseStatus() {
    return mongoose.connection.readyState;
  }

  async initClient() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // console.log("string: ", this.connectionString)
          this.client = await mongoose.connect(this.connectionString, {
            useNewUrlParser: true,
            useCreateIndex: true,
            useFindAndModify: false,
            useUnifiedTopology: true
          })
          console.log('Mongoose Connected')
          resolve();
        }
        catch (error) {
          console.error(`MongoDB Error ${error.message}`)
          process.exit(1)
        }
      })();
    });
  }

  async closeClient() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await mongoose.connection.close();
          console.log("Mongoose Connection Closed.");
          resolve();
        } catch (error) {
          reject(`Error closing client: ${error}`);
        }
      })();
    });
  }

  /**
   * 
   * @param array eventArray - Array of event objects
   */
  async uploadEventsToMongo(eventArray, halt=false) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if(halt) return resolve("Skipped uploading")
          let debugEvents = eventArray.filter(e=>e.debug);
          let prodEvents = eventArray.filter(e=>(!e.debug));

          let promises = [
            this._uploadEventsToMongoByColl_(debugEvents,true),
            this._uploadEventsToMongoByColl_(prodEvents, false)
          ]

          await Promise.all(promises);
          return resolve(promises);
        } catch (error) {
          reject(getErrorObject(error, "MONGO.uploadEventsToMongo():"));        }
      })();
    });
  }

  async _uploadEventsToMongoByColl_(eventArray,isDebug) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let eventCollection = isDebug ? DebugEvent : Event;


          // console.log("eventArray: ", isDebug, util.inspect(eventArray, { depth: null, maxArrayLength: null}));
          if (eventArray.length < 1) return resolve("No events to upload");
          let ruleId = eventArray[0].eventRule; //this will not always work because deletes are objects not pure events

          //Allows us to insertMany reather than insertOne at a time. Helps with speed when
          //we have a large amount of events to proccess. insert is faster than upsert/update
          let newEvents = eventArray.filter(event => {
            // console.log()
            return (!event.hasOwnProperty('_id') && (!event.hasOwnProperty('removeRemoteEvent')));
          });

          // for (let e of newEvents) console.log(e)
          // console.log("New: ", newEvents)
          // throw ""

          //these needs to be updated rather than inserted
          let idEvents = eventArray.filter(event => {
            return ((event.hasOwnProperty('_id')) && (!event.hasOwnProperty('removeRemoteEvent')));
          });

          //these needs to be deleted
          let deleteEvents = eventArray.filter(event => {
            return event.hasOwnProperty('removeRemoteEvent');
          });
          let deleteIds = deleteEvents.map(event => {
            return event.event._id
          });

          let inManyRes = await eventCollection.insertMany(newEvents);
          // console.log("insertMany Res: ", util.inspect(inManyRes, { depth: null }));

          let promises = []
          idEvents.forEach(event => {
            let filter = {
              _id: event._id
            }
            let doc = {
              start: event.start,
              end: event.end,
              chunks: event.chunks,
            }
            if (event.hasOwnProperty('values')) {
              doc.values = event.values
            }
            promises.push(eventCollection.updateOne(filter, doc));
          });
          let updateManyRes = await Promise.all(promises);
          // console.log("updateMany Res: ", util.inspect(updateManyRes, { depth: null }));

          let deleteManyRes = null;
          if (deleteIds.length > 0)  deleteManyRes = await eventCollection.deleteMany({ _id: { $in: deleteIds } });
          // console.log("delete ids: ", deleteIds);
          // console.log("deleteManyRes Res: ", util.inspect(deleteManyRes, { depth: null }));
          //TODO QUESTION: We probably want to check that all inserts/updates were successful. If not then log. So
          //that needs to be added. But also I don't know if we want the caller to handle that for some reason, rather than here
          let returnInfo = {
            isDebug : isDebug,
            nNewEvents: newEvents.length,
            nUpdateEvents : idEvents.length,
            nDelete : deleteIds.length,
          }
          return resolve(returnInfo);
        } catch (error) {
          reject(getErrorObject(error, "MONGO._uploadEventsToMongoByColl_(): "));
        }
      })();
    });
  }
}

function strToOid(id) {
  let oid = ObjectId(id);
  let len = oid.toHexString().length
  assert.strictEqual(24, len, `ID length is must be 24. Found length ${len}.`);
  return oid
}

function strToDate(dateStr) {
  let date = new Date(dateStr);
  return date;
}

function objPrint(obj) {
  console.log("objects start", "---------v");
  console.log("Key, Type, Value");
  for (const key in obj) {
    console.log(`\t${key},  ${typeof obj[key]},  ${obj[key]}}`);
  }
  console.log("objects end", " ---------^ ");

}

function hasDuplicates(array) {
  return (new Set(array)).size !== array.length;
}

module.exports = { Mongo, strToOid, strToDate, objPrint, hasDuplicates }