const { DateTime } = require("luxon");
const { ObjectId } = require('mongodb');
const { PiValue, PiValuesDebug, DebugFormulaValue, FormulaValue, Flare, Header, Formula, PiTag } = require('./FRTModels');
const MongoData = require('./MongoData');
const AWS = require('aws-sdk')
const S3 = new AWS.S3({ region: 'us-east-1' })
const Lambda = new AWS.Lambda({ region: 'us-east-1' })
// const util = require('util')

const LOCAL_ENV = true;
let Mongo = new MongoData();
let FORMULAS_MAP = {};

function getErrorObject(error, path) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  return { printPath: path, error };
}

async function getPiData(options) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let { start, end, debug, pitags, org } = options;
        if (pitags.length == 0) return resolve([])
        let collection = debug ? PiValuesDebug : PiValue;
        let allData = await Promise.all(pitags.map(pitag => {
          return new Promise((resolve, reject) => {
            (async () => {
              try {
                let query = {
                  org,
                  "piTag": new ObjectId(pitag.id),
                  "date": { "$gte": start, "$lte": end }
                };
                let data = await collection.find(query).select("date value -_id").sort({ "date": 1 }).lean().exec();
                return resolve({ pitag: pitag.id, details: pitag, data })
              } catch (error) { console.log("ERROR: ", error); return reject(getErrorObject(error, "getPiData().map")) }
            })();
          })
        }))
        return resolve(allData);
      } catch (error) { return reject(getErrorObject(error, "getPiData()")) }
    })();
  })
}

async function getFormulaData(options) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let { start, end, debug, formulas, org, format } = options;
        if (formulas.length == 0) return resolve([])
        let collection = debug ? DebugFormulaValue : FormulaValue;
        let allData = await Promise.all(formulas.map(formula => {
          return new Promise((resolve, reject) => {
            (async () => {
              try {
                let query = {
                  org,
                  "formula": new ObjectId(formula.id),
                  "flare": new ObjectId(formula.flare),
                  "header": formula.header == null ? null : new ObjectId(formula.header),
                  "date": { "$gte": start, "$lte": end },
                };
                let data = await collection.find(query).select("date value -_id").sort({ "date": 1 }).lean().exec();
                if (["dashboard-init"].includes(format)) {
                  data = data.map(d => {
                    try {
                      let formulaInfo = FORMULAS_MAP[formula.id];
                      if (d.value === null) return d
                      if (formulaInfo.dataType === "num" && !isNaN(d.value) && d.value) {
                        d.value = parseFloat(d.value.toFixed(formulaInfo.decimalPlaces))
                      }
                      return d;
                    } catch(e) {
                      console.log(`could not format number value for formula ${formula.id} on value ${d.value}`)
                      return d;
                    }
                  })
                } else if(["charting"].includes(format)){
                  //bools need to be converted to binary
                  let formulaInfo = FORMULAS_MAP[formula.id]
                  if (formulaInfo.dataType === "boolean"){
                    data = data.map(d => {
                      if (d.value === true) d.value = 1;
                      else if (d.value === false) d.value = 0;
                      else d.value = null;
                      return d
                    })
                  }
                } else if(["data-dump"].includes(format)){
                  // bools need to be converted to strings
                  let formulaInfo = FORMULAS_MAP[formula.id]
                  if (formulaInfo.dataType === "boolean"){
                    data = data.map(d => {
                      if (d.value === true || d.value === false) d.value = d.value.toString();
                      else d.value = null;
                      return d
                    })
                  }
                }
                return resolve({ formula: formula.id, details: formula, data })
              } catch (error) { return reject(getErrorObject(error, "getPiData().map")) }
            })();
          })
        }))
        return resolve(allData);
      } catch (error) { return reject(getErrorObject(error, "getPiData()")) }
    })();
  })
}

async function completeDataSet(dataSet, allDates) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let { data } = dataSet
        if (data === null) data = []; //this might not be needed... might always be at least '[]'...
        if (data.length === allDates.length) return resolve(dataSet);
        let datesIndexes = allDates.length;
        let dataIndexes = data.length - 1;
        for (let i = 0; i < datesIndexes; i++) { //N time instead of N^2 time
          if (dataIndexes === -1 && i === 0) { //no data in data array to start
            data = [{ "date": allDates[i], "value": null }];
            dataIndexes++;
            continue;
          }
          if (i > dataIndexes) { //data array is missing succeeding date bigger than array size
            data.push({ "date": allDates[i], "value": null });
            dataIndexes++;
            continue;
          }
          let expectedTime = allDates[i].getTime();
          let foundTime = data[i].date.getTime();
          if (expectedTime === foundTime) { continue; } //match
          else if (expectedTime < foundTime) { // found time has missing preceding date --in scope
            data.splice(i, 0, { "date": allDates[i], "value": null });
            dataIndexes++;
            continue;
          }
          else if (expectedTime > foundTime) { //data array is missing succeeding date --in scope
            data.push({ "date": allDates[i], "value": null })
            try {
              throw new Error("unexpected: expectedTime > foundTime")
            } catch (e) {
              console.log(">", allDates.length, data.length, "<")
              console.log(expectedTime, foundTime)
              throw e
            }
          }
          throw "unexpected: expectedTime and foundTime has no known relationship"
        }
        dataSet.data = data
        return resolve(dataSet);
      } catch (error) { return reject(getErrorObject(error, "completeFormulaDataSet()")) }
    })();
  })
}

async function formatDataSet(dataSet, format, tz) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let formatGroup1 = ["charting", "dashboard-init", "dashboard-poll"]
        let { data } = dataSet;
        if (formatGroup1.includes(format)) {
          // {tag , data : {date value}}
          data = data.map(set => {
            let { date, value } = set;
            date = DateTime.fromISO(date.toISOString())
            let stringDate = date.setZone(tz).setLocale('en-GB').toLocaleString(DateTime.DATETIME_SHORT);//, { timeZone: tz })
            return [stringDate, value]
          });
        }
        if (format == "data-dump") {
          let newFormatOptions = {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            hourCycle: 'h23',
          }
          data = data.map(set => {
            let { date, value } = set;
            value = value === null ? "NULL" : value;
            date = DateTime.fromISO(date.toISOString())
            //UGH. There is a bug in javascript that is supposed to be fixed in the 2021 version, but it's unreleased
            //the bug, for us, is causing 00 hour to display at 24.
            //As related to luxon: https://github.com/moment/luxon/issues/726
            //fix: use this as the formatting options (hourCycle) : { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' };
            let stringDT = date.setZone(tz).setLocale('en-US').toLocaleString(newFormatOptions);
            // throw new Error("erick says hhi")
            return { dt: stringDT, value }
          });
        }
        dataSet.data = data;
        return resolve(dataSet)
      } catch (error) { return reject(getErrorObject(error, "formatDataSet()")) }
    })();
  })
}

async function joinData(allData, format) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let formatGroup2 = ["dashboard-init", "dashboard-poll"];
        let result = allData.map(superSet => {
          let { data, type } = superSet; //superset : {data : [array of request obects], type}
          let formattedGroup = data.map(set => {
            let id = set[type];
            let flare = type == 'formula' ? set.details.flare : null;
            let header = type == 'formula' ? set.details.header : null;
            let dateValArr = set["data"];
            let intType = typeof (1);
            let floatType = typeof (1.1111);

            if (formatGroup2.includes(format)) {
              let recent = "n/a"
              for (let i = (dateValArr.length - 1); i > -1; i--) {
                let tempVal = dateValArr[i][1];
                if (typeof (tempVal) == intType || tempVal == floatType) {
                  try { //This try block fixes the date format from D/M/Y to M/D/Y
                    recent = [...dateValArr[i]];
                    let parts = recent[0].split("/");
                    recent = [`${parts[1]}/${parts[0]}/${parts[2]}`, recent[1]];
                  } catch (error) {
                    console.log("ERROR PARTS SPLITTING: ", error)
                    recent = dateValArr[i];
                  }
                  break;
                }
              }
              let status = "None"
              if (type == 'formula') return { id, flare, header, type, recent, status, "data": dateValArr }
              return { id, type, recent, status, "data": dateValArr }
            }
            return { id, type, details: set.details, "data": dateValArr }
          });
          return formattedGroup
        })

        return resolve(result.flat())
      } catch (error) { return reject(getErrorObject(error, "joinData()")) }
    })();
  })
}

async function processRawData(rawData, payload) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {

        let { start, end, format, tz, debug } = payload;
        let piData = rawData[0];
        let formulaData = rawData[1];


        let diffMs = (end - start);
        let diffMinutes = diffMs / 60000;

        let allDates = [];
        let pivot = new Date(start.getTime());
        while (pivot <= end) {
          allDates.push(pivot);
          pivot = new Date(pivot.getTime() + 60000);
        }

        if (allDates.length != (diffMinutes + 1)) throw "referece dates array is not matching expected length"

        let completePiData = await Promise.all(piData.map(dataSet => completeDataSet(dataSet, allDates)));
        let completeFormulaData = await Promise.all(formulaData.map(dataSet => completeDataSet(dataSet, allDates)));

        let formatedPiData = completePiData;
        let formatedFormulaData = completeFormulaData;

        if (format == "data-dump") {
          formatedPiData = await Promise.all(piData.map(dataSet => formatDataSet(dataSet, format, tz)));
          formatedFormulaData = await Promise.all(formulaData.map(dataSet => formatDataSet(dataSet, format, tz)));
          let formatedData = formatedPiData.concat(formatedFormulaData);

          let displayInfo = formatedData.map(group => group.details);

          // PiValue, PiValuesDebug, , FormulaValue 
          for (let displayGroup of displayInfo) {
            let model = null;
            if (displayGroup.type == 'pitag') {
              model = PiTag;
              let tagInfo = await model.findOne({ "_id": displayGroup.id }).populate('sensor parameter').lean().exec();
              displayGroup.parameter = tagInfo.parameter.name;
              displayGroup.parent = `${tagInfo.sensor.name} (${tagInfo.name})`;
            }
            else {
              model = Formula;
              let formulaInfo = await model.findOne({ "_id": displayGroup.id }).select('-_id name to').lean().exec();
              let parent = null;
              if (displayGroup.header) {
                parent = await Header.findOne({ "_id": displayGroup.header }).select('-_id name').lean().exec();
              } else {
                parent = await Flare.findOne({ "_id": displayGroup.flare }).select('-_id name').lean().exec();
              }
              displayGroup.parent = parent.name;
              displayGroup.parameter = formulaInfo.name;
            }
          }

          /**
          for each group in formated data
          arr = []
          check if date in last index or length = 0, else add 
          append 
           */
          let formattedJoinedData = [];
          let dataRowIndex, groupColumnIndex = 0;
          let dataRowGroup = [];
          for (let group of formatedData) {
            for (let dataPair of group.data) {
              if (groupColumnIndex === 0) {
                dataRowGroup.push([dataPair.dt, dataPair.value]);
              }
              else {
                dataRowGroup[dataRowIndex].push(dataPair.value);
              }
              dataRowIndex++;
            }
            dataRowIndex = 0;
            groupColumnIndex++;
          }
          return resolve({ displayInfo, "data": dataRowGroup })
        }

        if (format != "raw") {
          formatedPiData = await Promise.all(piData.map(dataSet => formatDataSet(dataSet, format, tz)));
          formatedFormulaData = await Promise.all(formulaData.map(dataSet => formatDataSet(dataSet, format, tz)));
          //==============================
          //new logic for getting the parent display names
          let displayInfo = formatedPiData.map(group => group.details);
          displayInfo = displayInfo.concat(formatedFormulaData.map(group => group.details));


          for (let displayGroup of displayInfo) {
            let model = null;
            if (displayGroup.type == 'pitag') {
              model = PiTag;
              let tagInfo = await model.findOne({ "_id": displayGroup.id }).populate('sensor parameter').lean().exec();
              displayGroup.parameter = tagInfo.parameter.name;
              displayGroup.parent = `${tagInfo.sensor.name} (${tagInfo.name})`;
            }
            else {
              model = Formula;
              let formulaInfo = await model.findOne({ "_id": displayGroup.id }).select('-_id name to').lean().exec();
              let parent = null;
              if (displayGroup.header) {
                parent = await Header.findOne({ "_id": displayGroup.header }).select('-_id name').lean().exec();
              } else {
                parent = await Flare.findOne({ "_id": displayGroup.flare }).select('-_id name').lean().exec();
              }
              displayGroup.parent = parent.name;
              displayGroup.parameter = formulaInfo.name;
            }
          }

          let formatGroup1 = ["charting", "dashboard-init", "dashboard-poll"]
          if (formatGroup1.includes(format)) {
            let params = [
              { data: formatedPiData, type: "pitag" },
              { data: formatedFormulaData, type: "formula" }
            ]

            let joinedData = await joinData(params, format); //re-organizes and flattens
            for (let dataGroup of joinedData) {
              let display = displayInfo.find(dGrp => {
                if (dataGroup.type == "pitag") {
                  return dGrp.id == dataGroup.id && dGrp.type == dataGroup.type
                }
                else if (dataGroup.type == "formula") {
                  if (dGrp.type != "formula") return false;
                  return (
                    dGrp.id == dataGroup.id &&
                    dGrp.type == dataGroup.type &&
                    dGrp.flare == dataGroup.flare &&
                    dGrp.header == dataGroup.header
                  )
                }
              });
              dataGroup.displayInfo = display;
              if (dataGroup.type == 'formula') {
                delete dataGroup.header;
                delete dataGroup.flare;
              }
            }
            return resolve(joinedData);
          }
        }
        return resolve({ "piData": formatedPiData, "formulaData": formatedFormulaData });
      } catch (error) { return reject(getErrorObject(error, "processRawData()")) }
    })();
  })
}

async function splitData(requested, type) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let filtered = requested.filter(field => field.type == type);
        // let mapped = filtered.map(field => field.id);
        return resolve(filtered);
      } catch (error) { return reject(getErrorObject(error, "splitData()")) }
    })();
  })
}

// exports.handler = async (event) => {
async function main(event) {
  try {
    console.log(event);
    let payload = event;
    let pollDate = payload.end;
    payload.formulas = await splitData(payload.requested, "formula");
    payload.pitags = await splitData(payload.requested, "pitag");
    payload.org = new ObjectId(payload.org);
    payload.start = DateTime.fromISO(payload.start, { zone: payload.tz });
    let formatGroup3 = ["charting", "data-dump"];
    if (formatGroup3.includes(payload.format)) {
      payload.end = DateTime.fromISO(payload.end, { zone: payload.tz }).plus({ days: 1 });
    }
    else {
      payload.end = DateTime.fromISO(payload.end, { zone: payload.tz });
    }
    payload.start = new Date(payload.start.toMillis());
    payload.end = new Date(payload.end.toMillis());
    if (Mongo.mongooseStatus() == 0) await Mongo.initClient();
    if (true) {
      let formulas = await Formula.find({ org: payload.org }).select("decimalPlaces dataType").lean().exec()
      for (let formula of formulas) {
        FORMULAS_MAP[formula._id.toString()] = formula;
      }
    }
    let rawData = await Promise.all([getPiData(payload), getFormulaData(payload)]);
    let processedData = await processRawData(rawData, payload);
    let body = { "data": processedData };
    let formatGroup2 = ["dashboard-poll", "dashboard-init"]
    if (formatGroup2.includes(payload.format)) body.pollDate = pollDate;
    if (payload.format == "data-dump" && (!LOCAL_ENV)) {
      let key = `cleancloud-data-export/${payload.jobID}.json`
      let upload = S3.upload({ Bucket: process.env.FLARE_REPORTING_BUCKET, Key: key, Body: JSON.stringify(body, null, 2) });
      let promise = await upload.promise();
      payload.inputDataKey = promise.Key
      let params = {
        FunctionName: "flareReportingExcelDataExport",
        InvocationType: "Event",
        Payload: JSON.stringify(payload),
      };
      await Lambda.invoke(params).promise();
      const response = {
        statusCode: 200,
        body: JSON.stringify({ "Key": promise.Key }),
      };
      if (LOCAL_ENV) {
        console.log(response);
        await MongoData.closeClient();
      }
      return response
    }

    const response = {
      statusCode: 200,
      body: JSON.stringify(body),
    };
    if (LOCAL_ENV) {
      // for (let i of body.data.data) console.log(i)
      // console.log(body.data.data)
      await MongoData.closeClient();
    }

    return response;

  } catch (error) {
    error = getErrorObject(error, "main()")
    console.log(`ERROR PATH: ${error.printPath}`);
    console.log(`STACK: ${error.error.stack}`);
    try {
      await MongoData.closeClient();
    } catch (error) { console.log("Could not close mongoclient") }
    const response = {
      statusCode: 500,
      body: JSON.stringify(error.error),
    };
    return response;
  }
}

let mytestinput = {
  debug: false,
  requested: [
    {
      id: '5fbd80330aa1ec4824bfc1d1',
      type: 'formula',
      parentName: 'AG',
      flare: '5fb6fb02b496f2ae0e0e6845',
      header: null
    }
  ],
  start: '2021-02-01',
  end: '2021-02-28',
  org: '5fb6b7ea6b029226f07d2677',
  tz: 'America/New_York',
  format: 'data-dump',
  jobID: '611524bdfceed46b67f21704'
}

main(mytestinput)