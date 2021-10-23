import React from "react";
import FusionCharts from "fusioncharts";
import TimeSeries from "fusioncharts/fusioncharts.timeseries";
import ExcelExport from "fusioncharts/fusioncharts.excelexport";
import ReactFC from "react-fusioncharts";
import GammelTheme from "fusioncharts/themes/fusioncharts.theme.gammel";
import { notification } from "antd";

ReactFC.fcRoot(FusionCharts, TimeSeries, ExcelExport, GammelTheme);

//MOVE SECURELY
FusionCharts.options.license({
  key: "3lB2lsF-11E1G4E1E3B6C3E2F2F3C4B3I4zegB5B2D3oE3E1G2bapC2A3E2B-7ziB3D5D1rjvG4A9A32A6C8B3B5D2G4F4D3iacA5C5JE3uwfC5A2B2E-13nG2AC2F1zduC7E2B4G2H2I2B3D8D2B1E6C1H2H3m==",
  creditLabel: false,
});

const ChartDisplay = (props) => {
  const { chartData, average } = props;

  const dataSchema = chartData?.map((data, index) => {
    let name = data.name;
    if (name) {
      if (name.includes("Header")) {
        let parent = data.displayInfo.parent;
        parent = parent.substring(parent.indexOf(" ") + 1);
        name = name.replace("Header", parent);
      }
      if (name.includes("Flare - ")) {
        name = name.replace("Flare - ", "");
      }
    }
    return {
      name: name || "Value" + index,
      type: "number",
    };
  });

  const xAxisSchema = [
    {
      format: "%-d/%-m/%Y, %-I:%-M",
      name: "Time",
      type: "date",
    },
  ];

  const schema = xAxisSchema.concat(dataSchema);
  const filteredData = chartData.filter(
    (data) => data.data && data.data.length
  );
  if (!filteredData || !filteredData.length) {
    notification["warning"]({
      message: "No Data",
      placement: "bottomLeft",
      description: "No data to graph",
    });
  }

  const aggregatedData =
    filteredData[0]?.data.map((item, index) =>
      filteredData.reduce(
        (result, res) => [...result, res.data[index][1]],
        [item[0]]
      )
    ) || [];

  const calculateHeight = (length) => {
    switch (length) {
      case 0:
      case 1:
        return 400;
      case 2:
        return 300 * length;
      case 3:
      case 4:
        return 250 * length;
      default:
        return 200 * length;
    }
  };

  const chart = {
    type: "timeseries",
    renderAt: "container",
    width: "100%",
    height: calculateHeight(filteredData.length),
    dataSource: {
      data: aggregatedData
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
        binning:
          average === "raw"
            ? {
                year: [],
                month: [],
                day: [],
                hour: [],
                minute: [1],
                second: [],
                millisecond: [],
              }
            : {},
      },
    },
  };

  return (
    <div>
      <ReactFC {...chart} />
    </div>
  );
};

export default ChartDisplay;
