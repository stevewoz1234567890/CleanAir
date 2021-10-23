//import your handler file or main file of Lambda
let handler = require('./index');

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
                },
                body: {
                    org : "5fb6b7ea6b029226f07d2677"
                }
            }
        });
}



main();