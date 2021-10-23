const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda({region: 'us-east-1'})


async function main() {
    let payload = {
        org: "5fb6b7ea6b029226f07d2677",
        formulas: ["5fbd80320aa1ec4824bfc1b7"],
        pitags: ["5fdd46b4f40caa29a402475b"],
        start: "2021-03-14T01:00:00",
        end: "2021-03-14T04:00:00",
        format: "charting", //export or charting
        debug: true,
        tz: "America/New_York"
    }
    const params = {
        FunctionName: "FormattedFlareDataPuller",
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(payload),
    };
    let response = await Lambda.invoke(params).promise();
    let all = JSON.parse(response.Payload)
    let body = JSON.parse(all.body)
    console.log(body)

}
main()