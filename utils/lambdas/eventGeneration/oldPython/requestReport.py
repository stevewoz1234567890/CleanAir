import json
import boto3
import pymongo
import datetime
import subprocess

DEV = True

if __name__ == '__main__':
    try:
        import config as os
    except:
        print("Error: You're missing the config file!")
else:
    import os

class Mongo():
    def __init__(self, database_name=os.environ["db_name"]):
        self.conn_string = os.environ["conn_string"]
        self.database_name = database_name
        self.client = pymongo.MongoClient(self.conn_string)

    def get_collection(self, coll_name):
        db = self.client[self.database_name]
        coll = db[coll_name]
        return coll


def make_job(event):
    return {
        "type": "create_report",
        "flareId": event["flareId"],
        "startDT": datetime.datetime.now(),
        "endDT": None,
        "elapsed": None,
        "progress": 0,
        "failure" : False,
        "statusMsg" : "In Progress",
        "link": None
    }


def main(event):
    mongo = Mongo()
    jobs_coll = mongo.get_collection("jobs")
    new_job = make_job(event) #create job json object
    result = jobs_coll.insert_one(new_job)
    event["jobId"] = str(result.inserted_id)
    if DEV: print("","","event: ", json.dumps(event),"")
    subprocess.Popen("python generateEvents.py " + json.dumps(event).replace(" ", "")) #run gene
    return str(result.inserted_id)


def lambda_handler(event, context):
    event = json.loads(event)
    if DEV: print(event)
    job_id = main(event)

    response = {
        'statusCode': 202,
        'headers': {
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps({"message": "Processing Report Request", "job_id": job_id})
    }
    if DEV: print(response)
    return response



event = json.dumps({
    "startDate": "2020-09-02",
    "endDate": "2020-09-04",
    "flare": "5ef9218a398f068e0fe3fadf",
    "rules": ["5fde89a93518d54f48176647"],
    "job" : "5fe22a8ad5c9df3f33228067"
})


if __name__ == '__main__':
    lambda_handler(event, None)