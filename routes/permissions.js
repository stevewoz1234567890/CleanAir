const express = require('express')
const {check,validationResult} = require('express-validator')
const router = express.Router();
const logger = require('../middleware/logger')
const auth = require('../middleware/auth')
const {getRouteHash} = require('../utils/auth/tokens')
const {Permission,PermissionGroup} = require('../utils/database/models');
const { logError } = require('../utils/aws/LogModels');

// @route POST api/permissions
// @desc Creates a new route permission
// @access SuperAdmin
const postValidator = [
    check('description','Missing description').not().isEmpty(),
    check('module','Missing module').not().isEmpty(),
    check('base','Missing base').not().isEmpty(),
    check('path','Missing path').not().isEmpty(),
    check('method','Missing method').not().isEmpty(),
]
router.post('/',[auth,postValidator],async (req,res)=>{
    try {
        let body = req.body
        if(!Array.isArray(body)) body = [req.body]


        
        
        let SuperUserEdited = false
        let newSuperPermissions = []
        for(const param of body){
            const {description,module,base,path,method,superuser} = param
            const routeHash = await getRouteHash(base,method,path)
            const newPerm =  new Permission({description,module,base,path,method,routeHash})
            const dbRes = await Permission.findOne({routeHash})
            if(dbRes){
                return res.status(400).json({msg:'path already exsists',base,path,method})
            }
            await newPerm.save()
            if(superuser){
                newSuperPermissions.push(newPerm._id.toString())
                SuperUserEdited = true
            }
            param._id = newPerm._id.toString()
            param.routeHash = routeHash
        }

        if(SuperUserEdited){
            const superUser = await PermissionGroup.findOne({_id :'5faf30976ad0f41ee656a9b1'})
            const superPerms = superUser.permissions.map(perm=>perm.toString())
            superUser.permissions = [...new Set([...superPerms,...newSuperPermissions])];
            await superUser.save()
        }

        if(body.length === 1){
            return res.status(200).json(body[0])
        }
        return res.status(200).json(body)
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
    //res.send(req.body)
});


// @route GET api/permission
// @desc gets permissions
// @access SuperAdmin
router.get('/',[auth],async (req,res)=>{
    
    //console.log({_id,per_page,limit,page})
    try {
        /* 
            Find the permission based of the param id wrap in tc because if the passed in param id
            cannot be parsed into a valid mongo id... it will error
        */
        const options = {
            page: req.query.page ? parseInt(req.query.page) : 1,
            limit: req.query.limit ? parseInt(req.query.limit) > 50 ? 50 :  parseInt(req.query.limit) : 10,
            customLabels: {meta: 'meta'},
            projection : {
                __v:0
            },
            sort : {createdDate : 1}
        };
        const allowedQueryKeys = ['_id','module','base','path','method','routeHash']
        const query = {}
        for(const key of allowedQueryKeys){
            if(req.query[key]) query[key] = req.query[key]
        }

        const permissions = await Permission.paginate(query, options)
        return res.status(200).json(permissions)
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
    //res.send(req.body)
});

// @route POST api/permission/groups
// @desc creates a new user group
// @access SuperAdmin
router.post('/groups',[auth],async (req,res)=>{
    try {
        const {name,permissions} = req.body
        const newGrp = new PermissionGroup(req.body)
        console.log(newGrp)
        await newGrp.save()

        res.json({msg:'post groups'})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
})

router.get('/groups',[auth],async (req,res)=>{
    try {
        const groups = await PermissionGroup.find({}).populate('permissions')
        res.json(groups)
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
})


router.post('/testroute',async (req,res)=>{
    try {
        const reqBase = req.baseUrl
        const reqMethod = req.method
        const reqPath = req.route.path
        const reqParms = req.query
        
        const reqRouteHash = await getRouteHash(reqBase,reqMethod,reqPath)


        const {description,module,route,method,path} = req.body
        const routeHash = await getRouteHash(route,method,path)

        res.json({description,module,route,method,routeHash,reqRouteHash,reqBase,reqMethod,reqPath,reqParms})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
})

// @route GET api/permission/:id
// @desc gets a specific permission
// @access SuperAdmin
router.get('/:id',[auth],async (req,res)=>{
    
    try {
        const permID = req.params.id

        /* 
            Find the permission based of the param id wrap in tc because if the passed in param id
            cannot be parsed into a valid mongo id... it will error
        */
        let permission = null;
        try {
            permission = await Permission.findOne({_id:permID})
        } catch (error) {
        
        }
        if(!permission){
            return res.status(404).json({msg:'could not locate'})
        }

        return res.status(200).json(permission)
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
    //res.send(req.body)
});


// @route PUT api/permission/id
// @desc updates a permission
// @access SuperAdmin
router.put('/:id',[auth],async (req,res)=>{
    try {
        const permID = req.params.id
        const {description,module,route,method} = req.body

        /* 
            Find the permission based of the param id wrap in tc because if the passed in param id
            cannot be parsed into a valid mongo id... it will error
        */
        let permission = null;
        try {
            permission = await Permission.findOne({_id:permID})
        } catch (error) {
        
        }
        if(!permission){
            return res.status(404).json({msg:'could not locate'})
        }
        const routeHash = await getRouteHash(route,method)
        permission.description = description
        permission.module = module
        permission.route = route
        permission.method = method
        permission.routeHash = routeHash
        await permission.save()

        return res.status(200).json(permission)
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
    //res.send(req.body)
});


// @route DELETE api/permission/id
// @desc deletes a permission
// @access SuperAdmin
router.delete('/:id',[auth],async (req,res)=>{
    try {
        const permID = req.params.id

        /* 
            Find the permission based of the param id wrap in tc because if the passed in param id
            cannot be parsed into a valid mongo id... it will error
        */
        let permission = null;
        try {
            permission = await Permission.findOne({_id:permID})
        } catch (error) {
        
        }
        if(!permission){
            return res.status(404).json({msg:'could not locate'})
        }

        await Permission.deleteOne({_id:permID})

        return res.status(200).json({msg:'deleted'})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:'serverError',err:error.message})
    }
    //res.send(req.body)
});




module.exports = router;