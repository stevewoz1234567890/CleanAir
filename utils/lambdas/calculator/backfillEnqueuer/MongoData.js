// require('dotenv').config();
const mongoose = require('mongoose')
const { ObjectId } = require('mongodb');
const { Org, PiTag } = require('./FRTModels');


function getErrorObject(error, path) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  return { printPath: path, error };
}

Number.isInteger = Number.isInteger || function (value) {
  return typeof value === 'number' &&
    isFinite(value) &&
    Math.floor(value) === value;
};

class MongoData {
  constructor() {
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
          this.client = await mongoose.connect(this.connectionString, {
            useNewUrlParser: true,
            useCreateIndex: true,
            useFindAndModify: false,
            useUnifiedTopology: true
          })
          console.log('Mongoose Connected')
          return resolve()
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.initClient(): ")) }
      })();
    });
  }

  static async closeClient() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await mongoose.connection.close();
          console.log("Mongoose Connection Closed.");
          return resolve();
        } catch (error) {
          return reject(`Error closing client: ${error}`);
        }
      })();
    });
  }

  async getOrgs() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let orgs = await Org.find({}).lean().exec()
          orgs = orgs.filter(o=>o.backfillEnabled === true);
          return resolve(orgs)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getUsers(): ")) }
      })();
    });
  }

  async getPiTags(orgs) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (orgs.length === 0 ) return resolve([]);
          let tags = [];
          for (let org of orgs) {
            let tag = await PiTag.findOne({org : org._id}).select('name org').lean().exec();
            if (tag) tags.push(tag)
          }
          return resolve(tags)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.getUsers(): ")) }
      })();
    });
  }
  
  async updateOrg(filter, update) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let doc = await Org.findByIdAndUpdate(filter, update);
          return resolve(doc)
        }
        catch (error) { return reject(getErrorObject(error, "Mongo.updateOrg(): ")) }
      })();
    });
  }


}

module.exports = MongoData
