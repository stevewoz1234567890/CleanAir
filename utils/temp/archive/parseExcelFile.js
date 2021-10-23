const XLSX = require('xlsx')
const fs = require('fs')
const fsp = fs.promises;
const ExcelJS = require('exceljs');
const tempfile = require('tempfile')


const parseExcel = async()=>{

    const filepath = '../python/2020-10.xlsx'
    // const workbook = new ExcelJS.Workbook();
    // await workbook.xlsx.readFile(filepath);
    const readStream = fs.createReadStream(filepath);
    const workbook = process_RS(readStream)
    //await workbook.xlsx.read(readStream);

    // var buffers = [];
    // readStream.on('data', function(data) {
    //     buffers.push(data);
    // });
    // readStream.on('end', function() {
    //     var buffer = Buffer.concat(buffers);
    //     var workbook = XLSX.read(buffer); // works
    // });
}

function process_RS(stream/*:ReadStream*/, cb/*:(wb:Workbook)=>void*/)/*:void*/{
    var fname = tempfile('.sheetjs');
    console.log(fname);
    var ostream = fs.createWriteStream(fname);
    stream.pipe(ostream);
    ostream.on('finish', function() {
      var workbook = XLSX.readFile(fname);
      fs.unlinkSync(fname);
   
      /* DO SOMETHING WITH workbook IN THE CALLBACK */
      cb(workbook);
    });
  }

parseExcel()