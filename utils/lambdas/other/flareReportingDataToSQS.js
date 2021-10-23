const AWS = require('aws-sdk')
const { MongoClient, ObjectId } = require("mongodb");
const { v4: uuidv4 } = require('uuid');
const DBURI = "mongodb+srv://cleanairuser:EsjGFgcqPMbLzupm@cleanair-znftk.mongodb.net/test"
const DBNAME = 'test'
const PICOLL = 'pitags'
const logGroup = 'HuskyPiPushExceptions'

let client = null;
let piCollection = null
let numericRuleCollection = null;

let numericRules = null;

const CloudWatch = new AWS.CloudWatchLogs({ region: 'us-east-1' });
const Lambda = new AWS.Lambda({ region: 'us-east-1' })
const SQS = new AWS.SQS({ region: 'us-east-1' });



/* See below for information */

exports.handler = async (event) => {
    console.log(event)

    try {
        const params = event.queryStringParameters

        /* If we arent already connected to mongo.... connect */
        if (!client) {
            await connect()
        }

        const data = JSON.parse(event.body)

        /* Check if we are in 'debug'/testing mode....  */
        data.d = false
        if (params && params.debug && params.debug == 'true') {
            data.d = true
        }

        const PAYLOAD_IS_DEBUG = data.d;

        /* Set the organization... in this case... the org is husky/lima */
        data.o = '5fb6b7ea6b029226f07d2677'

        /*check to make sure v and t are arrays*/
        if (!Array.isArray(data.v) || !Array.isArray(data.t)) {
            const response = {
                statusCode: 400,
                body: JSON.stringify(
                    {
                        msg: "Malformed JSON Payload. 'v' and 't' must be arrays.",
                    }
                ),
            };
            const logPayload = {
                event,
                response
            }
            await putExceptionLog(logPayload, 'Malformed JSON Payload')
            console.log({ response })
            return response;
        }
        const stats = {
            vlen: data.v.length,
            tlen: data.t.length,
            firstDate: new Date(data.t[0]),
            lastDate: new Date(data.t[data.t.length - 1])
        }

        console.log(stats)

        /* Check to make sure the values array and the times array are the same length */
        if (data.v.length !== data.t.length) {
            const response = {
                statusCode: 400,
                body: JSON.stringify(
                    {
                        msg: 'Mismatched Array Size',
                    }
                ),
            };
            const logPayload = {
                event,
                stats,
                response
            }
            await putExceptionLog(logPayload, 'Mismatched Array Size')
            console.log({ response })
            return response;
        }

        /* Get rid of the extension*/
        data.p = data.p.includes('.') ? data.p.split('.')[0] : data.p

        /* Check to make sure its a known pitag */
        const piId = await piCollection.findOne({ name: data.p, org: ObjectId(data.o) }, { projection: { _id: 1 } })

        if (!piId) {
            let code = 212; //data.p === "LI6159" ? 212 : 202;
            const response = {
                statusCode: code,
                body: JSON.stringify(
                    {
                        msg: `Recieved data for tag '${data.p}' but will not process. Configure pitag in CleanCloud to begin saving this data.`,
                    }
                ),
            };
            const logPayload = {
                event,
                stats,
                response
            }
            await putExceptionLog(logPayload, 'Unknown PiTag')
            console.log({ response })
            return response;
        }


        let res = null;
        if (!PAYLOAD_IS_DEBUG) {

            const messageParams = {
                MessageBody: JSON.stringify(data),
                QueueUrl: process.env.SQSURL
            };
            res = await SQS.sendMessage(messageParams).promise()
            try {
                if (numericRules && numericRules.length > 0) {
                    let matchedRules = numericRules.filter(r => String(r.parameter) === String(piId._id));
                    if (matchedRules.length > 0) {
                        let tagIDs = matchedRules.map(r => String(r._id)); 
                        let newMessage = {
                            updateInfo: data,
                            ruleInfo: { numericEventRules: tagIDs, parameterType: "pitag" },
                        }
                        let sqsMessage = {
                            MessageBody: JSON.stringify(newMessage),
                            QueueUrl: process.env.NUM_RULE_FIFO_QUEUE,
                            MessageGroupId : uuidv4(),
                            MessageDeduplicationId : uuidv4(),
                        };
                        await SQS.sendMessage(sqsMessage).promise()
                    }
                }
            } catch (e) { console.log("error with num rule sending, ", e) }
        }

        const response = {
            statusCode: 202,
            body: JSON.stringify({
                msg: "Accepted for Processing",
                id: res ? res.MessageId : null
            }),
        };
        if (stats.vlen !== 5 && stats.vlen !== 1440) {
            const logPayload = {
                event,
                stats,
                response
            }
            await putExceptionLog(logPayload, 'not5Or1440')
        }

        console.log({ response })
        return response;
    } catch (e) {
        console.log(e)
        const response = {
            statusCode: 500,
            body: {
                msg: e,
            },
        };
        const logPayload = {
            event,
            response
        }
        await putExceptionLog(logPayload, '500')
        console.log({ response })
        return response;
    }

};

const connect = async () => {
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
        client = new MongoClient(process.env.DBURI, options);
        await client.connect();
        console.log('MongoDB Connected')
        const database = client.db(process.env.DBNAME);
        piCollection = database.collection(process.env.PICOLL);
        try {
            let projection = { parameterType: 1, _id: 1, parameter : 1 };
            numericRuleCollection = database.collection("numericEventRules");
            numericRules = await numericRuleCollection.find({ parameterType: "pitag" }, { projection }).toArray()
        } catch (e) { console.log("error with num rule colls:", e) }
        return client
    } catch (error) {
        console.error(`MongoDB Error ${error.message}`)
        process.exit(1)
    }
}



const putExceptionLog = async (payload, logStream) => {
    const params = {
        FunctionName: "flareReportingUpdateLogStream",
        InvocationType: "Event",
        Payload: JSON.stringify({ payload, logStream }),
    };
    await Lambda.invoke(params).promise();
}




/*
    sampleHeaders = {
        'x-api-key': 'jUzARqsbDQ4QUG8SCcNQG5cM7PAAQTbg70pAzeaW',
        'Content-Type': 'application/json'
    }
    expected payload:
        {
            "p" : "FI6176A",
            "v" : [2.334,4.223,5.11111,6.2212,1.22],
            "t" : [1605813896,1605813897,1605813898,1605813899,1605813900]
        }
        {
            "p" : {{string}}, pi tag id
            "v" : {{array}}, array of values either string or nums
            "t" : {{array}} array of utc epoch timestamps
        }

    Accepts a payload from the client via the routes:
        production: POST https://del0xeo27b.execute-api.us-east-1.amazonaws.com/prod/data
        debug/testing: POST https://del0xeo27b.execute-api.us-east-1.amazonaws.com/prod/data?debug=true
    Sends the payload to SQS for failsafe processing

*/




