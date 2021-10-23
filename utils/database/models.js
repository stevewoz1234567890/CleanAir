const mongoose = require('mongoose') ;
const mongoosePaginate = require('mongoose-paginate-v2');
const { Schema } = mongoose; //https://mongoosejs.com/docs/models.html

const inviteSchmea = new Schema({
    from : {
        type: Schema.Types.ObjectId, 
        ref: 'User',
        required : true
    },
    to : {
        type : String,
        required : true
    },
    org : {
        type: Schema.Types.ObjectId, 
        ref: 'Org',
        required : true
    },
    createdDate : {
        type : Date,
        default : Date.now
    },
    accepted : {
        type : Boolean,
        default : false
    },
    acceptDate : {
        type : Date,
        default : null
    },
    newUserId : {
        type: Schema.Types.ObjectId, 
        ref: 'User',
        default : null
    },
    permissionGroup : {
        type: Schema.Types.ObjectId, 
        ref: 'PermissionGroup',
        required : true
    },
    permissions : [
        {
            type: Schema.Types.ObjectId, 
            ref: 'Permission',
        },
    ],
});

const orgSchema = new Schema({
    name : {
        type : String,
        required : true,
    },
    logGroup : {
        type : String,
        required : true,
        unique : true,
        immutable: true
    },
    require2FA : {
        type : Boolean,
        required : true
    },
    logoUrl : {
        type : String,
        default : 'https://www.cleanair.com/wp-content/uploads/2018/10/logo.png'
    },
    widgets : [
        {
            type: Schema.Types.ObjectId, 
            ref: 'Widgets'
        }
    ],
    backfillEnabled : {
        type : Boolean,
        default : false
    },
    backFillQueue : [
        {
          _id : false,
          oldestDate : {
            type : Date
          },
          newestDate : {
            type : Date
          },
          isCalcsComplete : {
            type : Boolean
          },
          isEventsComplete : {
            type : Boolean
          },
          created : {
            type : Date,
            default : Date.now,
          },
        }
      ],
});

const userSchema = new Schema({
    name : {
        type : String,
        required : true
    },
    email : {
        type : String,
        required : true,
        unique : true
    },
    password : {
        type : String,
        required : true
    },
    passwordChangeDate : {
        type : Date,
        default : Date.now
    },
    createdDate : {
        type : Date,
        default : Date.now
    },
    lastLogin : {
        type : Date,
    },
    defaultOrg : {
        type: Schema.Types.ObjectId, 
        ref: 'Org',
        required : true
    },
    orgs : [
        {
            type: Schema.Types.ObjectId, 
            ref: 'Org'
        }
    ],
    previousPasswords : [
        {
            type : String,
        }
    ],
    countPasswordChanges :{
        type : Number
    },
    permissions : [
        {
            type: Schema.Types.ObjectId, 
            ref: 'Permission',
        },
    ],
    permissionGroups : [
        {
            type: Schema.Types.ObjectId, 
            ref: 'PermissionGroup',
        },
    ],
    recentAlarms: [{
        _id: false,
        start : {
          type : Date
        },
        end : {
          type : Date
        },
        eventID : {
          type : Schema.Types.ObjectId
        },
      }],
    forceLogout : {
        type : Boolean,
        default : false
    },

});

const permissionSchema = new Schema({
    description : {
        type : String,
        required : true
    },
    module : {
        type : String,
        required : true
    },
    base : {
        type : String,
        required : true
    },
    path : {
        type : String,
        required : true
    },
    method : {
        type : String,
        required : true,
        enum: ['POST','GET', 'PUT','DELETE'],
    },
    routeHash : {
        type : String,
        required : true,
    },
    createdDate : {
        type : Date,
        default : Date.now
    },



});

const twoFactorTokens = new Schema({
    user : {
        type: Schema.Types.ObjectId, 
        ref: 'User',
        required : true
    },
    token : {
        type : Number,
        required : true
    },
    createdDate : {
        type : Date,
        default : Date.now
    },
});

const resetPasswordTokens = new Schema({
    user : {
        type: Schema.Types.ObjectId, 
        ref: 'User',
        required : true
    },
    token : {
        type : Number,
        required : true
    },
    createdDate : {
        type : Date,
        default : Date.now
    },
});

const permissionGroup = new Schema({
    name : {
        type : String,
        required : true
    },
    createdDate : {
        type : Date,
        default : Date.now
    },
    permissions : [
        {
            type: Schema.Types.ObjectId, 
            ref: 'Permission',
        },
    ]
});


permissionSchema.plugin(mongoosePaginate);
permissionGroup.plugin(mongoosePaginate);
userSchema.plugin(mongoosePaginate);
orgSchema.plugin(mongoosePaginate);

orgSchema.index({org: 1, name: 1}, {unique: true});

const Org =  mongoose.model('Org', orgSchema);
const Invite =  mongoose.model('Invite', inviteSchmea);
const User = mongoose.model('User', userSchema);
const Permission = mongoose.model('Permission', permissionSchema);
const TwoFactorToken = mongoose.model('TwoFactorToken', twoFactorTokens);
const ResetPasswordToken = mongoose.model('ResetPasswordToken', resetPasswordTokens);
const PermissionGroup = mongoose.model('PermissionGroup', permissionGroup);


module.exports = {Invite,Org,User,Permission,TwoFactorToken,ResetPasswordToken,PermissionGroup}