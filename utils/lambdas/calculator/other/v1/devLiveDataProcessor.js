const axios = require('axios');
const fs = require('fs/promises');
const http = require('http');
const https = require('https');
const Timer = require('./Timer');
const MongoData = require('./MongoData');
const { CalcStore, PiValue, DebugFormulaValue, FormulaValue } = require('./FRTModels');
const { ObjectId } = require("mongodb");
const { prod } = require('mathjs');
require('dotenv').config();

axios.defaults.httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 3000 })
axios.defaults.httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 3000 })

let PROCESSOR = null;
const LOCAL_DEBUGGING = true;
const LOCAL_PROD_TESTING = true;
const pythonURL = 'https://del0xeo27b.execute-api.us-east-1.amazonaws.com/prod/formulavalue'

// const orgId = '5fb6b7ea6b029226f07d2677'

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
  async getNonFormulaValues(flareid, formulaDepends = null, calcGroup, orgOID) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          await this.mongo.checkAllData(orgOID);
          let flares = this.mongo.allData.flares;
          let headers = await this.mongo.getFlareHeaders(flareid);
          let compoundGroups = this.mongo.allData.compoundGroups;
          let piTags = [...this.mongo.allData.piTags];
          let constants = this.mongo.allData.constants;
          let compounds = this.mongo.allData.compounds;
          const flare = flares.filter(f => f._id.toString() === flareid.toString())[0]
          const allData = []
          await Promise.all(
            formulaDepends.map(orgDep => {
              return new Promise((resolve, reject) => {
                (async () => {
                  try {
                    const dep = { ...orgDep }
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
                      const value = found[dep.attr[0]]
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
                      return resolve()
                    }

                    if (dep.type === 'parameter' && dep.parent === 'flare') {
                      const thisDep = { ...orgDep }
                      thisDep.parentid = flareid
                      let found = piTags.filter(tag => tag.parameter._id.toString() === dep.id.toString())
                      let calcGroupTag = calcGroup.data.filter(tagValPair => {
                        return (found[0]._id.toString() == tagValPair.pitag.toString());
                      });
                      if (calcGroupTag.length == 0) console.log("ERROR, no matching tag! in getNonFormulaValues param&flare");
                      found = calcGroupTag[0];
                      if (found.length === 0) {
                        thisDep.value = null
                        allData.push(thisDep)
                        return resolve()
                      }
                      thisDep.parentid = flareid;
                      thisDep.value = found.value;
                      allData.push(thisDep);
                      return resolve();
                    }

                    if (dep.type === 'parameter' && dep.parent === 'header') {
                      dep.value = []
                      const found = piTags.filter(tag => tag.parameter._id.toString() === dep.id.toString())
                      let isPri = null
                      if (dep.attr.includes('primary')) isPri = true
                      if (dep.attr.includes('secondary')) isPri = false
                      headers.map(header => {
                        const thisDep = { ...orgDep }
                        thisDep.parentid = header._id.toString()
                        for (const tag of found) {
                          if (tag.header._id.toString() !== header._id.toString()) continue
                          if (isPri !== null && tag.sensor.isPrimary !== isPri) continue
                          if (dep.attr.includes('max')) {
                            thisDep.value = tag.max
                            allData.push(thisDep)
                            return resolve()
                          }
                          if (dep.attr.includes('min')) {
                            thisDep.value = tag.min
                            allData.push(thisDep)
                            return resolve()
                          }
                          let matchingCalcTag = calcGroup.data.filter(CGTag => {
                            return CGTag.pitag.toString() == tag._id.toString()
                          });
                          thisDep.value = matchingCalcTag[0].value; //tag.value.value
                          allData.push(thisDep)
                          return resolve()
                        }
                        thisDep.value = null
                        allData.push(thisDep)
                      })
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
                          for (const tag of piTags) {
                            let matchingCalcTag = calcGroup.data.filter(CGTag => CGTag.pitag.toString() == tag._id.toString())[0];
                            const fracMapping = {
                              "mol%": 100,
                              "mol": 100,
                              "ppm": 1000000,
                              "ppb": 1000000000,
                            }
                            const div = fracMapping[tag.parameter.unitOfMeasure]
                            matchingCalcTag.fracValue = div ? matchingCalcTag.value / div : matchingCalcTag.value

                            if (!tag.parameter.compound) continue
                            if (tag.parameter.compound.toString() !== compound._id.toString()) continue
                            if (tag.header._id.toString() !== header._id.toString()) continue

                            if (dep.attr.includes('netHeatingValue')) {
                              if (tag.sensor.isPrimary === true) {
                                value = { value: compound.netHeatingValue, compound: compound.name }
                                break
                              }
                            }
                            if (dep.attr.includes('primary')) {
                              if (tag.sensor.isPrimary === true) {
                                value = { id: header._id.toString(), value: matchingCalcTag.fracValue, compound: compound.name }
                                value = { id: header._id.toString(), value: matchingCalcTag.fracValue, compound: compound.name }
                                break
                              }
                            }
                            if (dep.attr.includes('secondary')) {
                              if (tag.sensor.isPrimary === false) {
                                value = { id: header._id.toString(), value: matchingCalcTag.fracValue, compound: compound.name }
                                break
                              }
                            }
                          }
                          if (!value) continue
                          thisDep.value.push(value)
                        }
                        allData.push(thisDep)
                      })
                      return resolve()
                    }
                  }
                  catch (error) {
                    if (error.hasOwnProperty('printPath')) {
                      let errObj = { printPath: "LiveDataProcessor.getNonFormulaValues().promiseAll.Map: ", error: error.error };
                      errObj.printPath = `${errObj.printPath}${error.printPath}`
                      return reject(errObj);
                    }
                    return reject({ printPath: "LiveDataProcessor.getNonFormulaValues().promiseAll.Map: ", error });
                  }
                })();
              });
            }))
          return resolve(allData);
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "LiveDataProcessor.getNonFormulaValues(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "LiveDataProcessor.getNonFormulaValues(): ", error });
        }
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
  async getFormulaValues(flareid, depValues, formulas = null) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (!formulas) formulas = await this.mongo.getSortedFormulas();
          const headers = await this.mongo.getFlareHeaders(flareid);

          for (const formula of formulas) {
            if (formula.to === 'headers') {
              await Promise.all(headers.map(header => {
                return new Promise((resolve, reject) => {
                  (async () => {
                    try {

                      const expression = formula.newFormula.match(/^=((.*)\s*)*/gm)[0].replace(/\n/gm, '');
                      const unqiues = formula.vars.map(v => v.newUnique)
                      //const ids = formula.vars.map(v=>v.id)
                      const schema = {
                        formula: expression,
                        variables: {},
                        unqiues,
                        formulaName: formula.name,
                        formulaId: formula._id,
                        parentName: header.name,
                        parentid: header._id,

                      }
                      await Promise.all(unqiues.map(uni => {
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
                                  schema.variables[fVar.name] = headerFound[0].value
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
                            catch (error) {
                              if (error.hasOwnProperty('printPath')) {
                                let errObj = { printPath: "LiveDataProcessor.getFormulaValues().map2: ", error: error.error };
                                errObj.printPath = `${errObj.printPath}${error.printPath}`
                                return reject(errObj);
                              }
                              return reject({ printPath: "LiveDataProcessor.getFormulaValues().map2: ", error });
                            }
                          })();
                        });
                      }))

                      const finalRes = await axios.post(pythonURL, schema)
                      let finalResValue = null
                      if (pythonURL.includes('amazonaws')) {
                        finalResValue = JSON.parse(finalRes.data.body).value
                      } else {
                        finalResValue = finalRes.data.value
                      }

                      schema.value = finalResValue
                      const targetFormulaDeps = depValues.filter(row => row.id.toString() === formula._id.toString() && row.parentid === header._id.toString())
                      for (const tdep of targetFormulaDeps) {
                        tdep.value = schema.value
                      }
                      return resolve();
                    }
                    catch (error) {
                      if (error.hasOwnProperty('printPath')) {
                        let errObj = { printPath: "LiveDataProcessor.getFormulaValues().map1: ", error: error.error };
                        errObj.printPath = `${errObj.printPath}${error.printPath}`
                        return reject(errObj);
                      }
                      return reject({ printPath: "LiveDataProcessor.getFormulaValues().map1: ", error });
                    }
                  })();
                });
              })
              )
            } else {
              const expression = formula.newFormula.match(/^=((.*)\s*)*/gm)[0].replace(/\n/gm, '');
              const unqiues = formula.vars.map(v => v.newUnique)
              const schema = {
                formula: expression,
                variables: {},
                unqiues,
                formulaName: formula.name,
                formulaId: formula._id,
              }

              await Promise.all(unqiues.map(uni => {
                return new Promise((resolve, reject) => {
                  (async () => {
                    try {
                      const fVar = formula.vars.filter(row => row.newUnique === uni)[0]
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
                        const flareFound = depValues.filter(row => row.newUnique === uni && row.parentid.toString() === flareid.toString())[0] /// 
                        schema.variables[fVar.name] = flareFound.value
                      }
                      return resolve();
                    }
                    catch (error) {
                      if (error.hasOwnProperty('printPath')) {
                        let errObj = { printPath: "Error in LiveDataProcessor.getCalcGroups().map3: ", error: error.error };
                        errObj.printPath = `${errObj.printPath}${error.printPath}`
                        return reject(errObj);
                      }
                      return reject({ printPath: "Error in LiveDataProcessor.getCalcGroups().map3: ", error });
                    }
                  })();
                });
              }))

              const targetFormulaDeps = depValues.filter(row => row.id.toString() === formula._id.toString())
              const finalRes = await axios.post(pythonURL, schema)
              let finalResValue = null
              if (pythonURL.includes('amazonaws')) {
                finalResValue = JSON.parse(finalRes.data.body).value
              } else {
                finalResValue = finalRes.data.value
              }
              schema.value = finalResValue
              for (const tdep of targetFormulaDeps) {
                tdep.value = schema.value
              }
            }
            if (LOCAL_DEBUGGING) console.log(`done with ${formula.name}`)
          }
          return resolve();
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "LiveDataCalculator.getFormulaValues(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "LiveDataCalculator.getFormulaValues(): ", error });
        }
      })();
    });
  }

  /**
   * Stores new datapoints into the temporary store and returns the respective object ids
   * @param {} payload 
   */
  async updateCalcStore(payload) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let tagName = payload.p;
          let tagOid = this.mongo.allData.piTags.filter(tag => tag.name == tagName)
          tagOid = tagOid[0]._id;
          let orgOid = new ObjectId(payload.o);
          let isDubug = false;
          if (payload.d) isDubug = true; //idk if d is always there
          let dates = payload.t;
          let values = payload.v;

          let numValues = payload.v.length;
          let dataPairs = [];
          for (let i = 0; i < numValues; i++) {
            dataPairs.push([dates[i], values[i]]);
          }
          //Assumption: the user is not sending duplicate timestamps in a payload
          //Effect if wrong: Unsure. Possibly a race issue with a possible error? Depends on final implementation too
          //Solution (if needed): check for duplicate dates
          let docsUpdated = await Promise.all(
            dataPairs.map(pair => {
              return new Promise((resolve, reject) => {
                (async () => {
                  try {
                    let date = new Date(pair[0]);
                    let value = pair[1];
                    let query = {
                      org: orgOid,
                      groupDt: date,
                      debug: isDubug
                    }
                    let match = await CalcStore.findOne(query).exec();
                    if (!match) {
                      let newEntry = query;
                      newEntry.data = [{ pitag: tagOid, value }];
                      let res = await CalcStore.create(query);
                      res = res.toObject();
                      return resolve(res._id.toString());
                    }
                    else {
                      // let filter = { _id: match._id.toString() };
                      // let update = { $push: { data: { pitag: tagOid, value } } }
                      let index = match.data.findIndex(v => {
                        if (v.pitag.toString() == tagOid.toString()) {
                          return true
                        }
                      });
                      if (!(index == -1)) { //if already in data array (then there is no change or an update)
                        if (match.data[index].value == value) { return resolve(match._id.toString()) } //if no change, don't proccess. can't be null though if you want it to check for full sets
                        else { //there IS a change
                          match.data[index].value = value;
                          await match.save()
                          return resolve(match._id.toString())
                          // update = { data: match.data };
                        }
                      }
                      match.data.push({ pitag: tagOid, value })
                      await match.save();
                      // let res = await CalcStore.updateOne(filter, update);
                      // if (res.n != 1 && res.nModified != 1) {
                      //   console.log("in updateCalcStore: nothing modified")
                      //   console.log("res.n: ", res.n);
                      //   console.log("res.nModified: ", res.nModified);
                      // }
                      return resolve(match._id.toString());
                    }
                  }
                  catch (error) {
                    if (error.hasOwnProperty('printPath')) {
                      let errObj = { printPath: "LiveDataProcessor.updateCalcStore().map: ", error: error.error };
                      errObj.printPath = `${errObj.printPath}${error.printPath}`
                      return reject(errObj);
                    }
                    return reject({ printPath: "LiveDataProcessor.updateCalcStore().map: ", error });
                  }
                })();
              })

            })
          );
          return resolve(docsUpdated);
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "LiveDataProcessor.updateCalcStore(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);

          }
          return reject({ printPath: "LiveDataProcessor.updateCalcStore(): ", error });
        }
      })();
    });
  }

  async getFullCalcGroups(groupDocIds) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let oids = groupDocIds.map(id => new ObjectId(id));
          let query = { '_id': { '$in': oids } }
          let groups = await CalcStore.find(query).lean().exec();
          let fullGroups = groups.filter(group => {
            return this.mongo.allData.piTags.every(tag => {
              let tagMatched = false;
              for (let i = 0; i < group.data.length; i++) {
                if (group.data[i].pitag.toString() == tag._id.toString()) tagMatched = true;
              }
              return tagMatched;
            });
          })
          return resolve(fullGroups);
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

  async processCalcGroup(calcGroup, flareOID, orgOID) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let date = calcGroup.groupDt;
          //** New Parsing Logic Starts **********************************************************/
          const thisTimer = new Timer(date.toISOString())
          thisTimer.start()
          const depValues = await this.getNonFormulaValues(flareOID, this.mongo.allData.allDependants, calcGroup, orgOID);
          //=========================
          let path = "./utils/temp/liveFormulaCalculator/depLive.json"
          await fs.writeFile(path, JSON.stringify(depValues, null, 2));
          //=========================
          await this.getFormulaValues(flareOID, depValues)
          const formulaDepValues = depValues.filter(row => row.type === 'formula')
          const bulkUpdates = []
          await Promise.all(formulaDepValues.map(async (dep) => {
            const startDate = new Date(date)
            startDate.setMinutes(startDate.getMinutes() - 1)
            const dbSchema = {
              date: date,
              start: startDate,
              org: orgOID,
              formula: new ObjectId(dep.id),
              value: dep.value,
              flare: flareOID,
              header: dep.to === 'headers' ? new ObjectId(dep.parentid) : null,
              debug: calcGroup.debug
            }
            bulkUpdates.push(dbSchema)
            // const query = {
            //   logicId: dbSchema.logicId,
            //   date: dbSchema.date,
            //   org: dbSchema.org,
            //   flare: dbSchema.flare,
            //   header: dbSchema.header,
            // }
            // const onInsert = { created: new Date() }
            // const bulkSchema = {
            //   filter: query,
            //   update: { $set: dbSchema, $setOnInsert: onInsert },
            //   upsert: true
            // }
          }))
          thisTimer.stop()
          console.log("bulkUpdates length: ", bulkUpdates.length)
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
          console.log(res);
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

  /**
   * This class is effectively the 'main' of this class
   * @param {} event 
   */
  async processNewEvent(event) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let payload = event;
          if (event.Records) payload = JSON.parse(event.Records[0].body);
          let orgOid = new ObjectId(payload.o);
          let docIds = await this.updateCalcStore(payload);
          // docIds = docIds.filter(id => id != null); //no more nulls, so... this can probably be removed
          // if (docIds.length == 0) return resolve();
          let calcGroups = await this.getFullCalcGroups(docIds);
          // console.log("Nume Calc Groups: ", calcGroups.length);
          if (LOCAL_DEBUGGING) console.log("Num Calc Groups: ", calcGroups.length);
          if (this.mongo.allData == null) {
            await this.mongo.getAllData();
          }
          const formulas = await this.mongo.getSortedFormulas(orgOid);
          if (LOCAL_DEBUGGING) console.log("Number of formulas: ", formulas.length);
          await this.mongo.getAllFormulasDepends(formulas)
          const processingChunks = chunkArray(calcGroups, 30);
          let timer = new Timer();
          timer.start()
          // let flareOID = undefined;
          // if (LOCAL_PROD_TESTING) flareOID = new ObjectId("5fb6fac8b496f2ae0e0e6844"); //fcc
          let allFlares = this.mongo.allData.flares;
          let gpdCalcGpsXflare = await Promise.all(allFlares.map(flare => {
            return new Promise((resolve, reject) => {
              (async () => {
                try {
                  let flareOID = flare._id;
                  let groupedCalcGroupsToUpdate = await Promise.all(processingChunks.map(chunk => {
                    return new Promise((resolve, reject) => {
                      (async () => {
                        try {
                          let calcGroupsToUpdate = await Promise.all(chunk.map(calcGroup => {
                            return new Promise((resolve, reject) => {
                              (async () => {
                                try {
                                  let dataToUpdate = await this.processCalcGroup(calcGroup, flareOID, orgOid);
                                  return resolve(dataToUpdate);
                                }
                                catch (error) {
                                  if (error.hasOwnProperty('printPath')) {
                                    let errObj = { printPath: "LiveDataProcessor.processNewEvent().map2: ", error: error.error };
                                    errObj.printPath = `${errObj.printPath}${error.printPath}`
                                    return reject(errObj);
                                  }
                                  return reject({ printPath: "LiveDataProcessor.processNewEvent().map2: ", error });
                                }
                              })();
                            })
                          }))
                          return resolve(calcGroupsToUpdate);
                        }
                        catch (error) {
                          if (error.hasOwnProperty('printPath')) {
                            let errObj = { printPath: "LiveDataProcessor.processNewEvent().map1: ", error: error.error };
                            errObj.printPath = `${errObj.printPath}${error.printPath}`
                            return reject(errObj);
                          }
                          return reject({ printPath: "LiveDataProcessor.processNewEvent().map1: ", error });
                        }
                      })();
                    })
                  }))
                  resolve(groupedCalcGroupsToUpdate);
                } catch (error) {
                  if (error.hasOwnProperty('printPath')) {
                    let errObj = { printPath: "LiveDataProcessor.processNewEvent().flares: ", error: error.error };
                    errObj.printPath = `${errObj.printPath}${error.printPath}`
                    return reject(errObj);
                  }
                  return reject({ printPath: "LiveDataProcessor.processNewEvent().flares: ", error });
                }
              })();
            })
          }))
          // console.log(gpdCalcGpsXflare.flat(3))
          await this.uploadFormulaValues(gpdCalcGpsXflare.flat(3))
          timer.stop();
          return resolve(gpdCalcGpsXflare);
        }
        catch (error) {
          if (error.hasOwnProperty('printPath')) {
            let errObj = { printPath: "LiveDataProcessor.processNewEvent(): ", error: error.error };
            errObj.printPath = `${errObj.printPath}${error.printPath}`
            return reject(errObj);
          }
          return reject({ printPath: "LiveDataProcessor.processNewEvent(): ", error });
        }
      })();
    });
  }

}


async function getTestEvents() {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let path = "./utils/temp/liveFormulaCalculator/fullMinute.json"
        let orgID = "5fb6b7ea6b029226f07d2677";
        if (false) {
          const dateToParse = '2020-02-01'
          let date = new Date(`${dateToParse} 00:00z`)
          const pipeline = [
            {
              $match: {
                date: date,
                org: new ObjectId(orgID)
              }
            },
            {
              $project: {
                _id: 0,
                piTag: 1,
                value: 1
              }
            },
            {
              $lookup:
              {
                from: "pitags",
                localField: "piTag",
                foreignField: "_id",
                as: "name"
              }
            },
            {
              "$unwind": "$name"
            },
            {
              $project: {
                "value": 1,
                "name.name": 1
              }
            }
          ]
          const res = await PiValue.aggregate(pipeline).exec();
          let t = date.getTime();
          const formattedDocs = [];
          for (const doc of res) {
            formattedDocs.push({
              p: doc.name.name,
              v: [doc.value],
              t: [t],
              d: true,
              o: orgID,
            });
          }
          // convert JSON object to string
          const data = JSON.stringify(formattedDocs, null, 2);
          // write JSON string to a file
          // let path = "./utils/temp/liveFormulaCalculator/fullMinute.json"
          await fs.writeFile(path, data);
        }

        if (true) {
          // let path = "./utils/temp/liveFormulaCalculator/fullMinute.json"
          const data = await fs.readFile(path, 'utf-8');
          const res = JSON.parse(data.toString());
          console.log('Done getting starter data')
          return resolve(res);
        }
      } catch (error) {
        return reject({ printPath: "getTestEvent(): ", error });
      }
    })();
  })
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

async function main(payload) {
  try {
    if (PROCESSOR == null) {
      PROCESSOR = new LiveDataProcessor();
      await PROCESSOR.initClass(payload); //I think it only uses the org initially.
    }
    if (LOCAL_DEBUGGING) {
      let testEvents = await getTestEvents();
      console.log("num events: ", testEvents.length)
      for (const event of testEvents) {
        console.log(`Processing: ${event.p}`);
        let response = await PROCESSOR.processNewEvent(event);
        // let path = "./utils/temp/liveFormulaCalculator/output.json"
        // await fs.writeFile(path, JSON.stringify(response, null,2));
        console.log(`Done processing and saving: ${event.p}`);
        break;
      }
    }
    else {
      if (LOCAL_PROD_TESTING) console.log(`Processing: ${payload.p}`);
      await PROCESSOR.processNewEvent(payload);
      if (LOCAL_PROD_TESTING) console.log(`Done Processing: ${payload.p}`);
    }
    console.log("Closing Client...");
    await MongoData.closeClient();
  }
  catch (error) {
    if (error.hasOwnProperty('printPath')) {
      console.log(`Error at: main():${error.printPath}`);
      console.log(`Stack: ${error.error.stack}`);
    }
    else {
      console.log("Error in main(): ", error);
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

let payload = {
  "p": "FI6176A",
  "v": [3.33324392636617],
  "t": [1580515200000],
  "d": true,
  "o": "5fb6b7ea6b029226f07d2677"
}
// let payload = {
//   p: 'TI6176',
//   v: [62.1873, 62.1873, 62.1873, 62.2973, 62.2504],
//   t: [
//     1613509920000,
//     1613509980000,
//     1613510040000,
//     1613510100000,
//     1613510160000
//   ],
//   d: true,
//   o: '5fb6b7ea6b029226f07d2677'
// };
main(payload);



/*
return new Promise((resolve, reject) => {
  (async () => {
    try {

    }
    catch (error) {
      console.log(`Error in LiveDataProcessor.getCalcGroups(): ${error.message}`);
      console.log(`Stack Trace:\n${error.stack}`);
      return reject(error);
    }
  })();
});
*/