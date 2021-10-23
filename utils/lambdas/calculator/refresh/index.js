const AWS = require('aws-sdk');
const Lambda = new AWS.Lambda({ region: 'us-east-1' });
const SQS = new AWS.SQS({ region: 'us-east-1' });
const axios = require('axios');
const http = require('http');
const https = require('https');
const MongoData = require('./MongoData');
const { PiValue, DebugFormulaValue, FormulaValue, PiValuesDebug, EventRule } = require('./FRTModels');
const { ObjectId } = require("mongodb");
const { DateTime } = require('luxon');
const { v4: uuidv4 } = require('uuid');
const { printElapsedTime } = require('./Timer');

axios.defaults.httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 3000 })
axios.defaults.httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 3000 })

let PROCESSOR = null;
const DEBUG_0 = false; //print event
const DEBUG_TIMER = false;
const SQS_DEBUG = false;
const DIRECT_CALC = true;
const UPLOAD_DEBUG = false;
const DEBUG_2 = false; //More logging
const DEBUG_1 = false; //Less logging
const LOCAL_ENV = false; //diffrent kinds of processing needed. Like parsing a json object or not.
const SAVE_VALUES = true; //save the values you calculate
const FORWARD_TO_SQS = false; //forward to sqs for event gen
const pythonURL = 'https://del0xeo27b.execute-api.us-east-1.amazonaws.com/prod/formulavalue'

function getErrorObject(error, path) {
  path.concat(":");
  if (error.hasOwnProperty('printPath')) {
    let errObj = { printPath: path, error: error.error };
    errObj.printPath = `${errObj.printPath}${error.printPath}`;
    return errObj;
  }
  return { printPath: path, error };
}

class LiveDataProcessor {
  constructor() {
    this.mongo = new MongoData();
  }

  async initClass(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let orgOid = new ObjectId(payload.o);
          await this.mongo.initClient();
          await this.mongo.getAllData(orgOid);
          return resolve();
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "LiveDataProcessor.initClass(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "LiveDataProcessor.initClass(): ", error });
        }
      })();
    });
  }

  /**
   * 
   * @param {ObjectId} flareid 
   * @param {*} formulaDepends 
   * @param {*} calcGroup 
   */
  async getNonFormulaValues(flareid, formulaDepends = null, calcGroup, orgOID, isDebug) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {

          let flares = this.mongo.allData.flares;
          let headers = await this.mongo.getFlareHeaders(flareid);
          let compoundGroups = this.mongo.allData.compoundGroups;
          let piTags = [...this.mongo.allData.piTags];
          let constants = this.mongo.allData.constants;
          let compounds = this.mongo.allData.compounds;
          const flare = flares.filter(f => f._id.toString() === flareid.toString())[0]
          const allData = [];
          let date = calcGroup.groupDt;
          await Promise.all(formulaDepends.map(orgDep => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  const dep = { ...orgDep } //TODO, if it's copied here once, it really dosnt need to happen more times below.
                  if (dep.type === 'formula') {
                    if (dep.to === 'headers') {
                      headers.map(header => {
                        const thisDep = { ...orgDep }
                        thisDep.parentid = header._id.toString()
                        thisDep.value = null
                        allData.push(thisDep)
                      })
                    } else {
                      const thisDep = { ...orgDep }
                      thisDep.parentid = flareid
                      allData.push(thisDep)
                    }
                    return resolve()//dep
                  }

                  if (dep.type === 'flare') {
                    const thisDep = { ...orgDep }
                    thisDep.parentid = flareid
                    thisDep.value = flare[dep.param]
                    allData.push(thisDep)

                    return resolve()//dep
                  }

                  if (dep.type === 'header') {
                    headers.map(header => {
                      const thisDep = { ...orgDep }
                      thisDep.parentid = header._id.toString()
                      thisDep.value = header[dep.param]
                      allData.push(thisDep)
                    })
                    return resolve() //dep
                  }

                  if (dep.type === 'constant') {
                    const found = constants.filter(c => c._id.toString() === dep.id.toString())[0]
                    const value = found.value
                    headers.map(header => {
                      const thisDep = { ...orgDep }
                      thisDep.parentid = header._id.toString()
                      thisDep.value = value
                      allData.push(thisDep)
                    })
                    const thisDep = { ...orgDep }
                    thisDep.parentid = flareid
                    thisDep.value = value
                    allData.push(thisDep)
                    return resolve() //dep
                  }

                  if (dep.type === 'compound') {
                    const found = compounds.filter(c => c._id.toString() === dep.id.toString())[0]
                    let value = null;
                    const optionMatch = ["fractional", "primaryFractional", "secondaryFractional", "primary", "secondary"].some(r=> dep.attr.includes(r))
                    if (optionMatch || dep.attr.length === 0) {
                      headers.map(header => {
                        const thisDep = { ...orgDep }
                        thisDep.parentid = header._id.toString()
                        thisDep.value = null;
                        let value = null;
                        let primaryMatch = null;
                        let secondaryMatch = null;
                        for (const tag of piTags) {
                          if (!tag.parameter.compound) continue;
                          if (!(tag.parameter.compound.toString() == found._id.toString())) {
                            continue;
                          }
                          if (tag.header._id.toString() !== header._id.toString()) continue
                          let matchingCalcTag = calcGroup.data.filter(CGTag => CGTag.piTag.toString() == tag._id.toString())[0];
                          const fracMapping = {
                            "mol%": 100,
                            "mol": 100,
                            "ppm": 1000000,
                            "ppb": 1000000000,
                          }
                          const div = fracMapping[tag.parameter.unitOfMeasure]
                          let expectsNum = tag.parameter.valueType === 'num' ? true : false;
                          if (expectsNum && isNaN(matchingCalcTag.value)) {
                            if ( dep.attr.length === 0 ) { //this is for when we just want the value not the fractional
                              if (primaryMatch === false && secondaryMatch === false) {
                                value = null;
                                break;
                              }
                              if (tag.sensor.isPrimary === true && secondaryMatch === null) {
                                primaryMatch = false;
                                continue;
                              }
                              if (tag.sensor.isPrimary === false && primaryMatch === null) {
                                secondaryMatch = false;
                                continue;
                              }
                            }
                            else matchingCalcTag.value = 0;
                          }
                          matchingCalcTag.fracValue = div ? matchingCalcTag.value / div : matchingCalcTag.value
                          // if (tag.parameter.compound.toString() !== compound._id.toString()) continue
                          if (dep.attr.includes('fractional') || dep.attr.length === 0) {
                            if (!dep.attr.includes('primary') && !dep.attr.includes('secondary')) {
                              if (tag.sensor.isPrimary === true) {
                                if (dep.attr.length === 0) value = matchingCalcTag.value;
                                else {
                                  if (matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue)) break;
                                  if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                                  value = matchingCalcTag.fracValue //{ id: header._id.toString(), value: matchingCalcTag.fracValue, compound: found.name }
                                }
                                primaryMatch = true;
                                break;
                              } else { //is secondary
                                if (dep.attr.length === 0) {
                                  value = matchingCalcTag.value;
                                  secondaryMatch = true;
                                  continue;
                                }
                                else {
                                  if (primaryMatch || matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue)) break;
                                  if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                                  value = matchingCalcTag.fracValue //{ id: header._id.toString(), value: matchingCalcTag.fracValue, compound: found.name }
                                }
                              }
                            }
                          }
                          if (dep.attr.includes('primary') || dep.attr.includes('primaryFractional')) {
                            if (tag.sensor.isPrimary === true) {
                              if (["fractional", "primaryFractional"].some(r=> dep.attr.includes(r))) {
                                if (!(matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue))) {
                                  if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                                }
                                value = matchingCalcTag.fracValue //{ id: header._id.toString(), value: matchingCalcTag.fracValue, compound: found.name }
                              } else {
                                value = matchingCalcTag.value
                              }
                              break
                            }
                          }
                          if (dep.attr.includes('secondary') || dep.attr.includes('secondaryFractional')) {
                            if (tag.sensor.isPrimary === false) {
                              if(["fractional", "secondaryFractional"].some(r=> dep.attr.includes(r))) {
                                if (!(matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue))) {
                                  if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                                }
                                value = matchingCalcTag.fracValue //{ id: header._id.toString(), value: matchingCalcTag.fracValue, compound: found.name }
                              } else {
                                value = matchingCalcTag.value
                              }
                              break
                            }
                          }
                        }
                        thisDep.value = value;
                        allData.push(thisDep)
                      })
                      return resolve();
                    } else {
                      value = found[dep.attr[0]];
                      headers.map(header => {
                        const thisDep = { ...orgDep }
                        thisDep.parentid = header._id.toString()
                        thisDep.value = value
                        allData.push(thisDep)
                      })
                      //I think we have this here so that BOTH a header OR flare formula can access a compound. Unsure.
                      const thisDep = { ...orgDep }
                      thisDep.parentid = flareid
                      thisDep.value = value
                      allData.push(thisDep)
                      return resolve()
                    }
                  }

                  if (dep.type === 'parameter' && dep.parent === 'flare') {
                    const thisDep = { ...orgDep }
                    thisDep.parentid = flareid
                    let arr = await this.mongo.getArrayPiData(thisDep, date, orgOID, flareid, null, isDebug)
                    if (arr) {
                      thisDep.value = arr;
                    } else {
                      let found = piTags.filter(tag => ((tag.parameter._id.toString() === dep.id.toString()) && (tag.flare._id.toString() === flareid.toString())))
                      // let found = piTags.filter(tag => tag.parameter._id.toString() === dep.id.toString())	
                      if (found.length === 0) {
                        thisDep.value = null
                        allData.push(thisDep)
                        return resolve()
                      }
                      let tag = found;
                      let calcGroupTag = calcGroup.data.filter(tagValPair => {
                        return (found[0]._id.toString() == tagValPair.piTag.toString());
                      });
                      if (calcGroupTag.length == 0) {
                        console.log("ERROR, no matching tag! in getNonFormulaValues param&flare");
                      }
                      found = calcGroupTag[0];
                      if (found.length === 0) {
                        thisDep.value = null
                        allData.push(thisDep)
                        return resolve()
                      }
                      try {
                        let expectsNum = tag.parameter.valueType === 'num' ? true : false;
                        if (expectsNum && isNaN(found.value)) found.value = 0;
                      } catch (error) { }
                      thisDep.value = found.value;
                    }
                    allData.push(thisDep);
                    return resolve();
                  }
                  //getArrayPiData(dependancy, endDate, orgOID, flareID, headerID = null, isDebug)

                  if (dep.type === 'parameter' && dep.parent === 'header') {
                    dep.value = []
                    const found = piTags.filter(tag => tag.parameter._id.toString() === dep.id.toString())
                    let isPri = null
                    if (dep.attr.includes('primary')) isPri = true
                    if (dep.attr.includes('secondary')) isPri = false
                    await Promise.all(headers.map(header => {
                      return new Promise((resolve, reject) => {
                        (async () => {
                          try {
                            const thisDep = { ...orgDep }
                            thisDep.parentid = header._id.toString()
                            let arr = await this.mongo.getArrayPiData(thisDep, date, orgOID, flareid, thisDep.parentid, isDebug)
                            if (arr) {
                              thisDep.value = arr;
                              allData.push(thisDep);
                              return resolve();
                            }
                            for (const tag of found) {
                              if (tag.header._id.toString() !== header._id.toString()) continue
                              if (isPri !== null && tag.sensor.isPrimary !== isPri) continue
                              if (dep.attr.includes('max')) {
                                thisDep.value = tag.max;
                                allData.push(thisDep);
                                return resolve();
                              }
                              if (dep.attr.includes('min')) {
                                thisDep.value = tag.min;
                                allData.push(thisDep);
                                return resolve();
                              }
                              let matchingCalcTag = calcGroup.data.filter(CGTag => {
                                return CGTag.piTag.toString() == tag._id.toString()
                              });
                              thisDep.value = matchingCalcTag[0].value; //tag.value.value
                              try {
                                let expectsNum = tag.parameter.valueType === 'num' ? true : false;
                                if (expectsNum && isNaN(thisDep.value)) thisDep.value = 0;
                              } catch (error) { }
                              allData.push(thisDep);
                              return resolve();
                            }
                            thisDep.value = null;
                            allData.push(thisDep);
                            return resolve();
                          } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.getNonFormulaValues()")) }
                        })();
                      })
                    }))
                    return resolve(dep)
                  }

                  if (dep.type === 'compoundGroup') {
                    dep.value = []
                    const cGroup = compoundGroups.filter(row => row.name === dep.param)[0]
                    headers.map(header => {
                      const thisDep = { ...orgDep }
                      thisDep.parentid = header._id.toString()
                      thisDep.value = []
                      for (const compound of cGroup.compounds) {
                        let value = null
                        let primaryMatch = null; //this is used for fractional. When any cems is okay to use as long as it's available, with a bias favoring primary                        
                        for (const tag of piTags) {
                          if (!tag.parameter.compound) continue
                          if (!(tag.parameter.compound.toString() === compound._id.toString())) {
                            continue;
                          }
                          if (tag.header._id.toString() !== header._id.toString()) continue
                          let matchingCalcTag = calcGroup.data.filter(CGTag => CGTag.piTag.toString() === tag._id.toString())[0];
                          const fracMapping = {
                            "mol%": 100,
                            "mol": 100,
                            "ppm": 1000000,
                            "ppb": 1000000000,
                          }
                          const div = fracMapping[tag.parameter.unitOfMeasure]
                          let expectsNum = tag.parameter.valueType === 'num' ? true : false;
                          if (expectsNum && isNaN(matchingCalcTag.value)) matchingCalcTag.value = 0;
                          matchingCalcTag.fracValue = div ? matchingCalcTag.value / div : matchingCalcTag.value
                          // if (tag.parameter.compound.toString() !== compound._id.toString()) continue
                          if (dep.attr.includes('netHeatingValue')) {
                            if (tag.sensor.isPrimary === true) {
                              /**
                               since netHeatingValue is like a constant of a compound, it
                               shouldn't matter what sensor (primary or secondary) you get the value
                               with. For units without multiple sensors, this is good, and in general too.
                               */
                              value = { value: compound.netHeatingValue, compound: compound.name }
                              break
                            }
                          }
                          if (dep.attr.includes('molecularWeight')) { //similar case to NHV above
                            if (tag.sensor.isPrimary === true) {
                              value = { value: compound.molecularWeight, compound: compound.name }
                              break
                            }
                          }
                          if (dep.attr.includes('fractional')) {
                            if (!dep.attr.includes('primary') && !dep.attr.includes('secondary')) { //when cems unit does not matter
                              if (tag.sensor.isPrimary === true) {
                                if (matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue)) break;
                                if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                                value = { id: header._id.toString(), value: matchingCalcTag.fracValue, compound: compound.name }
                                primaryMatch = true;
                                break;
                              } else { //is secondary
                                if (primaryMatch || matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue)) break;
                                if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                                value = { id: header._id.toString(), value: matchingCalcTag.fracValue, compound: compound.name }
                              }
                            }
                          }
                          if (dep.attr.includes('primary') || dep.attr.includes('primaryFractional')) {
                            if (tag.sensor.isPrimary === true) {
                              if (!(matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue))) {
                                if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                              }
                              value = { id: header._id.toString(), value: matchingCalcTag.fracValue, compound: compound.name }
                              break
                            } else { continue; }
                          }
                          if (dep.attr.includes('secondary') || dep.attr.includes('secondaryFractional')) {
                            if (tag.sensor.isPrimary === false) {
                              if (!(matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue))) {
                                if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                              }
                              value = { id: header._id.toString(), value: matchingCalcTag.fracValue, compound: compound.name }
                              break
                            } else { continue; }
                          }
                        }
                        if (!value) {
                          try {
                            value = compound[dep.attr[0]];
                            value = { value, compound: compound.name }
                          } catch (error) {
                            value = null
                            console.log("ERROR: issue with matching compound of compoundGroup")
                            console.log(error)
                          }
                        }
                        if (!value) { continue; }
                        // else console.log("value found!")
                        thisDep.value.push(value)
                      }
                      allData.push(thisDep)
                    })
                    return resolve()
                  }
                  return reject(getErrorObject({}, `LiveDataProcessor.getNonFormulaValues().promiseAll.Map: No matching type "${dep.type}"`))
                }
                catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.getNonFormulaValues().promiseAll.Map")) }
              })();
            });
          }))

          return resolve(allData);
        }
        catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.getNonFormulaValues()")) }
      })();
    });
  }

  /*
   * 
   * @param {ObjectId} flareid 
   * @param {*} depValues 
   * @param {*} formulas 
   * @param {*} calcGroup 
   */
  async getFormulaValues(flareid, depValues, sortedFormulas = null, date, orgOID, isDebug) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let isEventRuleDate = date.getMinutes() % 15 == 0;
          let allEventRules = this.mongo.allData.eventRules;
          let formulas = sortedFormulas;
          if (!formulas) formulas = await this.mongo.getSortedFormulas(); //i think this becomes redundant
          const headers = await this.mongo.getFlareHeaders(flareid);
          let results = [];

          /**
           * To increase speed, below we are seperating into groups that can run conncurently
           * where each larger number grouped is dependant on all previous smaller numbered groups
           */

          let loop_limit = 15;
          let currentGroup = 0;
          let formulaGroups = [];
          while (currentGroup < loop_limit) {
            let group = formulas.filter(f => f.sortedQueueOrder === currentGroup);
            if (!group) break;
            formulaGroups.push(group);
            currentGroup++
          }

          for (const formulaGroup of formulaGroups) {
            await Promise.all(formulaGroup.map(formula => {
              return new Promise((resolve, reject) => {
                (async () => {
                  try {
                    if (formula.eventRule) {
                      let ruleMatch = this.mongo.allData.eventRules[formula.eventRule._id.toString()];
                      if (!ruleMatch) console.log("No rule match for FORMULA: ", formula)
                      if (ruleMatch.resolution !== 1 && !isEventRuleDate) return resolve();
                    }
                    if (formula.to === 'headers') {
                      await Promise.all(headers.map(header => {
                        return new Promise((resolve, reject) => {
                          (async () => {
                            try {
                              const expression = formula.newFormula.match(/^=((.*)\s*)*/gm)[0].replace(/\n/gm, '');
                              const uniques = formula.vars.map(v => v.newUnique)
                              let eventRuleID = formula.eventRule === null ? null : formula.eventRule.toString();
                              let eventRule = eventRuleID === null ? null : allEventRules[eventRuleID];
                              const schema = {
                                formula: expression,
                                variables: {},
                                uniques,
                                formulaName: formula.name,
                                formulaId: formula._id,
                                parentName: header.name,
                                parentid: header._id,
                                to: "header",
                                ruleInfo: eventRule === null ? null : { eventRule },
                              }
                              await Promise.all(uniques.map(uni => {
                                return new Promise((resolve, reject) => {
                                  (async () => {
                                    try {
                                      const headerFound = depValues.filter(row => row.newUnique === uni && row.parentid === header._id.toString())
                                      const flareFound = depValues.filter(row => row.newUnique === uni && row.parentid.toString() === flareid.toString())
                                      const fVar = formula.vars.filter(row => row.newUnique === uni)[0]

                                      /* Turn the variable name in the formula to an array formula {} */
                                      if (headerFound.length === 0) {
                                        schema.variables[fVar.name] = null
                                      } else if (headerFound.length === 1) {

                                        if (headerFound[0].type === 'compoundGroup') {
                                          const replace = fVar.name;
                                          const re = new RegExp(replace, "gm");
                                          schema.formula = schema.formula.replace(re, `{${fVar.name}}`)
                                          if (headerFound[0].value.length === 0) {
                                            schema.variables[fVar.name] = null
                                          } else {
                                            schema.variables[fVar.name] = headerFound[0].value.map(v => { //Return undefined items as 0 AND only the value
                                              return v.value === undefined ? 0 : v.value
                                            })
                                          }
                                        } else {
                                          if (headerFound[0].attr.includes("eventRule_15") && headerFound[0].type === 'formula') {
                                            let headerArrVals = await this.mongo.getFormulaArrayValues(headerFound[0], isDebug, date, orgOID, flareid, header._id.toString());
                                            schema.variables[fVar.name] = headerArrVals;
                                          }
                                          else schema.variables[fVar.name] = headerFound[0].value;
                                        }
                                      } else {
                                        const replace = fVar.name;
                                        const re = new RegExp(replace, "gm");
                                        schema.formula = schema.formula.replace(re, `{${fVar.name}}`)
                                        schema.variables[fVar.name] = headerFound[0].value//.map(v=>v.value)
                                      }

                                      if (flareFound.length > 0) {
                                        schema.variables[fVar.name] = flareFound[0].value
                                      }
                                      return resolve();
                                    }
                                    catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.getFormulaValues().map2: ")) }
                                  })();
                                });
                              }))


                              let finalRes = null;
                              if (DIRECT_CALC) {
                                const params = {
                                  FunctionName: "flareReportingGetFormulaValue",
                                  InvocationType: "RequestResponse",
                                  Payload: JSON.stringify(schema),
                                };
                                finalRes = await Lambda.invoke(params).promise();
                                finalRes = JSON.parse(finalRes.Payload)
                              }
                              else finalRes = await axios.post(pythonURL, schema)
                              if (schema.ruleInfo !== null) { //Here we are getting the values to be passed to the Event Generator
                                if (schema.ruleInfo.eventRule.withValues) {
                                  let checkForID = schema.ruleInfo.eventRule.checkForValue.toString();

                                  // let matchingVar = formula.vars.find(v => {	
                                  //   return v.newUnique.includes(checkForID)	
                                  // })	
                                  // schema.ruleInfo.withValue = { value: schema.variables[matchingVar.name] }
                          
                                  let uniqueValIndex = 0;
                                  for (let uniqueEntry of schema.uniques) {
                                    if (uniqueEntry.includes(checkForID)) {
                                      schema.ruleInfo.withValue = { value: Object.values(schema.variables)[uniqueValIndex] }
                                      break;
                                    } else uniqueValIndex++;
                                  }
                                }
                                else {
                                  schema.ruleInfo.withValue = null;
                                }
                              }
                              //======================================================
                              let finalResValue = null
                              if (DIRECT_CALC) {
                                try {
                                  finalResValue = JSON.parse(finalRes.body);
                                  if (finalResValue !== null) {
                                    finalResValue = finalResValue.value;
                                  }
                                } catch (e) {
                                  console.log({ schema, finalResValue });
                                  return reject(getErrorObject(e, "MongoData.getArrayPiData())"));
                                }
                              }
                              else if (pythonURL.includes('amazonaws')) {
                                try {
                                  finalResValue = JSON.parse(finalRes.data.body);
                                  if (finalResValue !== null) {
                                    finalResValue = finalResValue.value;
                                  }
                                } catch (e) {
                                  console.log({ schema, finalResValue });
                                  return reject(getErrorObject(e, "MongoData.getArrayPiData())"));
                                }
                              } else {
                                finalResValue = finalRes.data.value
                              }
                              //======================================================
                              schema.value = finalResValue
                              const targetFormulaDeps = depValues.filter(row => row.id.toString() === formula._id.toString() && row.parentid === header._id.toString())
                              for (const tdep of targetFormulaDeps) {
                                tdep.value = schema.value
                              }
                              results.push(schema);
                              return resolve();
                            }
                            catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.getFormulaValues().map1: ")) }
                          })();
                        });
                      })
                      )
                    }
                    else {
                      const expression = formula.newFormula.match(/^=((.*)\s*)*/gm)[0].replace(/\n/gm, '');
                      const uniques = formula.vars.map(v => v.newUnique);
                      let eventRuleID = formula.eventRule === null ? null : formula.eventRule.toString();
                      let eventRule = eventRuleID === null ? null : allEventRules[eventRuleID];
                      const schema = {
                        formula: expression,
                        variables: {},
                        uniques,
                        formulaName: formula.name,
                        formulaId: formula._id,
                        to: "flare",
                        ruleInfo: eventRule === null ? null : { eventRule },
                      }

                      await Promise.all(uniques.map(uni => {
                        return new Promise((resolve, reject) => {
                          (async () => {
                            try {
                              const fVar = formula.vars.find(row => row.newUnique === uni)
                              if (fVar.to === 'headers') {
                                const headerValues = []
                                for (const header of headers) {
                                  const headerFound = depValues.filter(row => row.newUnique === uni && row.parentid === header._id.toString())[0]
                                  if (headerFound) {
                                    if (headerFound.attr.includes("eventRule_15") && headerFound.type === 'formula') {
                                      let res = await this.mongo.getFormulaArrayValues(headerFound, isDebug, date, orgOID, flareid, header._id.toString());
                                      headerValues.push(res)
                                    } else {
                                      headerValues.push(headerFound.value)
                                    }
                                  } else {
                                    headerValues.push(null)
                                  }
                                }
                                if (headerValues.length === 0) {
                                  schema.variables[fVar.name] = null
                                } else if (headerValues.length === 1) {
                                  schema.formula = schema.formula.replace(fVar.name, `{${fVar.name}}`)
                                  schema.variables[fVar.name] = headerValues
                                } else {
                                  schema.formula = schema.formula.replace(fVar.name, `{${fVar.name}}`)
                                  schema.variables[fVar.name] = headerValues
                                }
                              } else {
                                const flareDepFound = depValues.find(row => row.newUnique === uni && row.parentid.toString() === flareid.toString())
                                try {
                                  if (flareDepFound.attr.includes("eventRule_15") && flareDepFound.type === 'formula') {
                                    schema.variables[fVar.name] = await this.mongo.getFormulaArrayValues(flareDepFound, isDebug, date, orgOID, flareid);
                                  }
                                  else schema.variables[fVar.name] = flareDepFound.value

                                } catch (error) {
                                  console.log("Error getting formula array values:")
                                  console.log(flareDepFound, depValues, uni)
                                  throw error
                                }
                              }
                              return resolve();
                            }
                            catch (error) { return reject(getErrorObject(error, "Error in LiveDataProcessor.getCalcGroups().map3: ")) }
                          })();
                        });
                      }))

                      const targetFormulaDeps = depValues.filter(row => row.id.toString() === formula._id.toString())

                      let finalRes = null;
                      if (DIRECT_CALC) {
                        const params = {
                          FunctionName: "flareReportingGetFormulaValue",
                          InvocationType: "RequestResponse",
                          Payload: JSON.stringify(schema),
                        };
                        finalRes = await Lambda.invoke(params).promise();
                        finalRes = JSON.parse(finalRes.Payload)
                      }
                      else finalRes = await axios.post(pythonURL, schema)
                      if (schema.ruleInfo !== null) { //Here we are getting the values to be passed to the Event Generator
                        if (schema.ruleInfo.eventRule.withValues) {
                          let checkForID = schema.ruleInfo.eventRule.checkForValue.toString();

                          // let matchingVar = formula.vars.find(v => {	
                          //   return v.newUnique.includes(checkForID)	
                          // })	
                          // schema.ruleInfo.withValue = { value: schema.variables[matchingVar.name] }

                          let uniqueValIndex = 0;
                          for (let uniqueEntry of schema.uniques) {
                            if (uniqueEntry.includes(checkForID)) {
                              schema.ruleInfo.withValue = { value: Object.values(schema.variables)[uniqueValIndex] }
                              break;
                            } else uniqueValIndex++;
                          }
                        }
                        else {
                          schema.ruleInfo.withValue = null;
                        }

                      }
                      //==========================================
                      let finalResValue = null
                      if (DIRECT_CALC) {
                        try {
                          finalResValue = JSON.parse(finalRes.body);
                          if (finalResValue !== null) {
                            finalResValue = finalResValue.value;
                          }
                        } catch (e) {
                          console.log({ schema, finalResValue });
                          return reject(getErrorObject(e, "MongoData.getArrayPiData())"));
                        }
                      }
                      else if (pythonURL.includes('amazonaws')) {
                        finalResValue = JSON.parse(finalRes.data.body);
                        if (finalResValue !== null) {
                          finalResValue = finalResValue.value;
                        }
                      } else {
                        finalResValue = finalRes.data.value
                      }
                      //============================================
                      schema.value = finalResValue
                      // console.log("FLARE CALC: ", {flare:flareid} ,schema)
                      for (const tdep of targetFormulaDeps) {
                        tdep.value = schema.value
                      }
                      results.push(schema);
                    }
                    if (DEBUG_2) console.log(`done with ${formula.name}`)
                    return resolve()
                  } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.getFormulaValues().formulaGroupLoop: ")) }
                })()
              })
            }))
          }




          // for (const formula of formulas) {

          // }
          return resolve(results);
        }
        catch (error) { return reject(getErrorObject(error, "LiveDataCalculator.getFormulaValues(): ")) }
      })();
    });
  }

  async getFullCalcGroups(timestamps, org, isDebug) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          org = new ObjectId(org)
          let dates = timestamps.map(ts => new Date(ts));
          let dateChunks = chunkArray(dates, 10);
          let queryResults = [];
          let numTags = this.mongo.allData.piTags.length;
          let collection = PiValue;
          if (isDebug) collection = PiValuesDebug;
          for (const chunk of dateChunks) {
            let data = await Promise.all(chunk.map(date => {
              return new Promise((resolve, reject) => {
                (async () => {
                  try {
                    let res = await collection.find({ date, org }).select("-_id piTag value").lean().exec();
                    let isComplete = this.mongo.allData.piTags.every(tag => {
                      let tagMatched = false;
                      for (let i = 0; i < res.length; i++) {
                        if (res[i].piTag.toString() === tag._id.toString()) tagMatched = true;
                      }
                      if (!tagMatched) res.push({ "piTag": tag._id.toString(), "value": null }); //if unmatched or not found, give it a null
                      return true //This needs to be fixed. since we added new tags, we should just fill with null and push. Also, should use loop rather than Array.every()...
                    })
                    return resolve({ "groupDt": date, "data": res });
                  } catch (error) {
                    return reject({ printPath: "LiveDataProcessor.getFullCalcGroups().map: ", error });
                  }
                })();
              })
            }));
            queryResults.push(data);
          }
          queryResults = queryResults.flat().filter(grp => grp);
          return resolve(queryResults);
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "LiveDataProcessor.getFullCalcGroups(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "LiveDataProcessor.getFullCalcGroups(): ", error });
        }
      })();
    });

  }

  async processCalcGroup(calcGroup, flareOID, orgOID, isDebug, info) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // const start_processCalcGroup = new Date()
          let date = calcGroup.groupDt;
          //** New Parsing Logic Starts **********************************************************/
          // const start_getNonFormulaValues = new Date()
          const depValues = await this.getNonFormulaValues(flareOID, info.allFormulasDepends, calcGroup, orgOID, isDebug);
          // printElapsedTime(start_getNonFormulaValues, `getNonFormulaValues ${flareOID.toString()}\n`)

          // const start_getFormulaValues = new Date()
          let formulaObjects = await this.getFormulaValues(flareOID, depValues, info.sortedFormulas, calcGroup.groupDt, orgOID, isDebug) //dep values are objects that store respective values for formula calcs. 
          // printElapsedTime(start_getFormulaValues, `getFormulaValues ${flareOID.toString()}\n`)

          // const start_calcRemain = new Date()
          const bulkUpdates = [];
          const ruleUpdates = [];
          let is15MinDate = date.getMinutes() % 15 === 0;
          await Promise.all(formulaObjects.map(async (formula) => {
            let resolution = 1;
            if (formula.ruleInfo) {
              resolution = formula.ruleInfo.eventRule.resolution;
              if (resolution === 15 && !is15MinDate) return;
            }
            const startDate = new Date(date);
            startDate.setMinutes(startDate.getMinutes() - resolution);
            const dbSchema = {
              date: date,
              start: startDate,
              org: orgOID,
              formula: formula.formulaId,
              value: formula.value,
              flare: flareOID,
              header: formula.to === 'header' ? formula.parentid : null,
              debug: isDebug,
            }
            let isEventRuleRelated = this.mongo.allData.eventRuleFormulaIDs[formula.formulaId.toString()] !== undefined;
            if (isEventRuleRelated) {
              if (formula.ruleInfo) { // it is an eventrule formula value itself
                ruleUpdates.push({ updateInfo: dbSchema, ruleInfo: formula.ruleInfo });
              }
              //else if it is a withValue that should be sent with a rule
              else if (this.mongo.allData.withValuesToEventRuleMap[formula.formulaId.toString()] !== undefined) {
                let sentWithRule = false;
                for (let rule of this.mongo.allData.withValuesToEventRuleMap[formula.formulaId.toString()]) {
                  if ((rule.resolution === 15 && is15MinDate) || rule.resolution === 1) {
                    sentWithRule = true;
                    ruleUpdates.push({ updateInfo: dbSchema, ruleInfo: formula.ruleInfo });
                  }
                  break;
                }
                if (!sentWithRule) bulkUpdates.push(dbSchema); //case: is part of a off-time rule (a 1-min formula also used by a 15min rule) but is itself a regular formula that should always send
              }
            }
            else {
              bulkUpdates.push(dbSchema);
            }
          }))
          // printElapsedTime(start_calcRemain, `calcRemain ${flareOID.toString()}\n`)
          // printElapsedTime(start_processCalcGroup, `processCalcGroup ${flareOID.toString()}\n`)
          return resolve({ bulkUpdates, ruleUpdates });
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "LiveDataProcessor.processCalcGroup().map: ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "LiveDataProcessor.processCalcGroup().map: ", error });
        }
      })();
    });
  }

  /**
  * Helper function for uploading bulk data to mongo
  * @param {Boolean} isDebug 
  * @param {Object} ops 
  * @returns 
  */
  async _bulkUpload_(isDebug, ops) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (ops.length == 0) return resolve();
          let collection = isDebug ? DebugFormulaValue : FormulaValue;
          let res = await collection.bulkWrite(ops);
          return resolve(res);
        } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor._bulkUpload_():")) }
      })();
    })
  }

  /**
  * Helper function for preparing bulk payloads to upload to mongo
  * @param {Object} bulkData
  * @returns 
  */
  async _bulkPrepare_(bulkData) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let bulkOps = await Promise.all(bulkData.map(datum => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  const { date, start, org, formula, value, flare, header, debug } = datum;
                  let filter = { formula, date, org, flare, header };
                  let update = { '$set': { start, value } };
                  return resolve({
                    "op": { "updateOne": { filter, update, upsert: true } },
                    debug
                  });
                }
                catch (error) { return reject({ printPath: "LiveDataProcessor.uploadFormulaValues()._bulkPrepare_.map: ", error }) }
              })()
            })
          }))
          let debugOps = [];
          let prodOps = [];
          bulkOps.forEach(op => {
            if (op.debug === undefined) {
              console.log("ops have debug field == undefined");
              throw new Error("bulkops have debug as undefined");
            }
            if (op.debug) {
              debugOps.push(op.op);
            }
            else prodOps.push(op.op);
          });
          return resolve({ debugOps, prodOps });
        } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor._bulkPrepare_():")) }
      })();
    })
  }

  /**
   * Send data to SQS for proccessing by the event generator
   * @param {Array} ruleData This must be an array of arrays (max len of 10 per inner-array) 
   * @returns 
   */
  async _RuleDataToSQS_(ruleData) { //comes in as 10-max chunked array of arrays; SQS bulk has a max of 10/send
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (SQS_DEBUG) {
            console.log("arrays to send to sqs: ", ruleData.length);
            if (ruleData.length > 0) {
              let numItems = 0
              for (let a of ruleData) {
                for (let e of a) {
                  numItems++;
                }
              }
              console.log("Items to upload: ", numItems)
              console.log("sample item: ", ruleData[0][0])
            }
          }
          if (ruleData.length == 0) return resolve();
          return resolve();
        } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor._RuleDataToSQS_():")) }
      })();
    })
  }

  /**
   * This is the new logic that handles collecting the OIDs of the saved formula values that 
   * are relevant for the event generator. It will also build the needed schemas to send/invoke the
   * lambda function for the event generator
   * @param ruleData
   */
  async _rulePrepareAndUpload_(ruleData) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let options = { "upsert": true, "new": true }
          let ruleDataWithNumValues = ruleData.filter((entry) => entry.ruleInfo === null) //we are going to bulk upload these
          let ruleData_Non1Min = ruleData.filter((entry) => {
            if (entry.ruleInfo !== null) {
              return (entry.ruleInfo.eventRule.resolution > 1)
            }
            return false
          }) //We need to upload non-1-min data (mostly 15-min) with their contituent withValues for reporting
          let ruleData_1Min = ruleData.filter((entry) => {
            if (entry.ruleInfo !== null) {
              return (entry.ruleInfo.eventRule.resolution === 1)
            }
            return false
          }) // we are going ot wait for the bulks to finish so we can pull their values along with their neighbors


          //findAndUpdate the withValue (chunkedRuleNumData) data second
          let ruleDataWithNumValuesOps = ruleDataWithNumValues.map(period => {
            const { date, start, org, formula, value, flare, header, debug } = period.updateInfo;
            let filter = { formula, date, org, flare, header };
            let update = { '$set': { start, value } };
            return {
              "op": { "updateOne": { filter, update, upsert: true } },
              debug
            }
          });
          let debugOps = ruleDataWithNumValuesOps.filter(op => op.debug)
          let prodOps = ruleDataWithNumValuesOps.filter(op => (!op.debug))
          debugOps = debugOps.map(op => op.op)
          prodOps = prodOps.map(op => op.op)
          await Promise.all([this._bulkUpload_(true, debugOps), this._bulkUpload_(false, prodOps)]);

          let OneMinOps = ruleData_1Min.map(period => {
            const { date, start, org, formula, value, flare, header, debug } = period.updateInfo;
            let filter = { formula, date, org, flare, header };
            let update = { '$set': { start, value } };
            return {
              "op": { "updateOne": { filter, update, upsert: true } },
              debug
            }
          });
          debugOps = OneMinOps.filter(op => op.debug)
          prodOps = OneMinOps.filter(op => (!op.debug))
          debugOps = debugOps.map(op => op.op)
          prodOps = prodOps.map(op => op.op)
          await Promise.all([this._bulkUpload_(true, debugOps), this._bulkUpload_(false, prodOps)]);

          let promises = ruleData_Non1Min.map(period => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  // console.log("period: ", period)
                  const { date, start, org, formula, value, flare, header, debug } = period.updateInfo;
                  let filter = { formula, date, org, flare, header };
                  let update = null;
                  if (period.ruleInfo.eventRule.withValues) {
                    let checkForValue = period.ruleInfo.eventRule.checkForValue.toString();
                    if (!checkForValue) throw new Error("Could not access period's rule's checkForValue: ", period)
                    let dependancyInput = { id : checkForValue }
                    let withValues = await this.mongo.getFormulaArrayValues(dependancyInput, debug, date, org, flare, header, period.ruleInfo.eventRule.resolution, false, false);
                    withValues = withValues.map(e => {
                      if (isNaN(e.value)) e.value = null;
                      return {
                        valID: e._id,
                        value: e.value,
                      }
                    })
                    update = { '$set': { start, value, withValues } };
                  } else {
                    update = { '$set': { start, value } };
                  }
                  const op = {
                    "op": { "updateOne": { filter, update, upsert: true } },
                    debug
                  }
                  return resolve(op)
                } catch (e) { return reject(getErrorObject(e, "_rulePrepareAndUpload_.map:")) }
              })();
            })
          })
          let ops = await Promise.all(promises);
          debugOps = ops.filter(op => op.debug)
          prodOps = ops.filter(op => (!op.debug))
          debugOps = debugOps.map(op => op.op)
          prodOps = prodOps.map(op => op.op)
          await Promise.all([this._bulkUpload_(true, debugOps), this._bulkUpload_(false, prodOps)]);
          return resolve()
        } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor._rulePrepare_():")) }
      })();
    })
  }

  async _bulkPrepareAndUpload_(bulkData) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let { debugOps, prodOps } = await this._bulkPrepare_(bulkData);
          let res = await Promise.all([this._bulkUpload_(true, debugOps), this._bulkUpload_(false, prodOps)]);
          if (DEBUG_1 || UPLOAD_DEBUG) console.log("bulkOps: ", res);
          resolve();
        } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.uploadFormulaValues():")) }
      })();
    });
  }

  async uploadFormulaValues(data) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let bulkData = [];
          let ruleData = [];
          //split so we can get IDs and forward rule-related data to the event generator 
          for (let flareGroup of data) {
            bulkData = bulkData.concat(flareGroup.bulkUpdates);
            ruleData = ruleData.concat(flareGroup.ruleUpdates);
          }
          let promises = [this._rulePrepareAndUpload_(ruleData), this._bulkPrepareAndUpload_(bulkData)]
          await Promise.all(promises);
          return resolve();
        } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.uploadFormulaValues():")) }
      })();
    });
  }

  async processOnAllFlares(allFlares, processingChunks, orgOid, payload, info) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let allFlaresDataToUpload = await Promise.all(allFlares.map(flare => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  let flareDataToUpload = await this.processOnSelectFlare(flare._id, processingChunks, orgOid, payload, info)
                  resolve(flareDataToUpload);
                } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.processOnAllFlares().flares")) }
              })();
            })
          }))
          return resolve(allFlaresDataToUpload);
        } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.processOnAllFlares()")) }
      })();
    })
  }

  async processOnSelectFlare(flareID, processingChunks, orgOid, payload, info) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let flareOID = ObjectId(flareID);
          // console.log("processOnSelectFlare: ", arguments)
          let groupedCalcGroupsToUpdate = await Promise.all(processingChunks.map(chunk => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {

                  let calcGroupsToUpdate = await Promise.all(chunk.map(calcGroup => {
                    return new Promise((resolve, reject) => {
                      (async () => {
                        try {
                          let dataToUpload = await this.processCalcGroup(calcGroup, flareOID, orgOid, payload.d, info);
                          return resolve(dataToUpload);
                        }
                        catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.processOnSelectFlare().map2()")) }
                      })();
                    })
                  }))
                  return resolve(calcGroupsToUpdate);
                }
                catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.processOnSelectFlare().map1()")) }
              })();
            })
          }))
          return resolve(groupedCalcGroupsToUpdate);
        } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.processOnSelectFlare()")) }
      })();
    })
  }


  /**
   * This class is effectively the 'main' of this class
   * @param {} event 
   */
  async processNewEvent(event) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let start_Main;
          if (DEBUG_TIMER) start_Main = new Date();
          let payload = event;
          let orgOid = new ObjectId(payload.o);

          // try { //Temp fix to speed up live-only data that excludes the backlogs
          //   let collection = FormulaValue;
          //   if (payload.d) collection = DebugFormulaValue;
          //   let valMatch = await collection.findOne({ date: new Date(payload.t[0]), org: new ObjectId(payload.o) }).select('_id').lean().exec();
          //   if (valMatch !== null && !LOCAL_ENV) {
          //     // console.log("Match found. Skipping.");
          //     return resolve();
          //   }
          // }
          // catch (error) {
          //   console.log("ERROR: trouble with checking for calculated value.", error);
          //   throw error;
          // }

          // const start_getFullCalcGroup = new Date();
          let calcGroups = await this.getFullCalcGroups(payload.t, payload.o, payload.d);
          // console.log({calcGroups})
          // printElapsedTime(start_getFullCalcGroup, "getFullCalcGroups")

          if (DEBUG_2) console.log("Num Calc Groups: ", calcGroups.length);
          // const start_getAllData = new Date();
          if (this.mongo.allData == null) {
            await this.mongo.getAllData();
          }
          let formulas = await this.mongo.getSortedFormulas(orgOid);
          // printElapsedTime(start_getAllData, "getAllData")

          let sortedFormulas = formulas; //added because needed. Unsure if should be cloned. check for pointer usage by others.

          // const start_getAllFormulasDepends = new Date();
          let allFormulasDepends = await this.mongo.getAllFormulasDepends(formulas, orgOid); // saved to allData.allDependants
          const processingChunks = chunkArray(calcGroups, 30);
          let allFlares = this.mongo.allData.flares;
          // printElapsedTime(start_getAllFormulasDepends, "getAllFormulasDepends")

          // const start_checkAllData = new Date();
          await this.mongo.checkAllData(orgOid);
          // printElapsedTime(start_checkAllData, "checkAllData")

          let info = { sortedFormulas, allFormulasDepends };


          // const start_processOnAllFlares = new Date();
          let dataToUpload = await this.processOnAllFlares(allFlares, processingChunks, orgOid, payload, info);
          // printElapsedTime(start_processOnAllFlares, "processOnAllFlares")
          dataToUpload = dataToUpload.flat(2);
          if (!LOCAL_ENV || SAVE_VALUES) await this.uploadFormulaValues(dataToUpload)
          else if (DEBUG_1) {
            console.log("Printing Records: ")
            for (let i of dataToUpload) {
              console.log("Bulk Updates: ")
              for (let x of i.bulkUpdates) {
                console.log(x);
              }
              console.log("Rule Updates: ")
              for (let y of i.ruleUpdates) {
                console.log(y);
                // if (y.ruleInfo) console.log(y.ruleInfo.withValue)
              }
            }
          } //console.log("DATA TO BE UPLOADED: ", dataToUpload)


          if (DEBUG_TIMER) printElapsedTime(start_Main, "All")

          return resolve();
        }
        catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.processNewEvent(): ")) }
      })();
    });
  }

}

const chunkArray = (arr, chunkLen) => {
  var chunks = [],
    i = 0,
    n = arr.length;
  while (i < n) {
    chunks.push(arr.slice(i, (i += chunkLen)));
  }
  return chunks;
}

// exports.handler = async (event) => {
  async function mymain(event) {
  if (DEBUG_0) console.log("event: ", event)
  console.log("event: ", event)
  let payload = {};
  try {

    if ("retDateString" in event) payload = event
    else if (!LOCAL_ENV) payload = JSON.parse(event.Records[0].body);
    else payload = event
    // console.log("Payload: ", typeof payload, payload);
    if (PROCESSOR == null) {
      PROCESSOR = new LiveDataProcessor();
      await PROCESSOR.initClass(payload); //I think it only uses the org initially.
    }
    if (PROCESSOR.mongo.mongooseStatus() == 0) await PROCESSOR.initClass(payload);
    let processingDisplay = null;
    processingDisplay = payload.p
    if (DEBUG_1 || DEBUG_2) console.log(`Processing: ${processingDisplay}`);
    let result = await PROCESSOR.processNewEvent(payload);
    if (DEBUG_1 || DEBUG_2) console.log(`Done Processing: ${processingDisplay}`);
    if (LOCAL_ENV) {
      console.log("Closing Client...");
      await MongoData.closeClient();
    }
    const response = {
      statusCode: 200,
      body: JSON.stringify({ "processedDate": payload.retDateString }),
    }
    console.log("response: ", response)
    return response;
  }
  catch (error) {
    let logError = error;
    if (error.hasOwnProperty('printPath')) {
      console.log(`Error at: main():${error.printPath}`);
      console.log(`Stack: ${error.error.stack}`);
      let stack = JSON.stringify(error.error.stack);
      if (stack.length > 200) stack = stack.substring(0, 200)
      logError = { path: error.printPath, stack };
    }
    else {
      console.log("Error in main(): ", error);
    }
    /*Send error to logger lambda*/
    if (!LOCAL_ENV) {
      try {
        let stream = "LiveDataCalc";
        const params = {
          FunctionName: "generalCloudWatchLogger",
          InvocationType: "Event",
          Payload: JSON.stringify({ "payload": { "error": logError, "event": event }, "logStream": stream, "logGroup": "FlareToolLambdaErrors" }),
        };
        await Lambda.invoke(params).promise();
        return { statusCode: 400 };
      } catch (error) {
        console.log("ERROR with invoking lambda logger: ", error);
        return { statusCode: 400 };
      }
    }
    try {
      console.log("Closing client...");
      await MongoData.closeClient();
      return { statusCode: 400 };
    }
    catch (error) {
      console.log("Error closing client: ", error);
      return { statusCode: 400 };
    }
  }
}

let input = {
  p: 'FI6176A',
  v: [
    123
  ],
  t: [
    1579042800000
  ],
  d: false,
  o: '5fb6b7ea6b029226f07d2677',
  retDateString: '2020-01-14T22:46:00.000Z - 2020-01-15T13:45:00.000Z'
}

mymain(input)