const MongoData = require('./MongoData');
const { ObjectId } = require("mongodb");
const { DateTime } = require('luxon');
const util = require('util');

//Main class object
var CLASS_OBJECT = null;

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

class ClassNameHere {
  constructor() {
    this.mongo = new MongoData(IS_DEV_LOCAL_ENV);
  }

  async template() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "ClassNameHere.template:()")) }
      })();
    })
  }

  async initClass() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await this.mongo.initClient();
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "ClassNameHere.initClass():")) }
      })();
    })
  }

  async run(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "ClassNameHere.run()):")) }
      })();
    })
  }
}

exports.handler = async (event) => {
  try {
    let payload = setSettings(event);
    if (IS_DEV_LOCAL_ENV) require('dotenv').config();
    if (CLASS_OBJECT === null) {
      CLASS_OBJECT = new ClassNameHere();
      await CLASS_OBJECT.initClass();
    }
    if (CLASS_OBJECT.mongo.mongooseStatus() === 0) await CLASS_OBJECT.initClass();
    let statusBody = await CLASS_OBJECT.run(payload);
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
