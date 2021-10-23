
const {putLog} = require('../utils/aws/Logger')

module.exports = function(req,res,next) {
    const {headers,body} = req
    putLog()
    console.log({headers,body})
    next()
}