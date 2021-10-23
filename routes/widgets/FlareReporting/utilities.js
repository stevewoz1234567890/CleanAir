const express = require('express')
const axios = require('axios')
const {PiTag,PiValue,Formula,Parameter} = require('../../../utils/database/FRTModels')
const {redisGet,redisSet} = require('../../../utils/redis/Client')


const getFormulaPipeline = async (data) => {
    const agg_time_formats = {
      daily: "%Y-%m-%d",
      hourly: "%Y-%m-%d %H:00",
      raw: "%Y-%m-%d %H:%M",
    };
  
    const project = {
      calculated: 1,
      end_time: 1,
    };
    const query = {
      end_time: {
        $gte: new Date(`${data.startDate}z`),
        $lt: new Date(`${data.endDate}z`),
      },
      flare_id: ObjectId(data.flare_id),
    };
    const pipeline = [
      {
        $match: query,
      },
  
      {
        $project: project,
      },
      {
        $unwind: {
          path: "$calculated",
        },
      },
      {
        $match: { "calculated.logic_id": ObjectId(data.param_id) },
      },
      {
        $addFields: {
          value: "$calculated.value",
        },
      },
      {
        $project: {
          calculated: 0,
          _id: 0,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: agg_time_formats[data.rangeType],
              date: "$end_time",
            },
          },
          value: {
            $avg: "$value",
          },
        },
      },
      { $sort: { _id: 1 } },
    ];
    return pipeline;
};

const getPiTagPipeline = async (data) => {
    const agg_time_formats = {
      daily: "%Y-%m-%d",
      hourly: "%Y-%m-%d %H:00",
      raw: "%Y-%m-%d %H:%M",
    };
  
    const project = {
      raw: 1,
      end_time: 1,
    };
    const query = {
      end_time: {
        $gte: new Date(`${data.startDate}z`),
        $lt: new Date(`${data.endDate}z`),
      },
      flare_id: ObjectId(data.flare_id),
    };
  
    const pipeline = [
      {
        $match: query,
      },
  
      {
        $project: project,
      },
      {
        $unwind: {
          path: "$raw",
        },
      },
      {
        $match: { "raw.pi_id": ObjectId(data.param_id) },
      },
      {
        $addFields: {
          value: "$raw.value",
        },
      },
      {
        $project: {
          raw: 0,
          _id: 0,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: agg_time_formats[data.rangeType],
              date: "$end_time",
            },
          },
          value: {
            $avg: "$value",
          },
        },
      },
      { $sort: { _id: 1 } },
    ];
    return pipeline;
};

const runChartPipeline = async (data) => {
    const dbName = "flare-compliance";
    const collName = "pi_data";
    const collection = await getCollection(dbName, collName);
  
    if (data.type === "formula") {
      const pipeline = await getFormulaPipeline(data);
      const res = await collection.aggregate(pipeline).toArray();
      for (const row of res) {
        row.date = row._id;
        delete row._id;
      }
  
      return res;
    }
    if (data.type === "pi_tag") {
      const pipeline = await getPiTagPipeline(data);
      const res = await collection.aggregate(pipeline).toArray();
      for (const row of res) {
        row.date = row._id;
        delete row._id;
      }
      return res;
    }
};

const getChartData = async(body)=>{
    const fusionSchema = [
        {
          name: 'Date',
          type: 'date',
          format: '%Y-%m-%d %H:%M',
        },
      ];
      let dates = [];
      const { dataPoints, startDate, endDate, rangeType } = body;
      await Promise.all(
        dataPoints.map(async (dp) => {
          const pipelineData = { ...dp };
          pipelineData.startDate = startDate;
          pipelineData.endDate = endDate;
          pipelineData.rangeType = rangeType;
          const response = await runChartPipeline(pipelineData);
          fusionSchema.push({
            name: `${dp.text}, ${dp.sub_text}`,
            type: 'number',
          });
          const respDates = response.map((row) => row.date);
          dates = [...dates, ...respDates];
  
          dp.data = response;
        })
      );
      const unqiueDates = Array.from(new Set(dates));
      const fusionDates = unqiueDates.map((date) => [date]);
  
      for (const dp of dataPoints) {
        for (const date of fusionDates) {
          const found = dp.data.filter((row) => row.date === date[0]);
          if (found.length === 0) {
            date.push(null);
          } else {
            date.push(found[0].value);
          }
        }
      }
      return { schema: fusionSchema, data: fusionDates }
}


module.exports = {getChartData};

