require('dotenv').config();
const mongoose = require('mongoose')
const { ObjectId } = require('mongodb');
const { Job } = require('./FRTModels')



class MongoData {
  constructor(debug = false) {
    this.DEBUG = debug;
    this.connectionString = process.env.DBURI;
    this.client = null;
    this.allData = {};
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
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "Mongo.initClient(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "Mongo.initClient(): ", error });
        }
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

}

module.exports = MongoData
