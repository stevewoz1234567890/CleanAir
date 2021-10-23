import React, { useEffect, useState } from 'react';
import DataPoints from './dataPoints';
import Dates from './dates';
import Averaging from './averaging';
import ChartDisplay from './chartdisplay';
import { notification } from 'antd';
import axios from 'axios';
import { useSelector } from 'react-redux';
import SortByName from '../utilityFunctions/sortByName';

const Chart = () => {
  const [optionsSelected, setOptionsSelected] = useState([]);
  const [averaging, setAveraging] = useState('raw');
  const [dateRangePicker, setDateRangePicker] = useState(null);
  const [dataPoints, setDataPoints] = useState();
  const [chartData, setChartData] = useState();
  const [loading, setLoading] = useState(false);
  const mode = useSelector(state => state.mode.mode);

  useEffect(() => {
    getDataOptionsAndSetDefaultNHVCZ();
  }, []);

  const getDataOptionsAndSetDefaultNHVCZ = async () => {
    const { data } = await axios.get('/api/widgets/flarereporting/charts/options');

    const options = {
      piTagOptions: SortByName(data.tags.map(tag => ({
        ...tag,
        name: tag.primary
      }))),
      formulaOptions: SortByName(data.formulas),
    };

    setDataPoints(options);
  };

  const validateApplyData = () => {
    if (optionsSelected.length === 0) {
      notification['warning']({
        message: 'Invalid Input',
        placement: 'bottomLeft',
        description: 'Please select up to 5 data points',
      });
      return false;
    }
    if (!dateRangePicker) {
      notification['warning']({
        message: 'Invalid Input',
        placement: 'bottomLeft',
        description: 'Please select a data range',
      });
      return false;
    }
    return true;
  };

  const applyData = async () => {
    if (!validateApplyData()) return;
    const selectedPiTags = dataPoints?.piTagOptions.filter(option => optionsSelected.includes(option.primary + option.secondary)).map(option => ({
      id: option.id,
      type: 'pitag'
    })) || [];
    
    const selectedFormulas = dataPoints?.formulaOptions.filter(option => optionsSelected.includes(option.primary + option.secondary)).map(option => ({
      id: option.id,
      type: 'formula',
      parentName: option.secondary
    })) || [];
    
    const requestData = [...selectedPiTags, ...selectedFormulas]
    
    const schema = {
      requested: requestData,
      start: dateRangePicker[0],
      end: dateRangePicker[1],
      debug: mode
    };
    
    try {
      setLoading(true);
      const { data } = await axios.post(
        '/api/widgets/flarereporting/charts/data/pull',
        schema
      );

      if (data && data.data && data.data.length) {
        data.data.forEach(element => {
          if (!element) {
            notification["warning"]({
              message: "No Data",
              placement: "bottomLeft",
              description: "No data to graph",
            });
          }
          if (element && !element.data.length) {
            notification["warning"]({
              message: "No Data",
              placement: "bottomLeft",
              description: `No data for ${element.details.parameter}`,
            });
          }
        });
      }

      setChartData(data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.log(err);
    }
  };

  return (
    <div className="col row mt-4 d-flex flex-column">
      <div className="d-flex w-100">
        <DataPoints
          setOptionsSelected={setOptionsSelected}
          optionsSelected={optionsSelected}
          averaging={averaging}
          dateRangePicker={dateRangePicker}
          applyData={applyData}
          dataPoints={dataPoints}
          loading={loading}
        />
        <Dates setDateRangePicker={setDateRangePicker} />
        <Averaging setAveraging={setAveraging} />
      </div>
      <div className="container mt-3 col">
        <ChartDisplay
          chartData={chartData}
          averaging={averaging}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default Chart;
