const express = require('express')
const router = express.Router();
const {getRouteHash} = require('../../../utils/auth/tokens')
const {PiValue, Flare} = require('../../../utils/database/FRTModels')
const auth = require('../../../middleware/auth');

const maxLimit = 50

const getReqMeta = async (req) =>{
    const {baseUrl,method,query,isSuper} = req
    const org = req.org._id;
    const path = req.route.path
    const userId = req.user
    const routeId = await getRouteHash(baseUrl,method,path)
    if(!isSuper || !query.org){
        query.org = org
    }
    return {org,baseUrl,method,query,isSuper,userId,routeId,path}
}

// @route GET api/widgets/flarereporting/flare-times/
// @desc Get all the constants from the users org
// @access Private
router.get('/',[auth],async (req,res)=>{
    try {
        const meta = await getReqMeta(req);
        const {org} = meta;
        let query = {org};
        let filter = 'date -_id';
        let endTS = await PiValue.findOne(query, filter).sort({date:-1});
        let startTS = await PiValue.findOne(query, filter).sort({date:1});
        let apiRes = {
            start : startTS.date,
            end : endTS.date
        };
        return res.status(200).json({data:apiRes, meta});
    } catch (error) {
        console.log(error);
        res.status(500).json({data:'serverError',err:error.message});
    }
});

module.exports = router;



/*

const flares = await Flare.find({org}).select('name');
        console.log("flares: ", flares);

        for (flare in flares) {
            let query = {org};
            let filter = 'date';
            // let tsResponse = await PiValue.findOne()
            
            // Get the newest value
            // Save the timestamp
            // Get the oldest value
            // Save the timestamp
            
        }

 */