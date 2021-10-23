import React, { createRef } from 'react';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css'; // theme
import { ReactTabulator } from 'react-tabulator';
import DatabaseButtons from './databaseButtons';
import testData from './test_data';

const columns = [
  { title: 'Flare', field: 'FCC', editor: 'input', headerFilter: true },
  { title: 'Unit', field: 'UNIT', editor: 'input', headerFilter: true },
  {
    title: 'Component Type',
    field: 'Component Type',
    editor: 'input',
    headerFilter: true,
  },
  { title: 'ID', field: 'ID', editor: 'input', headerFilter: true },
  {
    title: 'Flare Header Connection',
    field: 'Flare Header Connection',
    editor: 'input',
    headerFilter: true,
  },
  {
    title: 'Comp. PR No.',
    field: 'Comp. PR No.',
    editor: 'input',
    headerFilter: true,
  },
  { title: 'Unit', field: 'Unit', editor: 'input', headerFilter: true },
  {
    title: 'Process Vessel/Vent/Source Equipment',
    field: 'Process Vessel/Vent/Source Equipment',
    editor: 'input',
    headerFilter: true,
  },
  {
    title: 'PR No.',
    field: 'Equipment PR No.',
    editor: 'input',
    headerFilter: true,
  },
  {
    title: 'Drawing Number',
    field: 'Drawing Number',
    editor: 'input',
    headerFilter: true,
  },
  { title: 'C/V', field: 'C/V', editor: 'input', headerFilter: true },
  {
    title: 'Manual Valve',
    field: 'Manual Valve',
    editor: 'input',
    headerFilter: true,
  },
  { title: 'Vent', field: 'Vent', editor: 'input', headerFilter: true },
  { title: 'PSV', field: 'PSV', editor: 'input', headerFilter: true },
  { title: 'Other', field: 'Other', editor: 'input', headerFilter: true },
  {
    title: 'Continuous',
    field: 'Continuous',
    editor: 'input',
    headerFilter: true,
  },
  {
    title: 'Intermittent',
    field: 'Intermittent',
    editor: 'input',
    headerFilter: true,
  },
  { title: 'S/D', field: 'S/D', editor: 'input', headerFilter: true },
  { title: 'S/U', field: 'S/U', editor: 'input', headerFilter: true },
  {
    title: 'Upsets/Malfunction',
    field: 'Upsets/Malfunction',
    editor: 'input',
    headerFilter: true,
  },
  { title: 'Added', field: 'Added', editor: 'input', headerFilter: true },
  { title: 'Source', field: 'Source', editor: 'input', headerFilter: true },
];

const FlareConnectionsDatabase = () => {
  const table = createRef();

  //these options are needed to fix the bug with tabulator not downloading correctly...
  const options = {
    downloadDataFormatter: (data) => data,
    downloadReady: (fileContents, blob) => blob,
  };

  return (
    <div className="card mt-4" style={{ width: '100%' }}>
      <h5 className="card-header">Flare Connections Database</h5>
      <div className="card-body" style={{ textAlign: 'center' }}>
        <ReactTabulator
          ref={table}
          data={testData}
          columns={columns}
          tooltips={true}
          height={500}
          layout={'fitColumns'}
          layoutColumnsOnNewData={true}
          options={options}
          columnMinWidth={150}
        />
        <br />
        <DatabaseButtons table={table} />
      </div>
    </div>
  );
};

export default FlareConnectionsDatabase;
