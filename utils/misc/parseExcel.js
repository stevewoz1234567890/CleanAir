
const XLSX = require('xlsx')
const fs = require('fs').promises;

const parseExcel = async(file)=>{
    await file.mv(`./${file.name}`);
    const workbook = XLSX.readFile(`./${file.name}`, { type: 'array' })
    const first_sheet_name = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[first_sheet_name];
    const jsonOptions = {
        header: ['date', 'value'],
        raw: false,
    }
    const sheetJson = XLSX.utils.sheet_to_json(worksheet, jsonOptions)
    await fs.unlink(`./${file.name}`)
    return sheetJson
}

module.exports = {
    parseExcel
  
  }