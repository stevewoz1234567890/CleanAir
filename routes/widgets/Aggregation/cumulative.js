
const express = require('express')
const router = express.Router();
const {parseExcel} = require('../../../utils/misc/parseExcel')
const {Formula} = require('../../../utils/misc/formula')
const {myDate} = require('../../../utils/misc/myDate')
const math = require('mathjs')
const {getNumOptions} = require('../Utilities/getAllData')

/* 
Aggregator Punch List 10/25/201.
    Change all nulls in output to blanks.
    eliminate all roll units that are larger than block units in pulldown
    Keep long date but add short date (local time only)
    Add user choice to select agg only, formula only or both
    Add formulas to cumulative
*/

const calcMethods = [
    { display: 'Avg of Sums', input: 'avgOfSums' },
    { display: 'Sum of Sums', input: 'sumOfSums' },
    { display: 'Avg of Avgs', input: 'avgOfAvgs' },
    { display: 'Sum of Avgs', input: 'sumOfAvgs' },
];

const unitOptions = [
    'Hour',
    'Day',
    'Week',
    'Month',
    'Quarter',
    'Semester',
    'Year',
];

router.get('/options',async(req,res)=>{
    try {
        const {formulaData,numTags} = await getNumOptions()
        const options = [...formulaData,...numTags]
        //console.log(numTags)
        console.log(formulaData.length)
        res.status(200).json({unitOptions,calcMethods,options})
    } catch (error) {
        console.log(error)
        console.error(error.message)
        res.status(500).json({err:'serverError'})
    }
})

router.post('/', async (req,res)=>{

    try {
        
        /* If from file upload */
        let options, data
        let method = 'formdata'
        if(req.files){
            data = await parseExcel(req.files.file)
            options = JSON.parse(req.body.options)
        }else{
            data = req.body.data
            options = req.body.options
            method = 'json'
        }
        const widget = new CumulativeNew(data,options,method)
        const widgetRes = await widget.main()

        res.json(widgetRes)
    } catch (error) {
        console.log(error)
        console.error(error.message)
        res.status(500).json({err:'serverError'})
    }
});


class CumulativeNew {
    constructor(rawSheetData,userInput,method) {
        this.method = method
        this.rawSheetData = rawSheetData
        this.userInput = userInput
        this.dateValuePairs = []
        this.calculatedDataRes = null
        this.startDate = null
        this.endDate = null
        this.formula = new Formula()
        this.userInput.blockDuration = 1
        this.userInput.rollDuration = 1
        this.rollSchema = {
            blockUnit : this.userInput.blockUnit,
            rollUnit : this.userInput.rollUnit,
            sumOfSums : 0,
            sumOfAvgs : 0,
            tempRoll : 0,
            rollCount : 0,
            expectedDataPoints : 0,
            actualDataPoints : 0,
            avgValues : [],
            sumValues : [],
            avgOfAvgsValues : [],
            avgOfSumsValues : [],
            dataStart : null,
            dataEnd : null,
            sumDiffPrior : null,
            avgDiffPrior : null,
            sumOfSumsPrior : null,
            sumOfAveragesPrior : null,
            avgOfAvgsPrior : null,
            avgOfSumsPrior : null,
        }
        this.workingRollSchema = null
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

        if(this.method === 'formdata'){
            this.rawSheetData.splice(0, 1);
        }
        
        for (const row of this.rawSheetData) {
            row.rawDate = row.date
            row.rawValue = row.value
            row.date = new Date(`${row.date}`)
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
        this.calculatedDataRes = resolution / 60
    }
    async getRollDates(inputDate){
        const {blockUnit,rollUnit,blockDuration,rollDuration} = this.userInput
        const timeOffSet = this.calculatedDataRes ? this.calculatedDataRes : 0
        
        const rollDate = new myDate(inputDate)
        const rollSize = rollDate.getBlock(rollUnit,rollDuration)
        const blockSize = rollDate.getBlock(blockUnit,blockDuration)

        const rollStart = new myDate(rollDate.date)
        rollStart.addMinutes(timeOffSet)
        
        const rollEnd = new myDate(rollDate.date)
        rollEnd.addMinutes(rollSize)
        
        const nextRoll = new myDate(rollStart.date)
        nextRoll.addMinutes(rollSize)
        
        
        return {
            rollDate,
            rollStart,
            rollEnd,
            nextRoll,
            rollSize,
            blockSize
        }
    }

    async getBlockValues(rollValues){



        this.workingRollSchema.sumOfSums += rollValues.sum
        this.workingRollSchema.sumOfAvgs += rollValues.avg
        
        this.workingRollSchema.avgValues.push(rollValues.avg)
        this.workingRollSchema.sumValues.push(rollValues.sum)
        
        if(this.workingRollSchema.avgValues.length > 0 ){
            const avgOfAvgs = math.mean(this.workingRollSchema.avgValues)
            this.workingRollSchema.avgOfAvgs = avgOfAvgs
            this.workingRollSchema.avgOfAvgsValues.push(avgOfAvgs)
        }
        
        if(this.workingRollSchema.sumValues.length > 0 ){
            const avgOfSums = math.mean(this.workingRollSchema.sumValues)
            this.workingRollSchema.avgOfSums = avgOfSums
            this.workingRollSchema.avgOfSumsValues.push(avgOfSums)
        }

        this.workingRollSchema.avgOfSums = this.workingRollSchema.sumValues.length > 0 ? math.mean(this.workingRollSchema.sumValues) : null

        const mapping = {
            sumOfSums : {
                value : this.workingRollSchema.sumOfSums,
                prior : this.workingRollSchema.sumOfSumsPrior,
                data : this.workingRollSchema.sumValues,
            },
            sumOfAverages : {
                value : this.workingRollSchema.sumOfAvgs,
                prior : this.workingRollSchema.sumOfAveragesPrior,
                data : this.workingRollSchema.avgValues,
            },
            avgOfAvgs : {
                value : this.workingRollSchema.avgOfAvgs,
                prior : this.workingRollSchema.avgOfAveragesPrior,
                data : this.workingRollSchema.avgOfAvgsValues,
            },
            avgOfSums : {
                value : this.workingRollSchema.avgOfSums,
                prior : this.workingRollSchema.avgOfSumsPrior,
                data : this.workingRollSchema.avgOfSumsValues,
            },
        }


        const {value,prior,data} = mapping[this.userInput.calcMethod]
        const schema = {
            value : value,
            diff : prior ? value - prior : '',
            min : data.length>0 ? math.min(data) : '',
            max : data.length>0 ? math.max(data) : '',
            stdev : data.length > 1 ? math.std(data):'' ,
            //values : data
        }

        this.workingRollSchema.sumOfSumsPrior = this.workingRollSchema.sumOfSums
        this.workingRollSchema.sumOfAveragesPrior = this.workingRollSchema.sumOfAvgs
        this.workingRollSchema.avgOfAveragesPrior = this.workingRollSchema.avgOfAvgs
        this.workingRollSchema.avgOfSumsPrior = this.workingRollSchema.avgOfSums
        return schema
    }

    async getChunkStats(data){
        /* Validate the data values and pull them out if valid*/
        const values = []
        const dates = []
        for(const row of data){
            dates.push(row.date)
            if(row.value !== null && row.value !== '' && !isNaN(row.value)){
                values.push(row.value) 
            }
        }
        const valuesCount = values.length

        const thisSetSum = valuesCount> 0 ? math.sum(values) : ''
        const thisSetAvg = valuesCount> 0 ? math.mean(values) : ''
        const thisSetMin = valuesCount> 0 ? math.min(values) : ''
        const thisSetMax = valuesCount> 0 ? math.max(values) : ''
        const thisSetStdev = valuesCount> 0 ? math.std(values) : ''
        const rollValues = {
            sum : thisSetSum,
            avg : thisSetAvg,
            min : thisSetMin,
            max : thisSetMax,
            stdev : thisSetStdev,
            //data : data,
            valuesCount : valuesCount,
            dataCount : data.length,
        }
        const blockValues = await this.getBlockValues(rollValues)
        return {rollValues,blockValues}
    }

    async getData(){
        const {endDate,startDate} = this
        const allSchemas = []
        let rollingDate = new Date(startDate)
        rollingDate.setMinutes(0)
        rollingDate.setHours(0)
        
        this.workingRollSchema = {...this.rollSchema}
        while(rollingDate <= endDate){
            
            /* Based on the rollingDate... get the meta data */
            const {rollDate,rollStart,rollEnd,nextRoll,blockSize,rollSize} = await this.getRollDates(rollingDate)

            /* Increments the rolling date to the this date.. plus rollsize... (rollEnd.date)  */
            rollingDate = rollEnd.date
            //rollingDate.setMinutes(0)
            //rollingDate.setHours(0)

            if(!this.workingRollSchema.dataStart){
                this.workingRollSchema.dataStart =  rollStart.date
                this.workingRollSchema.blockStart = rollStart
            } 
            this.workingRollSchema.dataEnd = rollEnd.date


            /* Filter the data to get the data FOR only this roll */
            const newData = this.dateValuePairs.filter(row=> row.date >= rollStart.date && row.date <= rollEnd.date )
            
            /* Gets all the required calculated data for this roll chunk */
            const rollData = await this.getChunkStats(newData)

            /* Construct Row Data For table */
            const finalSchema = {
                rollDate : rollStart.strings.short,
                rollStart : rollStart.strings.long,
                rollEnd : rollEnd.strings.long,
                blockStart :this.workingRollSchema.blockStart.strings.long,
                blockEnd :rollEnd.strings.long,
                rollValues : rollData.rollValues,
                blockValues : rollData.blockValues,
                formulaValue : null
            }

            if(this.userInput.formula){
                finalSchema.formulaValue = this.formula.getFormulaValue(this.userInput.formula,[
                    {name : 'value', value : finalSchema.blockValues.value},
                    {name : 'diff', value : finalSchema.blockValues.diff},
                    {name : 'min', value : finalSchema.blockValues.min},
                    {name : 'max', value : finalSchema.blockValues.max},
                    {name : 'stdev', value : finalSchema.blockValues.stdev},
                ])
            }
            allSchemas.push(finalSchema)

            this.workingRollSchema.tempRoll += rollSize
            if(this.workingRollSchema.tempRoll == blockSize){
                // console.log('-----BREAK-----')
                this.workingRollSchema = {...this.rollSchema}
            }
        }
        return allSchemas


    }


}



module.exports = router;