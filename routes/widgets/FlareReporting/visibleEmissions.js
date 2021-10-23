const express = require("express");
const router = express.Router();
const auth = require("../../../middleware/auth");
const { VisibleEmission } = require("../../../utils/database/FRTModels");
const { Org } = require("../../../utils/database/models")
const util = require("util")
const { DateTime } = require('luxon');

const { getFlares } = require("../../../utils/misc/getOrgData");
const { ConfigValueTooSmallError } = require("hyperformula");

router.get("/", [auth], async (req, res) => {
  const { startDate, endDate } = req.query;
  const { org } = req;
  const timezone = org.toObject().timezone;
  let start = new Date(startDate);
  start.setUTCHours(0,0,0,0);
  let end = new Date(endDate);
  end.setUTCHours(0,0,0,0)
  const startDateTime = DateTime.fromISO( start.toISOString() , {zone: timezone});
  const endDateTime = DateTime.fromISO( end.toISOString() , {zone: timezone}).plus({days:1});
  const localFormat = {...DateTime.DATE_SHORT, ...DateTime.TIME_24_SIMPLE}
  try {
    const flares = await getFlares();
    let visibleEmissions = await VisibleEmission.find({
      org: req.fullUser.defaultOrg._id,
      startDate: {
        $gte: new Date(startDateTime.toMillis()),
      },
      endDate: {
        $lte: new Date(endDateTime.toMillis()),
      },
    })
      .populate("flare")
      .sort({ startDate: 1 })
      .lean()
      .exec();
    visibleEmissions = visibleEmissions.map(e=>{
      e.startDate = DateTime.fromJSDate(e.startDate).setZone(timezone).toLocaleString(localFormat)
      e.endDate = DateTime.fromJSDate(e.endDate).setZone(timezone).toLocaleString(localFormat)
      return e
    })
    const data = flares.map(flare => ({
      ...flare,
      logData: visibleEmissions.filter(emission => emission.flare._id.toString() === flare._id.toString())
    }))
    return res.status(200).json(data);
  } catch (error) {
    return res.status(422).json(error.message);
  }
});

router.post("/", [auth], async (req, res) => {
  const { flareId, startDate, endDate, notes } = req.body;
  try {
    const { org } = req;
    const timezone = org.toObject().timezone;
    const startDateTime = DateTime.fromISO( startDate , {zone: timezone});
    const endDateTime = DateTime.fromISO( endDate , {zone: timezone});
    const visibleEmission = await VisibleEmission.create({
      org: req.fullUser.defaultOrg._id,
      flare: flareId,
      startDate: new Date(startDateTime.toMillis()),
      endDate: new Date(endDateTime.toMillis()),
      notes,
    });
    return res.status(200).json(visibleEmission);
  } catch (error) {
    console.log(error)
    return res.status(422).json(error.message);
  }
});

module.exports = router;
