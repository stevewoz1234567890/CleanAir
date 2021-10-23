import React from 'react';

const DatabaseButtons = (props) => {
  const table = props.table;
  const downloadXLSX = () =>
    table.current.table.download('xlsx', 'data.xlsx', { sheetName: 'MyData' }); //download a xlsx file that has a sheet name of "MyData"

  const downloadCSV = () => {
    table.current.table.download('csv', 'data.csv'); //download table data as a CSV formatted file with a file name of data.csv
  };

  const downloadJSON = () => {
    table.current.table.download('json', 'data.json');
  };

  return (
    <div
      className="col-lg-6"
      style={{ display: 'flex', justifyContent: 'space-between' }}
    >
      <button
        style={{ width: '140px' }}
        type="button"
        className="btn btn-success"
        onClick={downloadXLSX}
      >
        Download XLSX
      </button>

      <button
        style={{ width: '140px' }}
        type="button"
        className="btn btn-success"
        onClick={downloadCSV}
      >
        Download CSV
      </button>

      <button
        style={{ width: '140px' }}
        type="button"
        className="btn btn-success"
        onClick={downloadJSON}
      >
        Download JSON
      </button>
    </div>
  );
};

export default DatabaseButtons;
