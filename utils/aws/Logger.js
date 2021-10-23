require('dotenv').config();
const AWS = require('aws-sdk');
const { response } = require('express');
// const { stream } = require('xlsx/types');
const CloudWatch = new AWS.CloudWatchLogs({
  accessKeyId:process.env.AWS_ACCSSKEY, 
  secretAccessKey:  process.env.AWS_SECRETKEY,
  region : process.env.AWS_REGION,
});

const createLogGroup = async (groupName) => {
    const params = {
        logGroupName: groupName,
    };
    
    try {
        const res = await CloudWatch.createLogGroup(params).promise()
        console.log('createLogGroup.res',res)
        
        //TODO: return log group token?
    } catch (error) {
        const describeParams = {
            limit: 3,
            logGroupNamePrefix: logName
          };
        const res2 = await CloudWatch.describeLogGroups(describeParams).promise()
        console.log('createLogGroup.res2',res2)
    }
}

const putLog = async (
    payload,
    logStream=null,
    logGroup = process.env.LOG_GROUP,
    token=null) => 
    {
        //FIXME: for testing only. Remove when ready for prod or prod-level testing 
        logGroup = process.env.LOG_GROUP;

        console.log('putLogHit')
        
        //if you don't have the token, then get it. BUT the very first log in a stream doesn't have/need a token
        if(!token){ 
            const tokenRes = await getStreamToken(logGroup,logStream)
            token = tokenRes
        }
        // console.log("token: ", token);
        
        const params = {
            logEvents: [
                {
                    message: JSON.stringify(payload),
                    timestamp: new Date().getTime()
                }
            ],
            logGroupName: logGroup, 
            logStreamName: logStream
        };
        if(token){
            params.sequenceToken = token
        }
        try {
            const response = await CloudWatch.putLogEvents(params).promise()
            // console.log('putLog',response)
            return response
        } catch (error) {
            console.log("Put error: ", error)
        }
    }

const createStream = async (groupName, streamName) => {
    const params = {
        logGroupName: groupName,
        logStreamName: streamName
      };
      try{ 
        let res = await CloudWatch.createLogStream(params).promise();
        console.log("createStream.res: ", res);
        return res

      } catch(err)  {
        console.log("createStream.err: ", err);
      }
}

const getStreamToken = async (logGroup,logStream) => {
    const params = {
        logGroupName: logGroup, /* required */
        descending: true,
        limit: 3,
        logStreamNamePrefix: logStream,
        orderBy: 'LogStreamName'
      };

      try {
        const response = await CloudWatch.describeLogStreams(params).promise();
        const streams = response.logStreams;
        // console.log("STREAMS: ", streams)
        if (!streams) {
            await createStream(logGroup, logStream);
            return null;
        }
        if (streams.length == 0) {
            return null;
        }
            
        const token = streams[0].uploadSequenceToken
        return token ? token : null
      } catch (error) {
          console.log("error in getting token: ", error)
      }
}

module.exports = {putLog, createLogGroup}