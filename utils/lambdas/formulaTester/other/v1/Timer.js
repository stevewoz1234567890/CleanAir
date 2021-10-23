class Timer {
    constructor(funcname = 'Function') {
        this.funcname = funcname
        this.startTime = null
        this.endTime = null
        this.time = null
    }
    start() {
        this.startTime = new Date().getTime();
    }

    stop() {
        this.endTime = new Date().getTime();
        this.duration = (this.endTime - this.startTime) / 1000
        console.log(`${this.funcname} took ${this.duration} seconds.`)
    }
}

module.exports = Timer