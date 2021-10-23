const { Parameter, Compound, PiTag, Sensor, Header, PiValue, Constant, Formula, CompoundGroup, EventRule } = require('../database/FRTModels')
const { Org } = require('../database/models')
const { MongoClient, ObjectId } = require("mongodb");
const { mongooseConnect } = require('../database/Client')
const { getPiTags, getCompoundGroups,getFormulaDepends } = require('../misc/getOrgData')
const mongoose = require('mongoose');
const _ = require('lodash');
const { RemoteCredentials } = require('aws-sdk');


const DBNAME = "flare-compliance"
const DBURI = "mongodb+srv://cleanairuser:EsjGFgcqPMbLzupm@cleanair.znftk.mongodb.net/test?retryWrites=true&w=majority"
let client = null


// // const formula = {
// //     "name": "VSF",
// //     "formula": "let nhvcz = formula(\"Flare NHVcz\");\nlet cemsAvail = formula(\"Flare Any CEMS Available\");\nlet regGas = formula(\"Flare Regulated Gas\");\nlet x = constant(\"alpha1\");\nlet waterMW = compound(\"Water\",\"Molecular Weight\");\nlet y = 123455;\n\n=AND(nhvcz < 270,regGas + x,cemsAvail + y)",
// //     "to": "flare",
// //     "_id": "5f05ff153103cc4b0fb1f4b4"
// // }

// let formula = {
//     "name": "VSF",
//     "formula": `
//     let fault = value("Fatal Fault");
//     let maint = value("Maintenance Mode");
//     let cal = value("Cal Mode");
//     let fractional = compoundGroup("all","fractional");
//     let cems = "primary";

// =AND(
//         OR(fault = "NORMAL",fault = "OK"),
//         OR(maint = "NORMAL",maint = "OK"),
//         cal = "NORMAL",
//         OR(fractional < 0.8, fractional > 1.2) = FALSE
//     )
//     `,
//     "to": "flare",
//     "_id": "5f05ff153103cc4b0fb1f4b4"
// }



// const formulaIds = {
//     "Flare NHVcz" : "123456",
//     "Flare Any CEMS Available" : "98764",
//     "Flare Regulated Gas" : '456987'
// }
// const compounds = {
//     "Water" : {
//         'id' : '33333333',
//         "Molecular Weight" : 1234
//     }
// }



// const getCompoundValue = (typeValue) =>{
//     const split = typeValue.split(',')
//     const value = compounds[split[0]][split[1]]
//     const compId = compounds[split[0]].id
//     return {compId,value}
// }

// formula.formula = formula.formula.replace(/\n/gm, '')
// console.log(JSON.stringify(formula.formula))
// const variables = formula.formula.match(/\blet .*;/gm);
// // \blet .*;     \blet .*in
// const expression = formula.formula.match(/^=.*/gm)[0];
// const varSchema = {}

// for(const variable of variables){
//     const split = variable.split("=")
//     const varName = split[0].replace("let ","").trim()
//     const rawValue = split[1].replace("in",'').trim().replace(';','')
//     let type = rawValue.match(/\w+(?=\()/gm);
//     let typeValue = null
//     let id = null
//     let finalValue = null
//     if(type){
//         type = type[0]
//         typeValue = rawValue.match(/(?<=\().+?(?=\))/gm)[0].replace(/"/gm, '');
//         if(type === 'formula'){
//             id = formulaIds[typeValue]
//         }
//         if(type === 'compound'){
//             const {compId,value} = getCompoundValue(typeValue)
//             id = compId
//             finalValue = value

//         }
//     }else{
//         finalValue = rawValue
//     }

//     varSchema[varName] = finalValue? finalValue.toString() : null
//     console.log({variable,split,varName,rawValue,expression,type,typeValue,id})
// }
// console.log(varSchema)



getFormulaDepends()


