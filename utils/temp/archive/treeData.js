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

    const ts = 1609933440000
    const date = new Date(0)
    //date.setUTCSeconds(ts);
    date.setUTCMilliseconds(ts)
    console.log(date)
    // const collection = await getCollection('flares')
    // const flare = await collection.findOne({_id:ObjectId('5fdbc563d82f6f1d582ae7f8')})
    // console.log(flare)


    // if(client) client.close()
}




main()
