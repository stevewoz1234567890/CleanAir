class myDate{
    constructor(date){
        // if(!date){
        //     date = new Date()//.toISOString().split('T')[0]

        // }
        this.dateString = date
        this.init(date)
    }
    init(date=this.date){
        this.date = new Date(date)//new Date(`${date}z`)
        //console.log({'thisDate' : this.date})
        this.tzOffset = this.date.getTimezoneOffset()
        //this.date.setMinutes(-this.tzOffset)
        //console.log({tzDate:this.date })
        this.day = this.date.getDate()
        
        this.dow = this.date.getDay()
        
        this.getYearMeta()
        this.getMonthMeta()
        this.getSemesterMeta()
        this.getQuarterMeta()
        this.getDayMeta()
        this.strings = this.getStrings()
        this.getDST()
        this.conversions = {
            minute : 1,
            hour : 60,
            day : 60 * 24,
            week : 60 * 24 * 7,
            month : this.month.minutes,
            quarter : this.quarter.minutes,
            semester : this.semester.minutes,
            year : this.year.minutes
        }
    }

    getDayMeta(){
        const index = this.date.getDate()
        const num = index
        // const start = new Date(this.date)
        // const end =  new Date(this.year.year, index + 1,0);
        const short = this.date.toLocaleDateString("en", {weekday: "short"})
        const long = this.date.toLocaleDateString("en", {weekday: "long"})
        const dow = this.date.getDay()
        this.day = {index,num,short,long,dow}
    }

    getBlock(unit,duration){
        return duration * this.conversions[unit]
    }

    getDST(){
        const jan = new Date(this.date.getFullYear(), 0, 1);
        const jul = new Date(this.date.getFullYear(), 6, 1);
        const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset())
        const offset = this.date.getTimezoneOffset()
        const dst =  offset < stdTimezoneOffset
        this.dst = {offset,dst}
    }

    getStrings(date=this.date){
        let yyyy = date.getFullYear();
        let MM = date.getMonth() + 1;
        let dd = date.getDate();
        let hh = date.getHours();
        let mm = date.getMinutes();
        const quarter = Math.floor((date.getMonth() / 3))
        const monthS = date.toLocaleDateString("en", {month: "short"})
        const monthL = date.toLocaleDateString("en", {month: "long"})
        const semesterNum = date.getMonth() < 7 ? 1 : 2
    
        if (MM < 10) MM = `0${MM}`
        if (dd < 10) dd = `0${dd}`
        if (hh < 10) hh = `0${hh}`
        if (mm < 10) mm = `0${mm}`

        const short = `${yyyy}-${MM}-${dd}`
        const long = `${yyyy}-${MM}-${dd} ${hh}:${mm}`
        const qtr = `Q${quarter+1} ${yyyy}`
        const monthShort = `${monthS} ${yyyy}`
        const monthLong = `${monthL} ${yyyy}`
        const semester = `S${semesterNum} ${yyyy}`
        const year = `${yyyy}`
        return {short,long,qtr,monthShort,monthLong,semester,year}
    }

    getYearMeta(){
        const year = this.date.getFullYear()
        const isLeap = new Date(year, 1, 29).getDate() === 29
        const start = new Date(year, 0,1);
        const end = new Date(year, 12,0);
        const days = isLeap ? 366 : 365
        const minutes = days * 24  * 60
        const hours = days * 24
        this.year = {year,start,end,days,isLeap,minutes,hours}
    }

    getMonthMeta(){
        const index = this.date.getMonth()
        const num = index + 1
        const start = new Date(this.year.year, index,1);
        const end = new Date(this.year.year, index + 1);
        const days = this.daysBetween(start,end)
        const minutes = days * 24  * 60
        const short = this.date.toLocaleDateString("en", {month: "short"})
        const long = this.date.toLocaleDateString("en", {month: "long"})
        this.month = {index,num,start,end,days,minutes,short,long}
    }

    getSemesterMeta(){
        const index = this.month.index < 6 ? 0 : 1
        const num = index + 1
        const start = new Date(this.year.year, index * 6, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 6);
        const days = this.daysBetween(start,end)
        const minutes = days * 24  * 60
        const hours = days * 24
        this.semester = {index,num,start,end,days,minutes,hours}
    }

    getQuarterMeta(){
        const index = Math.floor((this.month.index / 3))
        const num = index + 1
        const start = new Date(this.year.year, index * 3, 1)
        const end = new Date(start.getFullYear(), start.getMonth() + 3);
        const days = this.daysBetween(start,end)
        const hours = days * 24
        const minutes = days * 24  * 60
        this.quarter = {index,num,start,end,days,hours,minutes}
    }

    daysBetween(start=this.date,end){
        const millisecondsPerDay = 24 * 60 * 60 * 1000
        return Math.round(Math.abs((start.getTime() - end.getTime()) / (millisecondsPerDay)))
    }

    addMinutes(minutes){
        this.date.setMinutes(this.date.getMinutes() + minutes)
        this.init(this.date)
    }

}


module.exports = {
    myDate
  
  }