//import your handler file or main file of Lambda
let handler = require('./saveToLocal');

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
                    USE_LOCAL_DATA : false,
                    SAVE_FILE_PATH : 'C:\\Users\\evaquero\\Desktop\\testingOutput\\template.xlsx',
                    LOCAL_DATA_PATH : 'C:\\Users\\evaquero\\Desktop\\data_files\\', //  C:\\Users\\evaquero\\Documents\\GitHub\\CleanCloud-2\\rawData.txt
                    PROGRESS_DEBUG_LOGS : false,
                },
                body: {
                    start: "2020/01/01",    //Requires format: YYYY/MM/DD
                    end: "2020/12/31",
                    parameters: [
                        {
                            paramType: "formula", //VOCs
                            id: "60a6c9d60ff3cc056d36be1d" 
                        },
                        {
                            paramType: "formula", //SO2
                            id: "60a6dd850ff3cc056d36be21" 
                        },
                        {
                            paramType: "formula", //H2S
                            id: "60db4ed82ab43a09df8b8a40" 
                        },
                        {
                            paramType: "formula", //CO2
                            id: "60a6e5a70ff3cc056d36be23" 
                        },
                        {
                            paramType: "formula", //Methane
                            id: "60db48582ab43a09df8b8a37" 
                        },
                        {
                            paramType: "formula", //Ethane
                            id: "60db477e2ab43a09df8b8a34" 
                        },
                    ],
                    reportBinSize: "annual", //interval as lowercase string. Must be one of: month, year
                    action : "sum",
                    // flare: "5fb6fb02b496f2ae0e0e6845", //ObjectID as string
                    debug: false,  //boolean
                    org: "5fb6b7ea6b029226f07d2677",
                    jobID : "6106f2d74d4ab95a142c248c",
                }
            }
        });
}



main();