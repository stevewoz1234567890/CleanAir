//import your handler file or main file of Lambda
let handler = require('./index');
const { DateTime } = require("luxon");

//Call your exports function with required params
//In AWS lambda these are event, content, and callback
//event and content are JSON object and callback is a function
//In my example i'm using empty JSON
const diff = -1 * 60 * 24; //-24 hours
let now = DateTime.now().startOf('minute');
console.log("ISO Date: ", now.plus({ minutes: diff }).toISO());
console.log("Milliseconds: ", now.plus({ minutes: diff }).toMillis());

const input = {
    invokerArgs: {
        settings: {
            LOCAL_ENV: true,
            SKIP_CHECKER_ON: true,
            DIRECT_CALC: true,
            DEBUG_TIMER: false,
            SQS_DEBUG: false,
            UPLOAD_DEBUG: false,
            DEBUG_2: false,
            DEBUG_1: false,
            SAVE_VALUES: false,
            FORWARD_TO_SQS: false,
            DUMP_RESULTS: false,
            FORWARD_NUM_RULE_SQS: false,
        },
        body: { "p": "CTA610651C", "v": ["OK", "OK", "OK", "OK", "OK"], "t": [1629411900000, 1629411960000, 1629412020000, 1629412080000, 1629412140000], "d": false, "o": "5fb6b7ea6b029226f07d2677" }
    }
}

async function main() {
    await handler.handler(input);
}

main();

// ================================================================
// function addMinutes(date, minutes) {
//   return new Date(date.getTime() + (minutes*60000))
// }

// let itEndDate = new Date(1606809600000);
// let itStartDate = addMinutes(itEndDate,-60 * 1);
// let it = new Date(itStartDate.getTime());
// console.log("Start: ", itStartDate, itStartDate.toString())
// console.log("End: ", itEndDate, itEndDate.toString())

// let itTestEvent = {
//   "p": "FI6176A",
//   "v": [
//   ],
//   "t": [
//   ],
//   "d": false,
//   "o": "5fb6b7ea6b029226f07d2677"
// }

// while(it <= itEndDate) {
//   // console.log("queueing: ", it.toString());
//   itTestEvent.v.push(12345);
//   itTestEvent.t.push(it.getTime())
//   it = addMinutes(it,1);
// }

// // console.log(itTestEvent)
// mymain(itTestEvent)
