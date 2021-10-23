import React, { useState } from "react";
import { Select, Input, Form } from "antd";
import PrePendLabel from "../FlareReporting/utilityComponents/prependLabel";
import usePermissions from "../../utilities/usePermissions";
import { AGGREGATION_PAGE_BTNS_PERMISSION } from "../../constants/permissions";
const { Option } = Select;

const unitOptions = [
  "Hour",
  "Day",
  "Week",
  "Month",
  "Quarter",
  "Semester",
  "Year",
];

const rollOptions = [
  "Date",
  "Start",
  "End",
  " Average",
  "Average Diff",
  "Sum Diff",
  "Min",
  "Max",
  "STDEV",
];
const blockDateOptions = ["Start", "End"];
const sumAverageOptions = ["Value", "Min", "Max", "STDEV", "Diff"];

const methods = [
  { display: "Avg of Sums", input: "avgOfSums" },
  { display: "Sum of Sums", input: "sumOfSums" },
  { display: "Avg of Avgs", input: "avgOfAvgs" },
  { display: "Sum of Avgs", input: "sumOfAvgs" },
];

const CumulativeAgg = () => {
  const { checkPermission } = usePermissions();

  const [excelSource, setExcelsource] = useState(true); //if excelSource === false, then that means data from DB is used

  const [form] = Form.useForm();

  const parse = (formData) => {
    console.log("parsing data", formData);
  };

  const initialValues = {
    blockUnit: "month",
    rollUnit: "day",
    formula: "=IF(value > 900,true,false)",
    calcMethod: "sumOfSums",
  };

  return (
    <div className="col-lg-12 mt-4">
      <div className="card" id="data-dump" style={{ width: "100%" }}>
        <h5 className="card-header">Cumulative Aggregation</h5>
        <div className="card-body">
          <Form form={form} onFinish={parse} initialValues={initialValues}>
            <div className="row" id="aggSelectionRow">
              <div
                className="col-lg input-group"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel title="Block Unit" width={"98px"} />
                <Form.Item
                  style={{ flexGrow: 1 }}
                  name="blockUnit"
                  rules={[
                    { required: true, message: "Please select a block unit" },
                  ]}
                >
                  <Select
                    style={{ flexGrow: 1, display: "grid" }}
                    size={"large"}
                    defaultValue="month"
                  >
                    {unitOptions.map((option) => (
                      <Option key={option} value={option.toLowerCase()}>
                        {option}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>
              <div
                className="col-lg input-group"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel title="Roll Unit" width={"98px"} />
                <Form.Item
                  style={{ flexGrow: 1 }}
                  name="rollUnit"
                  rules={[
                    { required: true, message: "Please select a roll unit" },
                  ]}
                >
                  <Select
                    style={{ flexGrow: 1, display: "grid" }}
                    size={"large"}
                    defaultValue="day"
                  >
                    {unitOptions.map((option) => (
                      <Option key={option} value={option.toLowerCase()}>
                        {option}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>
              <div
                className="col-lg input-group"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel title="Method" width={"98px"} />
                <Form.Item
                  style={{ flexGrow: 1 }}
                  name="calcMethod"
                  rules={[
                    {
                      required: true,
                      message: "Please select a method",
                    },
                  ]}
                >
                  <Select
                    style={{ flexGrow: 1, display: "grid" }}
                    size={"large"}
                    defaultValue="sumOfSums"
                  >
                    {methods.map((option) => (
                      <Option key={option.input} value={option.input}>
                        {option.display}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>
            </div>

            <div className="row" id="formulaRow">
              <div
                className="col-lg input-group"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel title="Formula" width={"98px"} />
                <Form.Item
                  style={{ flexGrow: 1 }}
                  name="formula"
                  rules={[
                    { required: true, message: "Please input a formula" },
                  ]}
                >
                  <Input
                    size="large"
                    defaultValue={"=IF(value > 900,true,false)"}
                  />
                </Form.Item>
              </div>
            </div>
            <div className="row" id="aggDataRow">
              <div
                className="col-lg input-group"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel title="Source" width={"98px"} />
                <Select
                  style={{ flexGrow: 1 }}
                  size={"large"}
                  defaultValue="Excel"
                  onChange={(value) => setExcelsource(value)}
                >
                  <Option key="excel" value={true}>
                    Excel
                  </Option>
                  <Option key="database" value={false}>
                    Database
                  </Option>
                </Select>
              </div>
              {excelSource && (
                <div
                  className="col-lg"
                  style={{ display: "flex", justifyContent: "center" }}
                >
                  <Form.Item
                    style={{ flexGrow: 1, height: "1px" }}
                    name="dataSheet"
                    rules={[{ required: true, message: "Please upload data" }]}
                  >
                    <input type="file" accept=".xlsx" />
                  </Form.Item>
                </div>
              )}
              {!excelSource && (
                <div
                  className="col-lg input-group"
                  style={{ flexWrap: "nowrap" }}
                >
                  <Form.Item
                    style={{ flexGrow: 1, height: "1px" }}
                    name="data"
                    rules={[
                      { required: true, message: "Please select a datapoint" },
                    ]}
                  >
                    <Select size={"large"} placeholder="Select one datapoint">
                      <Option key="excel" value={true}>
                        DB opt 1
                      </Option>
                      <Option key="database" value={false}>
                        DB opt 2
                      </Option>
                    </Select>
                  </Form.Item>
                </div>
              )}
              <div
                className="col-lg"
                style={{ display: "flex", justifyContent: "center" }}
              >
                <button
                  className="btn btn-success"
                  style={{ width: "100%" }}
                  onClick={() => form.submit}
                  disabled={!checkPermission(AGGREGATION_PAGE_BTNS_PERMISSION)}
                >
                  Parse <i className="fas fa-calculator"></i>
                </button>
              </div>
              <div
                className="col-lg"
                style={{ display: "flex", justifyContent: "center" }}
              >
                <button
                  className="btn btn-primary"
                  style={{ width: "100%" }}
                  disabled={!checkPermission(AGGREGATION_PAGE_BTNS_PERMISSION)}
                >
                  Download Data <i className="fas fa-download"></i>
                </button>
              </div>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default CumulativeAgg;
