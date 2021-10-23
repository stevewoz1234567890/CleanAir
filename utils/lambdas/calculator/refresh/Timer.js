

async function printElapsedTime(startTime, name=null) {
    let endTime = new Date();
    let timeDiffMS = endTime - startTime;
    timeDiffMS
    let milliElapsed = Math.round(timeDiffMS);
    let secondsElapsed = Math.floor(milliElapsed/1000);
    let milliRemainder = Math.floor((milliElapsed % 1000)/10);
    if (!name) {
        console.log(`${secondsElapsed}.${milliRemainder} seconds elapsed.`);
    } else {
        console.log(`${name} -- ${secondsElapsed}.${milliRemainder} seconds elapsed.`)
    }
}

module.exports = {printElapsedTime}