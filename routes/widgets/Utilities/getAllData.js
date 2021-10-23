const {PiTag,PiValue,Formula,Parameter,Constant,Compound,Header,Flare} = require('../../../utils/database/FRTModels')
const {redisGet,redisSet} = require('../../../utils/redis/Client')

const exp = 60
const orgId = '5fb6b7ea6b029226f07d2677'


const SortByName = (arrayOfObjects, field = 'name') => {
    if (arrayOfObjects && arrayOfObjects.length >= 1) {
      function sortByName(a, b) {
        const constantA = a[field].toUpperCase();
        const constantB = b[field].toUpperCase();
        let comparison = 0;
        if (constantA > constantB) {
          comparison = 1;
        } else if (constantA < constantB) {
          comparison = -1;
        }
        return comparison;
      }
      return arrayOfObjects.slice().sort(sortByName);
    }
    return null;
  };


const getFormulas = async(args)=>{
    const key = `${orgId}-formulas`
    const {value,ex} = await redisGet(key)

    if(!value || args.force){
        const res = await Formula.find({org:orgId})
        const sorted = SortByName(res)
        await redisSet(key,JSON.stringify(sorted),exp)
        return sorted
    }
    return value
}

const getPiTags = async(args)=>{
    const key = `${orgId}-pitags`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const res = await PiTag.find({org:orgId}).populate('parameter').populate('sensor').populate('flare').populate('header')
        const sorted = SortByName(res)
        await redisSet(key,JSON.stringify(sorted),exp)
        return sorted
    }
    return value
}

const getConstants = async(args)=>{
    const key = `constants`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const res = await Constant.find()
        const sorted = SortByName(res)
        await redisSet(key,JSON.stringify(sorted),exp)
        return sorted
    }
    return value
}

const getCompounds = async(args)=>{
    const key = `compounds`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const res = await Compound.find()
        const sorted = SortByName(res)
        await redisSet(key,JSON.stringify(sorted),exp)
        return sorted
    }
    return value
}

const getHeaders = async(args)=>{
    const key = `${orgId}-headers`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const res = await Header.find().populate('flare')
        const sorted = SortByName(res)
        await redisSet(key,JSON.stringify(sorted),exp)
        return sorted
    }
    return value
}

const getFlares = async(args)=>{
    const key = `${orgId}-flares`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const res = await Flare.find()
        const sorted = SortByName(res)
        await redisSet(key,JSON.stringify(sorted),exp)
        return sorted
    }
    return value
}

const getTagData = async(tags,args)=>{
    const key = `${orgId}-tagData`
    const {value,ex} = await redisGet(key)
    if(!value || args.force){
        const data = tags.map(tag=>{
            const flare = tag.flare ? tag.flare.name : null
            const header = tag.header ? tag.header.name : null
            const sensor = tag.sensor.name
            const param = tag.parameter.name
            const piTag = tag.name
            const primary = `${param}`
            const secondary = `${sensor} (${piTag})`
            const type = tag.parameter.valueType
            const id = tag._id
            const paramType = 'param'
            return {id,paramType,flare,header,sensor,param,piTag,type,primary,secondary}
        })
        await redisSet(key,JSON.stringify(data),exp)
        return data
    }
    return value
}



const sortFormulas = async(formulas)=>{

    //console.log({formulas})




}


const getAllValues = async(args={})=>{

    const [formulas,tags,constants,compounds,headers,flares] = await Promise.all([
        getFormulas(args),
        getPiTags(args),
        getConstants(args),
        getCompounds(args),
        getHeaders(args),
        getFlares(args)
    ])
    
    const tagData = await getTagData(tags,args)
    const numTags = tagData.filter(tag=>tag.type=='num')
    const numFormulas = formulas.filter(formula=>formula.dataType=='num')
    const boolFormulas = formulas.filter(formula=>formula.dataType=='boolean')
    await sortFormulas(formulas)


    const data = {flares,headers,formulas,tags,constants,compounds,tagData,numTags,numFormulas,boolFormulas}
    return data


}

const getNumOptions = async()=>{
    const options = await getAllValues()
    //console.log(options.headers)
    //console.log(options.flares)
    const {numTags,numFormulas} = options
    const formulaData = []
    for(const formula of numFormulas){

        
        if(formula.to === 'flare'){
            for(const flare of options.flares){
                formulaData.push({
                    paramType : 'formula',
                    id: formula._id,
                    name : formula.name,
                    flareName: flare.name,
                    flareID : flare._id,
                    headerName: null,
                    headerID : null,
                    type: "num",
                    primary: formula.name,
                    secondary : flare.name
                })
            }
        }
        if(formula.to === 'headers'){
            for(const header of options.headers){
                formulaData.push({
                    paramType : 'formula',
                    id: formula._id,
                    name : formula.name,
                    flareName: header.flare.name,
                    flareID : header.flare._id,
                    headerName: header.name,
                    headerID : header.id,
                    type: "num",
                    primary: formula.name,
                    secondary : header.name
                })
            }
        }


    }
    console.log({formulaData})

    



    return {numTags,formulaData}
}


module.exports = {getAllValues,getNumOptions}