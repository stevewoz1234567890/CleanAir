
const AWS = require('aws-sdk')
const { MongoClient } = require("mongodb");
const collections = [
        'compoundgroups',
        'compounds',
        'constants',
        'eventrules',
        'flares',
        'formulas',
        'headers',
        'orgs',
        'parameters',
        'permissiongroups',
        'permissions',
        'pitags',
        'sensors',
        'users'
]
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
const DBNAME = 'test'
const DBURI =  "mongodb+srv://cleanairuser:EsjGFgcqPMbLzupm@cleanair-znftk.mongodb.net/test"
const BUCKETNAME = 'clean-cloud-mongo-backups'
let client = null


exports.handler = async (event) => {
    await connect()
    await Promise.all(collections.map(async(collection) => {
        await backUpCollection(collection)
    }))
    if (client) client.close();
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    
    return response;
};

const backUpCollection = async (coll) =>{
    const database = client.db(DBNAME);
    const collection = database.collection(coll)
    const docs = await collection.find().toArray()
    const path = `${coll}.json`
    const params = {
        Body: JSON.stringify(docs,null,4),
        Bucket: BUCKETNAME,
        Key: path,
    };
    const res = await s3.putObject(params).promise()

    console.log(res)
}



const connect = async () =>{
    try {
        const options = {
            useNewUrlParser : true,
            useUnifiedTopology: true
        }
        client = new MongoClient(DBURI,options);
        await client.connect();
        console.log('MongoDB Connected')
        return client
    } catch (error) {
        console.error(`MongoDB Error ${error.message}`)
        process.exit(1)
    }
}