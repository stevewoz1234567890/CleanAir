import React from "react";
import FusionCharts from "fusioncharts";
import TimeSeries from "fusioncharts/fusioncharts.timeseries";
import ExcelExport from "fusioncharts/fusioncharts.excelexport";
import ReactFC from "react-fusioncharts";
import GammelTheme from "fusioncharts/themes/fusioncharts.theme.gammel";
import { LineChartOutlined } from "@ant-design/icons";
import { Result } from "antd";

ReactFC.fcRoot(FusionCharts, TimeSeries, ExcelExport, GammelTheme);

//MOVE SECURELY
FusionCharts.options.license({
  key: "3lB2lsF-11E1G4E1E3B6C3E2F2F3C4B3I4zegB5B2D3oE3E1G2bapC2A3E2B-7ziB3D5D1rjvG4A9A32A6C8B3B5D2G4F4D3iacA5C5JE3uwfC5A2B2E-13nG2AC2F1zduC7E2B4G2H2I2B3D8D2B1E6C1H2H3m==",
  creditLabel: false,
});

const ChartDisplay = (props) => {
  const { chartData, loading, averaging } = props;

  const binning = () => {
    if (averaging === "raw") {
      return {
        year: [],
        month: [],
        day: [],
        hour: [],
        minute: [1],
        second: [],
        millisecond: [],
      };
    }
    if (averaging === "daily") {
      return {
        year: [],
        month: [],
        day: [1],
        hour: [],
        minute: [],
        second: [],
        millisecond: [],
      };
    }
    if (averaging === "hourly") {
      return {
        year: [],
        month: [],
        day: [],
        hour: [1],
        minute: [],
        second: [],
        millisecond: [],
      };
    }
    if (averaging === "dynamic") {
      return {};
    }
  };

  const aggregatedData =
    chartData?.data[0]?.data?.map((item, index) =>
      chartData.data.reduce(
        (result, res) => [
          ...result,
          res.data[index] ? res.data[index][1] : null,
        ],
        [item[0]]
      )
    ) || [];

  const dataSchema = chartData?.data?.map((data) => ({
    name: data.details.parameter + " " + data.details.parent,
    type: "number",
  }));

  const xAxisSchema = [
    {
      format: "%-d/%-m/%Y, %-I:%-M", 
      name: "Time",
      type: "date",
    },
  ];

  const schema = xAxisSchema.concat(dataSchema);

  const calculateHeight = (length) => {
    switch (length) {
      case 0:
      case 1:
        return 600;
      case 2:
        return 400 * length;

      case 5:
        return 200 * length;

      default:
        return 300 * length;
    }
  };

  const chart = {
    type: "timeseries",
    renderAt: "container",
    width: "100%",
    height: calculateHeight(chartData?.data?.length) || 700,
    dataSource: {
      data: chartData
        ? new FusionCharts.DataStore().createDataTable(aggregatedData, schema)
        : [],
      extensions: {
        customRangeSelector: {
          enabled: "0",
        },
      },
      chart: {
        theme: "gammel",
        exportEnabled: "1",
        exportFileName: "Chart",
      },
      xaxis: {
        binning: binning(),
      },
    },
  };

  return (
    <div className="h-100">
      {chartData && !loading && <ReactFC {...chart} />}
      {chartData && loading && (
        <div className="mt-5">
          <center>
            <i className="fas fa-spinner fa-spin fa-3x"></i>
          </center>
        </div>
      )}
      {!chartData && (
        <div className="card h-100 d-flex justify-content-center">
          <Result
            icon={<LineChartOutlined />}
            title="Select the fields and apply to begin graphing!"
          />
        </div>
      )}
    </div>
  );
};

export default ChartDisplay;
