const {PiTag,PiValue,Formula,Parameter,Constant} = require('../database/FRTModels')
const {redisGet,redisSet} = require('../redis/Client')



const exp = 500
const orgId = '5fb6b7ea6b029226f07d2677'
const force = false

const getFormulas = async()=>{
    const key = `${orgId}-formulas`
    const {value,ex} = await redisGet(key)
    if(!value || force){
        const res = await Formula.find({org:orgId})
        await redisSet(key,JSON.stringify(res),exp)
        return res
    }
    return value
}

const getPiTags = async()=>{
    const key = `${orgId}-pitags`
    const {value,ex} = await redisGet(key)
    if(!value || force){
        const res = await PiTag.find({org:orgId}).populate('parameter').populate('sensor').populate('flare').populate('header')
        await redisSet(key,JSON.stringify(res),exp)
        return res
    }
    return value
}

const getConstants = async()=>{
    const key = `constants`
    const {value,ex} = await redisGet(key)
    if(!value || force){
        const res = await Constant.find()
        await redisSet(key,JSON.stringify(res),exp)
        return res
    }
    return value
}

const getAllValues = async()=>{
    const formulas = await getFormulas()
    const tags = await getPiTags()
    const constants = await getConstants()
    console.log(formulas)



}


getAllValues()