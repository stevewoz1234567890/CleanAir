"use strict";

const { MongoClient } = require("mongodb");
let client = null;

const DBNAME = 'test'
// const MONGODB_URI = process.env.MONGODB_URI; // "mongodb+srv://cleanairuser:EsjGFgcqPMbLzupm@cleanair-znftk.mongodb.net/test"
const MONGODB_URI = "mongodb+srv://cleanairuser:EsjGFgcqPMbLzupm@cleanair-znftk.mongodb.net/test"

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log({event});
  
  try {
    await connectToDatabase()
    const dbRes = await useDatabase(event)
    const response = {
      statusCode: 200,
      body: JSON.stringify({data : dbRes}),
    };
    console.log({response})
    return response;

  } catch (error) {
      const response = {
          statusCode: 500,
          body: JSON.stringify({msg : error.message}),
      };
      console.log({response})
      return response;
      
  }
};






function dbFindOne(event){
  console.log('=> dbFindOne');
  const collectionName = event.collection;
  const query = event.query ? event.query : {};
  const args = event.args ? event.args : {};
  return await client.collection(collectionName).findOne(query,args);
}

function dbBulkWrite(event) {
  console.log('=> dbBulkWrite');
  const collectionName = event.collection;
  let args = event.dbArgs;
  
  return client.collection(collectionName).bulkWrite(...args).toArray()
    .then(() => { return { statusCode: 200, body: 'success' }; })
    .catch(err => {
      console.log('=> an error occurred: ', err);
      return { statusCode: 500, body: 'error' };
    });

}

function useDatabase (event) {
  let action = event.action;
  switch(action) {
    case "findOne":
      return dbFindOne(event)
    case "bulkWrite":
      return dbBulkWrite(event)
    default:
      throw `${action} action for database was not found`;
  }
}




const connectToDatabase = async()=>{
  if (client) return 
  
  const options = {
    useNewUrlParser : true,
    useUnifiedTopology: true
  }

  try {
    client = new MongoClient(MONGODB_URI, options);
    await client.connect();
    console.log("MongoDB SDK Connected");
  } catch (error) {
    console.error(`MongoDB SDK Error ${error.message}`);
    process.exit(1);
  }
}




// function connectToDatabase (uri) {
//   console.log('=> connect to database');
//   if (cachedDb) {
//     console.log('=> using cached database instance');
//     return Promise.resolve(cachedDb);
//   }
//   try {
//     const options = {
//       useNewUrlParser : true,
//       useUnifiedTopology: true
//     }
//     return MongoClient.connect(uri, options)
//       .then(client => {
//         console.log('MongoDB Connected')
//         cachedDb = client.db(DBNAME);
//         return cachedDb;
//       });
//   } catch(error) {
//     console.error(`MongoDB Error ${error.message}`);
//     process.exit(1);
//   }
// }