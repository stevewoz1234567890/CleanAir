import pymongo
import boto3
from bson.objectid import ObjectId
import json
from datetime import datetime, timedelta 
from statistics import mean
from dateutil.parser import parse
import asyncio
import motor.motor_asyncio
import time
import os

def _json(data,tabs=1):
    print(json.dumps(data,indent=4*tabs,default=str))
    
def lambda_handler(event, context):
    print(event)
    message = "successfully created events"
    response = {
        'statusCode': 200,
        'headers' : {
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
        }
    }
    try:
        asyncio.run(
            main(event)
        )
    except Exception as err:
        print("ERROR: ", err)
        response["statusCode"] = 500
        message = "Error occurred. Talk to Dev Team"
        #TODO Add logic to tell job that event gen failed
        return response
    response["body"] = json.dumps({"message" : message},default=str)
    print(response)
    
    try:
        client = boto3.client('lambda')
        client.invoke(
            FunctionName = 'arn:aws:lambda:us-east-1:309249889330:function:flare-reporting-create-report',
            InvocationType = 'Event', #Event, RequestResponse
            Payload = json.dumps(event)
        )
        pass
    except Exception as err:
        print("ERROR: could not invoke lambda, error: ", err)

    return response

class WidgetMain():
    def __init__(self, event):
        self.mongo = Mongo(event)
        self.flare_id = event["flare_id"]
        self.rules = None
        self.local_events = {}
        self.step = 0

    async def update_progress(self, num_rules, step):
        den = num_rules * 2
        num = step
        frac = (num / den) * 80 
        progress = int(frac)

        coll = self.mongo.get_collection("jobs")
        up = await coll.update_one({"_id": ObjectId(self.mongo.event["job_id"])}, {
            "$set": { "progress": progress}
        })
        print(f"for: {self.mongo.event['job_id']}; matched: {up.matched_count}; mod: {up.modified_count}; prog: {progress}")


   
    def get_min(self, vals):
        try:
            return min(vals)
        except:
            return vals

    def get_max(self, vals):
        try:
            return max(vals)
        except:
            return vals

    def get_avg(self, vals):
        try:
            return mean(vals)
        except:
            return vals
    
    def timedelta_to_str(self, time):
        d = time.days
        s = time.seconds
        days = d
        hours, remainder = divmod(s, 3600)
        minutes, remainder = divmod(remainder, 60)
        return f"{str(days).zfill(2)}:{str(hours).zfill(2)}:{str(minutes).zfill(2)}"
    
    def str_to_timedelta(self, time):
        t = time.split(":")
        return timedelta(days=int(t[0]), hours=int(t[1]), minutes=int(t[2]) )




    async def main(self):
        
        #This logic can probably be simplified. but it gets all the rules then only keeps the 
        #ones that are requested by the user
        await self.get_rules()
        rule_ids = self.mongo.event["rule_ids"]
        matched_rules = []
        for id in rule_ids:
            matched_rules += [
                    rule for rule in self.rules 
                    if str(rule["_id"]) ==  id 
                    # and rule["parsed"][self.flare_id] == False
                ]
        self.rules = matched_rules
        self.num_rules = len(self.rules) if len(self.rules) != 0 else 1
        """Clear all the events for each rule"""
        events_coll = self.mongo.get_collection("events")
        for rule in self.rules:
            result = await events_coll.delete_many({"rule_id":rule["_id"], "flare_id": ObjectId(self.flare_id) })
            print("Deleted: " + str(result.deleted_count))
        """Create all the events for each rule"""
        tasks = []
        for rule in self.rules:
            tasks.append(
                asyncio.create_task(
                    self.create_events(rule)
                )
            )
        await asyncio.gather(*tasks)

        for events_group in self.local_events.values():
            self.step += 1
            if len(events_group) == 0:
                await self.update_progress(self.num_rules, self.step)
                continue
            await self.update_event_records(records=events_group)
        # coll = self.mongo.get_collection("event_rules")
        # for rule in self.rules:
        #     coll.update_one({"_id":rule["_id"]}, {"$set" :{f"parsed.{self.flare_id}" : True}})
        return 

    async def create_events(self, rule):
        records = await self.mongo.get_violations( #are 
            rule=rule
        )
        str_id = str(rule["_id"])
        if str_id not in self.local_events:
            self.local_events[str_id] = []

        for record in records:
            c_record = self.get_continuation_record(rule=rule,record=record)
            if c_record:
                """ append logic """
                c_record['end'] = record['end_time']
                c_record['duration'] = self.timedelta_to_str( (self.str_to_timedelta(c_record['duration']) + timedelta(minutes=15)) )   #str((parse(c_record['duration']) + timedelta(minutes=15)).time())
                c_record['count'] = c_record['count'] + 1
                c_record['chunks'].append(record)
                if rule["with_values"]:
                    c_record['values'].append(record["value"])
                    c_record['values_min'] = self.get_min(c_record['values'])
                    c_record['values_max'] = self.get_max(c_record['values'])
                    c_record['values_avg'] = self.get_avg(c_record['values'])
            else:
                duration = ((record["end_time"] - record["start_time"] ) + timedelta(minutes=1))
                """ new logic """
                new_event = self.new_event_schema()
                new_event["rule_id"] = rule["_id"]
                new_event["flare_id"] = ObjectId(self.mongo.event["flare_id"])
                new_event["parent_id"] = record["calculated"]["parent_id"]
                new_event["start"] = record["start_time"]
                new_event["end"] = record["end_time"]
                new_event["duration"] = self.timedelta_to_str(duration)
                new_event["count"] = 1
                new_event['chunks'].append(record)
                if rule["with_values"]:
                    new_event['values'].append(record["value"])
                    new_event['values_min'] = self.get_min(new_event['values'])
                    new_event['values_max'] = self.get_max(new_event['values'])
                    new_event['values_avg'] = self.get_avg(new_event['values'])
                self.local_events[str(rule["_id"])].append(new_event)
        self.step += 1
        await self.update_progress(self.num_rules, self.step)
        

    async def update_event_records(self,records=None):
        events_collection = self.mongo.get_collection("events")
        result = await events_collection.insert_many(records)
        print("inserted: " +  str(len(result.inserted_ids)))
        await self.update_progress(self.num_rules, self.step)

    # def clear_all_docs(self):
    #     events_collection = self.mongo.get_collection("events")
    #     events_collection.delete_many({})

    def check_for_with_values(self,rule=None,record=None):        
        if not rule['with_values']:
            return
        found_logic = list(filter(
            lambda row: str(row['logic_id']) == str(rule['value_id'])
            ,record['calculated']
        ))
        if len(found_logic) == 1:
            return found_logic[0]['value']
        if len(found_logic) > 1:
            print("WARNING FOUND MORE THAN ONE LOGIC IDS FOR CHECK WITH VALUES")
            
        found_raw = list(filter(
            lambda row: str(row['pi_id']) == str(rule['value_id'])
            ,record['raw']
        ))
        if len(found_raw) == 1:
            return found_raw[0]['value']
        if len(found_raw) > 1:
            print("WARNING FOUND MORE THAN ONE LOGIC IDS FOR CHECK WITH VALUES")

    def get_record_rule_value(self,logic_id=None,record=None):
        found = list(filter(
            lambda row: str(row['logic_id']) == str(logic_id)
            ,record['calculated']
        ))
        if len(found) == 1:
            return found[0]['value']
        if len(found) == 0:
            print("ERROR.... NO LOGIC VALUE FOUND")
            return 
        if len(found) > 1:
            print("ERROR.... MORE THAN ONE VALUE FOUND")
            return


    def get_continuation_record(self, rule=None,record=None, rule_local_events=None):
        LAST_EVENT_END_TIME = record['start_time'] - timedelta(minutes=1)
        
        if False:
            """This section querys events coll for each violation. Excluding for now. May be removed in the future...tbd"""
            events_collection = self.mongo.get_collection("events")
            mongo_query = {
                "rule_id" : rule["_id"], 
                "flare_id": record['flare_id'],
                "end" : LAST_EVENT_END_TIME,
            }
            records = list(events_collection.find(mongo_query)) 
            # _json(records)
        str_id = str(rule["_id"])
        if str_id not in self.local_events:
            self.local_events[str_id] = []
        records = [event for event in self.local_events[str_id] if event["parent_id"] == record["calculated"]["parent_id"] and rule["_id"] == event["rule_id"] and ObjectId(self.mongo.event["flare_id"]) == event["flare_id"] and LAST_EVENT_END_TIME == event["end"]]


        if len(records) == 0:
            return
        if len(records) == 1:
            return records[0]
        else:
            print("ERROR FOUND MORE THAN ONE EVENT RECORD")

    def new_event_schema(self):
        return {
            "rule_id":None,
            "flare_id":None,
            "parent_id":None,
            "start":None,
            "end":None,
            "duration":None,
            "count":None,
            "reason":None,
            "corrective_action":None,
            "chunks" : [],
            "values":[],
            "values_min" : None, 
            "values_max" : None, 
            "values_avg" : None
        }

    async def get_rules(self):
        rules_collection = self.mongo.get_collection("event_rules")
        self.rules = await rules_collection.find({}).to_list(length=None)

class Mongo():
    def __init__(self,event=None,database_name=os.environ["db_name"]):
        self.conn_string = os.environ["conn_string"]
        self.database_name = database_name
        self.client = motor.motor_asyncio.AsyncIOMotorClient(self.conn_string)
        self.event = event

    async def get_values(self,records=[],rule=None):
        if rule['with_values'] == False:
            return
        
        collection = self.get_collection('pi_data')
        matches = [{'_id': ObjectId(str(record['_id']))} for record in records]
        calc_pipeline = [
            {
                '$match': {
                    '$or': matches
                }
            }, {
                '$unwind': {
                    'path': '$calculated'
                }
            }, {
                '$match': {
                    'calculated.logic_id': ObjectId(str(rule['value_id']))
                }
            }, {
                '$project': {
                    '_id': 1, 
                    'calculated': 1
                }
            }
        ]
        
        response = await collection.aggregate(calc_pipeline).to_list(length=None)
        if len(response) > 0:
            for record in records:
                for row in response:
                    if row['_id'] == record['_id']:
                        record['value'] = row['calculated']['value']
                        continue
            return
        
        raw_pipeline = [
            {
                '$match': {
                    '$or': matches
                }
            }, {
                '$project': {
                    'calculated': 0
                }
            }, {
                '$unwind': {
                    'path': '$raw'
                }
            }, {
                '$lookup': {
                    'from': 'pi_tags', 
                    'localField': 'raw.pi_id', 
                    'foreignField': '_id', 
                    'as': 'param'
                }
            }, {
                '$unwind': {
                    'path': '$param'
                }
            }, {
                '$match': {
                    'param.param_id': ObjectId(str(rule['value_id']))
                }
            }, {
                '$project': {
                    '_id': 1, 
                    'raw': 1
                }
            }
        ]
        response = list(collection.aggregate(raw_pipeline))
        if len(response) > 0:
            for record in records:
                for row in response:
                    if row['_id'] == record['_id']:
                        record['value'] = row['raw']['value']
                        continue
            return
        
        return

    async def get_violations(self,rule=None):
        collection = self.get_collection('pi_data')
        pipeline = [
            {
                '$match': {
                    'flare_id': ObjectId(self.event['flare_id']),
                    'start_time' : {'$gte': (parse(self.event["start_date"]) + timedelta(minutes=15))},
                    'end_time' : { '$lte' : (parse(self.event["end_date"])  + timedelta(days=1))}
                }
            }, 
            {
                '$unwind': {
                    'path': '$calculated'
                }
            },
            {
                '$match': {
                    'calculated.logic_id': ObjectId(rule['logic_id']), 
                    'calculated.value': rule['check_for']
                }
            },
            {
                '$project': {
                    '_id': 1, 
                    'start_time': 1, 
                    'end_time': 1,
                    'calculated.parent_id' : 1,
                    'calculated.value' : 1
                }
            }
        ]
        records = await collection.aggregate(pipeline).to_list(length=None)
        if len(records) > 0:
            
            await self.get_values(records=records,rule=rule)        
        return list(records)


    def get_collection(self,coll_name):
        db = self.client[self.database_name]
        coll = db[coll_name]
        return coll 

async def main(event):
    widget = WidgetMain(event=event)
    await widget.main()
