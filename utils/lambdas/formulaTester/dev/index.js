const AWS = require('aws-sdk')
const Lambda = new AWS.Lambda()
const axios = require('axios');
const http = require('http');
const https = require('https');
const MongoData = require('./MongoData');
const { PiValue, DebugFormulaValue, FormulaValue, PiValuesDebug } = require('./FRTModels');
const { ObjectId } = require("mongodb");
const { DateTime } = require('luxon');

axios.defaults.httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 3000 })
axios.defaults.httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 3000 })

let PROCESSOR = null;
const DEBUG_2 = false; //More logging
const DEBUG_1 = false; //Less logging
const LOCAL_ENV = true; //diffrent kinds of processing needed. Like parsing a json object or not.
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
                      //let found = piTags.filter(tag => tag.parameter._id.toString() === dep.id.toString())
                      if (found.length === 0) {
                        thisDep.value = null
                        allData.push(thisDep)
                        return resolve()
                      }
                      let tag = found;
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
                            // console.log("done getting arr data")
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
                          let matchingCalcTag = calcGroup.data.filter(CGTag => CGTag.piTag.toString() === tag._id.toString());
                          matchingCalcTag = matchingCalcTag[0];
                          const fracMapping = {
                            "mol%": 100,
                            "mol": 100,
                            "ppm": 1000000,
                            "ppb": 1000000000,
                          }
                          const div = fracMapping[tag.parameter.unitOfMeasure]
                          let expectsNum = tag.parameter.valueType === 'num' ? true : false;
                          try {
                            if (expectsNum && isNaN(matchingCalcTag.value)) matchingCalcTag.value = 0;
                          } catch (e) {
                            console.log("tag: ", tag)
                            console.log("matchingCalcTags: ", calcGroup)
                            throw e
                          }

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

  /**
   * 
   * @param {ObjectId} flareid 
   * @param {Array} depValues 
   * @param {Array} sortedFormulas 
   * @param {Date} date 
   */
  async getFormulaValues(flareid, depValues, sortedFormulas = null, date, orgOID, isDebug) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let isEventRuleDate = date.getMinutes() % 15 == 0;
          let formulas = sortedFormulas;
          if (!formulas) formulas = await this.mongo.getSortedFormulas(); //i think this becomes redundant
          const headers = await this.mongo.getFlareHeaders(flareid);
          let results = [];
          for (const formula of formulas) {
            // console.log("FORMUILA: ", formula)

            //we don't want to save values for evenRules not on the add time
            //eventRule is either true (for a test formula) or an ObjectID for a live formula (else null or undefined)
            // if (formula.eventRule && !isEventRuleDate) continue; 

            if (formula.to === 'headers') {
              await Promise.all(headers.map(header => {
                return new Promise((resolve, reject) => {
                  (async () => {
                    try {
                      // console.log(formula.newFormula)
                      const expression = formula.newFormula.match(/^=((.*)\s*)*/gm)[0].replace(/\n/gm, '');
                      const uniques = formula.vars.map(v => v.newUnique)
                      //const ids = formula.vars.map(v=>v.id)
                      const schema = {
                        formula: expression,
                        variables: {},
                        uniques,
                        formulaName: formula.name,
                        formulaId: formula._id,
                        parentName: header.name,
                        parentid: header._id,
                        to: "header"
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
                                //TODO I have no idea what this is or why there would be more than one header match...
                                // I tested in the live parser and I'm not seeing it being used... leaving for now assuming i might be missing something
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

                      const finalRes = await axios.post(pythonURL, schema)
                      let finalResValue = null

                      try {
                        if (pythonURL.includes('amazonaws')) {
                          finalResValue = JSON.parse(finalRes.data.body);
                          if (finalResValue !== null) {
                            finalResValue = finalResValue.value;
                          }
                        } else {
                          finalResValue = finalRes.data.value
                        }

                      } catch (error) {
                        console.log(`ERROR: Could not excel-parse -> ${error}`)
                        console.log("schema: ", schema);
                        console.log("finalRes: ", finalRes);
                      }

                      
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
              const schema = {
                formula: expression,
                variables: {},
                uniques,
                formulaName: formula.name,
                formulaId: formula._id,
                to: "flare"
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
                        const flareDepFound = depValues.find(row => row.newUnique === uni && row.parentid.toString() === flareid.toString()) /// 
                        if (flareDepFound.attr.includes("eventRule_15") && flareDepFound.type === 'formula') {
                          schema.variables[fVar.name] = await this.mongo.getFormulaArrayValues(flareDepFound, isDebug, date, orgOID, flareid);
                        }
                        else schema.variables[fVar.name] = flareDepFound.value

                      }
                      return resolve();
                    }
                    catch (error) { return reject(getErrorObject(error, "Error in LiveDataProcessor.getCalcGroups().map3: ")) }
                  })();
                });
              }))

              const targetFormulaDeps = depValues.filter(row => row.id.toString() === formula._id.toString())
              const finalRes = await axios.post(pythonURL, schema)
              let finalResValue = null
              try {
                if (pythonURL.includes('amazonaws')) {
                  finalResValue = JSON.parse(finalRes.data.body);
                  if (finalResValue !== null) {
                    finalResValue = finalResValue.value;
                  }
                } else {
                  finalResValue = finalRes.data.value
                }
              } catch (error) {
                console.log(`ERROR: Could not excel-parse -> ${error}`)
                console.log("schema: ", schema);
                console.log("finalRes: ", finalRes);
              }
              schema.value = finalResValue
              for (const tdep of targetFormulaDeps) {
                tdep.value = schema.value
              }
              results.push(schema);
            }
            if (DEBUG_2) console.log(`done with ${formula.name}`)
          }
          return resolve(results);
        }
        catch (error) { return reject(getErrorObject(error, "LiveDataCalculator.getFormulaValues(): ")) }
      })();
    });
  }


  async getFullCalcGroups(timestamps, org, isDebug, isTest) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // console.log("TIMESTAMPS: ", tiemstamps)
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
                    if (res.length < numTags && !isTest) return resolve();
                    let isComplete = this.mongo.allData.piTags.every(tag => {
                      let tagMatched = false;
                      for (let i = 0; i < res.length; i++) {
                        if (res[i].piTag.toString() == tag._id.toString()) tagMatched = true;
                      }
                      if (!tagMatched) res.push({ "piTag": tag._id.toString(), "value": null }); //if unmatched or not found, give it a null
                      return true
                    })
                    // if (isComplete) console.log("complete group at :",)
                    return resolve({ "groupDt": date, "data": res });
                    // else return resolve()
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

  async processCalcGroup(calcGroup, flareOID, orgOID, isDebug, info, testingInfo = null) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let date = calcGroup.groupDt;
          //** New Parsing Logic Starts **********************************************************/
          // if (testingInfo) console.log("allFormulasDepends: ", info.allFormulasDepends)
          const depValues = await this.getNonFormulaValues(flareOID, info.allFormulasDepends, calcGroup, orgOID, isDebug);

          let formulaObjects = await this.getFormulaValues(flareOID, depValues, info.sortedFormulas, calcGroup.groupDt, orgOID, isDebug) //dep values are objects that store respective values for formula calcs. 
          if (testingInfo) formulaObjects = formulaObjects.filter(formula => formula.formulaId.toString() === testingInfo.testFormula._id.toString())

          const bulkUpdates = []
          await Promise.all(formulaObjects.map(async (formula) => {
            // console.log("formula AQUI: ", formula)
            const startDate = new Date(date)
            startDate.setMinutes(startDate.getMinutes() - 1)
            const dbSchema = {
              date: date,
              start: startDate,
              org: orgOID,
              formula: formula.formulaId,
              value: formula.value,
              flare: flareOID,
              header: formula.to === 'header' ? formula.parentid : null,
            }
            if (testingInfo) { bulkUpdates.push({ formula, info: dbSchema }); return; }
            bulkUpdates.push(dbSchema)
          }))

          if (testingInfo) {
            let formulaOutputByParent = [];
            let utcEnd = bulkUpdates[0].info.date.toISOString();
            let utcStart = bulkUpdates[0].info.start.toISOString();

            let formulaInfo = {
              name: testingInfo.testFormula.name,
              id: testingInfo.testFormula._id.toString(),
              utc: {
                end: utcEnd,
                start: utcStart,
              },
              local: {
                end: DateTime.fromISO(utcEnd).setZone(testingInfo.tz).toISO(),
                start: DateTime.fromISO(utcStart).setZone(testingInfo.tz).toISO(),
                timezone: testingInfo.tz,
              },
            }

            bulkUpdates.map(group => {
              let out = {
                parent: {
                  name: group.formula.parentName,
                  id: group.formula.parentid,
                  to: group.formula.to,
                },
                value: group.formula.value,
                variables: group.formula.variables,
                end: group.info.date,
                start: group.info.start,
              }
              formulaOutputByParent.push(out);
            });

            return resolve({ formulaInfo, results: formulaOutputByParent, deps: depValues })
          }
          return resolve(bulkUpdates);
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

  async upload(isDebug, ops) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (ops.length == 0) return resolve();
          let collection = isDebug ? DebugFormulaValue : FormulaValue;
          let res = await collection.bulkWrite(ops);
          return resolve(res);
        } catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "LiveDataProcessor.upload(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "LiveDataProcessor.upload(): ", error });
        }
      })();
    })
  }

  async uploadFormulaValues(data) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let bulkOps = await Promise.all(data.map(datum => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  const { date, start, org, formula, value, flare, header, debug } = datum;
                  let filter = { formula, date, org, flare, header };
                  let update = { start, value };
                  let upsert = { "upsert": true }
                  return resolve({
                    "op": { "updateOne": { filter, update, upsert } },
                    debug
                  });
                }
                catch (error) {
                  return reject({ printPath: "LiveDataProcessor.uploadFormulaValues().map: ", error });
                }
              })()
            })
          }))
          let debugOps = [];
          let prodOps = [];
          bulkOps.forEach(op => {
            if (op.debug) {
              debugOps.push(op.op);
            }
            else prodOps.push(op.op);
          });
          let res = await Promise.all([this.upload(true, debugOps), this.upload(false, prodOps)]);
          // console.log(res);
          resolve(res);
        } catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "LiveDataProcessor.uploadFormulaValues(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "LiveDataProcessor.uploadFormulaValues(): ", error });
        }
      })();
    });
  }

  async processOnAllFlares(allFlares, processingChunks, orgOid, payload, info) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let gpdCalcGpsXflare = await Promise.all(allFlares.map(flare => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  let groupedCalcGroupsToUpdate = await this.processOnSelectFlare(flare._id, processingChunks, orgOid, payload, info)
                  resolve(groupedCalcGroupsToUpdate);
                } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.processOnAllFlares().flares")) }
              })();
            })
          }))
          return resolve(gpdCalcGpsXflare);
        } catch (error) { return reject(getErrorObject(error, "LiveDataProcessor.processOnAllFlares()")) }
      })();
    })
  }

  async processOnSelectFlare(flareID, processingChunks, orgOid, payload, info, testingInfo = null) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let flareOID = ObjectId(flareID);
          let groupedCalcGroupsToUpdate = await Promise.all(processingChunks.map(chunk => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  let calcGroupsToUpdate = await Promise.all(chunk.map(calcGroup => {
                    return new Promise((resolve, reject) => {
                      (async () => {
                        try {
                          let dataToUpdate = await this.processCalcGroup(calcGroup, flareOID, orgOid, payload.d, info, testingInfo);
                          return resolve(dataToUpdate);
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
          let payload = event;
          let orgOid = new ObjectId(payload.o);
          let isTest = false;
          let testFormula, testFormulasDepsObj, testFormulasDepsArr = null;
          if (payload.specialEvent !== undefined) {
            if (payload.specialEvent == "testFormula") {
              isTest = true;
              //gets the test formula and dependant FORMULAS
              let res = await this.mongo.getTestFormulaAndDeps(payload.formula, orgOid);
              testFormula = res[0];
              testFormulasDepsObj = res[1];
              testFormulasDepsArr = Object.values(res[1]); //TODO, return array from start... ??? maybe not...
            }
          }
          let calcGroups = await this.getFullCalcGroups(payload.t, payload.o, payload.d, isTest);
          if (DEBUG_2) console.log("Num Calc Groups: ", calcGroups.length);
          if (this.mongo.allData == null) {
            await this.mongo.getAllData();
          }
          let formulas = null;
          if (isTest) formulas = await this.mongo.getSortedFormulas(orgOid, true, [testFormula, ...testFormulasDepsArr]); //TODO ERICK. MAKEIT AN ARRAY THATS RETURNED
          else formulas = await this.mongo.getSortedFormulas(orgOid);

          let sortedFormulas = formulas; //added because needed. Unsure if should be cloned. check for pointer usage by others.


          // let inputFormulas = null
          // if (isTest) {
          //   let formulaMatch = formulas.find(formula => formula._id == payload.formula.id); //changes, now i think is unnessesary
          //   inputFormulas = [formulaMatch];
          // } else inputFormulas = formulas
          // if (DEBUG_2) console.log("Number of formulas: ", inputFormulas.length);
          // inputFormulas = formulas; //this makes the previous block completely unneeded. It's because we added the other logic...

          let allFormulasDepends = await this.mongo.getAllFormulasDepends(formulas, isTest); // saved to allData.allDependants
          const processingChunks = chunkArray(calcGroups, 30);
          let allFlares = this.mongo.allData.flares;
          await this.mongo.checkAllData(orgOid);
          let info = { sortedFormulas, allFormulasDepends };

          if (isTest) {
            let testingInfo = {
              isTest: true,
              testFormula,
              testFormulasDepsArr,
              tz: payload.tz,
            }
            let testResult = await this.processOnSelectFlare(payload.flareID, processingChunks, orgOid, payload, info, testingInfo);
            testResult = testResult.flat(2)[0];
            if (payload.formula.isNewFormula == true) {
              let matchIndex = this.mongo.allData.formulas.findIndex(formula => {
                return formula._id.toString() == testResult.formulaInfo.id;
              });
              if (matchIndex < 0) throw "Unexpected: could not find index to remove temporary formula from allFormulas"
              this.mongo.allData.formulas.splice(matchIndex, 1);
              testResult.formulaInfo.id = "unsaved_test_formula";
            }

            return resolve(testResult);
          } else {
            let gpdCalcGpsXflare = await this.processOnAllFlares(allFlares, processingChunks, orgOid, payload, info);
            gpdCalcGpsXflare = gpdCalcGpsXflare.flat(3);
            await this.uploadFormulaValues(gpdCalcGpsXflare.flat(3))
          }
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
  // console.log("event: ", event) 
  let payload = {};
  try {
    let isTest = false;
    if (!LOCAL_ENV) payload = event
    else payload = event;

    if (payload.specialEvent === 'testFormula') {
      isTest = true;
      let date = DateTime.fromISO(payload.date, { zone: payload.tz }).toMillis()
      payload.t = [date]
      if (payload.formula.isNewFormula) payload.formula.id = new ObjectId().toString();
    }
    console.log("Payload: ", typeof payload, payload);
    if (PROCESSOR == null) {
      PROCESSOR = new LiveDataProcessor();
      await PROCESSOR.initClass(payload); //I think it only uses the org initially.
    }
    if (PROCESSOR.mongo.mongooseStatus() == 0) await PROCESSOR.initClass(payload);
    let processingDisplay = null;
    if (isTest) processingDisplay = payload.formula.name
    else processingDisplay = payload.p
    // let procDisplay = isTest ? payload.formula.name : payload.p;
    if (DEBUG_1 || DEBUG_2 || isTest) console.log(`Processing: ${processingDisplay}`);
    let result = await PROCESSOR.processNewEvent(payload);
    if (DEBUG_1 || DEBUG_2 || isTest) console.log(`Done Processing: ${processingDisplay}`);
    const response = {
      statusCode: 200,
      body: isTest ? result : JSON.stringify({ "tag": payload.p }),
    }
    if (LOCAL_ENV) {
      console.log(JSON.stringify(response.body, null, 2));
      console.log("Closing Client...");
      await MongoData.closeClient();
    }
    return response;
  }
  catch (error) {
    let logError = error;
    if (error.hasOwnProperty('printPath')) {
      console.log(`Error at: main():${error.printPath}`);
      console.log(`Stack: ${error.error.stack}`);
    }
    else {
      console.log("Error in main(): ", error);
    }
    /*Send error to logger lambda*/
    if (!LOCAL_ENV) {
      try {
        let stream = "FormulaTest";
        if ('d' in payload) {
          if (payload.d) stream = "DebugFormulaTest"
        }
        else {
          logError = { "issue": "could not determine correct logstream. Default to LiveDataCalc", error };
        }
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


let myInputTest = {
  formula: {
    isNewFormula: true,
    id: '60f6f1af9998340009cfcc05',
    name: 'test',
    logic: 'let prich4 = compound(5fb7f09b2d14ea1cd8a8371a,"primary");\r\n\r\n=prich4',
    to: 'headers'
  },
  date: '2021-07-20T04:00',
  flareID: '5fb6fb02b496f2ae0e0e6845',
  headerID: 'All Headers',
  o: '5fb6b7ea6b029226f07d2677',
  tz: 'America/New_York',
  specialEvent: 'testFormula',
  d: false,
  t: [ 1626768000000 ]
}

mymain(myInputTest);