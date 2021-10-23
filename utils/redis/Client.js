const redis = require("redis");
const { promisify } = require("util");
let client, getAsync, setAsync, setExpire,setObject,getType,getObject,getExpiration



const redisConnect = async () =>{
    client = redis.createClient();
    getAsync = promisify(client.get).bind(client);
    setAsync = promisify(client.set).bind(client);
    setExpire = promisify(client.expire).bind(client);
    setObject = promisify(client.hmset).bind(client);
    getObject = promisify(client.hgetall).bind(client);
    getType = promisify(client.type).bind(client);
    getExpiration = promisify(client.ttl).bind(client);
    console.log('Redis Connected')
}

const redisSet = async (key,value,ex=null) =>{
    if(!client) return null
    
    const type = typeof value
    if(type === 'string'){
        await setAsync(key,value)
    }else{
        await setObject(key,value)
    }
    if(ex){
        await redisSetExpire(key,ex)
    }
}

const redisSetExpire = async (key,time) => {
    if(!client) return null
    await setExpire(key, time)
}

const redisGet = async (key) =>{
    if(!client) {
        return null
    }
    const type = await getType(key)
    //console.log("type,key: ", type,key)
    let value = null
    if(type === 'hash'){
        value = await getObject(key)
    }
    else if(type === 'string'){
        value = await getAsync(key)
    }
    try {
        value = JSON.parse(value)
    } catch (error) {
        console.log(error)
    }

    const ex = await getExpiration(key)
    return {value,ex}
}





module.exports = {redisConnect,redisSet,redisSetExpire,redisGet}