const AWS = require('aws-sdk');
const Lambda = new AWS.Lambda();
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
const {spawn} = require('child_process');

axios.defaults.httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 3000 })
axios.defaults.httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 3000 })

let PROCESSOR = null;
const DEBUG_TIMER = false;
const LOCAL_CALC = true;
const DEBUG_2 = false; //More logging
const DEBUG_1 = false; //Less logging
const LOCAL_ENV = true; //diffrent kinds of processing needed. Like parsing a json object or not.
const SAVE_VALUES = false; //save the values you calculate
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
                    if (dep.attr.includes('fractional') || dep.attr.includes('primaryFractional') || dep.attr.includes('secondaryFractional')) {
                      headers.map(header => {
                        const thisDep = { ...orgDep }
                        thisDep.parentid = header._id.toString()
                        thisDep.value = null;
                        let value = null;
                        let primaryMatch = null;
                        // let secondaryMatch = null;
                        for (const tag of piTags) {
                          if (!tag.parameter.compound) continue;
                          if (!(tag.parameter.compound.toString() == found._id.toString())) {
                            continue;
                          }
                          let matchingCalcTag = calcGroup.data.filter(CGTag => CGTag.piTag.toString() == tag._id.toString())[0];
                          const fracMapping = {
                            "mol%": 100,
                            "mol": 100,
                            "ppm": 1000000,
                            "ppb": 1000000000,
                          }
                          const div = fracMapping[tag.parameter.unitOfMeasure]
                          matchingCalcTag.fracValue = div ? matchingCalcTag.value / div : matchingCalcTag.value
                          // if (tag.parameter.compound.toString() !== compound._id.toString()) continue
                          if (tag.header._id.toString() !== header._id.toString()) continue
                          if (dep.attr.includes('fractional')) {
                            if (!dep.attr.includes('primary') && !dep.attr.includes('secondary')) {
                              if (tag.sensor.isPrimary === true) {
                                if (matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue)) break;
                                if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                                value = matchingCalcTag.fracValue //{ id: header._id.toString(), value: matchingCalcTag.fracValue, compound: found.name }
                                primaryMatch = true;
                                break;
                              } else { //is secondary
                                if (primaryMatch || matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue)) break;
                                if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                                value = matchingCalcTag.fracValue //{ id: header._id.toString(), value: matchingCalcTag.fracValue, compound: found.name }
                              }
                            }
                          }
                          if (dep.attr.includes('primary') || dep.attr.includes('primaryFractional')) {
                            if (tag.sensor.isPrimary === true) {
                              if (!(matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue))) {
                                if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                              }
                              value = matchingCalcTag.fracValue //{ id: header._id.toString(), value: matchingCalcTag.fracValue, compound: found.name }
                              break
                            }
                          }
                          if (dep.attr.includes('secondary') || dep.attr.includes('secondaryFractional')) {
                            if (tag.sensor.isPrimary === false) {
                              if (!(matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue))) {
                                if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                              }
                              value = matchingCalcTag.fracValue //{ id: header._id.toString(), value: matchingCalcTag.fracValue, compound: found.name }
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
                      let calcGroupTag = calcGroup.data.filter(tagValPair => {
                        return (found[0]._id.toString() == tagValPair.piTag.toString());
                      });
                      if (calcGroupTag.length == 0) console.log("ERROR, no matching tag! in getNonFormulaValues param&flare");
                      found = calcGroupTag[0];
                      if (found.length === 0) {
                        thisDep.value = null
                        allData.push(thisDep)
                        return resolve()
                      }
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
                        let primaryMatch = null;
                        for (const tag of piTags) {
                          if (!tag.parameter.compound) continue
                          if (!(tag.parameter.compound.toString() == compound._id.toString())) {
                            continue;
                          }
                          let matchingCalcTag = calcGroup.data.filter(CGTag => CGTag.piTag.toString() == tag._id.toString())[0];
                          const fracMapping = {
                            "mol%": 100,
                            "mol": 100,
                            "ppm": 1000000,
                            "ppb": 1000000000,
                          }
                          const div = fracMapping[tag.parameter.unitOfMeasure]
                          matchingCalcTag.fracValue = div ? matchingCalcTag.value / div : matchingCalcTag.value
                          // if (tag.parameter.compound.toString() !== compound._id.toString()) continue
                          if (tag.header._id.toString() !== header._id.toString()) continue

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
                            if (!dep.attr.includes('primary') && !dep.attr.includes('secondary')) {
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
                            }
                          }
                          if (dep.attr.includes('secondary') || dep.attr.includes('secondaryFractional')) {
                            if (tag.sensor.isPrimary === false) {
                              if (!(matchingCalcTag.fracValue == null || isNaN(matchingCalcTag.fracValue))) {
                                if (matchingCalcTag.fracValue < 0) matchingCalcTag.fracValue = 0;
                              }
                              value = { id: header._id.toString(), value: matchingCalcTag.fracValue, compound: compound.name }
                              break
                            }
                          }
                          try {
                            value = compound[dep.attr[0]];
                            value = {value, compound: compound.name}
                            break;
                          } catch(error) {
                            console.log("ERROR: issue with matching compound of compoundGroup")
                            console.log(error)
                          }
                        }
                        if (!value) { continue;}
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

  async doCalculation(schema) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let payload = JSON.stringify(schema)
          const path = 'utils/temp/liveDataCalculator/dev-local-full/calc.py'
          const process = spawn('python', [path, payload]);

          const output = [];
          process.stdout.on('data', (data) => {
              output.push(data.toString())
            }
          );

          const err = []
          process.stderr.on('data', (data) => {
            err.push(data.toString());
          });

          process.on('exit', (code, signal) => {
            // console.log("exit: ", `${code} ${signal}`)
            if (code === 0) {
              return resolve(output[0])
              // resolve(JSON.parse(output[0]))
            } else {
              resolve(new Error("Erick made this error up"))
            }
          })
        } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.doCalculation()")) }
      })();
    });
  }

  /**
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
          while(currentGroup < loop_limit) {
            let group = formulas.filter(f => f.sortedQueueOrder === currentGroup);
            if(!group) break;
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
                                            schema.variables[fVar.name] = headerFound[0].value.map(v => v.value)
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
                                    catch (error) { return reject(getErrorObject(error,"LiveDataProcessor.getFormulaValues().map2: ")) }
                                  })();
                                });
                              }))
        
                              const finalRes =  await this.doCalculation(schema)//axios.post(pythonURL, schema)
                              if (schema.ruleInfo !== null) { //Here we are getting the values to be passed to the Event Generator
                                if (schema.ruleInfo.eventRule.withValues) {
                                  let checkForID = schema.ruleInfo.eventRule.checkForValue.toString();
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
                              if (LOCAL_CALC) {
                                finalResValue = JSON.parse(finalRes);
                                finalResValue = finalRes === null ? null : finalResValue.body;
                                // console.log({finalResValue}, typeof finalResValue)
                              }
                              else if (pythonURL.includes('amazonaws')) {
                                try {
                                  
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
                            catch (error) { return reject(getErrorObject(error,"LiveDataProcessor.getFormulaValues().map1: ")) }
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
                                    headerValues.push(headerFound.value)
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
                                  if (flareDepFound.attr.includes("eventRule_15")  && flareDepFound.type === 'formula') {
                                    schema.variables[fVar.name] = await this.mongo.getFormulaArrayValues(flareDepFound, isDebug, date, orgOID, flareid);
                                  }
                                  else schema.variables[fVar.name] = flareDepFound.value
        
                                } catch(error) {
                                  console.log("Error getting formula array values:")
                                  console.log(flareDepFound, depValues, uni)
                                  throw error
                                }
                              }
                              return resolve();
                            }
                            catch (error) { return reject(getErrorObject(error,"Error in LiveDataProcessor.getCalcGroups().map3: ")) }
                          })();
                        });
                      }))
        
                      const targetFormulaDeps = depValues.filter(row => row.id.toString() === formula._id.toString())
                      const finalRes = await this.doCalculation(schema) //axios.post(pythonURL, schema)
                      if (schema.ruleInfo !== null) { //Here we are getting the values to be passed to the Event Generator
                        if (schema.ruleInfo.eventRule.withValues) {
                          let checkForID = schema.ruleInfo.eventRule.checkForValue.toString();
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
                      if (LOCAL_CALC) {
                        finalResValue = JSON.parse(finalRes);
                        finalResValue = finalRes === null ? null : finalResValue.body;
                        // console.log({finalResValue}, typeof finalResValue)
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
                      for (const tdep of targetFormulaDeps) {
                        tdep.value = schema.value
                      }
                      results.push(schema);
                    }
                    if (DEBUG_2) console.log(`done with ${formula.name}`)
                    return resolve()
                  } catch (error) { return reject(getErrorObject(error,"LiveDataProcessor.getFormulaValues().formulaGroupLoop: ")) }
                })()
              })
            }))
          }




          // for (const formula of formulas) {
            
          // }
          return resolve(results);
        }
        catch (error) { return reject(getErrorObject(error,"LiveDataCalculator.getFormulaValues(): ")) }
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
                    if (res.length < numTags) return resolve();
                    let isComplete = this.mongo.allData.piTags.every(tag => {
                      let tagMatched = false;
                      for (let i = 0; i < res.length; i++) {
                        if (res[i].piTag.toString() == tag._id.toString()) tagMatched = true;
                      }
                      if (!tagMatched && isTest) res.push({ "piTag": tag._id.toString(), "value": null }); //if unmatched or not found, give it a null
                      return tagMatched
                    })
                    if (isComplete) return resolve({ "groupDt": date, "data": res });
                    else return resolve()
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
          let is15MinDate = date.getMinutes() % 15 == 0;
          await Promise.all(formulaObjects.map(async (formula) => {
            let resolution = 1;
            if (formula.ruleInfo) {
              resolution = formula.ruleInfo.eventRule.resolution;
              if (resolution == 15 && !is15MinDate) return;
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
              header: formula.to === 'header' ? formula. parentid : null,
              debug: isDebug,
            }
            let isEventRuleRelated = this.mongo.allData.eventRuleFormulaIDs[formula.formulaId.toString()] !== undefined
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
                  let update = { '$set' : { start, value } };
                  return resolve({
                    "op": { "updateOne": { filter, update, upsert : true } },
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
          // console.log("rule data: ", ruleData)
          if (ruleData.length == 0) return resolve();

          for (const arr of ruleData) {
            var params = {
              QueueUrl: process.env.RULE_GEN_SQS_URL,
              Entries: []
            };
            for (const message of arr) {
              // console.log(message)
              // if (message.ruleInfo) console.log(message.ruleInfo.withValue)
              params.Entries.push({
                Id: uuidv4(),
                MessageBody: JSON.stringify(message)
              });
            }
            if (!LOCAL_ENV || FORWARD_TO_SQS){
              await SQS.sendMessageBatch(params).promise();
            } 
          }
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
          let ruleDataWithNumValues = ruleData.filter((entry) => entry.ruleInfo === null); //is the withValues itself
          ruleData = ruleData.filter((entry) => entry.ruleInfo !== null)

          //Chunk the data so we don't overwhelm the number of queries/connections
          let chunkedRuleData = chunkArray(ruleData, 10);
          let chunkedRuleNumData = chunkArray(ruleDataWithNumValues, 10);

          //findAndUpdate the rule data first (order doesn't actually matter? i think they can be done concurrently...)
          for (let chunk of chunkedRuleData) {
            await Promise.all(chunk.map(datum => {
              return new Promise((resolve, reject) => {
                (async () => {
                  try {
                    const { date, start, org, formula, value, flare, header, debug } = datum.updateInfo;
                    let filter = { formula, date, org, flare, header };
                    let update = { '$set' : { start, value } };
                    let updateRes = null;
                    if (debug) {
                      updateRes = await DebugFormulaValue.findOneAndUpdate(filter, update, options).select('_id').lean();
                    } else if (debug === false) {
                      updateRes = await FormulaValue.findOneAndUpdate(filter, update, options).select('_id').lean();
                    }
                    if (updateRes === null) { //we need to add this because we don't want to be missing these events
                      console.log("Update Response: ", updateRes);
                      throw new Error(`Unexpected: could not obtain updated ID from update response`);
                    }
                    datum.updateInfo.calcID = updateRes._id.toString();
                    return resolve()
                  }
                  catch (error) {
                    return reject({ printPath: "LiveDataProcessor._rulePrepareAndUpload_.map: ", error });
                  }
                })()
              })
            }))
          }

          //findAndUpdate the withValue (chunkedRuleNumData) data second
          for (let chunk of chunkedRuleNumData) {
            await Promise.all(chunk.map(datum => {
              return new Promise((resolve, reject) => {
                (async () => {
                  try {
                    const { date, start, org, formula, value, flare, header, debug } = datum.updateInfo;
                    let filter = { formula, date, org, flare, header };
                    let update = { '$set' : { start, value } };
                    let updateRes = null;
                    if (debug) {
                      updateRes = await DebugFormulaValue.findOneAndUpdate(filter, update, options).select('_id').lean();
                    } else if (debug === false) {
                      updateRes = await FormulaValue.findOneAndUpdate(filter, update, options).select('_id').lean();
                    }
                    if (updateRes === null) { //we need to add this because we don't want to be missing these events
                      console.log("Update Response: ", updateRes);
                      throw new Error(`Unexpected: could not obtain updated ID from update response`);
                    }
                    datum.updateInfo.calcID = updateRes._id.toString();
                    return resolve()
                  }
                  catch (error) {
                    return reject({ printPath: "LiveDataProcessor._rulePrepareAndUpload_.map: ", error });
                  }
                })()
              })
            }))
          }


          //Here we are matching (with)numValue db OIDs to the rule so that we can forward them to the event gen
          for (let numDatum of ruleDataWithNumValues) {

            numDatum.values = {};

            //In this block we are getting the array of 1 min values if the rule is for non-1-minute eventRules
            for (let correspondingRule of this.mongo.allData.withValuesToEventRuleMap[numDatum.updateInfo.formula.toString()]) {
              let resolution = correspondingRule.resolution;
              let {value, calcID, date} = numDatum.updateInfo;
              if (resolution === 1) {
                numDatum.values[resolution.toString()] = [{value, _id: calcID, date}];
              } else {
                let { org, formula, flare, header, debug } = numDatum.updateInfo;
                let dependancyInput = {
                  id : formula,
                  fullValue : {
                    value,
                    _id: calcID,
                    header,
                    date
                  }
                }
                if (header !== null) header = header.toString();
                numDatum.values[resolution.toString()] = await this.mongo.getFormulaArrayValues(dependancyInput, debug, date, org, flare, header, resolution, false);
              }
            }

            for (let ruleDatum of ruleData) {
              let ruleDatumHeaderMatch = false;
              if (
                (ruleDatum.ruleInfo !== null) &&
                (ruleDatum.ruleInfo.eventRule.withValues) && //is with values
                (numDatum.updateInfo.formula.toString() == ruleDatum.ruleInfo.eventRule.checkForValue.toString()) && //formula match
                (numDatum.updateInfo.flare.toString() == ruleDatum.updateInfo.flare.toString()) //flare match
              ) {
                //At this point we already have a flare match (and a match with all the other attributed)
                //However, since numDatum and ruleDatum formula can go "to" different types (flare, header)
                //we might have mix-matched nulls on header. That is still correct. But we want non-null
                //matches to be selected if available
                let ruleResolution = ruleDatum.ruleInfo.eventRule.resolution;
                if (ruleDatum.ruleInfo.withValue.valueID === undefined) {
                  if ((numDatum.updateInfo.header === null || ruleDatum.updateInfo.header === null)) {
                    ruleDatum.ruleInfo.withValue = numDatum.values[ruleResolution.toString()];
                  }
                  else if (numDatum.updateInfo.header.toString() === ruleDatum.updateInfo.header.toString()) {
                    ruleDatum.ruleInfo.withValue = numDatum.values[ruleResolution.toString()];
                    ruleDatumHeaderMatch = true;
                  }
                } else {
                  if ((numDatum.updateInfo.header === null || ruleDatum.updateInfo.header === null) && (!ruleDatumHeaderMatch)) {
                    ruleDatum.ruleInfo.withValue = numDatum.values[ruleResolution.toString()];
                  }
                  else if (numDatum.updateInfo.header.toString() === ruleDatum.updateInfo.header.toString()) {
                    ruleDatum.ruleInfo.withValue = numDatum.values[ruleResolution.toString()];
                    ruleDatumHeaderMatch = true;
                  }
                }
              }
            }
          }
          await this._RuleDataToSQS_(chunkedRuleData); //send off data to sqs for event gen
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
          // if (DEBUG_1) console.log("bulkOps: ", res);
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
          const start_Main = new Date();
          let payload = event;
          let orgOid = new ObjectId(payload.o);

          try { //Temp fix to speed up live-only data that excludes the backlogs
            let collection = FormulaValue;
            if (payload.d) collection = DebugFormulaValue;
            let valMatch = await collection.findOne({ date: new Date(payload.t[0]), org: new ObjectId(payload.o) }).select('_id').lean().exec();
            if (valMatch !== null && !LOCAL_ENV) {
              // console.log("Match found. Skipping.");
              return resolve(); 
            }
          }
          catch (error) {
            console.log("ERROR: trouble with checking for calculated value.", error);
            throw error;
          }

          // const start_getFullCalcGroup = new Date();
          let calcGroups = await this.getFullCalcGroups(payload.t, payload.o, payload.d);
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
          

          printElapsedTime(start_Main, "All")
          
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
  console.log("event: ", event)
  let payload = {};
  try {
    if (!LOCAL_ENV) payload = JSON.parse(event.Records[0].body);
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
      body: JSON.stringify({ "tag": payload.p }),
    }
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
      } catch (error) {
        console.log("ERROR with invoking lambda logger: ", error);
      }
    }
    try {
      console.log("Closing client...");
      await MongoData.closeClient();
      return;
    }
    catch (error) {
      console.log("Error closing client: ", error);
    }
  }
}

let testEvent = {
  "p": "FI6176A",
  "v": [
    12345,
  ],
  "t": [
    1609488600000,
  ],
  "d": false,
  "o": "5fb6b7ea6b029226f07d2677"
}

mymain(testEvent)

// 1620010860000 //Monday, May 3, 2021 3:01:00 AM
// 1620010800000 //Monday, May 3, 2021 3:00:00 AM

// ================================================================
// function addMinutes(date, minutes) {
//   return new Date(date.getTime() + (minutes*60000))
// }

// let itEndDate = new Date(1609567200000);
// let itStartDate = addMinutes(itEndDate,-60 * 1);
// let it = new Date(itStartDate.getTime());
// console.log("Start: ", itStartDate, itStartDate.toString())
// console.log("End: ", itEndDate, itEndDate.toString())

// let itTestEvent = {
//   "p": "FI6176A",
//   "v": [
//   ],
//   "t": [
//   ],
//   "d": false,
//   "o": "5fb6b7ea6b029226f07d2677"
// }

// while(it <= itEndDate) {
//   // console.log("queueing: ", it.toString());
//   itTestEvent.v.push(12345);
//   itTestEvent.t.push(it.getTime())
//   it = addMinutes(it,1);
// }

// // console.log(itTestEvent)
// mymain(itTestEvent)

