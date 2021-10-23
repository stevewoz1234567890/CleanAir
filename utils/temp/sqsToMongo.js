
const { MongoClient,ObjectId } = require("mongodb");
let client = null
let debugColl = null
let piCollection = null
let productionColl = null
const DBNAME = 'test'
const DBURI =  "mongodb+srv://cleanairuser:EsjGFgcqPMbLzupm@cleanair-znftk.mongodb.net/test"
const COLLECTION_NAME =  'piValuesDebug'
const PRODUCTION_COLL = 'piValues'
const PICOLL = 'pitags'

exports.handler = async (event) => {
    try{
        if(!client){
            await connect()
        }
        let payload = event
        if(event.Records) payload = JSON.parse(event.Records[0].body)
        
        console.log({payload})
        
        const orgId = ObjectId(payload.o)
        const piId = await piCollection.findOne({name:payload.p,org:orgId},{projection : {_id : 1}})
        
        if(!piId) throw 'no pi tag found'
        if(payload.v.length !== payload.t.length) throw 'mismatched'

        console.log({payload})

        const utcSecs = Math.round(Date.now() / 1000)
        const schemas = payload.v.map((value,index)=>{
            const date = new Date(0)
            date.setUTCSeconds(payload.t[index]);
            const mQuery = {date,org:orgId}
            const schema = {
                piTag : piId._id,
                value : payload.v[index],
                date : date,
                created : new Date(),
                org : orgId,
            }
            return {updateOne : {filter:mQuery,update:{
                $set: {lastUpdate : new Date()},
                $setOnInsert:schema
            
            },upsert:true}}
        })
        const selColl = payload.d ? debugColl : productionColl

        const res = await selColl.bulkWrite(schemas)
        const {result,...stats} = res
        console.log({schemas,stats})

        const response = {
            statusCode: 200,
            body: stats,
        };
        //if(client) client.close()
        return response;
        
    }catch(e){
        console.log(e)
        const response = {
            statusCode: 500,
            body: {
                msg : e,
            },
        };
        //if(client) client.close()
        return response;  
    }
};



const connect = async () =>{
    try {
        const options = {
            useNewUrlParser : true,
            useUnifiedTopology: true
        }
        client = new MongoClient(DBURI,options);
        await client.connect();
        console.log('MongoDB Connected')
        const database = client.db(DBNAME);
        debugColl = database.collection(COLLECTION_NAME)
        piCollection = database.collection(PICOLL)
        productionColl = database.collection(PRODUCTION_COLL)
        return client
    } catch (error) {
        console.error(`MongoDB Error ${error.message}`)
        process.exit(1)
    }
}