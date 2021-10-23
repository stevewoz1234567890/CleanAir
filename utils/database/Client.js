require('dotenv').config();

const mongoose = require('mongoose')
const { MongoClient,ObjectId } = require("mongodb");
let client = null

const mongooseConnect = async (DBURI=process.env.DBURI) =>{
    try {
        await mongoose.connect(DBURI,{
            useNewUrlParser : true,
            useCreateIndex: true,
            useFindAndModify : false,
            useUnifiedTopology: true
        })
        console.log('Mongoose Connected')
    } catch (error) {
        console.error(`MongoDB Error ${error.message}`)
        process.exit(1)
    }
}

const mongoSDKConnect = async (DBURI=process.env.DBURI) => {
    try {
      const dbUrl = DBURI;
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      };
      client = new MongoClient(DBURI, options);
      await client.connect();
      console.log("MongoDB SDK Connected");
    } catch (error) {
      console.error(`MongoDB SDK Error ${error.message}`);
      process.exit(1);
    }
};

const getCollection = async (collName, dbName=process.env.MONGO_DATABASE) => {
    const database = client.db(dbName);
    return database.collection(collName);
};


module.exports = {mongooseConnect,mongoSDKConnect,getCollection,ObjectId}