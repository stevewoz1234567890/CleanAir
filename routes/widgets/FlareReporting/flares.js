const express = require('express')
const router = express.Router();
const {getRouteHash} = require('../../../utils/auth/tokens')
const {Flare} = require('../../../utils/database/FRTModels')
const {ObjectId} = require('../../../utils/database/utils')
const auth = require('../../../middleware/auth')
const {
    getFlares
} = require('../../../utils/misc/getOrgData')


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

// @route PUT api/widgets/flarereporting/flares/:id
// @desc Get a flare
// @access Private
router.put('/:id',[auth],async (req,res)=>{
    
    try {
        const meta = await getReqMeta(req)
        const {id} = meta.params
        
        /* Make sure the requested flare exsists */
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
        const data = await Flare.findOneAndUpdate({_id:id,org},req.body,{new: true,projection})
        if(!data){
            return res.status(400).json({msg:'cannot find flare'})
        }

        return res.status(200).json({data,meta})
    } catch (error) {
        if(error.message.includes('duplicate key error collection')){
            return res.status(400).json({msg:'name already used'})
        }
        res.status(500).json({msg:'serverError',err:error.message})
    }
});

// @route GET api/widgets/flarereporting/flares
// @desc Get flares
// @access Private
router.get('/:all?',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req)
        const {page,limit,isSuper,org} = meta
        const options = {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) > maxLimit ? maxLimit :  parseInt(limit) : 10,
            customLabels: {meta: 'pagination'},
            projection : projection,
            sort : {createdDate : 1}
        };
        const allowedQueryKeys = ['_id','name','to','dataType']
        const query = {}
        for(const key of allowedQueryKeys){
            if(meta.query[key]) query[key] = meta.query[key]
        }

        if(!isSuper || !query.org){
            query.org = org._id
        }
        
        if(req.params.all){
            const data = await getFlares()
            return res.status(200).json({data,meta})
        }

        const dbRes = await Flare.paginate(query,options)
        const data  = dbRes.docs
        meta.pagination = dbRes.pagination
        return res.status(200).json({data,meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
    //res.send(req.body)
});

// @route POST api/widgets/flarereporting/flares/
// @desc create a flare
// @access Private
router.post('/',[auth],async (req,res)=>{
    
    /* 
    const samplePayload = {
        "name" : "FCC",
        "steamAssisted": true,
        "airAssisted" : true,
        "permitId" : "P006",
        "tipDiameterValue" : 2,
        "tipDiameterUom": "ft",
        "unobstructedTipAreaValue": 2.79,
        "unobstructedTipAreaUom": "sq ft",
        "smokelessCapacityValue": 138000,
        "smokelessCapacityUom": "lb/hr",
        "effectiveTipDiameterValue": 22.626,
        "effectiveTipDiameterUom": "in"
    }
    */



    try {
        const meta = await getReqMeta(req)
        const body = req.body
        const {name} = body
            
        
        let org = meta.org._id
        if(meta.isSuper && req.body.org){
            org = req.body.org
        }
        const foundFlare = await Flare.findOne({name,org})
        if(foundFlare){
            return res.status(400).json({msg:"Flare Name Already Used"})
        }
        body.org = meta.org._id
        const obj = new Flare(body)
        const data = await obj.save()
        return res.status(200).json({data,meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
});


router.delete('/:id',[auth],async (req,res)=>{
    
    try {
        const meta = await getReqMeta(req)

        const data = {msg:"Not implemented"}
        return res.status(200).json({data,meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
});



/* Utilites */




module.exports = router;