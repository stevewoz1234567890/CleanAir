const axios = require('axios')
const https = require("https");
axios.defaults.timeout = 30000;
axios.defaults.httpsAgent = new https.Agent({ keepAlive: true });
const { MongoClient,ObjectId } = require("mongodb");
const util = require('util')
//const url = 'https://del0xeo27b.execute-api.us-east-1.amazonaws.com/prod/data?debug=true'
const url = 'https://del0xeo27b.execute-api.us-east-1.amazonaws.com/prod/data'

const DBNAME = 'test'
const DBURI =  "mongodb+srv://cleanairuser:EsjGFgcqPMbLzupm@cleanair-znftk.mongodb.net/test"
const PICOLL = 'pitags'
let collection = null
let client = null

const headers =  { 
    'x-api-key': 'jUzARqsbDQ4QUG8SCcNQG5cM7PAAQTbg70pAzeaW', 
    'Content-Type': 'application/json'
}

const getCollection = async (collName, dbName=process.env.MONGO_DATABASE) => {
  if(!client) await connect()
  const database = client.db(dbName);
  return database.collection(collName);
};

const connect = async () =>{
    try {
        const options = {
            useNewUrlParser : true,
            useUnifiedTopology: true
        }
        client = new MongoClient(DBURI,options);
        await client.connect();
        console.log('MongoDB Connected')
        const database = client.db(DBNAME);
        collection = database.collection('pitags')
        return client
    } catch (error) {
        console.error(`MongoDB Error ${error.message}`)
        process.exit(1)
    }
}
const arrayOfNumbers = (num) => {
    return [...Array(num).keys()]
}

const main = async()=>{
    if(!client){
        await connect()
    }
    const startTime = new Date('2020-01-01')
    
    const piTagRes = await collection.find({},{projection:{name:1}}).toArray()
    
    
    const piTags =piTagRes.map(row=>row.name)
    const minsToSim = 1440
    const arrayOfNums = arrayOfNumbers(minsToSim)
    await Promise.all(piTags.map(async (tag,index)=>{
        let utcSecs = Math.round(startTime / 1000)

        const values = arrayOfNums.map(row=>Math.random())
        const times = arrayOfNums.map(row=>{
            const thisTime = utcSecs
            utcSecs+=60
            return thisTime 
        })
        const payload = {
            p: tag,
            v : values,
            t : times,
            dev : 'production'
        }
        console.log(payload)
        //const res = await axios.post(url,payload,{headers})
        //console.log(util.inspect({res: res.data,payload}, {depth: null}));
    }))
    if(client) client.close()
}

const pushToMongo = async(data)=>{
  const valuesColl = await getCollection('pivalues')
  const orgId = ObjectId('5fb6b7ea6b029226f07d2677')
  const bulkCalls = []
  
  await Promise.all(data.map(async(row,index)=>{
      const piTag = await collection.findOne({name:row.p,org:orgId},{projection : {_id : 1}})
      //const utcSecs = Math.round(Date.now() / 1000)
      row.tag = piTag._id
      const schemas = await Promise.all(row.v.map((value,index)=>{
        //const date = new Date(0)
        //date.setUTCSeconds(row.t[index]);
        const date = new Date(row.t[index])
        const startTime = new Date(date)
        startTime.setMinutes(startTime.getMinutes() - 1)
        const mQuery = {date,org:orgId,piTag:row.tag}
        const schema = {
            piTag : row.tag,
            value : row.v[index],
            start : startTime,
            date,
            //dateRaw : row.t[index],
            //index,
            //created : new Date(),
            org : orgId,
        }
        if(row.tag.toString() === '5fdd46b4f40caa29a402475b'){
          console.log(schema)
        }
        
        
        return {updateOne : {filter:mQuery,update:{
            $set: schema,
            $setOnInsert:{
                created : new Date(),
            }
        
        },upsert:true}}
      }))
      const {result,...stats} = await valuesColl.bulkWrite(schemas)
      //const {result,...stats} = res
      console.log({stats})
      //console.log(row)
  }))

}



const getFromExcel = async()=>{
    const url = 'http://localhost:5001/parseExcel'
    const payload = {
        "fileName" : "2020Nov.xlsx",
        "batchSize" : 1440,
        "force" : false
        
    }
    if(!client) await connect()
    
    //const {data} = await axios.post(url,payload)
    //await pushToMongo(data)
    //console.log(data[0])
    //payload.force = false
    while(true){
      const {data} = await axios.post(url,payload)
      
      if(data.status) break
      await pushToMongo(data)
      console.log("BREAK")
      
    }





    if(client) client.close()
    //console.log(data)
    return
    
    
    
    
    await Promise.all(data.map(async (row,index)=>{
      try {
          const apiURL = 'https://del0xeo27b.execute-api.us-east-1.amazonaws.com/prod/data'
          const res = await axios.post(apiURL,row,{headers})
          console.log(util.inspect({res: res.data,tag:row.p,time:row.t[0]}, {depth: null}));
      } catch (error) {
          console.log(error.message)
      }

    }))
    //return

    
    
    while(true){
      const {data} = await axios.post(url,payload)
      if(data.status) return
      await Promise.all(data.map(async (row,index)=>{
        try {
            const apiURL = 'https://del0xeo27b.execute-api.us-east-1.amazonaws.com/prod/data'
            const res = await axios.post(apiURL,row,{headers})
            console.log(util.inspect({res: res.data,tag:row.p,time:row.t[0]}, {depth: null}));
        } catch (error) {
          console.log(error.message)
        }

    }))
      
      
      
      console.log(data[0])
    }
    



}

const pipelineTest = async()=>{

    const valuesColl = await getCollection('pivalues')
    const resolution = 15
    const operator = 'avg'
    const fromDateRaw = '2020-01-01'
    const fromDate = new Date(`${fromDateRaw}z`)
    //fromDate.setMinutes(fromDate.getMinutes())
    
    const toDateRaw = '2020-06-01'
    const toDate = new Date(`${toDateRaw}z`)
    //toDate.setMinutes(toDate.getMinutes() -1)
    

    // const dateRanges = []
    // let rollingDate = fromDate
    // rollingDate.setMinutes(rollingDate.getMinutes() + 1)
    // while(rollingDate < toDate){
    //   const newStart = new Date(rollingDate)
    //   const newEnd =new Date(newStart)
    //   newEnd.setMinutes(newStart.getMinutes() + resolution -1)
    //   rollingDate.setMinutes(rollingDate.getMinutes() + resolution)
    //   dateRanges.push({newStart,newEnd})
    // }


    const tags = ['5fdd46b4f40caa29a402475b'] //,'5fdd46b4f40caa29a402475c','5fdd46b6f40caa29a4024769'
    const org = '5fb6b7ea6b029226f07d2677'
    //const days = 2

    const project1 = {
      '$project': {
        'date': 1, 
        'start': 1, 
        '_id': 0, 
        'piTag': 1, 
        'value': 1
      }
    }
    const groupID = {
      $toDate: {
        $subtract: [
          { $toLong: "$start" },
          { $mod: [ { $toLong: "$start" }, 1000 * 60 * resolution ] }
        ]
      }
    }
    const groupTest = {
      $group: {
        _id: groupID,
        value: operator === 'avg' ? {$avg: '$value'} : {$sum: '$value'},
        count: { $sum: 1 },
        //firstValue :  {$first: "$value"},
        //lastValue :  {$last: "$value"},
        //firstStart :  {$first: "$start"},
        //lastStart :  {$last: "$start"},
        
        //firstEnd :  {$first: "$date"},
        //lastEnd :  {$last: "$date"},
       //
        //
        //start :  {$first: "$date"},
        end :  {$last: "$date"},
        //values : {$push: "$value"},
        //ids : {$push: "$_id"},
      }
    }

    console.log({fromDate,toDate})
    await Promise.all(tags.map(async(tag)=>{
        const match = {
          '$match': {
            'piTag': new ObjectId(tag), 
            'org': new ObjectId(org), 
            'start': {
              '$gte': fromDate, 
              '$lt': toDate, 
            }
          }
        }

        const pipeline = [
            match, 
            
            //{$sort: {start:1}},
            
            //project1, 
            groupTest,
            {$sort: {_id: 1}},
            //{$addFields: { date: { $add: ["$end", 60000] } }}, 
            {$addFields: { date: "$end",roundedValue: { $round: [ "$value", 6 ] } }}, 
            //{ $addFields: { roundedValue: { $round: [ "$value", 6 ] } } },
            {$project: {'_id': 0, 'end' : 0}},
            //{ $limit: 5},
        ]
        //console.log(pipeline)
        const res = await valuesColl.aggregate(pipeline).toArray();
        for(const row of res){
          //const {value,count,values} = row
          console.log(row)
          // console.log({
          //   value,count,
          //   start:values[0].d,
          //   end:values[values.length - 1].d,
          //   valueStart:values[0].v,
          //   valueEnd:values[values.length - 1].v 
          // })
          //console.log(util.inspect(res, {depth: null}));
        }
        console.log(res.length)
        
    }))

}


const updateRecordTest = async ()=>{
  const valuesColl = await getCollection('pivalues')
  const fromDateRaw = '2020-01-01'
  const fromDate = new Date(`${fromDateRaw}z`)
  
  const toDateRaw = '2020-02-01'
  const toDate = new Date(`${toDateRaw}z`)
  
  const query = { 
    'date': {
      '$gte': fromDate, 
      '$lte': toDate, 
    }
  }


  const update = await valuesColl.updateMany(
    query,
    [{ $set: { start: { $subtract: ["$date", 60000] } } }]
  )
  console.log(update)
}

const mainFunc = async()=>{
  await pipelineTest()
  //await getFromExcel()
  if(client) client.close()
}


mainFunc()



