//import your handler file or main file of Lambda
let handler = require('./index');
let {DateTime} = require('luxon')
;
//Call your exports function with required params
//In AWS lambda these are event, content, and callback
//event and content are JSON object and callback is a function
//In my example i'm using empty JSON
async function main() {
    await handler.handler(
        {
            invokerArgs: {
                settings: {
                    IS_DEV_LOCAL_ENV: true,
                    PROGRESS_DEBUG_LOGS : false,
                    SEND_EMAIL : false,
                },
                body: {
                }
            }
        });
}

// let now = new Date;
// console.log(now)
// console.log(DateTime.fromJSDate(now, {zone: "America/New_York"}).toISO());
// console.log(DateTime.now().setZone("America/New_York").toISO())

main();