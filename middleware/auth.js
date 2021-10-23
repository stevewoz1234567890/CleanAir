
const {verifyJWT,getRouteHash,setCookie} = require('../utils/auth/tokens')
const {User, Permission, TwoFactorToken,delCookie,PermissionGroup} = require('../utils/database/models')



module.exports = async function(req,res,next) {

    const {params,method,url,baseUrl,originalUrl,query,body,cookies,headers,route} = req
    const {path} = route
    
    const routeHash = await getRouteHash(baseUrl,method,path)
    
    //console.log({params,method,url,baseUrl,originalUrl,query,body,cookies,headers,routeHash})

    try {
        const {token} = req.cookies
        if(!token){
            res.clearCookie('token');
            return res.status(401).json({msg:"No Token, auth denied"})
        }

        /* Decode the token to get the user information */
        let jwtRes = null
        try {
            jwtRes = await verifyJWT(token)
        } catch (error) {
            return res.status(401).json({msg:"invalid token"})
        }
        

        

        const {user} = jwtRes
        
        /* Check if the user exsists */
        const options = {
                __v:0,
                password : 0,
                previousPasswords : 0
        }
        const dbUser = await User.findOne({_id:user},options).populate('defaultOrg');
        if(!dbUser){
            res.clearCookie('token');
            return res.status(401).json({msg:"No Token, auth denied"})
        }

        /* Check if user set to Force Logout */
        if(dbUser.forceLogout){
            res.clearCookie('token');
            dbUser.forceLogout = false
            await dbUser.save()
            return res.status(401).json({msg:"Forced Logout"})
        }

        /* Get the user Permission groups*/
        const userPermissionGroupsIds = dbUser.permissionGroups.map(perm=>perm.toString())
        const isDeveloper = userPermissionGroupsIds.includes('5faf5006f45c64236bd48200')
        const isSuperAdmin = userPermissionGroupsIds.includes('5faf30976ad0f41ee656a9b1')
        const isDebugGuest = userPermissionGroupsIds.includes('608adcad85fc0253808e4d73')

        /*  If the user is NOT a developer or a SuperAdmin... check for route auth */
        if(!isDeveloper && !isSuperAdmin){
            const permGroups = await PermissionGroup.find().populate('permissions') //this needs to be fixed, should only be permissions for the user
            const permGroupIds = []
            const allPerms = []
            for(const group of permGroups){
                permGroupIds.push(group._id.toString())
                const gPerms = group.permissions.map(perm=>perm.routeHash)
                allPerms.push(...gPerms)
            }
            const dbPermissions = await Permission.find({ _id: { $in: dbUser.permissions } }).lean().exec();
            const permissions = dbPermissions.map(perm=>perm.routeHash)
            allPerms.push(...permissions)
            if(!allPerms.includes(routeHash)){
                return res.status(401).json({msg:"Route not authorized"})
            }
        }else{
            // console.log({isDeveloper,isSuperAdmin})
        }

        req.user = user
        req.fullUser = dbUser
        // console.log(req.fullUser)
        req.org = dbUser.defaultOrg
        req.routeHash = routeHash
        req.isSuper = isDeveloper||isSuperAdmin
        req.isDebugGuest = isDebugGuest
        /* Refresh the cookie time.... */
        await setCookie(res,'token',token)

        next()
    } catch (err) {
        console.log(err)
        //res.clearCookie('token');
        return res.status(401).json({msg:"Token is not valid"})
    }

}