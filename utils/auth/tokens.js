require('dotenv').config();
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const crypto = require('crypto');  
const {redisSet,redisGet} = require('../redis/Client')
const zxcvbn = require('zxcvbn')
const passwordValidator = require('password-validator');

const expires = 60 * 60 * 12 //every 12 hours in seconds

  
/* 
  key and sess need to be moved to env vars 
  Key and Session need to be insync with front end to decrypt password
*/
const secret = '69820bc3d686ac1ad347a205b47011212b246625a962e25cb14fb2b3fbdca42f'
const session = 'ae87b73677f4e9f4565cf455aed8f43a'

const MS_PER_MIN = 60000;
const isPwExpired = async (user) =>{
  const thisUser = user.toJSON()
  if(!thisUser.passwordChangeDate){
    return true
  }
  const lastPasswordUpdateMS = thisUser.passwordChangeDate.getTime();
  const delta = MS_PER_MIN * 60 * 24 * 180; //180 Days aka half a year;
  const expireDate = new Date(lastPasswordUpdateMS + delta);
  const today = new Date()
  const expired = today > expireDate
  return expired
}

const checkPwStr = async (pw,blacklist=[]) => {
  const minLen = 8
  const maxLen = 60
  const uppercase = 1
  const lowercase = 1
  const digits = 1
  const symbols = 1

  const pwschema = new passwordValidator();
  pwschema
  .is().min(minLen)                                    // Minimum length 8
  .is().max(maxLen)                                  // Maximum length 60
  .has().uppercase(uppercase)                              // Must have uppercase letters
  .has().lowercase(lowercase)                              // Must have lowercase letters
  .has().digits(digits)                                // Must have at least 2 digits
  .has().symbols(symbols)                                //must include symbols
  .has().not().spaces()                           // Should not have spaces
  .is().not().oneOf(['Passw0rd', 'Password123',...blacklist]); // Blacklist these values
  const isValid = pwschema.validate(pw, { list: true })
  const reasonsMap = {
    min : `Minimum password length is ${minLen}`,
    max : `Maximum Password lenth is ${maxLen}`,
    uppercase : `Password must have ${uppercase} or more uppercase letters`,
    lowercase : `Password must have ${lowercase} or more lowercase letters`,
    symbols : `Password must have ${symbols} or more symbols`,
    digits : `Password must have ${digits} or more digits`,
    spaces : 'Password must not contain spaces',
    oneOf : 'Password is too common and is not allowed'
    
  }
  
  let valid = true
  let failReasons = {}
  if(isValid.length > 0){
    valid = false
    for(const reason of isValid){
      failReasons[reason] = reasonsMap[reason]
    }
  }
  // const str = zxcvbn(pw) //this might have been an old implementation... but husky had specific requirements...
  return {valid,failReasons}
}

const random2FACode = async () =>{
  //will give a number from 100000 to 999999 (inclusive).
  const num = 100000 + Math.floor(Math.random() * 900000);
  return num
}

const delCookie = async(res,key) =>{
  res.clearCookie(key);
}

const setCookie = async(res,key,value)=>{
  let minute = 1000 * 60
  
  let options = {
    maxAge: minute * 60, // would expire after 60 minutes
    httpOnly: true, // The cookie only accessible by the web server
    signed: false // Indicates if the cookie should be signed
}
  res.cookie(key,value, options)
}

const hashPassword = async (password)=>{
    const salt = await bcrypt.genSalt(10)
    const hashed = await bcrypt.hash(password,salt)
    return hashed
}

const checkPassword = async (password,hash) => {
  const isMatch = await bcrypt.compare(password,hash)
  return isMatch
}

const getRouteHash = async (route,method,path=null)=>{
  
  const combo = path? method+route+path : method+route
  const hashed = crypto.createHash('md5').update(combo).digest('hex')
  // console.log('getRouteHash',{route,path,method,combo,hashed})
  return hashed
}

const getJWT = async (user) => {
  const secretKey = process.env.SECRETKEY
  const options = {
    expiresIn : expires
  }
  const {password,previousPasswords,...userWithoutPassword} = user.toJSON()

  const payload = {
    //user : userWithoutPassword
    user : user.id
  }
  const token = jwt.sign(payload,secretKey,options)
  //await redisSet(token,JSON.stringify(userWithoutPassword),expires)
  return token
}

const verifyJWT = async (token) =>{
    const secretKey = process.env.SECRETKEY
    try {
      const decoded = jwt.verify(token,secretKey)
      return decoded
    } catch (error) {
      console.log(error.message)
    }
}

const decrypt = (text) => {
  try {
    const key = Buffer.from(secret, 'hex')
    const iv = Buffer.from(session, 'hex');
    let encryptedText = Buffer.from(text, 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    const encText = decrypted.toString();
    return encText
  } catch (error) {
    console.log(error.message)
    return null
  }

 }
 const encrypt = (text) => {
  const keyBuffer = Buffer.from(secret, 'hex')
  const sessionBuffer = Buffer.from(session, 'hex');
  let cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, sessionBuffer);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const encText = encrypted.toString('hex')
  return encText
}


module.exports = {
  hashPassword,
  checkPassword,
  getJWT,
  verifyJWT,
  getRouteHash,
  random2FACode,
  setCookie,
  delCookie,
  checkPwStr,
  isPwExpired,
  decrypt,
  encrypt

}