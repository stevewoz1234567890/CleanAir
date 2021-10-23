require('dotenv').config();
const mongoose = require('mongoose')
const { ObjectId } = require('mongodb');
const { Formula, Flare, Header,
    PiTag, Compound, Constant,
    FormulaValue, PiValue,
    CompoundGroup, PiValuesDebug, EventRule
} = require('./FRTModels');
const fs = require('fs').promises;
const { DateTime } = require('luxon');

var startTime;

function getErrorObject(error, path) {
    path.concat(":");
    if (error.hasOwnProperty('printPath')) {
        let errObj = { printPath: path, error: error.error };
        errObj.printPath = `${errObj.printPath}${error.printPath}`;
        return errObj;
    }
    return { printPath: path, error };
}


class MongoData {
    constructor(debug = false) {
        this.DEBUG = debug;
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

// let tags = ["CTA610651A", "CTA610651B", "CTA610651C", "XL610651", "XA610651", "CTA610654A", "CTA610654B", "CTA610654C", "XL610654", "XA610654", "PI6176", "PI6162", "LI6160", "CTA6262A", "CTA6262B", "CTA6262C", "XL6262A", "XL6262B", "CTA6263A", "CTA6263B", "CTA6263C", "XL6263A", "XL6263B", "CTA98168A", "CTA98170A", "XA98720A", "XA98174A", "XA98172A", "CTA98168B", "CTA98170B", "XA98227A", "XA98174B", "XA98172B", "CTA98169A", "CTA98171A", "XA98175A", "XA98173A", "CTA98169B", "CTA98171B", "XA98175B", "XA98173B", "PI98321", "LI98553", "PI98134"]

async function uploadPiData(data, args) {
    return new Promise((resolve, reject) => {
        (async () => {
            try { 
                if (!args.org) throw new Error("String arg 'org' id is required");
                if (!args.timezone) throw new Error("String arg 'timezone' is required");
                let orgOID = ObjectId(args.org);
                let ianaTimezone = args.timezone;

                //get pitags and organize them as a dict for faster access 
                let pitags = await PiTag.find({org:orgOID}).lean().exec();
                let pitagDict = {};
                for (const tag of pitags) {
                    pitagDict[tag.name] = tag;
                }

                //first check that everything seems good in terms of quality of data (over the whole input)
                for (const group of data) {
                    let tLength = group.t.length;
                    let vLength = group.v.length;
                    if (tLength !== vLength) throw new Error("t and v arrays do not match");
                    for (const ts of group.t) if ((args.fromSeconds || args.fromMilliseconds) && !Number.isInteger(ts)) throw new Error(`Timestamp "${ts}" is not an integer`);
                }

                let replacementTagName = {
                    "CTA98172B" : "XA98172B",
                    "CTA98173B" : "XA98173B"

                }

                // XA98172B and XA98173B instead of CTA98172B and CTA98173B, respectively.
                let numTags = data.length;
                let completed = 0;
                for (const group of data) {
                    if (group.p in replacementTagName) group.p = replacementTagName[group.p]
                    let ops = [];
                    for (let i = 0; i < group.t.length; i++) {
                        //index uses date, org, and pitag
                        try {
                            let x = pitagDict[group.p]._id
                        } catch (err) {
                            console.log("dict: ", pitagDict)
                            console.log("group.p: ", group.p)
                        }
                        let filter = { date: null, org: orgOID, piTag: pitagDict[group.p]._id }
                        if (args.fromISOString) {
                            let ms = DateTime.fromISO(group.t[i], { zone: ianaTimezone }).toMillis();
                            // if (ms < 1640952000000) {
                                
                            //     continue;
                            // }
                            // else console.log(new Date(ms))
                            let dt = new Date(ms);
                            filter.date = dt;
                        }
                        else if (args.fromSeconds) {
                            let ms = DateTime.fromSeconds(group.t[i], { zone: ianaTimezone }).toMillis();
                            let dt = new Date(ms);
                            filter.date = dt;
                        } else {
                            throw new Error("Parsing from miliseconds not implemented")
                        }
                        // console.log(filter.date, typeof filter.date)
                        // if (filter.date.getTime() < 1640952000000) {
                            
                        //     continue;
                        // }
                        // else  console.log(new Date(filter.date.getTime()))
                        let update = { '$set': { value: group.v[i] } };
                        let updateOp = { 'updateOne' : {filter, update, upsert:true}};
                        // let insertOp = { 'insertOne' : {"document" : {date : filter.date, org : filter.org, piTag : filter.piTag, value : group.v[i]}}}
                        // ops.push(insertOp);
                        ops.push(updateOp);
                    }
                    // console.log("ops: ", ops)
                    let res = await PiValue.bulkWrite(ops);
                    completed++;
                    console.log(`Completed uploading ${group.p}. ${(completed/numTags*100).toFixed(2)}%`);
                    printElapsedTime(startTime);
                }
                // let res = await PiValue.bulkWrite(ops);
                // console.log(res)
                return resolve();
            } catch (error) {
                console.log("trace: ", error.stack)
                return reject(`Error uploading pidata: ${error}`);

            }
        })();
    });
}

async function printElapsedTime(startTime) {
    let endTime = new Date();
    let timeDiff = endTime - startTime;
    timeDiff /= 1000;
    let secondsElapsed = Math.round(timeDiff);
    let minutesElapsed = Math.floor(secondsElapsed/60);
    let secondsRemainder = secondsElapsed % 60;
    console.log(`${minutesElapsed} minutes and ${secondsRemainder} seconds elapsed.`)
}


async function main() {
    try {
        startTime = new Date();
        let filePath = "C:\\Users\\evaquero\\Documents\\GitHub\\resuable-snippets\\files\\output\\august_2020_end.json"
        let mongo = new MongoData();
        await mongo.initClient();
        let readRes = await fs.readFile(filePath);
        let data = JSON.parse(readRes);
        let response = await uploadPiData(data, { fromISOString: true, timezone: "America/New_York", org: "5fb6b7ea6b029226f07d2677" });
        console.log("Complete.")
        printElapsedTime(startTime);
        await MongoData.closeClient();
    } catch (error) {
        console.log(error, error.stack)
    }
 
}


main()