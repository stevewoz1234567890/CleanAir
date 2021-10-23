from pymongo import MongoClient
from datetime import datetime


class Mongo:
    def __init__(self, connection_string, database):
        self.database_name = database
        self.connection_string = connection_string
        self.client = MongoClient(connection_string)
    
    def connect(self):
        self.client = MongoClient(self.connection_string)

    def disconnect(self): 
        self.client.close()

    def complete_job(self, jobOID, file_url):
        query = {
            "_id": jobOID
        }
        update = {
            "isComplete" : True,
            "endDate" : datetime.now(),
            "info" : {
                "link" : file_url
            }
        }
        jobs_collection = self.get_collection("jobs")
        jobs_collection.find_one_and_update(query, {"$set": update})

    def fail_job(self, jobOID):
        query = {
            "_id": jobOID
        }
        update = {
            "isComplete" : False,
            "failed" : True,
            "endDate" : datetime.now()
        }
        jobs_collection = self.get_collection("jobs")
        jobs_collection.find_one_and_update(query, update)

    def get_collection(self, coll_name):
        db = self.client[self.database_name]
        coll = db[coll_name]
        return coll
