const AWS = require('aws-sdk')
const { MongoClient, ObjectId } = require("mongodb");
let client = null
let debugColl = null
let piCollection = null
let productionColl = null
let orgsColl = null;
const DBNAME = 'test'
const DBURI = "mongodb+srv://cleanairuser:EsjGFgcqPMbLzupm@cleanair-znftk.mongodb.net/test"
const COLLECTION_NAME = 'piValuesDebug'
const PRODUCTION_COLL = 'pivalues'
const ORG_COLL = 'orgs';
const PICOLL = 'pitags'
const SQS = new AWS.SQS();

exports.handler = async (event) => {
    try {
        let DUPLICATE_TO_PROD = { enabled: true, needsDuplication: false };
        if (!client) {
            await connect()
        }
        let payload = event
        if (event.Records) payload = JSON.parse(event.Records[0].body)
        if (payload.d) return {
            statusCode: 200,
            body: {msg : "skipped debug payload"},
        };
        console.log({ payload })
        const orgId = ObjectId(payload.o)
        const piId = await piCollection.findOne({ name: payload.p, org: orgId }, { projection: { _id: 1 } })
        DUPLICATE_TO_PROD.needsDuplication = payload.d;

        if (!piId) throw 'no pi tag found'
        if (payload.v.length !== payload.t.length) throw 'mismatched'
        let payloadLength = payload.v.length;
        console.log("payloadLength: ", payloadLength)

        const utcSecs = Math.round(Date.now() / 1000)
        const schemas = payload.v.map((value, index) => {
            const date = new Date(0)
            //date.setUTCSeconds(payload.t[index]);
            date.setUTCMilliseconds(payload.t[index]);
            const mQuery = { date, org: orgId, piTag: piId._id }
            const schema = {
                piTag: piId._id,
                value: payload.v[index],
                date: date,
                //created : new Date(),
                org: orgId,
            }
            if (payload.dev && payload.dev == 'production') {
                schema.testData = true

            }
            const piValue = payload.v[index]
            return {
                updateOne: {
                    filter: mQuery, update: {
                        $set: schema,
                        $setOnInsert: {
                            created: new Date(),
                        }

                    }, upsert: true
                }
            }
        })
        let selColl = payload.d ? debugColl : productionColl
        if (payload.dev && payload.dev == 'production') {
            // console.log("PRODUCTION COLLECTION SELECTED!")
            selColl = productionColl
        }
        let res, result, stats = null;
        if (!payload.ignore) {
            res = await selColl.bulkWrite(schemas)
            result = res.result;
            stats = res.stats
            // { result, ...stats } = res
            console.log({ schemas, stats })
        }


        //============== temp
        if (DUPLICATE_TO_PROD.enabled && DUPLICATE_TO_PROD.needsDuplication) {
            await productionColl.bulkWrite(schemas);
        }
        //==============

        if (payloadLength < 16) {
            try {
                /* Send the data to the endpoint for live data calculations */
                const messageParams = {
                    MessageBody: JSON.stringify(payload),
                    QueueUrl: process.env.FlareDataToCalc_SQS
                };
                if (!payload.d) await SQS.sendMessage(messageParams).promise()
                else if (DUPLICATE_TO_PROD.enabled && DUPLICATE_TO_PROD.needsDuplication) {
                    payload.d = false;
                    const lMessageParams = {
                        MessageBody: JSON.stringify(payload),
                        QueueUrl: process.env.FlareDataToCalc_SQS
                    }
                    await SQS.sendMessage(lMessageParams).promise();
                }

            } catch (error) {
                console.log("ERROR: with sending message to SQS, ", error);
            }
        } else if (payloadLength > 1430 && payloadLength < 1450) { //there are 1440 min in a day, but we are allowing flex for human error (by client) and for non-regualar backfills
            try {
                console.log("payload qualifies for backfill")
                let timestamps = payload.t.filter(t => !isNaN(t));
                console.log("filtered payload length is: ", timestamps.length)
                if (timestamps.length > 0) {
                    let oldestTimestamp = Math.min(...timestamps);
                    let newestTimestamp = Math.max(...timestamps);
                    if (isNaN(oldestTimestamp) || isNaN(newestTimestamp)) {
                        console.log("timestamps: ", timestamps);
                        console.log("oldest: ", oldestTimestamp);
                        console.log("newest: ", newestTimestamp);
                        throw new Error("Max or min timestamp is NaN.")
                    }
                }
            } catch (error) {
                console.log(`Error in handling backfill. The size was: ${payloadLength}.`);
                console.log("ERROR : ", error)
                try {
                    console.log("Stack: ", error.stack);
                } catch (e) { }
            }
        }

        const response = {
            statusCode: 200,
            body: stats,
        };
        //if(client) client.close()
        return response;
    } catch (e) {
        console.log(e)
        const response = {
            statusCode: 500,
            body: {
                msg: e,
            },
        };
        //if(client) client.close()
        return response;
    }
};


const connect = async () => {
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
        client = new MongoClient(DBURI, options);
        await client.connect();
        console.log('MongoDB Connected')
        const database = client.db(DBNAME);
        debugColl = database.collection(COLLECTION_NAME)
        piCollection = database.collection(PICOLL)
        productionColl = database.collection(PRODUCTION_COLL)
        orgsColl = database.collection(ORG_COLL);
        return client
    } catch (error) {
        console.error(`MongoDB Error ${error.message}`)
        process.exit(1)
    }
}