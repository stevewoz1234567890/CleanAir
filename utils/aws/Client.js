require('dotenv').config();
const AWS = require('aws-sdk')



let CloudWatch, s3, ses

new AWS.Credentials({
    accessKeyId:process.env.AWS_ACCSSKEY, 
    secretAccessKey:  process.env.AWS_SECRETKEY
  });

const AWSConnect = async () => {
    try {
        CloudWatch = new AWS.CloudWatchLogs({
            region : process.env.AWS_REGION,
        })
        
        s3 = new AWS.S3({
            region : process.env.AWS_REGION,
        })

        ses = new AWS.SESV2({apiVersion: '2019-09-27'});
        console.log('AWS Connected')
    } catch (error) {
        console.error(`CloudWatch Error ${error.message}`)
        process.exit(1)
    }

    
}

module.exports = {AWSConnect,CloudWatch,s3,ses}
