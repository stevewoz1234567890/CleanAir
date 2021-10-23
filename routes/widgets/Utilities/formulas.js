const express = require('express')
const router = express.Router();
const {Formula} = require('../../../utils/misc/formula')

router.post('/', async (req,res)=>{

    try {
        const thisFormula = new Formula()
        const userFormula = req.body.formula
        const userVars = req.body.variables
        let response
        try {
            response = thisFormula.getFormulaValue(userFormula,userVars)
        } catch (error) {
            req.body.value = null
            req.body.error = error.message
            return res.status(500).json(req.body)
        }
        req.body.response = response

        return res.json(req.body)
    } catch (error) {
        console.log(error)
        res.status(500).json({err:'serverError'})
    }
});

module.exports = router;