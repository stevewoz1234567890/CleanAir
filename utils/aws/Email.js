//require('dotenv').config();
const AWS = require('aws-sdk')
const SES = new AWS.SESV2({
  accessKeyId:process.env.AWS_ACCSSKEY, 
  secretAccessKey:  process.env.AWS_SECRETKEY
});

const FROM = 'portaladmin@cleanair.com'


const sendPasswordChangedEmail = async (address) =>{
  const text = 'Writing to let you know that your password has changed'
  
  const template = {
    from : FROM,
    to : address,
    subject : 'Password Changed',
    text: text,
    html : text,
  }
  const res = await sendEmail(template)
  console.log({'msg' : `Sent sendPasswordChangedEmail Email to ${address}`})
}

const sendPasswordForgotEmail = async (address) =>{
  const template = {
    from : FROM,
    to : address,
    subject : 'Forgot Password',
    text: '',
    html : '',
  }
  console.log({'msg' : `Sent sendPasswordForgotEmail Email to ${address}`})
}

const sendInvite = async (address,inviteId, toProd=true) =>{
  const URL = toProd === true ? process.env.PROD_URL : process.env.DEV_URL;
  const registerURL = `${URL}/signup`;
  const link = `${registerURL}?inviteId=${inviteId}&email=${address}`;
  //<a style="color: #007cc2;">test@test.com</a>
  const text = `
    <html>
      <body>
          <h1 style="color: #007cc2; text-align: center;" >CleanClould</h1>
          <h2 style="text-align: center;">CleanCloud Invitation.</h2>
          <br>
          <div style="text-align: center;">
            Hello from CleanCloud! You have been invited to create an account. <a style="color: #007cc2;" href="${link}">Your invitation ID is : ${inviteId}</a>
          </div>
          <br>
          <div style="text-align: center;">
              <span>If you need additional help, please contact us</span>
          </div>
      </body>
    </html>
  `;
  const template = {
    from : FROM,
    to : address,
    subject : 'Invitation',
    text: text,
    html : text,
  }
  console.log({'msg' : `Sent Invite Email to ${address}`})
  const res = await sendEmail(template)
}

const send2FAEmail = async (address,code) =>{
  const text = `
  <html>
    <body>
        <h1 style="color: #007cc2; text-align: center;" >CleanClould</h1>
        <h2 style="text-align: center;">Two-Factor Authentication Code</h2>
        <br>
        <div style="text-align: center;">
          Your two-factor authentication code is: <a style="font-weight: bold; font-size: medium;">${code}</a>
        </div>
        <br>
        <div style="text-align: center;">
          <br>
        </div>
    </body>
  </html>
`;

  const template = {
    from : FROM,
    to : address,
    subject : 'CleanCloud 2FA Code',
    text: text,
    html : text,
  }
  console.log({'msg' : `Sent 2FA Email to ${address}`})
  const res = await sendEmail(template)
}

const sendEmail = async (template) =>{
    const {
      from,
      to,
      subject,
      text,
      html,
    } = template

    const CCs = []
    const bCCs =[]
    const tos = Array.isArray(to) ? to : [to]
    const replyTos = []
    const charSet = 'UTF-8'

    const params = {
        Content: { 
          Simple: {
            Body: { 
              Html: {
                Data: html,
                Charset: charSet
              },
              Text: {
                Data: text, 
                Charset: charSet
              }
            },
            Subject: { 
              Data: subject,
              Charset: charSet
            }
          },
        },
        Destination: {
          BccAddresses: bCCs,
          CcAddresses: CCs,
          ToAddresses: tos
        },
        FromEmailAddress: from,
        ReplyToAddresses: replyTos
      };

    const res = await SES.sendEmail(params).promise()
    console.log(res)
}

module.exports = {
  sendEmail,
  sendPasswordChangedEmail,
  sendPasswordForgotEmail,
  sendInvite,
  send2FAEmail



}