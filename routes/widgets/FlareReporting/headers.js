const express = require('express')
const router = express.Router();
const {getRouteHash} = require('../../../utils/auth/tokens')
const {Header} = require('../../../utils/database/FRTModels')
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

// @route PUT api/widgets/flarereporting/headers/:id
// @desc update a header
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
        const data = await Header.findOneAndUpdate({_id:id,org},req.body,{new: true,projection})
        if(!data){
            return res.status(400).json({msg:'cannot find header'})
        }

        return res.status(200).json({data,meta})
    } catch (error) {
        if(error.message.includes('duplicate key error collection')){
            return res.status(400).json({msg:'name already used'})
        }
        res.status(500).json({msg:'serverError',err:error.message})
    }
});

// @route GET api/widgets/flarereporting/headers/
// @desc get headers
// @access Private
router.get('/',[auth],async (req,res)=>{
    
    try {
        const meta = await getReqMeta(req)
        const {page,limit,isSuper,org} = meta
        const options = {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) > maxLimit ? maxLimit :  parseInt(limit) : 10,
            customLabels: {meta: 'pagination'},
            projection : projection,
            sort : {createdDate : 1},
            //populate: 'flare',
        };
        const allowedQueryKeys = ['_id','name','to','dataType']
        const query = {}
        for(const key of allowedQueryKeys){
            if(meta.query[key]) query[key] = meta.query[key]
        }
        if(!isSuper || !query.org){
            query.org = org._id
        }

        const dbRes = await Header.paginate(query,options)
        const data  = dbRes.docs
        meta.pagination = dbRes.pagination
        return res.status(200).json({data,meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
    //res.send(req.body)
});

// @route POST api/widgets/flarereporting/headers/:id
// @desc create a header
// @access Private
router.post('/',[auth],async (req,res)=>{
    
    /* 
    const samplePayload = {
        "name" : "AG H1",
        "flare" : "5fb6fb02b496f2ae0e0e6845",
        "sealed" : false,
        "cemsInstalled" : true,
        "processList" : [
            "Sour Water Stripper 1",
            "Sour Water Stripper 2",
            "SRU Claus 1",
            "SRU Claus 2",
            "TGTU 1",
            "TGTU 2",
            "SRU Amine"
        ]
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
        const headerFound = await Header.findOne({name,org})
        if(headerFound){
            return res.status(400).json({msg:"Header Name Already Used"})
        }
        body.org = meta.org
        const obj = new Header(body)
        const data = await obj.save()
        return res.status(200).json({data,meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
});

// @route DELETE api/widgets/flarereporting/headers/
// @desc delete a header
// @access Private
router.delete('/:id',[auth],async (req,res)=>{
    
    try {
        const meta = await getReqMeta(req)
        const {id} = req.params;
        console.log({_id:id, org:meta.org._id})
        await Header.deleteOne({_id:id, org:meta.org._id});
        return res.status(200).json({data:"Header deleted",meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
});


/* Utilites */




module.exports = router;