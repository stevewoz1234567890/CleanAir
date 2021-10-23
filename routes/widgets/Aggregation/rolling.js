const express = require('express')
const router = express.Router();
const {parseExcel} = require('../../../utils/misc/parseExcel')
const {Formula} = require('../../../utils/misc/formula')
const {myDate} = require('../../../utils/misc/myDate')
const math = require('mathjs')




router.post('/', async (req,res)=>{

    try {
        
        /* If from file upload */
        let data = null
        if(req.files){
            data = await parseExcel(req.files.file)
        }

        const options = {
            "blockUnit": "day",
            "blockDuration": 1,
            "rollUnit": "day",
            "rollDuration": 1,
            "formula": "=IF(value > 900,true,false)",
            "aggMethod": "avg"
          }
        const widget = new RollingTool(data,options)
        const widgetRes = await widget.main()

        res.json(widgetRes)
    } catch (error) {
        console.log(error)
        console.error(error.message)
        res.status(500).json({err:'serverError'})
    }
});




class RollingTool {
    constructor(rawSheetData,userInput){
        this.rawSheetData = rawSheetData
        this.userInput = userInput
        this.dateValuePairs = []
        this.calculatedDataRes = 60
        this.reparse = false
        this.progress = 0
        this.formula = new Formula()
    }
    async main(){
        await this.getDateValuePairs()
        const tableData = await this.getData()

        return tableData
    }

    async getDateValuePairs(){
        let resolution = null
        let lastTimeStamp = null
        let skipCount = 2

        if(!this.reparse){
            this.rawSheetData.splice(0, 1);
        }
        
        for (const row of this.rawSheetData) {
            row.rawDate = row.date
            row.rawValue = row.value
            row.date = new Date(row.date)
            row.value = parseFloat(row.value)

            if(!lastTimeStamp){
                lastTimeStamp = row.date
            }else{
                const thisTime = row.date.getTime()
                const lastTime = lastTimeStamp.getTime()
                const thisRes = thisTime - lastTime
                const secdiff = thisRes/1000
                if(!resolution){
                    resolution = secdiff
                    lastTimeStamp = row.date
                    skipCount = 2
                }else if(secdiff === resolution){
                    lastTimeStamp = row.date
                    resolution = secdiff
                    skipCount = 2
                }else if(secdiff / skipCount === resolution){
                    lastTimeStamp = row.date
                    skipCount ++
                }else if(secdiff !== 0 && secdiff !== resolution){
                    console.log({row,secdiff,resolution})
                    //throw {msg : `Inconsistent Data Resolution Row ${row.__rowNum__ + 1}`}
                }
            }
            this.dateValuePairs.push(row)
        }
        this.startDate = this.dateValuePairs[0].date
        this.endDate = this.dateValuePairs[this.dateValuePairs.length - 1].date
    }

    async getData(){
        const allSchemas = []
        const {endDate,startDate} = this
        let rollingDate = new Date(startDate)

        rollingDate.setMinutes(0)
        rollingDate.setHours(0)
        let newRollingDate = new Date(startDate)
        newRollingDate.setMinutes(0)
        newRollingDate.setHours(0)
        while(rollingDate <= endDate){
            const rollData = await this.getRollDates(rollingDate)
            const {rollDate,rollStart,rollEnd,nextRoll} = rollData
            const datapoints = this.dateValuePairs.filter(row=> row.date >= rollStart.date && row.date <= rollEnd.date )
            const values = []
            for(const row of datapoints){
                if(row.value !== null && row.value !== '' && !isNaN(row.value)){
                    values.push(row.value) 
                }
            }
            const schema = {
                dateDisplay: rollDate.strings.long, 
                dataStartDateDisplay: rollStart.strings.long, 
                dataEndDateDisplay: rollEnd.strings.long, 
                //data: null,
                value: null,
                formulaValue : null,
                countDataPoints : null,
                //valid : null,
                //rollData : rollData
            }
            
            
            const valuesCount = values.length
            let aggValue = null
            if(valuesCount > 0){
                aggValue = this.userInput.aggMethod === 'avg' ? math.mean(values) : math.sum(values)
            }
            //schema.data = datapoints
            schema.value =  aggValue
            schema.countDataPoints = valuesCount
            //schema.valid = schema.dateMeta.blocks.expectedDataPoints == valuesCount? true : false
            if(this.userInput.formula){
                schema.formulaValue = this.formula.getFormulaValue(this.userInput.formula,[
                    {name : 'value', value : aggValue},
                    {name : 'count', value : valuesCount},
                ])
            }
            //console.log({schema})
            rollingDate = new Date(nextRoll.date)
            this.progress++
            allSchemas.push(schema)
            
        }
        //console.log(allSchemas)
        return allSchemas
        
    }

    async getRollDates(inputDate){
        const {rollUnit,rollDuration,blockDuration,blockUnit} = this.userInput
        const timeOffSet = this.calculatedDataRes ? this.calculatedDataRes : 0
        const rollStart = new myDate(inputDate)
        rollStart.addMinutes(timeOffSet)
        const blockSize = rollStart.getBlock(blockUnit,blockDuration)
        const rollSize = rollStart.getBlock(rollUnit,rollDuration)

        const rollDate = new myDate(inputDate)
        rollDate.addMinutes(blockSize - rollSize)
        
        const rollEnd = new myDate(inputDate)
        rollEnd.addMinutes(blockSize)
        
        const nextRoll = new myDate(inputDate)
        nextRoll.addMinutes(rollSize)
        
        
        return {
            rollDate,
            rollStart,
            rollEnd,
            nextRoll,
            blockSize,
            rollSize
        }
    }

}



module.exports = router;