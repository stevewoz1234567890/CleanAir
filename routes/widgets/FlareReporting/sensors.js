const express = require('express')
const router = express.Router();
const {getRouteHash} = require('../../../utils/auth/tokens')
const {Sensor, PiTag} = require('../../../utils/database/FRTModels')
const {ObjectId} = require('../../../utils/database/utils')
const auth = require('../../../middleware/auth')



const maxLimit = 50

const getReqMeta = async (req) =>{
    const {org,baseUrl,method,query,isSuper} = req
    const path = req.route.path
    const userId = req.user
    const routeId = await getRouteHash(baseUrl,method,path)
    const params = req.params

    if(!isSuper || !query.org){
        query.org = org
    }
    return {org,baseUrl,method,query,isSuper,userId,routeId,path,params}
}

const projection = {
    __v:0
}

// @route PUT api/widgets/flarereporting/sensors/:id
// @desc update sensor(s)
// @access Private
router.put('/:id',[auth],async (req,res)=>{
    
    try {
        const meta = await getReqMeta(req)
        const {id} = meta.params
        
        const objId = await ObjectId(id)
        if(!objId){
            return res.status(400).json({msg:'invalid id'})
        }
        
        let org = meta.org._id
        if(meta.isSuper && req.body.org){
            org = req.body.org
        }

        /* Dont let the user updated thse properties */
        delete req.body.org
        delete req.body.createdDate
        delete req.body.lastUpdate
        delete req.body._id

        req.body.lastUpdate = new Date()
        const data = await Sensor.findOneAndUpdate({_id:id,org},req.body,{new: true,projection})
        if(!data){
            return res.status(400).json({msg:'cannot find sensor'})
        }

        return res.status(200).json({data,meta})
    } catch (error) {
        if(error.message.includes('duplicate key error collection')){
            return res.status(400).json({msg:'name already used'})
        }
        res.status(500).json({msg:'serverError',err:error.message})
    }
});

// @route GET api/widgets/flarereporting/sensors/
// @desc get sensor(s)
// @access Private
router.get('/',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req)
        const {isSuper, org} = meta
        // const {limit,page} = meta.query
        // console.log(meta.params)
        // const options = {
        //     page: page ? parseInt(page) : 1,
        //     limit: limit ? parseInt(limit) > maxLimit ? maxLimit :  parseInt(limit) : 10,
        //     customLabels: {meta: 'pagination'},
        //     projection : projection,
        //     sort : {createdDate : 1},
        //     //populate: 'flare',
        // };
        const allowedQueryKeys = ['_id','name','description','flare', 'header', 'isPrimary', 'cemsInstalled']
        const query = {}
        for(const key of allowedQueryKeys){
            if(meta.query[key]) query[key] = meta.query[key]
        }
        query.org = org._id
        // if(!isSuper || !query.org){
        //     query.org = org
        // }

        const dbRes = await Sensor.find(query)
        // const data  = dbRes.docs
        // meta.pagination = dbRes.pagination
        return res.status(200).json({data:dbRes,meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
    //res.send(req.body)
});

// @route POST api/widgets/flarereporting/sensors/
// @desc create sensor(s)
// @access Private
router.post('/',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req)
        const body = req.body
        const {name} = body
            
        
        let org = meta.org._id
        if(meta.isSuper && req.body.org){
            org = req.body.org
        }
        const sensorFound = await Sensor.findOne({name,org})
        if(sensorFound){
            return res.status(400).json({msg:"Sensor Name Already Used"})
        }
        body.org = org
        const obj = new Sensor(body)
        const data = await obj.save()
        return res.status(200).json({data,meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
});

// @route DELETE api/widgets/flarereporting/sensors/:id
// @desc delete sensor(s)
// @access Private
router.delete('/:id',[auth],async (req,res)=>{
    
    try {
        const meta = await getReqMeta(req)
        const {id} = req.params;
        console.log({_id:id, org:meta.org._id})
        await Sensor.deleteOne({_id:id, org:meta.org._id});
        return res.status(200).json({data:"Sensor deleted",meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
});


/* Utilites */




module.exports = router;