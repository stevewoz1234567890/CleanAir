const AWS = require('aws-sdk');
const Lambda = new AWS.Lambda({ region: 'us-east-1' });
const fs = require('fs');

const MS_PER_MIN = 60000;
const MS_PER_HOUR = MS_PER_MIN * 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS = 31;

function addMinutes(date, minutes) {
    return new Date(date.getTime() + (minutes * 60000))
}

let schema = {
    "p": "FI6176A",
    "v": [
    ],
    "t": [
    ],
    "d": false,
    "o": "5fb6b7ea6b029226f07d2677",
    "retDateString": ""
}

function isMinuteMatch(MS, is15MinuteRun) {
    if (is15MinuteRun) return MS % 15 === 0
    else return MS % 15 !== 0
}

// 1604203200000  start of NOV 2020
// 1606798800000  end of NOV
// 1577854800000 START, start of jan 2020
// 1619841600000 END, end of April 2021
// 1596254400000 MIDDLE, September 1st 2020
async function main() {
    let stream = fs.createWriteStream("dates_log.txt", {flags:'a'});

    //Theses are the variables you should set for running.
    const startMS = 1577854800000;
    const endMS = 1604203200000;
    const is15MinuteRun = false; // x%15 === 0, true;  x%15 !== 0, false;

    let itStartDate = new Date(startMS);
    let itEndDate = new Date(endMS);

    // itEndDate = new Date(Date.now() - (MS_PER_HOUR))
    // itStartDate = new Date(itEndDate.getTime() - (MS_PER_HOUR * 27))

    //SETTING TIMESTAMPS TO 0 SECOND AND MS IS VERY IMPORTANT
    itEndDate.setSeconds(0,0); 
    itStartDate.setSeconds(0,0);

    let it = new Date(itStartDate.getTime());

    console.log("All Start: ", itStartDate.getTime(), itStartDate.toISOString())
    console.log("All End: ", itEndDate.getTime(), itEndDate.toISOString())
    
    let allSets = [];
    let set = [];
    let maxGroupsPerSet = 12;
    let newGroup = JSON.parse(JSON.stringify(schema));
    newGroup.retDateString += it.toISOString();
    let maxMinutesPerGroup = 60;
    let expectedTotal = 0;
    while (it <= itEndDate) {
        let temp = new Date(it.getTime())
        temp = addMinutes(temp, 1)
        if (isMinuteMatch(it.getMinutes(), is15MinuteRun)) {
            expectedTotal++;
            newGroup.v.push(123);
            newGroup.t.push(it.getTime())

            if (newGroup.t.length >= maxMinutesPerGroup) {
                newGroup.retDateString += ` - ${it.toISOString()}`
                set.push(newGroup);
                newGroup = JSON.parse(JSON.stringify(schema))
                newGroup.retDateString += `${temp.toISOString()}`
            }
            if (set.length >= maxGroupsPerSet) {
                allSets.push(set);
                set = [];
            }
        }
        if (temp > itEndDate) {
            newGroup.retDateString += ` - ${it.toISOString()}`
            set.push(newGroup);
            allSets.push(set);
        }
        it = addMinutes(it, 1);
    }


    for (let set of allSets) {
        let response = await Promise.all(set.map(group => {
            return new Promise((resolve, reject) => {
                (async () => {
                    try {
                        const params = {
                            FunctionName: "flareToolCalcRefresh",
                            InvocationType: "RequestResponse",
                            Payload: JSON.stringify(group),
                        };
                        let res = await Lambda.invoke(params).promise();
                        try {
                            let parsed = JSON.parse(res.Payload);
                            stream.write(parsed.body + "\n");
                            parsed = JSON.parse(parsed.body)
                            return resolve(parsed.processedDate)
                        } catch(err) { return resolve(res); }
                        return resolve(res);
                    } catch (error) {
                        return reject(`error: ${error}`)
                    }
                })()
            })
        }))
        console.log(response)
    }

    stream.end();

    console.log("DONE!");
    console.log(`start: ${itStartDate.toISOString()} , end: ${itEndDate.toISOString()}`);




}

main()