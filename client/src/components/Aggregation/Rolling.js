import React, { useState } from "react";
import { Select, Input, InputNumber, Form } from "antd";
import PrePendLabel from "../FlareReporting/utilityComponents/prependLabel";
import { AGGREGATION_PAGE_BTNS_PERMISSION } from "../../constants/permissions";
import usePermissions from "../../utilities/usePermissions";
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

const rollOptions = ["Hour", "Day"];
const aggMethod = ["Avg", "Sum"];

const RollingAgg = () => {
  const { checkPermission } = usePermissions();
  const [file, setFile] = useState();

  const [form] = Form.useForm();

  const onUpload = (e) => {
    setFile(e.target.files[0]);
  };

  const parse = (formData) => {
    console.log("parsing data", formData);
  };

  const initialValues = {
    blockUnit: "day",
    blockDuration: 2,
    rollUnit: "day",
    rollDuration: 1,
    formula: "=IF(value > 900,true,false)",
    aggMethod: "avg",
  };

  return (
    <div className="col-lg-12 mt-4">
      <div className="card" id="data-dump" style={{ width: "100%" }}>
        <h5 className="card-header">Rolling Aggregation</h5>
        <div className="card-body">
          <Form form={form} onFinish={parse} initialValues={initialValues}>
            <div className="row" id="blockRollRow">
              <div
                className="col-lg input-group"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel title="Block Unit" width={"130px"} />
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
                <PrePendLabel title="Block Duration" width={"130px"} />
                <Form.Item
                  style={{ flexGrow: 1 }}
                  name="blockDuration"
                  rules={[
                    {
                      required: true,
                      message: "Please select a block duration",
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    size="large"
                    min={0}
                    defaultValue={2}
                  />
                </Form.Item>
              </div>
              <div
                className="col-lg input-group"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel title={"Roll Unit"} width={"130px"} />
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
                    {rollOptions.map((option) => (
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
                <PrePendLabel title="Roll Duration" width={"130px"} />
                <Form.Item
                  style={{ flexGrow: 1 }}
                  name="rollDuration"
                  rules={[
                    {
                      required: true,
                      message: "Please select a roll duration",
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    size="large"
                    min={0}
                    defaultValue={1}
                  />
                </Form.Item>
              </div>
            </div>
            <div className="row" id="formulaAggMethodRow">
              <div
                className="col-lg-9 input-group"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel title="Formula" width={"130px"} />
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
              <div
                className="col-lg-3 input-group"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel title="Agg Method" width={"130px"} />
                <Form.Item
                  style={{ flexGrow: 1 }}
                  name="aggMethod"
                  rules={[
                    {
                      required: true,
                      message: "Please select an aggregation method",
                    },
                  ]}
                >
                  <Select
                    style={{ flexGrow: 1, display: "grid" }}
                    size={"large"}
                    defaultValue="avg"
                  >
                    {aggMethod.map((option) => (
                      <Option key={option} value={option.toLowerCase()}>
                        {option}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>
            </div>
            <div className="row" id="aggDataRow">
              <div
                className="col-lg"
                style={{ display: "flex", justifyContent: "center" }}
              >
                <input type="file" accept=".xlsx" onChange={onUpload} />
              </div>
              <div
                className="col-lg"
                style={{ display: "flex", justifyContent: "center" }}
              >
                <button className="btn btn-success" style={{ width: "100%" }} disabled={!checkPermission(AGGREGATION_PAGE_BTNS_PERMISSION)}>
                  Parse <i className="fas fa-calculator"></i>
                </button>
              </div>
              <div
                className="col-lg"
                style={{ display: "flex", justifyContent: "center" }}
              >
                <button className="btn btn-primary" style={{ width: "100%" }} disabled={!checkPermission(AGGREGATION_PAGE_BTNS_PERMISSION)}>
                  Download Agg Data <i className="fas fa-download"></i>
                </button>
              </div>
              <div
                className="col-lg"
                style={{ display: "flex", justifyContent: "center" }}
              >
                <button className="btn btn-primary" style={{ width: "100%" }} disabled={!checkPermission(AGGREGATION_PAGE_BTNS_PERMISSION)}>
                  Download Event Data <i className="fas fa-download"></i>
                </button>
              </div>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default RollingAgg;
