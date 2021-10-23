require("util").inspect.defaultOptions.depth = null;
const chalk = require('chalk')

const colorLogger = (props) => {
    
    
    /* 
        https://www.npmjs.com/package/chalk
        Colors = black, red, green, yellow, blue, magenta, cyan, white
        
        const testObj = {
            test: 'testing',
            
        }
        colorLogger({
            data:testObj,
            color : 'green',
            bright: true,
            bold : true
        })

    */  
    let {data,color,bold,bright} = props
    if(!bright) bright = false
    if(!bold) bold = false
    if(!color) color = 'magenta'
    const type = typeof data
    const formattedData = type == 'string' || type == 'number' ? data : JSON.stringify(data,undefined,4)

    const chalkColor = bright ? `${color}Bright` : color
    if(bold){
        console.log(chalk[chalkColor]['bold'](formattedData));
    }else{
        console.log(chalk[chalkColor](formattedData));
    }
}

module.exports = colorLogger;