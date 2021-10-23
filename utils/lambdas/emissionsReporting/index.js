const MongoData = require('./MongoData');
const { ObjectId } = require("mongodb");
const { DateTime } = require('luxon');
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCSSKEY,
  secretAccessKey: process.env.AWS_SECRETKEY
});
const fs = require('fs').promises;
const util = require('util');
const Excel = require('exceljs');

const DARK_GREY = "A6A6A6"; //coral "F08080";
const MED_GREY = "D9D9D9";
const LIGHT_GREY = "f2f2f2";

const sheetIdMap = {
  "annual": 1,
  "semi-annual": 2,
  "quarterly": 3,
  "monthly": 4,
}
const sheetNameMap = {
  "annual": "Annual",
  "semi-annual": "Semi-Annual",
  "quarterly": "Quarterly",
  "monthly": "Monthly",
}

const monthNumToName = {
  1: "Jan",
  2: "Feb",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "Aug",
  9: "Sept",
  10: "Oct",
  11: "Nov",
  12: "Dec"
}

var EM_REPORTER = null;

//testing variables
var IS_DEV_LOCAL_ENV = false;
var USE_LOCAL_DATA = false;
var LOCAL_DATA_PATH = null;
var SAVE_FILE_PATH = "/tmp/emissionsReport.xlsx"
var PROGRESS_DEBUG_LOGS = false;

const defaultFormulas = [ //17
  "60a6c2b00ff3cc056d36be1b",
  "60a6c4310ff3cc056d36be1c",
  "60a6c9d60ff3cc056d36be1d",
  "60a6d11a0ff3cc056d36be1f",
  "60a6dd850ff3cc056d36be21",
  "60a6e5a70ff3cc056d36be23",
  "60a6e6ee0ff3cc056d36be25",
  "60a6e77d0ff3cc056d36be26",
  "60db429f2ab43a09df8b8a33",
  "60db477e2ab43a09df8b8a34",
  "60db47f52ab43a09df8b8a35",
  "60db48282ab43a09df8b8a36",
  "60db48582ab43a09df8b8a37",
  "60db48b42ab43a09df8b8a38",
  "60db48e52ab43a09df8b8a39",
  "60db49242ab43a09df8b8a3a",
  "60db49582ab43a09df8b8a3b",
  "60db4ed82ab43a09df8b8a40",
]

function getErrorObject(error, path) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  return { printPath: path, error };
}

function readStream(stream, encoding = "utf8") {

  stream.setEncoding(encoding);

  return new Promise((resolve, reject) => {
    let data = "";

    stream.on("data", chunk => data += chunk);
    stream.on("end", () => resolve(data));
    stream.on("error", error => reject(error));
  });
}

function setSettings(event) {
  if (event.hasOwnProperty("invokerArgs")) {
    let e = event.invokerArgs;
    IS_DEV_LOCAL_ENV = e.settings.IS_DEV_LOCAL_ENV;
    USE_LOCAL_DATA = e.settings.USE_LOCAL_DATA;
    SAVE_FILE_PATH = e.settings.SAVE_FILE_PATH;
    LOCAL_DATA_PATH = e.settings.LOCAL_DATA_PATH;
    PROGRESS_DEBUG_LOGS = e.settings.PROGRESS_DEBUG_LOGS;
    return e.body;
  }
  return event;
}

function groupItems(items, groupSize) {
  let groups = [[]];
  let lastGroupIndex = 0;
  for (let item of items) {
    if (groups[lastGroupIndex].length === groupSize) {
      groups.push([]);
      lastGroupIndex++;
    }
    groups[lastGroupIndex].push(item);
  }
  return groups;
}

function getBufferFromS3(file, callback) {
  const buffers = [];
  const stream = s3.getObject({ Bucket: 'flare-reporting', Key: file }).createReadStream();
  stream.on('data', data => buffers.push(data));
  stream.on('end', () => callback(null, Buffer.concat(buffers)));
  stream.on('error', error => callback(error));
}

// promisify read stream from s3
function getBufferFromS3Promise(file) {
  return new Promise((resolve, reject) => {
    getBufferFromS3(file, (error, s3buffer) => {
      if (error) return reject(error);
      return resolve(s3buffer);
    });
  });
};

/**
   * 
   * @param {Date} date 
   * @param {String} timezone 
   * @returns {String} string
   */
function UTCDateToLocalString(date, timezone) {
  try {
    /**
     * There is a bug in javascript that is supposed to be fixed in the 2021 version, but it's unreleased
     * the bug, for us, is causing 00 hour to display at 24.
     * As related to luxon: https://github.com/moment/luxon/issues/726
     * fix: use this as the formatting options : { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' };
     */
    if (!date || !timezone) return null;
    const FORMAT_OPTIONS = { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' };
    date = DateTime.fromISO(date.toISOString())
    let stringDate = date.setZone(timezone).setLocale('en-US').toLocaleString(DateTime.DATE_MED_WITH_WEEKDAY);
    let stringTime = date.setZone(timezone).setLocale('en-US').toLocaleString(FORMAT_OPTIONS);
    let stringDT = stringDate + " " + stringTime;
    return stringDT;
  } catch (err) { throw getErrorObject(err, "UTCDateToLocalString") }
}

function fillCell(cell, hexColor) {
  cell.style = JSON.parse(JSON.stringify(cell.style)); //workaround for bug outlined here: https://github.com/exceljs/exceljs/issues/791
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: hexColor },
  };
}

function formatTotalCell(cell) {
  cell.style = JSON.parse(JSON.stringify(cell.style)); //workaround for bug outlined here: https://github.com/exceljs/exceljs/issues/791
  cell.font = { bold: true, size: 12 };
  cell.border = {
    top: { style: 'thin' },
  };
}

class EmissionsReporter {
  constructor() {
    this.mongo = new MongoData(IS_DEV_LOCAL_ENV);
  }

  async initClass() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await this.mongo.initClient();
          return resolve();
        }
        catch (error) { return reject(getErrorObject(error, "EmissionsReporter.initClass(): ")) }
      })();
    });
  }

  async template() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.:")) }
      })();
    })
  }

  async getWorkbookTemplate() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {

          // create workbook from buffer
          const buffer = await getBufferFromS3Promise("templates/emissionsReportBlankTemplate.xlsx");
          const workbook = new Excel.Workbook();
          await workbook.xlsx.load(buffer);
          return resolve(workbook)
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.:")) }
      })();
    })
  }

  async addSpecialColumnNames(workbook, binSize) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let sampleFlareId = this.flares[0]._id;
          let samplePages = this.formulas[0].data[sampleFlareId];

          for (let i = 0; i < this.numPages; i++) {
            let worksheet = workbook.worksheets[i];
            let pageInfo = samplePages[i];
            let row = 9;
            let column = 5;
            for (let x = 0; x < this.formulas.length; x++) {
              if (binSize === 'monthly') {
                const totalCell = worksheet.getCell(row, column);
                totalCell.value = "Total";
                fillCell(totalCell, MED_GREY);
                column += 2;
              }
              else if (binSize === 'quarterly') {
                const m1Cell = worksheet.getCell(row, column);
                const m2Cell = worksheet.getCell(row, column + 1);
                const m3Cell = worksheet.getCell(row, column + 2);
                const totalCell = worksheet.getCell(row, column + 3);
                m1Cell.value = monthNumToName[pageInfo.m1.n].toUpperCase();
                m2Cell.value = monthNumToName[pageInfo.m2.n].toUpperCase();
                m3Cell.value = monthNumToName[pageInfo.m3.n].toUpperCase();
                totalCell.value = "Total";
                fillCell(m1Cell, MED_GREY);
                fillCell(m2Cell, MED_GREY);
                fillCell(m3Cell, MED_GREY);
                fillCell(totalCell, MED_GREY);
                column += 5;
              }
              else if (binSize === 'semi-annual') {
                const q1Cell = worksheet.getCell(row, column);
                const q2Cell = worksheet.getCell(row, column + 1);
                const totalCell = worksheet.getCell(row, column + 2);
                q1Cell.value = (`Q${pageInfo.q1.n}`).toUpperCase();
                q2Cell.value = (`Q${pageInfo.q2.n}`).toUpperCase();
                totalCell.value = "Total";
                fillCell(q1Cell, MED_GREY);
                fillCell(q2Cell, MED_GREY);
                fillCell(totalCell, MED_GREY);
                column += 4;
              }
              else if (binSize === 'annual') {
                const h1Cell = worksheet.getCell(row, column);
                const h2Cell = worksheet.getCell(row, column + 1);
                const totalCell = worksheet.getCell(row, column + 2);
                h1Cell.value = (`H${pageInfo.s1.n}`).toUpperCase();
                h2Cell.value = (`H${pageInfo.s2.n}`).toUpperCase();
                totalCell.value = "Total";
                fillCell(h1Cell, MED_GREY);
                fillCell(h2Cell, MED_GREY);
                fillCell(totalCell, MED_GREY);
                column += 4;
              }
              else {
                throw new Error(`No matching bin option called : "${this.payload.reportBinSize} in buildExcelFile()"`);
              }
            }
          }
          return resolve(workbook)
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.:")) }
      })();
    })
  }

  async addFormulaNamesToWorksheet(worksheet, binSize) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let row = 8;
          let column = 5;
          for (let formula of this.formulas) {
            const cell = worksheet.getCell(row, column);
            fillCell(cell, DARK_GREY);
            if (binSize === 'monthly') {
              cell.value = formula.name;
              column += 2;
            }
            else if (binSize === 'quarterly') {
              cell.value = formula.name;
              column += 5;
            }
            else if (binSize === 'semi-annual') {
              cell.value = formula.name;
              column += 4;
            }
            else if (binSize === 'annual') {
              cell.value = formula.name;
              column += 4;
            }
            else {
              throw new Error(`No matching bin option called : "${this.payload.reportBinSize} in buildExcelFile()"`);
            }
          }
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.:")) }
      })();
    })
  }

  async createTabs(workbook) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let binSize = this.payload.reportBinSize;
          //Create the needed sheets
          let sheetToClone = workbook.getWorksheet(sheetIdMap[binSize]);
          let sheetIdToClone = sheetToClone.id;
          workbook.eachSheet(function (worksheet, sheetId) {
            if (sheetId !== sheetIdToClone) workbook.removeWorksheet(sheetId)
          });
          sheetToClone = workbook.getWorksheet(sheetIdMap[binSize]);
          for (let i = 0; i < this.numPages - 1; i++) { //there is some wierd but with ids and this is the workaround so they are in order and without duplicates
            let newSheet = workbook.addWorksheet("Sheet") //Not sure why this step is required too, but it was descibed by another user as a nessesary intermediate step
            // newSheet.model = sheetToClone.model;
            newSheet.model = Object.assign(sheetToClone.model, { //This is a bug workaround outlined here: https://github.com/exceljs/exceljs/issues/292
              mergeCells: sheetToClone.model.merges,
            });
            newSheet.name = `Clone ${i + 1}`;
          }
          //Organize Data
          let sampleFlareId = this.flares[0]._id;
          let samplePages = this.formulas[0].data[sampleFlareId];
          //start populating everything with the correct data
          switch (this.payload.reportBinSize) {
            case 'monthly':
              for (let i = 0; i < this.numPages; i++) {
                let sheet = workbook.worksheets[i];
                let month = samplePages[i].month.n;
                let year = samplePages[i].year;
                sheet.name = `${monthNumToName[month]} ${year}`
              }
              break;
            case 'quarterly':
              for (let i = 0; i < this.numPages; i++) {
                let sheet = workbook.worksheets[i];
                let quarter = samplePages[i].q;
                let year = samplePages[i].year;
                sheet.name = `Q${quarter} ${year}`
              }
              break;
            case 'semi-annual':
              for (let i = 0; i < this.numPages; i++) {
                let sheet = workbook.worksheets[i];
                let semester = samplePages[i].s;
                let year = samplePages[i].year;
                sheet.name = `H${semester} ${year}`
              }
              break;
            case 'annual':
              for (let i = 0; i < this.numPages; i++) {
                let sheet = workbook.worksheets[i];
                let year = samplePages[i].year;
                sheet.name = `${year}`
              }
              break;
            default:
              throw new Error(`No matching bin option called : "${this.payload.reportBinSize} in buildExcelFile()"`);
          }
          const end = DateTime.fromMillis(this.end.toMillis());
          end.plus({ days: -1 });
          const startString = this.start.toLocaleString(DateTime.DATE_SHORT);
          const endString = end.toLocaleString(DateTime.DATE_SHORT);
          const dateNow = DateTime.now().setZone(this.timezone);
          const format = { ...DateTime.DATE_SHORT, ...DateTime.TIME_24_WITH_SHORT_OFFSET }
          const nowString = dateNow.toLocaleString(format);

          let regex = new RegExp('/ ', 'g')
          for (let formula of this.formulas) { //getting the names
            let reportNameExists = formula.reportName === undefined ? false : true;
            if (!reportNameExists) {
              let nameParts = formula.name.split("-");
              for (let part of nameParts) { part.replace(regex, "") }
              try {
                formula.name = `${nameParts[1]} (${nameParts[2]})`
              } catch {
                try {
                  formula.name = nameParts[1];
                } catch { }
              }

            }
            else formula.name = formula.reportName
            // formula.name += " (tons)"
          }

          workbook = await this.addSpecialColumnNames(workbook, binSize);
          for (let worksheet of workbook.worksheets) {
            await this.addFormulaNamesToWorksheet(worksheet, binSize);
            const startDateCell = worksheet.getCell('C3');
            const endDateCell = worksheet.getCell('C4');
            const nowDateCell = worksheet.getCell('C5');
            startDateCell.value = startString;
            endDateCell.value = endString;
            nowDateCell.value = nowString;

            let flareNameRow = 10;
            let flareNameColumn = 3;
            for (let flare of this.flares) {
              const cell = worksheet.getCell(flareNameRow, flareNameColumn);
              cell.value = flare.name;
              flareNameRow++;
            }
            const cell = worksheet.getCell(flareNameRow, flareNameColumn);
            cell.value = "Total";
            cell.font = { bold: true };
            cell.border = {
              top: { style: 'thin' },
            };
          }

          return resolve(workbook);
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.createTabs:")) }
      })();
    })
  }

  async populateData(workbook) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // let sampleFlareId = this.flares[0]._id;
          // let samplePages = this.formulas[0].data[sampleFlareId];
          let binSize = this.payload.reportBinSize;
          for (let pageNum = 0; pageNum < this.numPages; pageNum++) {
            // console.log({pageNum})
            let worksheet = workbook.worksheets[pageNum];
            let column = 5;
            for (let formula of this.formulas) {
              // console.log({formula})
              let row = 10;
              let totals = {};
              if (binSize === 'monthly') totals = { overall: 0 };
              for (let flare of this.flares) {
                // console.log({flare})
                let pageData = formula.data[flare._id.toString()][pageNum];
                if (binSize === 'monthly') {
                  // console.log(pageNum, row, column, pageData)
                  const cell = worksheet.getCell(row, column);
                  cell.value = pageData.month.value === null ? "NULL" : pageData.month.value;
                  fillCell(cell, LIGHT_GREY);
                  totals.overall += pageData.month.value;
                }
                else if (binSize === 'quarterly') {
                  const m1Cell = worksheet.getCell(row, column);
                  const m2Cell = worksheet.getCell(row, column + 1);
                  const m3Cell = worksheet.getCell(row, column + 2);
                  const totalCell = worksheet.getCell(row, column + 3);
                  m1Cell.value = pageData.m1.value === null ? "NULL" : pageData.m1.value;
                  m2Cell.value = pageData.m2.value === null ? "NULL" : pageData.m2.value;
                  m3Cell.value = pageData.m3.value === null ? "NULL" : pageData.m3.value;
                  totalCell.value = pageData.total;
                  fillCell(totalCell, LIGHT_GREY);

                  totals[0] = totals[0] === undefined ? pageData.m1.value : totals[0] + pageData.m1.value;
                  totals[1] = totals[1] === undefined ? pageData.m2.value : totals[1] + pageData.m2.value;
                  totals[2] = totals[2] === undefined ? pageData.m3.value : totals[2] + pageData.m3.value;
                  totals[3] = totals[3] === undefined ? pageData.total : totals[3] + pageData.total;
                }
                else if (binSize === 'semi-annual') {
                  const q1Cell = worksheet.getCell(row, column);
                  const q2Cell = worksheet.getCell(row, column + 1);
                  const totalCell = worksheet.getCell(row, column + 2);
                  q1Cell.value = pageData.q1.value === null ? "NULL" : pageData.q1.value;
                  q2Cell.value = pageData.q2.value === null ? "NULL" : pageData.q2.value;
                  totalCell.value = pageData.total;
                  fillCell(totalCell, LIGHT_GREY);

                  totals[0] = totals[0] === undefined ? pageData.q1.value : totals[0] + pageData.q1.value;
                  totals[1] = totals[1] === undefined ? pageData.q2.value : totals[1] + pageData.q2.value;
                  totals[2] = totals[2] === undefined ? pageData.total : totals[2] + pageData.total;
                }
                else if (binSize === 'annual') {
                  const h1Cell = worksheet.getCell(row, column);
                  const h2Cell = worksheet.getCell(row, column + 1);
                  const totalCell = worksheet.getCell(row, column + 2);
                  h1Cell.value = pageData.s1.value === null ? "NULL" : pageData.s1.value;
                  h2Cell.value = pageData.s2.value === null ? "NULL" : pageData.s2.value;
                  totalCell.value = pageData.total;
                  fillCell(totalCell, LIGHT_GREY);

                  totals[0] = totals[0] === undefined ? pageData.s1.value : totals[0] + pageData.s1.value;
                  totals[1] = totals[1] === undefined ? pageData.s2.value : totals[1] + pageData.s2.value;
                  totals[2] = totals[2] === undefined ? pageData.total : totals[2] + pageData.total;
                }
                row++;
              }
              if (binSize === 'monthly') {
                const totalCell = worksheet.getCell(row, column);
                totalCell.value = totals.overall;
                formatTotalCell(totalCell);
                fillCell(totalCell, LIGHT_GREY);
                column += 2;
              }
              else if (binSize === 'quarterly') {
                let numCols = Object.keys(totals).length;
                for (let i = 0; i < numCols; i++) {
                  const totalCell = worksheet.getCell(row, column + i);
                  totalCell.value = totals[i];
                  formatTotalCell(totalCell);
                  if (i === numCols - 1) fillCell(totalCell, LIGHT_GREY);
                }
                column += 5;
              }
              else if (binSize === 'semi-annual') {
                let numCols = Object.keys(totals).length;
                for (let i = 0; i < Object.keys(totals).length; i++) {
                  const totalCell = worksheet.getCell(row, column + i);
                  totalCell.value = totals[i];
                  formatTotalCell(totalCell);
                  if (i === numCols - 1) fillCell(totalCell, LIGHT_GREY);
                }
                column += 4;
              }
              else if (binSize === 'annual') {
                let numCols = Object.keys(totals).length;
                for (let i = 0; i < Object.keys(totals).length; i++) {
                  const totalCell = worksheet.getCell(row, column + i);
                  totalCell.value = totals[i];
                  formatTotalCell(totalCell);
                  if (i === numCols - 1) fillCell(totalCell, LIGHT_GREY);
                }
                column += 4;
              }
            }
            //here is where the total goes
          }
          return resolve(workbook);
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.populateData:")) }
      })();
    })
  }

  async buildExcelFile() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          //C:\Users\evaquero\Desktop\testingOutput
          let workbook = await this.getWorkbookTemplate();
          workbook = await this.createTabs(workbook);
          workbook = await this.populateData(workbook);
          return resolve(workbook)
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.buildExcelFile:")) }
      })();
    })
  }

  async binData(data, formula, flare) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // We're going to take the approach of always binning by month as default as our smallest unit.
          // Once we get over that then it's easier to get the other (larger) report types: quarterly, semi-an, annual, 
          let reportBinSize = this.payload.reportBinSize;

          let firstDate, lastDate = null;
          if (formula.reportInfo[flare._id.toString()].firstValue.isCutoff) {
            firstDate = formula.reportInfo[flare._id.toString()].firstValue.originalStart;
            firstDate = DateTime.fromJSDate(firstDate, {zone : this.timezone });
          }
          else firstDate = data[0].date;
          lastDate = data[data.length - 1].date;

          //Get the year-month bins
          let yearMonthBins = [];
          if (firstDate.toMillis() > lastDate.toMillis()) throw new Error(`firstDate is larger than lastDate: '${firstDate.toMillis(), lastDate.toMillis()}'`)
          if (lastDate.year - firstDate.year > 2) throw new Error(`Date range is too large. Range is more 2 years: '${firstDate.toMillis(), lastDate.toMillis()}'`)
          let pivotDate = DateTime.fromObject({year: firstDate.year, month : firstDate.month, day : 1, zone: this.timezone});
          while (pivotDate.toMillis() < lastDate.toMillis()) {
            //Using this approach, user should always use the start 1st of a month
            yearMonthBins.push({ year: pivotDate.year, month: pivotDate.month });
            pivotDate = pivotDate.plus({ months: 1 });
          }
          yearMonthBins = yearMonthBins.map(v => {
            let lastDateToInclude = DateTime.fromObject({ year: v.year, month: v.month + 1, zone: this.timezone }).toMillis();
            let firstDateToExclude = DateTime.fromObject({ year: v.year, month: v.month, zone: this.timezone }).toMillis();
            let binData = data.filter(d =>
              (d.date.year === v.year && d.date.month === v.month) ||
              d.date.toMillis() === lastDateToInclude
              && d.date.toMillis() !== firstDateToExclude);
            let resultValue = null;
            const sumReducer = (accumulator, currentValue) => { return { value: accumulator.value + currentValue.value } };
            switch (this.action) {
              case 'sum':
                resultValue = binData.length === 0 ? null : binData.reduce(sumReducer).value;
                break;
              case 'average':
                // let sum = binData.length === 0 ? null : binData.reduce(sumReducer).value;
                // resultValue = sum / binData.length; //this will throw error
                break;
              default:
                throw new Error(`No matching action available to: ${this.action}`);
            }
            v.result = resultValue === null ? null : parseFloat(resultValue.toFixed(2));
            return v;
          });

          //Now we bin into what is requested by the report
          const monthSumReducer = (accumulator, currentValue) => { return { result: accumulator.result + currentValue.result } };
          let years = [];
          let binnedData = [];
          for (let bin of yearMonthBins) {
            if (!years.includes(bin.year)) years.push(bin.year);
          }
          switch (reportBinSize) {
            case 'monthly':
              binnedData = yearMonthBins.map(b => {
                return {
                  year: b.year,
                  month: { n: b.month, value: b.result },
                }
              });
              return resolve(binnedData);
            case 'quarterly':
              for (let year of years) {
                let m1 = yearMonthBins.filter(b => b.year === year && b.month === 1);
                let m2 = yearMonthBins.filter(b => b.year === year && b.month === 2);
                let m3 = yearMonthBins.filter(b => b.year === year && b.month === 3);
                let m4 = yearMonthBins.filter(b => b.year === year && b.month === 4);
                let m5 = yearMonthBins.filter(b => b.year === year && b.month === 5);
                let m6 = yearMonthBins.filter(b => b.year === year && b.month === 6);
                let m7 = yearMonthBins.filter(b => b.year === year && b.month === 7);
                let m8 = yearMonthBins.filter(b => b.year === year && b.month === 8);
                let m9 = yearMonthBins.filter(b => b.year === year && b.month === 9);
                let m10 = yearMonthBins.filter(b => b.year === year && b.month === 10);
                let m11 = yearMonthBins.filter(b => b.year === year && b.month === 11);
                let m12 = yearMonthBins.filter(b => b.year === year && b.month === 12);
                m1 = m1.length === 0 ? null : m1[0].result;
                m2 = m1.length === 0 ? null : m2[0].result;
                m3 = m1.length === 0 ? null : m3[0].result;
                m4 = m1.length === 0 ? null : m4[0].result;
                m5 = m1.length === 0 ? null : m5[0].result;
                m6 = m1.length === 0 ? null : m6[0].result;
                m7 = m1.length === 0 ? null : m7[0].result;
                m8 = m1.length === 0 ? null : m8[0].result;
                m9 = m1.length === 0 ? null : m9[0].result;
                m10 = m1.length === 0 ? null : m10[0].result;
                m11 = m1.length === 0 ? null : m11[0].result;
                m12 = m1.length === 0 ? null : m12[0].result;
                binnedData.push(
                  {
                    year: year,
                    q: 1,
                    m1: { n: 1, value: m1 },
                    m2: { n: 2, value: m2 },
                    m3: { n: 3, value: m3 },

                    total: parseFloat((m1 + m2 + m3).toFixed(2)),
                  },
                  {
                    year: year,
                    q: 2,
                    m1: { n: 4, value: m4 },
                    m2: { n: 5, value: m5 },
                    m3: { n: 6, value: m6 },
                    total: parseFloat((m4 + m5 + m6).toFixed(2)),
                  },
                  {
                    year: year,
                    q: 3,
                    m1: { n: 7, value: m7 },
                    m2: { n: 8, value: m8 },
                    m3: { n: 9, value: m9 },
                    total: parseFloat((m7 + m8 + m9).toFixed(2)),
                  },
                  {
                    year: year,
                    q: 4,
                    m1: { n: 10, value: m10 },
                    m2: { n: 11, value: m11 },
                    m3: { n: 12, value: m12 },
                    total: parseFloat((m10 + m11 + m12).toFixed(2)),
                  },
                )
              }
              return resolve(binnedData);
            case 'semi-annual':
              for (let year of years) {
                let q1m = [1, 2, 3];
                let q2m = [4, 5, 6];
                let q3m = [7, 8, 9];
                let q4m = [10, 11, 12];
                let q1 = yearMonthBins.filter(b => b.year === year && q1m.includes(b.month));
                let q2 = yearMonthBins.filter(b => b.year === year && q2m.includes(b.month));
                let q3 = yearMonthBins.filter(b => b.year === year && q3m.includes(b.month));
                let q4 = yearMonthBins.filter(b => b.year === year && q4m.includes(b.month));
                q1 = q1.length === 0 ? null : q1.reduce(monthSumReducer).result;
                q2 = q2.length === 0 ? null : q2.reduce(monthSumReducer).result;
                q3 = q3.length === 0 ? null : q3.reduce(monthSumReducer).result;
                q4 = q4.length === 0 ? null : q4.reduce(monthSumReducer).result;
                binnedData.push(
                  {
                    year: year,
                    s: 1,
                    q1: { n: 1, value: q1 },
                    q2: { n: 2, value: q2 },
                    total: parseFloat((q1 + q2).toFixed(2)),
                  },
                  {
                    year: year,
                    s: 2,
                    q1: { n: 3, value: q3 },
                    q2: { n: 4, value: q4 },
                    // data : [ { n: 3, value: q3 }, { n: 4, value: q4 } ],
                    total: parseFloat((q3 + q4).toFixed(2)),
                  }
                )
              }
              return resolve(binnedData);
            case 'annual':
              for (let year of years) {
                let s1 = [1, 2, 3, 4, 5, 6];
                let s2 = [7, 8, 9, 10, 11, 12];
                let h1 = yearMonthBins.filter(b => b.year === year && s1.includes(b.month));
                let h2 = yearMonthBins.filter(b => b.year === year && s2.includes(b.month));
                h1 = h1.length === 0 ? null : h1.reduce(monthSumReducer).result;
                h2 = h2.length === 0 ? null : h2.reduce(monthSumReducer).result;
                binnedData.push({
                  year: year,
                  s1: { n: 1, value: h1 },
                  s2: { n: 2, value: h2 },
                  // data : [{ n: 1, value: h1 }, { n: 2, value: h2 }],
                  total: parseFloat((h1 + h2).toFixed(2)),
                })
              }
              return resolve(binnedData)
            default:
              throw new Error(`No matching reportBinSize available to: ${reportBinSize}`);
          }
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.binData:")) }
      })();
    })
  }

  async normalizeData(rawData, formula, flare) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          //Data Replacement
          let firstValue = {
            isCutoff: false,
            originalStart : rawData[0].date,
            newStartObject: null,
            newStartIndex: null,
            fullRangeIsNull: false,
          }
          //Below we are cutting off any starting nulls
          if (rawData[0].value === null) {
            let newStartIndex = -1;
            firstValue.isCutoff = true;
            for (let datum of rawData) {
              newStartIndex++
              if (datum.value !== null) {
                firstValue.newStartObject = datum;
                firstValue.newStartIndex = newStartIndex;
                break;
              }
            }
            if (firstValue.isCutoff && firstValue.newStartObject === null) firstValue.fullRangeIsNull = true;
            else if (firstValue.isCutoff) rawData.splice(0, newStartIndex + 1);
          }
          //Below we are replacing values with last existing value
          rawData.map((v, i, a) => {
            if (v.value !== null || i === 0) return;
            a[i].value = a[i - 1].value;
          })
          if (formula.reportInfo === undefined) formula.reportInfo = {};
          if (formula.reportInfo[flare._id.toString()] === undefined) formula.reportInfo[flare._id.toString()] = {};
          formula.reportInfo[flare._id.toString()].firstValue = firstValue; //we'll need to access some of these values later

          //Date substitution so we can handle it in local time
          let normalizedData = rawData.map(d => {
            d.date = DateTime.fromMillis(d.date.getTime(), { zone: this.timezone });
            return d;
          })
          return resolve(normalizedData)
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.normalizeData:")) }
      })();
    })
  }

  async getFormulaData(formula, flare) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let filter = {
            org: this.org._id,
            formula: formula._id,
            flare: flare._id,
            header: null,
            date: { $gt: new Date(this.start.toMillis()), $lte: new Date(this.end.toMillis()) }
          }
          let rawData = null;
          if (USE_LOCAL_DATA) {
            rawData = await fs.readFile(LOCAL_DATA_PATH, 'utf8');
            rawData = JSON.parse(rawData);
            rawData = rawData.map(v => {
              v.date = new Date(v.date);
              if (v.value === null) return v
              v.value = parseFloat(v.value);
              if (typeof v.value !== 'number') throw new Error(`non number found: ${v}`);
              return v
            });
          } else {
            let Key = `preloadedData/${formula._id.toString()}_${flare._id.toString()}_${this.dashStart}_${this.dashEnd}.json`
            if (this.preloadedFileNames.includes(Key)) {
              const buffer = await getBufferFromS3Promise(Key);
              rawData = JSON.parse(buffer.toString());
              rawData = rawData.map(v => {
                v.date = new Date(v.date);
                if (v.value === null) return v
                v.value = parseFloat(v.value);
                if (typeof v.value !== 'number') throw new Error(`non number found: ${v}`);
                return v
              });
            } else {
              rawData = await this.mongo.getFormulaValues(filter, !this.payload.debug);
            }
          }
          // if (!USE_LOCAL_DATA) await fs.writeFile(LOCAL_DATA_PATH, JSON.stringify(rawData))
          let normalizedData = await this.normalizeData(rawData, formula, flare); //Data replacement and UTC-to-Localtime
          let binnedData = await this.binData(normalizedData, formula, flare);
          if (this.numPages === undefined) this.numPages = binnedData.length;
          if (formula.data === undefined) formula.data = {};
          formula.data[flare._id.toString()] = binnedData
          return resolve(binnedData)
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.getFormulaData:")) }
      })();
    })
  }

  async getManyFormulasData(formulas, flare) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let results = [];
          results = await Promise.all(formulas.map(formula => this.getFormulaData(formula, flare)));
          return resolve();
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.getManyFormulasData:")) }
      })();
    })
  }

  async compileReport() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let formulaGroups = groupItems(this.formulas, 3);
          for (let flare of this.flares) {
            await Promise.all(formulaGroups.map(formulaGroup => this.getManyFormulasData(formulaGroup, flare)));
          }
          // console.log("formula data: ", util.inspect(this.formulas, { showHidden: true, depth: null }));
          // console.log("num pages: ", this.numPages)
          let workbook = await this.buildExcelFile();

          /**
          let link = uploadFile();
          return resolve({success: true, link})
           */
          return resolve(workbook)
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.compileReport:")) }
      })();
    })
  }

  async updateBaseInfo() {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const org = this.payload.org;
          const formulas = this.payload.parameters.filter(p => p.paramType === "formula");
          const formulaIDs = formulas.map(f => f.id);
          const formulasFilter = {
            _id: { $in: formulaIDs },
            org
          }
          this.action = this.payload.action;
          this.flares = await this.mongo.getFlares({ org });
          // this.flare = this.flares.find(f => f._id.toString() === this.payload.flare);
          this.headers = await this.mongo.getHeaders({ org });
          this.org = (await this.mongo.getOrgs({ _id: org }))[0];
          this.formulas = await this.mongo.getFormulas(formulasFilter);

          this.preloadedFileNames = [];
          try {
            let preloadedFileNames = await s3.listObjectsV2({
              Bucket: "flare-reporting",
              Prefix: "preloadedData/"
            }).promise();
            preloadedFileNames = preloadedFileNames.Contents.map(f => f.Key);
            this.preloadedFileNames = preloadedFileNames;
          } catch (e) { console.log(e, e.stack) }

          this.timezone = this.org.timezone;
          let re = new RegExp('\/', 'g')
          let start = this.payload.start.replace(re, "-");
          let end = this.payload.end.replace(re, "-");
          this.dashStart = start;
          this.dashEnd = end;
          this.start = DateTime.fromISO(start, { zone: this.timezone });
          this.end = DateTime.fromISO(end, { zone: this.timezone }).plus({ days: 1 });
          return resolve()
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.updateBaseInfo:")) }
      })();
    })
  }

  async uploadFile(filepath = null, filename = null) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (PROGRESS_DEBUG_LOGS) console.log("uploading file")
          // Read content from the file
          const fileContent = await fs.readFile(filepath);

          if (!filename) {
            const now = parseInt(DateTime.now().toMillis() / 1000);
            filename = `emissionsReport_${this.dashStart}_to_${this.dashEnd}_${now}.xlsx`
          }

          // Setting up S3 upload parameters
          const params = {
            Bucket: "flare-reporting",
            Key: `reports/${filename}`, // File name you want to save as in S3
            Body: fileContent
          };

          // Uploading files to the bucket
          let res = await s3.upload(params).promise();
          // console.log("upload res: ", res)
          return resolve(res.Location)
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.:")) }
      })();
    })
  }


  async run(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          this.payload = payload;
          await this.updateBaseInfo();
          if (PROGRESS_DEBUG_LOGS) console.log("finished local update")
          let workbook = await this.compileReport();
          if (PROGRESS_DEBUG_LOGS) console.log("finished compling")
          await workbook.xlsx.writeFile(SAVE_FILE_PATH);
          if (PROGRESS_DEBUG_LOGS) console.log("finished writing")
          let downloadLink = null;
          if (!IS_DEV_LOCAL_ENV) {
            downloadLink = await this.uploadFile(SAVE_FILE_PATH)
            await this.mongo.updateJob(this.payload.jobID, true, false, downloadLink);
          }
          return resolve(downloadLink);
        } catch (err) { return reject(getErrorObject(err, "EmissionsReporter.run:")) }
      })();
    })
  }
}

exports.handler = async (event) => {
  try {
    let payload = setSettings(event);
    if (IS_DEV_LOCAL_ENV) require('dotenv').config();
    if (EM_REPORTER === null) {
      EM_REPORTER = new EmissionsReporter();
      await EM_REPORTER.initClass();
    }
    if (EM_REPORTER.mongo.mongooseStatus() === 0) await EM_REPORTER.initClass();
    let downloadLink = await EM_REPORTER.run(payload);
    const response = {
      statusCode: 200,
      body: { downloadLink }
    }
    if (IS_DEV_LOCAL_ENV) {
      await MongoData.closeClient();
      console.log("response: ", response);
    }
    return response;
  }
  catch (error) {
    const response = { status: 400, body: error }
    try { await this.mongo.updateJob(this.payload.jobID, true, true); }
    catch (e) { }
    if (IS_DEV_LOCAL_ENV) {
      try {
        await MongoData.closeClient();
        console.log("response: ", response);
      } catch (e) { }
    }
    console.log("ERROR: ", error)
    return response;
  }
}
