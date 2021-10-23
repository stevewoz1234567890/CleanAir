const express = require('express');
const router = express.Router();


router.use('/flarereporting/formulas', require('./widgets/FlareReporting/formulas'));
router.use('/flarereporting/flares', require('./widgets/FlareReporting/flares'));
router.use('/flarereporting/headers', require('./widgets/FlareReporting/headers'));
router.use('/flarereporting/pitags', require('./widgets/FlareReporting/pitags'));
router.use('/flarereporting/sensors', require('./widgets/FlareReporting/sensors'));
router.use('/flarereporting/parameters', require('./widgets/FlareReporting/parameters'));
router.use('/flarereporting/compounds', require('./widgets/FlareReporting/compounds'));
router.use('/flarereporting/constants', require('./widgets/FlareReporting/constants'));
router.use('/flarereporting/eventrules', require('./widgets/FlareReporting/eventrules'));
router.use('/flarereporting/numeric-event-rules', require('./widgets/FlareReporting/numericEventRules'));
router.use('/flarereporting/flaretimes', require('./widgets/FlareReporting/flaretimes'));
router.use('/flarereporting/charts', require('./widgets/FlareReporting/charts'));
router.use('/flarereporting/datatransfer', require('./widgets/FlareReporting/dataTransfer'));
router.use('/flarereporting/dataexport', require('./widgets/FlareReporting/dataExport'));
router.use('/flarereporting/generatereport', require('./widgets/FlareReporting/generateReport'));
router.use('/flarereporting/dashboard', require('./widgets/FlareReporting/dashboard'));
router.use('/flarereporting/jobs', require('./widgets/FlareReporting/jobs'));
router.use('/flarereporting/visible-emissions', require('./widgets/FlareReporting/visibleEmissions'));
router.use('/flarereporting/stoplightDashboard', require('./widgets/FlareReporting/stoplightDashboard'));
//router.use('/flarereporting/utilities', require('./widgets/FlareReporting/utilities'));



router.use('/utils/exceltojson', require('./widgets/Utilities/excelToJson'));
router.use('/utils/excelFormula', require('./widgets/Utilities/formulas'));






router.use('/aggregation/rolling', require('./widgets/Aggregation/rolling'));
router.use('/aggregation/cumulative', require('./widgets/Aggregation/cumulative'));


module.exports = router;