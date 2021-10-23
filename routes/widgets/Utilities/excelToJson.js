const express = require('express')
const router = express.Router();
const {parseExcel} = require('../../../utils/misc/parseExcel')

router.post('/', async (req,res)=>{

    try {
        const {files:{file},body:{userOptions}} = req
        const options = JSON.parse(userOptions)
        const sheetJson = await parseExcel(file)
        return res.json(sheetJson)
    } catch (error) {
        res.status(500).json({err:'serverError'})
    }
});

module.exports = router;