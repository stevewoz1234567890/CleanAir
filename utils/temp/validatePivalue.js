const { MongoClient, ObjectId } = require("mongodb");
const DBNAME = "test"
const DBURI = "mongodb+srv://cleanairuser:EsjGFgcqPMbLzupm@cleanair.znftk.mongodb.net/test?retryWrites=true&w=majority"
let client = null
const connect = async () => {
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
        client = new MongoClient(DBURI, options);
        await client.connect();
        console.log('MongoDB Connected')
        return client
        //    2   console.error(`MongoDB Error ${error.message}`)
        //         process.exit(1) 
    } catch (error) {
        console.log("Connect Error: ", err);
    }
}
const getCollection = async (collName, dbName = DBNAME) => {
    if (!client) {
        await connect()
    }
    const database = client.db(dbName);
    return database.collection(collName)
}
const main = async () => {
    const day = '2021-01-24'
    const startTime = '10:50'
    const endTime = '11:15'
    const tagName = 'CTA98173B'
    const tagCollection  = await getCollection('pitags')
    const tag = await tagCollection.findOne({name:tagName})
    const query = {
        piTag: tag._id,
        org: ObjectId('5fb6b7ea6b029226f07d2677'),
        date: {
            $gte : new Date(`${day} ${startTime}z`),
            $lt : new Date(`${day} ${endTime}z`),
        }
    }
    const collection = await getCollection('piValuesDebug')
    const records = await collection.find(query).toArray()
    for(const record of records){
        console.log({d:record.date,t:record.value})
    }
    //console.log(records)
    if(client) client.close()
}
main()