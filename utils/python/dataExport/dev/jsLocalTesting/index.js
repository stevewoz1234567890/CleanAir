/**
The purspose of this code is so we can generate a report using this script
instead of using the API endpoint and such. Primarily for local testing/dev
puproses. But should be able to use it generally if needed for whatever reason
 */
// const { ObjectId }  = require('mongodb');
const { Job } = require('./FRTModels');
const MongoData = require('./MongoData');
const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda({ region: 'us-east-1', accessKeyId: process.env.AWS_ACCSSKEY, secretAccessKey: process.env.AWS_SECRETKEY })
// const util = require('util')

var newJob = null;
var jobID = null;


function getErrorObject(error, path) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  return { printPath: path, error };
}

async function main(dataPullerInput, isNewJob, jobID=null, newJobDocument=null) {
  try {
    let Mongo = new MongoData();
    Mongo.initClient();


    //Create the new Job document
    if (isNewJob) {
      let res = await Job.create(newJobDocument);
      jobID = res._id.toString();
      console.log("Document inserted: ", { res });
    }
    dataPullerInput.jobID = jobID;

    var params = {
      FunctionName: "FormattedFlareDataPuller",
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(dataPullerInput),
    };
    let response = await Lambda.invoke(params).promise();
    let all = JSON.parse(response.Payload)
    let dataURL = JSON.parse(all.body);
    dataPullerInput.inputDataKey = dataURL.Key;
    console.log(JSON.stringify(dataPullerInput,null,2));

    params = {
      FunctionName: "flareReportingExcelDataExport",
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(dataPullerInput),
    };
    response = await Lambda.invoke(params).promise();
    all = JSON.parse(response.Payload)
    console.log("response: ",JSON.stringify(all,null,2));
    

    await MongoData.closeClient();
  } catch (error) {
    console.log("ERROR: ", error.message, error.stack)
    await MongoData.closeClient();
  }

}

let dataPullerInput = {
  "org": "5fb6b7ea6b029226f07d2677",
  "tz": "America/New_York",
  "format": "data-dump",
  "debug": true,
  "requested": [
      {
          "id": "5fdd46b8f40caa29a4024774",
          "type": "pitag"
      },
      {
          "id": "5fdd46b8f40caa29a4024773",
          "type": "pitag"
      },
      {
        "id": "5fbd80330aa1ec4824bfc1cf",
        "type": "formula",
        "flare": "5fb6fac8b496f2ae0e0e6844",
        "header": null
      },
  ],
  "end": "2021-04-02T23:30",
  "start": "2021-04-02T11:30"
}
let newJobDocument = {
  type: "data-export",
  org: "5fb6b7ea6b029226f07d2677", //husky
  user: "5fb423068e53172a740761a1" //erick
}
newJob = false;
jobID = "606c7f9fbc79ab151026d3e2";
main(dataPullerInput, newJob, jobID, newJobDocument)





// const JobSchema = new Schema({
//   type : {
//       type : String,
//       required : true
//   },
//   org : {
//       type: Schema.Types.ObjectId, 
//       required : true
//   },
//   user : {
//       type: Schema.Types.ObjectId, 
//       required : true
//   },
//   progress : {
//       type: Schema.Types.Mixed, 
//       default : 0
//   },
//   isComplete : {
//       type: Schema.Types.Boolean, 
//       default : false
//   },
//   failed : {
//       type: Schema.Types.Boolean, 
//       default : false
//   },
//   startDate : {
//       type : Date,
//       default : Date.now
//   },
//   endDate : {
//       type : Date,
//       default : null
//   },
//   info : {
//       type : Schema.Types.Mixed,
//       default : null
//   }
// })