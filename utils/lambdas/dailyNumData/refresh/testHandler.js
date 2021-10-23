//import your handler file or main file of Lambda
let handler = require('./index');
const { DateTime } = require('luxon');

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
                    PROGRESS_DEBUG_LOGS: true,
                    PARSE_INPUT: false, //you only need to parse for the live data which sends data as string...
                },
                body: {
                    //THESE OPTIONS ARE NOT IMPLMENTED. Defaults to full range of all orgs with numeric event rules
                    //Start and end allow for user defined start and end times for refresh.
                    //leaving them null will default to earliest avail start thru today
                    //org ids will only refresh on specified orgs when provided, else it will run for all orgs
                    start: null, //epoch timestamp
                    end: null, //epoch timestamp
                    orgs: null, //org ids as arr of strings
                },


            }
        });
}

// let x = DateTime.fromISO('2021-09-12T00:00:00.000-05:00')
// console.log(x.toISO())
// x = x.plus({minutes:1440})
// console.log(x.toISO())


main();

/**
 *                     Records: [
                        {
                            "updateInfo": {
                                "date": "2021-08-19T22:27:00.000Z",
                                "start": "2021-08-19T22:26:00.000Z",
                                "org": "5fb6b7ea6b029226f07d2677",
                                "formula": "5fbd80320aa1ec4824bfc1b9",
                                "value": 12450.1,
                                "flare": "5fb6fb02b496f2ae0e0e6845",
                                "header": "5fb6fdecedcf06ae8256c74d",
                                "debug": false
                                //values
                                //ts
                                //parameter
                            },
                            "ruleInfo": {
                                "numericEventRules": ["611ad553e857bf25bc8a6a02"],
                                "parameterType": "formula"
                                //resolution
                            }
                        }
                    ]
*/

/** Live Example....
                                body: {
                    Records: [
                        {
                            messageId: '065ed945-3f3f-4626-afb6-14570aae73c7',
                            receiptHandle: 'AQEBd5n9BuHoInH6EFrb6p27ubRDXzR290T/72F7zOSsVkgyqcEk3RpyzgbBQ1Jy/hfZCOlKsUqSUC7y2ZSnp5pF2GRHd0FDABV0LazuOxZjCsO/4ODhmAKLqCfmbaHS7QeqSpRAFsc1F36tk58cKfopktUpUieWUaiuuACnFiNjQBVP1GAU8yXtdZOomcqTffeWanlrS7BJ0PEBIvgkbNOcadQgMMKiW+KZBnLlAy4Fux9mUj7h9LpCDPstPa7IleaXxgd5vYnB39ua11oJ3vN71okH9zVbT4jhOThn7NFKs0I=',
                            body: '{"updateInfo":{"date":"2021-08-25T15:04:00.000Z","start":"2021-08-25T15:03:00.000Z","org":"5fb6b7ea6b029226f07d2677","formula":"5fbd80320aa1ec4824bfc1b9","value":12831.300000000001,"flare":"5fb6fb02b496f2ae0e0e6845","header":"5fb6fdecedcf06ae8256c74d","debug":false},"ruleInfo":{"numericEventRules":["611ad553e857bf25bc8a6a02"],"parameterType":"formula"}}',
                            attributes: [Object],
                            messageAttributes: {},
                            md5OfBody: 'f572b904439f1e3b1d614f9f64edfaa8',
                            eventSource: 'aws:sqs',
                            eventSourceARN: 'arn:aws:sqs:us-east-1:309249889330:NumericRuleData.fifo',
                            awsRegion: 'us-east-1'
                        },
                        {
                            messageId: '9c73a402-2c1d-49c5-96ce-03e88d42fe91',
                            receiptHandle: 'AQEBKrw5CMXI1l9Y+bDvjyyEgk/ObzWVbQSwH4XIGCWZJwy1Xtvlnk+FBSsz/191cEj/YYXL+PpUEeXOejiQdpfUDF9wwU4Xuo7JUjbskT9e8H3oBk58gBMQa42Sw69RJYSqlqN+htuyLJumhvvThpGwZCezgCGixrZtE2bDbN6Xqw+564EaTksQMx61ZNHmsItHo2cDjNIoCrGkqlkkk9UpH63Jhfunsa7Y41SQUv8PWxjqktcUI5Itep4p+HkZ/PDZvkYc0f/EUCq4lRLO+IllR/Y7Ut+p6kfYXKblcxEcunM=',
                            body: '{"updateInfo":{"date":"2021-08-25T15:05:00.000Z","start":"2021-08-25T15:04:00.000Z","org":"5fb6b7ea6b029226f07d2677","formula":"5fbd80320aa1ec4824bfc1b9","value":12684.1,"flare":"5fb6fb02b496f2ae0e0e6845","header":"5fb6fdecedcf06ae8256c74d","debug":false},"ruleInfo":{"numericEventRules":["611ad553e857bf25bc8a6a02"],"parameterType":"formula"}}',
                            attributes: [Object],
                            messageAttributes: {},
                            md5OfBody: 'bfbc9eb783360d95b3197b6b3f368714',
                            eventSource: 'aws:sqs',
                            eventSourceARN: 'arn:aws:sqs:us-east-1:309249889330:NumericRuleData.fifo',
                            awsRegion: 'us-east-1'
                        },
                        {
                            messageId: '4e1cdd74-3aab-4302-bbd9-160737814fcd',
                            receiptHandle: 'AQEB44oeJDogcdjM0yQTuu5l6mTKHXnsOZztP+LxfqGGGAC39LUi4H0dQVdGGbXWIUNqr9hs76+vQ4rjErctWYUv8j4TEp7V+qxvteBDPjVGpAvlVtAkSLgH977e5MR2aPECtF4s0o9RZRTRscgFUyR3+WOaWzwSAAV7WxOFBAlKcwVbdlM3/uj+xrOgAecMeMxoz+ha/VFQhi7tvtjjpaBHtvnnzoaH9GPI6ukmyMTpeQYBiBObZJ2+ZYQQcsLCMRN64MQto+mIGcGU+/9n51YDPc/6VQfUOkL/HxiVpfB+uLQ=',
                            body: '{"updateInfo":{"date":"2021-08-25T15:06:00.000Z","start":"2021-08-25T15:05:00.000Z","org":"5fb6b7ea6b029226f07d2677","formula":"5fbd80320aa1ec4824bfc1b9","value":12621.7,"flare":"5fb6fb02b496f2ae0e0e6845","header":"5fb6fdecedcf06ae8256c74d","debug":false},"ruleInfo":{"numericEventRules":["611ad553e857bf25bc8a6a02"],"parameterType":"formula"}}',
                            attributes: [Object],
                            messageAttributes: {},
                            md5OfBody: '27aacaed6b9fef371af68c9944f786f5',
                            eventSource: 'aws:sqs',
                            eventSourceARN: 'arn:aws:sqs:us-east-1:309249889330:NumericRuleData.fifo',
                            awsRegion: 'us-east-1'
                        },
                        {
                            messageId: '55f9d14e-ef17-4379-ab30-8e3b700966c4',
                            receiptHandle: 'AQEB6wj4Vr0ZhXpi+QLRgY23fxDmsTI+czPyE0UZOxelj6x+swYvAjrJ5q9ui9nIMN0ymHNDavT1q6YSRRJ4Ugi+myYZoHgsMfJvKq4pqPxvzBNPQP9lkkQoOH38n4P/KWedi/cun1Dh8645/MV3YVAGyLeOJAxG8GGe9ruKVapy7jMNnn4/iZWtsjkqMQEY1WoHwTqeEuMjIu/r8ogmSAs4zwOrFBQzIRuzmOVyP4odu8/WXQtl6miEz8yAGh2aS6jLDCQ3VfF1LpLmK3yQBRa8EsCrhEUjdHSQSj3oxtEo2K0=',
                            body: '{"updateInfo":{"date":"2021-08-25T15:07:00.000Z","start":"2021-08-25T15:06:00.000Z","org":"5fb6b7ea6b029226f07d2677","formula":"5fbd80320aa1ec4824bfc1b9","value":12668.2,"flare":"5fb6fb02b496f2ae0e0e6845","header":"5fb6fdecedcf06ae8256c74d","debug":false},"ruleInfo":{"numericEventRules":["611ad553e857bf25bc8a6a02"],"parameterType":"formula"}}',
                            attributes: [Object],
                            messageAttributes: {},
                            md5OfBody: '9e7e8a0f959a88b43da7c9776f1d30b3',
                            eventSource: 'aws:sqs',
                            eventSourceARN: 'arn:aws:sqs:us-east-1:309249889330:NumericRuleData.fifo',
                            awsRegion: 'us-east-1'
                        },
                        {
                            messageId: '7363fb34-0b3d-4a2c-852c-91e62a59fc32',
                            receiptHandle: 'AQEBI2IqFTeBoBr3OkrWK4Q0M0gPE1WmVo25xTn+sWBqdTQX8vIMsuhqOvi8A1H1FgYDum50uq5M0KI/vHBD0FqESZ2qgVgdoBbUUm61OgntV7oqYB6HuVz8L8ZUv1FWPIup4z2FGmr8CFGNwzZDDS/q0hjCnxC49NY7xfgnsc4d8+uBnXkdHxD+m89Q8ijhever67l3ciGPMshkxNHMH6fc7IY5pT4Qun0AzkwNwIeyOb0gVdhj6vQv1D0EX34UxWZ89S1kF0d31pJ8DIkFFP/86L4r31mBNhLEn1iN8wXOUxc=',
                            body: '{"updateInfo":{"date":"2021-08-25T15:03:00.000Z","start":"2021-08-25T15:02:00.000Z","org":"5fb6b7ea6b029226f07d2677","formula":"5fbd80320aa1ec4824bfc1b9","value":8490.8,"flare":"5fb6fac8b496f2ae0e0e6844","header":"5fb6fc4ded5c61ae6c9c0fdf","debug":false},"ruleInfo":{"numericEventRules":["611ad553e857bf25bc8a6a02"],"parameterType":"formula"}}',
                            attributes: [Object],
                            messageAttributes: {},
                            md5OfBody: 'cc4379aaf6b414c845cbd28f091d20cd',
                            eventSource: 'aws:sqs',
                            eventSourceARN: 'arn:aws:sqs:us-east-1:309249889330:NumericRuleData.fifo',
                            awsRegion: 'us-east-1'
                        },
                        {
                            messageId: 'c32222ae-6b58-4edc-8f8b-18fc0d3d8469',
                            receiptHandle: 'AQEBk/egN0BtA8fdn/wbVZQ3uRo2gZCr0Z3ap3yy7UGPqLW5BMmd1T0Kgr7JrotuiA0eq7prYQHI6PUiPlBy7SyOf52JGsW/fGxFFg4PbDSghw8a2DSEZ5d8Jq/qlX+6nGILjFovE+JtmP02Nml6Ypf0oIqOGFQiUqBX/Uwec/kpib0qQIvl1SkKj5OQdWFaC7ULoR85Xj9s3gki+Isvg7aPbbckqR9Kxa1iz0OWBrs3oidRVJEckg9rfqxmOwTHk/xt4YqoYGEgAAyxK0EIwOxJBsDmc9Knu7aWR2gJLYOZdFM=',
                            body: '{"updateInfo":{"date":"2021-08-25T15:04:00.000Z","start":"2021-08-25T15:03:00.000Z","org":"5fb6b7ea6b029226f07d2677","formula":"5fbd80320aa1ec4824bfc1b9","value":5177.299999999996,"flare":"5fb6fac8b496f2ae0e0e6844","header":"5fb6fc4ded5c61ae6c9c0fdf","debug":false},"ruleInfo":{"numericEventRules":["611ad553e857bf25bc8a6a02"],"parameterType":"formula"}}',
                            attributes: [Object],
                            messageAttributes: {},
                            md5OfBody: '74eaf1ba1dfe06dffbb244f3961b1923',
                            eventSource: 'aws:sqs',
                            eventSourceARN: 'arn:aws:sqs:us-east-1:309249889330:NumericRuleData.fifo',
                            awsRegion: 'us-east-1'
                        },
                        {
                            messageId: '1d9af919-ddc7-4d9e-ab52-a3667e3d555d',
                            receiptHandle: 'AQEBTOOTfFm1EaB+BLZcEsbofzCjvIC5hG1JiKL6qe6tgNld4ckca44wOl+KX6kgLcMhgpGK3RCbfuIRkuiOOCvVx3dqVUYqnFg4T9AoTHBzfu9lXNCtYsrp8HzKYoHR34KaoeOUCPweyCWpnWoCVbxG1qz66dJdCW4DdhAlmT910c/IBvCl5I5k9VGHx1e6Z9WRT8hLFuNNl1KUOeRELrhuot+pPzC/ZMddRHnsS6NJG+hYyBkLjr/yy0laCZNOBaM/LvbgZihUcbo+SE8TpT1SPooMANSdvl9dcIN9cCFIvAk=',
                            body: '{"updateInfo":{"date":"2021-08-25T15:05:00.000Z","start":"2021-08-25T15:04:00.000Z","org":"5fb6b7ea6b029226f07d2677","formula":"5fbd80320aa1ec4824bfc1b9","value":6316.199999999995,"flare":"5fb6fac8b496f2ae0e0e6844","header":"5fb6fc4ded5c61ae6c9c0fdf","debug":false},"ruleInfo":{"numericEventRules":["611ad553e857bf25bc8a6a02"],"parameterType":"formula"}}',
                            attributes: [Object],
                            messageAttributes: {},
                            md5OfBody: '35a33648a2a7cc5c6badd98412807ccb',
                            eventSource: 'aws:sqs',
                            eventSourceARN: 'arn:aws:sqs:us-east-1:309249889330:NumericRuleData.fifo',
                            awsRegion: 'us-east-1'
                        },
                        {
                            messageId: '03fb4d8a-0097-4e1a-b2a9-b8f09952152a',
                            receiptHandle: 'AQEBqe1CqqyaiyU/m8wMVD7sGLAd0n8VeL3567oD4MXG/cn8K+lYDKzI8XswYTvHQrMeULlqoxANnh4s4ZGK9af8E3iACWbUM6fCqla9mUeBpuByytUmGC/EMUo6ICaxaV9hvWcK7NDXDlzh0OZ65vDs/ScbaigAtDt/DuwTlCSjX0qXb7gG9E7cyJ2EodlXtzJH/8Y17JIXQUCsk02THvf4HZyXwqTf/vLBQ5g+a25sxzWVvAcp25dLCNgIAe2+ZWnvOfMTnkUzPmJSH2MUrOSpgCgJn+HYtXO5iKcwgHeh4fs=',
                            body: '{"updateInfo":{"date":"2021-08-25T15:06:00.000Z","start":"2021-08-25T15:05:00.000Z","org":"5fb6b7ea6b029226f07d2677","formula":"5fbd80320aa1ec4824bfc1b9","value":7385.599999999997,"flare":"5fb6fac8b496f2ae0e0e6844","header":"5fb6fc4ded5c61ae6c9c0fdf","debug":false},"ruleInfo":{"numericEventRules":["611ad553e857bf25bc8a6a02"],"parameterType":"formula"}}',
                            attributes: [Object],
                            messageAttributes: {},
                            md5OfBody: 'f9e973c436f5878ea21a36520ba28ce4',
                            eventSource: 'aws:sqs',
                            eventSourceARN: 'arn:aws:sqs:us-east-1:309249889330:NumericRuleData.fifo',
                            awsRegion: 'us-east-1'
                        },
                        {
                            messageId: 'e86130b6-7305-4a46-bfe4-1df86f8299ab',
                            receiptHandle: 'AQEBFD3gsl8ipfqvTDr6SlOpLuDDG3trTHCbpGZqkerKebQq7QE4fxPdJWg3FvZ/+JM4o7FohEM1/HwreiyOW9pdFssISh0XalB+LkgigwvI73GxwhL6a94+0HXHrpyCQtZ0HJ/Kf0Adf1hMLr9VPoyfQh9nyc8P3o3Ew+fklDUGeGpxyusetcuNZr3yCU0W3y6d+9QQpWC/hop3N7DifCBH2atmMYoD1O12Nu1SYej7+IY11/SJg3oowCAzOlYCEtEHJ9trF83ZaUW8waAuBAAcJfBEtkQo1OZfLSbIHuIrHC8=',
                            body: '{"updateInfo":{"date":"2021-08-25T15:07:00.000Z","start":"2021-08-25T15:06:00.000Z","org":"5fb6b7ea6b029226f07d2677","formula":"5fbd80320aa1ec4824bfc1b9","value":7661.899999999996,"flare":"5fb6fac8b496f2ae0e0e6844","header":"5fb6fc4ded5c61ae6c9c0fdf","debug":false},"ruleInfo":{"numericEventRules":["611ad553e857bf25bc8a6a02"],"parameterType":"formula"}}',
                            attributes: [Object],
                            messageAttributes: {},
                            md5OfBody: 'ee8520a0f0211d6e10153681066e0056',
                            eventSource: 'aws:sqs',
                            eventSourceARN: 'arn:aws:sqs:us-east-1:309249889330:NumericRuleData.fifo',
                            awsRegion: 'us-east-1'
                        }
                    ]
                }
            */