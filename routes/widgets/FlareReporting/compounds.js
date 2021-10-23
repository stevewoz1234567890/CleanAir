const express = require('express')
const router = express.Router();
const {getRouteHash} = require('../../../utils/auth/tokens')
const {Compound} = require('../../../utils/database/FRTModels')
const auth = require('../../../middleware/auth');
const {getCompoundGroups} = require('../../../utils/misc/getOrgData')
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

// @route POST api/widgets/flarereporting/compounds/
// @desc Create a compound
// @access Private
router.post('/',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req);
        const data = req.body;
        const dbRes = await Compound.create(data, function (err, compound) {
            if (err) {
                console.log("compound.post.err: ", err);
                // return res.status(500).json({data:'serverError',err:error.message});
                return handleError(err)
            }
            console.log("Compound saved: ", compound);
            return res.status(200).json({data:compound, meta});
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({data:'serverError',err:error.message});
    }
});

// @route GET api/widgets/flarereporting/compounds/
// @desc Get compounds
// @access Private
router.get('/',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req);
        const query = {};
        if ("id" in req.query) {
            query._id = req.query.id;
        }
        dbRes = await Compound.find(query);
        // console.log("get compounds: ", dbRes);

        getCompoundGroups({force:true})

        return res.status(200).json({data:dbRes, meta});
    } catch (error) {
        console.log(error);
        res.status(500).json({data:'serverError',err:error.message});
    }
});

// @route PUT api/widgets/flarereporting/compounds/:id
// @desc Update a compound
// @access Private
router.put('/:id',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req);
        const {id} = req.params;
        const data = req.body;
        const dbRes = await Compound.updateOne({_id:id},data);
        console.log(dbRes)
        if (dbRes.n==0) return res.status(404).json({data:"Compound Not Found",meta});
        if (dbRes.nModified==0) return res.status(409).json({data:"Compound Not Updated",meta});
        if (dbRes.nModified==1) return res.status(200).json({data:"Compound Updated",meta});
    } catch (error) {
        console.log(error);
        res.status(500).json({data:'serverError',err:error.message});
    }
});

// @route DELETE api/widgets/flarereporting/compounds/:id
// @desc delete a compound
// @access Private
router.delete('/:id',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req)
        const {id} = req.params;
        await Compound.deleteOne({_id:id});
        return res.status(200).json({data: "deleted compound",meta})
    } catch (error) {
        console.log(error)
        res.status(500).json({data:'serverError',err:error.message})
    }
});

module.exports = router;