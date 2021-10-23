const mongoose = require('mongoose') ;

const ObjectId = async (str) => {
    
    if(str){
        try {
            return mongoose.Types.ObjectId(str)
        } catch (error) {
            return null
        }
    }
    return new mongoose.Types.ObjectId()
}


module.exports = {ObjectId}