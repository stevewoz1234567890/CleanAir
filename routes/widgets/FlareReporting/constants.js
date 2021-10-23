const express = require('express')
const router = express.Router();
const {getRouteHash} = require('../../../utils/auth/tokens')
const {Constant} = require('../../../utils/database/FRTModels')
const auth = require('../../../middleware/auth');
const { response } = require('express');

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


// @route POST api/widgets/flarereporting/constants/
// @desc Create a constant
// @access Private
router.post('/',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req);
        const data = req.body;
        data.org = meta.org;
        const dbRes = await Constant.create(data, function (err, constant) {
            if (err) {
                console.log("const.post.err: ", err);
                return handleError(err)
            }
            console.log("Constant saved: ", constant);
            return res.status(200).json({constant});
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({data:'serverError',err:error.message});
    }
});

// @route GET api/widgets/flarereporting/constants/
// @desc Get all the constants from the users org
// @access Private
router.get('/',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req);
        const data = req.body;
        const query = {org: meta.org}
        if ("id" in req.query) {
            query._id = req.query.id
        }
        dbRes = await Constant.find(query);
        return res.status(200).json({data:dbRes, meta});
    } catch (error) {
        console.log(error);
        res.status(500).json({data:'serverError',err:error.message});
    }
});


// @route PUT api/widgets/flarereporting/constants/:id
// @desc Update a constant
// @access Private
router.put('/:id',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req);
        const {id} = req.params;
        const data = req.body;
        const dbRes = await Constant.updateOne({_id:id, org:meta.org},data);
        console.log(dbRes)
        if (dbRes.n==0) return res.status(404).json({data:"Constant Not Found"});
        if (dbRes.nModified==0) return res.status(409).json({data:"Constant Not Updated"});
        if (dbRes.nModified==1) return res.status(200).json({data:"Constant Updated",meta});
    } catch (error) {
        console.log(error);
        res.status(500).json({data:'serverError',err:error.message});
    }
});

// @route DELETE api/widgets/flarereporting/constants/:id
// @desc delete a constant
// @access Private
router.delete('/:id',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req)
        const {id} = req.params;
        await Constant.deleteOne({_id:id, org:meta.org});
        return res.status(200).json({data:"deleted constant",meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({data:'serverError',err:error.message})
    }
});

module.exports = router;