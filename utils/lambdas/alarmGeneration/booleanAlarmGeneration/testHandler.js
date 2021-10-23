//import your handler file or main file of Lambda
let handler = require('./index');

//Call your exports function with required params
//In AWS lambda these are event, content, and callback
//event and content are JSON object and callback is a function
//In my example i'm using empty JSON
async function main() {
    await handler.handler(
        {
            cleanCloudArgs: {
                settings: {
                    TESTING_MODE_EMAIL: false,
                    IS_DEV_LOCAL_ENV: true,
                    UPDATE_USER_INFO : false,
                },
                body: {
                    alarmTickets: [{
                        userInfo: {
                            email: "evaquero@cleanair.com",
                            defaultOrg: "100"
                        },
                        events: [
                            {
                                end: new Date(),
                                start: new Date(Date.now() - 1000 * 60 * 15),
                                eventRule: "1",
                                chunks: [{
                                    _id: "60ca0f3d8e1d3f3a60b606e5",
                                    formulaValue: "60d0c332860c7945d51ea7e7"
                                }, {
                                    _id: "60ca0f3d8e1d3f3a60b606e6",
                                    formulaValue: "60d0c332860c7945d51ea7a0"
                                }, {
                                    _id: "60ca0f3d8e1d3f3a60b606e7",
                                    formulaValue: "60d0c332860c7945d51eaac8"
                                }],
                            },
                            {
                                end: new Date(),
                                start: new Date(Date.now() - 1000 * 60 * 15),
                                eventRule: "2",
                                chunks: [{
                                    _id: "60ca0f3d8e1d3f3a60b606e5",
                                    formulaValue: "60d0c332860c7945d51ea7e7"
                                }, {
                                    _id: "60ca0f3d8e1d3f3a60b606e6",
                                    formulaValue: "60d0c332860c7945d51ea7a0"
                                }, {
                                    _id: "60ca0f3d8e1d3f3a60b606e7",
                                    formulaValue: "60d0c332860c7945d51eaac8"
                                }],
                            }
                        ]
                    }
                    ],
                    rulesInfo: [
                        {
                            _id: "1",
                            name: "Test Rule 1",
                            formula: "10"
                        },
                        {
                            _id: "2",
                            name: "Test Rule 2",
                            formula: "20"
                        }
                    ],
                    formulasInfo: {
                        "10": {
                            resolution: 1
                        },
                        "20": {
                            resolution: 15
                        }
                    },
                    orgs: {
                        "100": { timezone: "America/New_York" }
                    }
                }
            }
        });
}



main();