const express = require('express')
const {check,validationResult} = require('express-validator')
const router = express.Router();
const {getRouteHash} = require('../utils/auth/tokens')
const {Org} = require('../utils/database/models')
const auth = require('../middleware/auth')
const {createLogGroup} = require ('../utils/aws/Logger');

const maxLimit = 50

const getReqMeta = async (req) =>{
    const {org,baseUrl,method,query,isSuper} = req
    const path = req.route.path
    const userId = req.user
    const routeId = await getRouteHash(baseUrl,method,path)
    if(!isSuper || !query.org){
        query.org = org
    }
    return {org,baseUrl,method,query,isSuper,userId,routeId,path}
}

const projection = {
    __v:0
}


router.put('/:id',[auth],async (req,res)=>{
    
    try {
        const meta = await getReqMeta(req)
        const body = req.body
        if(!meta.isSuper){
            return res.status(400).json({msg:"Unauthorized Dev and Super Only"})
        }

        const data = {}
        return res.status(200).json({data,meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
});

router.get('/',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req)
        const {isSuper,org} = meta
        const options = {
            page: req.query.page ? parseInt(req.query.page) : 1,
            limit: req.query.limit ? parseInt(req.query.limit) > 50 ? 50 :  parseInt(req.query.limit) : 10,
            customLabels: {meta: 'meta'},
            projection : {
                __v:0
            },
            sort : {createdDate : 1}
        };
        const allowedQueryKeys = ['_id','name']
        const query = {}
        for(const key of allowedQueryKeys){
            if(req.query[key]) query[key] = req.query[key]
        }

        const dbRes = await Org.paginate(query, options)
        const data  = dbRes.docs
        meta.pagination = dbRes.pagination
        return res.status(200).json({data,meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
    //res.send(req.body)
});

const postValidator = [
    check('name','name is required').not().isEmpty(),
    check('logGroup','logGroup is required').not().isEmpty(),
    check('require2FA','require2FA  is required').not().isEmpty(),
]

router.post('/',[auth,postValidator],async (req,res)=>{
    const errors = validationResult(req)
    if(!errors.isEmpty()){
        const validationErrors = errors.array().map(error=>({msg:error.msg,param:error.param}))
        return res.status(400).json({validationErrors})
    }
    try {
        const meta = await getReqMeta(req)
        const body = req.body
        if(!meta.isSuper){
            return res.status(400).json({msg:"Unauthorized Dev and Super Only"})
        }

        /* Make sure the logGroup name isnt already used */
        const logGRes = await Org.findOne({logGroup:body.logGroup})
        if(logGRes){
            return res.status(400).json({msg:"logGroup name already used"})
        }

        const newOrg = new Org(body)
        await newOrg.save()
        await createLogGroup(body.logGroup)
        const data = newOrg

        
        return res.status(200).json({data,meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
});

router.delete('/',[auth],async (req,res)=>{
    
    try {
        const meta = await getReqMeta(req)
        const data = {}
        return res.status(200).json({data,meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
});


/* Utilities */



module.exports = router;