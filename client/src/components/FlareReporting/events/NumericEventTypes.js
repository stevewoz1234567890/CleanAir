import React, { useEffect, useState } from "react";
import { Select, Input, notification, Form } from "antd";
import styled from "styled-components";
import PrePendLabel from "../utilityComponents/prependLabel";
import EditName from "../utilityComponents/editName";
import CancelEditName from "../utilityComponents/cancelEditName";
import { useSelector, useDispatch } from "react-redux";
import crudSave, { crudDelete } from "../utilityFunctions/crudSave";
import usePermissions from "../../../utilities/usePermissions";
import axios from "axios";
import {
  fetchNumericEventRules,
  numericEventRulesSelector,
} from "../../../redux/slices/FMT/numericEventRulesSlice";

const { Option, OptGroup } = Select;

const ConditionWrapper = styled.div`
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-variant: tabular-nums;
  list-style: none;
  font-feature-settings: "tnum", "tnum";
  position: relative;
  display: inline-block;
  width: 100%;
  min-width: 0;
  padding: 4px 11px;
  color: rgba(0, 0, 0, 0.85);
  font-size: 16px;
  line-height: 1.5715;
  background-color: #fbfbfb;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
  transition: all 0.3s;
  display: flex;
  align-items: center;
`;

const NumericEventTypes = (props) => {
  const dispatch = useDispatch();
  const { crudAccess } = usePermissions();
  const reports = useSelector(numericEventRulesSelector);

  const [addMode, setAddMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedObj, setSelectedObj] = useState();
  const [latestSavedID, setLatestSavedID] = useState();
  const [saveLoading, setSaveLoading] = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [resolutions, setResolutions] = useState([]);
  const [uses, setUses] = useState([]);
  const [actionPeriods, setActionPeriods] = useState([]);
  const [actionOperations, setActionOperations] = useState([]);
  const [actionPeriodActions, setActionPeriodActions] = useState([]);
  const [actionInequalities, setActionInequalities] = useState([]);
  const [parameters, setParameters] = useState({});

  const [form] = Form.useForm();

  const [condition, setCondition] = useState("");

  const updateCondition = () => {
    const fields = form.getFieldsValue();
    setCondition(
      `${fields.actionPeriodLength} ${fields.actionPeriod} ${fields.actionPeriodAction} ${fields.actionOperation} ${fields.actionInequality} ${fields.actionValue}`
    );
  };

  //set initial fields
  useEffect(() => {
    if (reports) {
      const report = latestSavedID
        ? reports.find((item) => item._id === latestSavedID)
        : reports[0];
      setSelectedObj(report);
      form.setFieldsValue({
        name: report.name,
        parameter: report.parameter,
        resolution: report.resolution,
        use: report.use,
        actionPeriod: report.actionPeriod,
        actionOperation: report.actionOperation,
        actionInequality: report.actionInequality,
        actionValue: report.actionValue,
        actionPeriodLength: report.actionPeriodLength,
        actionPeriodAction: report.actionPeriodAction,
      });
      setCondition(
        `${report.actionPeriodLength} ${report.actionPeriod} ${report.actionPeriodAction} ${report.actionOperation} ${report.actionInequality} ${report.actionValue}`
      );
    }
  }, [reports, latestSavedID, form]);

  useEffect(() => {
    dispatch(fetchNumericEventRules());
    getOptionsData();
  }, []);

  const getOptionsData = async () => {
    const res = await axios.get(
      `/api/widgets/flarereporting/numeric-event-rules/options`
    );
    if (res && res.data) {
      const {
        resolution,
        use,
        actionPeriod,
        actionOperation,
        actionInequality,
        parameters,
        actionPeriodAction,
      } = res.data.data;
      setResolutions(resolution);
      setUses(use);
      setActionPeriods(actionPeriod);
      setActionOperations(actionOperation);
      setActionInequalities(actionInequality);
      setParameters(parameters);
      setActionPeriodActions(actionPeriodAction);
    }
  };

  const onReportChange = (id) => {
    const newObj = reports.filter((option) => option._id === id)[0];

    form.setFieldsValue({
      name: newObj.name,
      parameter: newObj.parameter,
      resolution: newObj.resolution,
      use: newObj.use,
      actionPeriod: newObj.actionPeriod,
      actionOperation: newObj.actionOperation,
      actionInequality: newObj.actionInequality,
      actionValue: newObj.actionValue,
      actionPeriodLength: newObj.actionPeriodLength,
      actionPeriodAction: newObj.actionPeriodAction,
    });

    //must be last
    setSelectedObj(newObj);
  };

  const onEditClick = () => {
    setEditMode(!editMode);

    if (editMode) {
      form.setFieldsValue({
        name: selectedObj.name,
      });
    }
  };

  const onAddClick = () => {
    setAddMode(!addMode);

    if (editMode === true) {
      setEditMode(false);
    }

    if (addMode === false) {
      form.resetFields();
      form.setFieldsValue({
        name: null,
        parameter: null,
        resolution: null,
        use: [],
        actionPeriod: null,
        actionOperation: null,
        actionInequality: null,
        actionValue: null,
        actionPeriodLength: null,
        actionPeriodAction: null,
      });
    } else {
      //revert to selected item on cancel add
      onReportChange(selectedObj._id);
    }
  };

  const revertAfterSave = (newID) => {
    setLatestSavedID(newID);
    setAddMode(false);
    setEditMode(false);
  };

  const onSave = async (formData) => {
    if (
      addMode &&
      reports &&
      reports.find(
        (report) => report.name.toLowerCase() === formData.name.toLowerCase()
      )
    ) {
      notification["error"]({
        message: "Error",
        placement: "bottomLeft",
        description: "Report name already exists",
      });
      return;
    } else if (reports) {
      for (let report of reports) {
        if (selectedObj._id !== report._id && formData.name === report.name) {
          notification["error"]({
            message: "Error",
            placement: "bottomLeft",
            description: "Report name already exists",
          });
          return;
        }
      }
    }

    setSaveLoading(true);

    //client ID added in flareReporting.js
    let saveObj = {
      ...formData,
      parameterType: "formula",
      resolution: Number(formData.resolution),
      actionValue: Number(formData.actionValue),
      actionPeriodLength: Number(formData.actionPeriodLength),
    };
    if (!addMode) {
      saveObj._id = selectedObj._id;
    }

    const addModeAndRevertFNobj = {
      addMode: addMode,
      revertAfterSave: revertAfterSave,
    };
    try {
      await crudSave(
        addModeAndRevertFNobj,
        { schema: saveObj, collection: "numeric-event-rules" },
        dispatch
      );
      dispatch(fetchNumericEventRules());
      setAddMode(false);
      setEditMode(false);
      setSaveLoading(false);
    } catch (err) {
      console.log(err);
      setSaveLoading(false);
    }
  };

  const onDelete = async () => {
    setDelLoading(true);
    try {
      await crudDelete("numeric-event-rules", selectedObj._id);
      dispatch(fetchNumericEventRules());
      setAddMode(false);
      setEditMode(false);
      setDelLoading(false);
    } catch (err) {
      console.log(err);
      setDelLoading(false);
    }
  };

  const onItemSelect = () => {
    setKeyword("");
  };

  return (
    <div className="card my-4">
      <h5 className="card-header">Numeric Event Types</h5>
      <div className="card-body">
        <Form form={form} onFieldsChange={updateCondition} onFinish={onSave}>
          <div className="row ml-3 justify-content-between">
            {!editMode && !addMode && (
              <div className="col-lg-12 row flex-nowrap">
                <PrePendLabel title="Event Name" />
                <Form.Item
                  style={{ flexGrow: 1 }}
                  name="name"
                  rules={[
                    {
                      required: !editMode && !addMode ? true : false,
                      message: "Please select a event",
                    },
                  ]}
                >
                  <Select
                    style={{ textAlign: "left", whiteSpace: "nowrap" }}
                    size={"large"}
                    showSearch={true}
                    onChange={(id) => onReportChange(id)}
                    filterOption={false}
                    onSearch={setKeyword}
                    onSelect={onItemSelect}
                  >
                    {reports &&
                      reports
                        .filter((option) =>
                          option.name
                            .toLowerCase()
                            .includes(keyword.toLowerCase())
                        )
                        .map((report) => (
                          <Option value={report._id} key={report._id}>
                            {report.name}
                          </Option>
                        ))}
                  </Select>
                </Form.Item>
                <EditName onClick={onEditClick} />
              </div>
            )}

            {editMode && !addMode && (
              <div className="col-lg-12 row">
                <PrePendLabel title="Event Name" />
                <Form.Item
                  style={{ flexGrow: 1 }}
                  name="name"
                  rules={[
                    {
                      required: editMode && !addMode ? true : false,
                      message: "Please enter a event name",
                    },
                  ]}
                >
                  <Input
                    type="text"
                    placeholder=""
                    style={{ textAlign: "left" }}
                    size={"large"}
                    allowClear
                  />
                </Form.Item>
                <CancelEditName onClick={onEditClick} />
              </div>
            )}

            {addMode && (
              <div className="col-lg-12 row">
                <PrePendLabel title="Event Name" />
                <Form.Item
                  style={{ flexGrow: 1 }}
                  name="name"
                  rules={[
                    {
                      required: addMode ? true : false,
                      message: "Please enter a event name",
                    },
                  ]}
                >
                  <Input
                    type="text"
                    placeholder=""
                    style={{ textAlign: "left" }}
                    size={"large"}
                    allowClear
                  />
                </Form.Item>
              </div>
            )}
          </div>
          <div className="row mx-3 justify-content-between">
            <div className="col-lg-7 row flex">
              <PrePendLabel title="Parameter" />
              <Form.Item
                style={{ flexGrow: 1 }}
                name="parameter"
                rules={[
                  { required: true, message: "Please select a Parameter" },
                ]}
              >
                <Select
                  style={{
                    textAlign: "left",
                  }}
                  size={"large"}
                  showSearch={true}
                  filterOption={false}
                  onSearch={setKeyword}
                  onSelect={onItemSelect}
                >
                  <OptGroup label="formulas">
                    {!parameters && (
                      <Option key="formulas_loader" disabled>
                        <i className="fas fa-spinner fa-spin mx-auto d-block"></i>
                      </Option>
                    )}
                    {parameters &&
                      parameters.formulaData &&
                      parameters.formulaData
                        .filter((option) =>
                          option.name
                            .toLowerCase()
                            .includes(keyword.toLowerCase())
                        )
                        .map((formula) => (
                          <Option vaue={formula.id} key={formula.id}>
                            {formula.name}
                          </Option>
                        ))}
                  </OptGroup>
                  <OptGroup label="pitags">
                    {!parameters && (
                      <Option key="formulas_loader" disabled>
                        <i className="fas fa-spinner fa-spin mx-auto d-block"></i>
                      </Option>
                    )}
                    {parameters &&
                      parameters.numericPitags &&
                      parameters.numericPitags
                        .filter((option) =>
                          (option.primary + " " + option.secondary)
                            .toLowerCase()
                            .includes(keyword.toLowerCase())
                        )
                        .map((pi_tag) => (
                          <Option vaue={pi_tag.id} key={pi_tag.id}>
                            {pi_tag.primary}{" "}
                            <span style={{ opacity: "60%" }}>
                              {pi_tag.secondary}
                            </span>
                          </Option>
                        ))}
                  </OptGroup>
                </Select>
              </Form.Item>
            </div>
            <div className="col-lg-2 row flex-nowrap">
              <PrePendLabel title="Resolution" />
              <Form.Item
                style={{ flexGrow: 1 }}
                name="resolution"
                rules={[
                  { required: true, message: "Please select a Resolution" },
                ]}
              >
                <Select
                  style={{
                    textAlign: "left",
                  }}
                  size={"large"}
                  showSearch={true}
                  filterOption={false}
                  onSearch={setKeyword}
                  onSelect={onItemSelect}
                >
                  {resolutions &&
                    resolutions
                      .filter((option) => option.toString().includes(keyword))
                      .map((resolution) => {
                        return (
                          <Option vaue={resolution} key={resolution}>
                            {resolution}
                          </Option>
                        );
                      })}
                </Select>
              </Form.Item>
            </div>
            <div className="col-lg-3 row flex-nowrap">
              <PrePendLabel title="Use" />
              <Form.Item
                style={{ flexGrow: 1 }}
                name="use"
                rules={[{ required: true, message: "Please select a Use" }]}
              >
                <Select
                  style={{
                    textAlign: "left",
                  }}
                  size={"large"}
                  showSearch={true}
                  filterOption={false}
                  onSearch={setKeyword}
                  onSelect={onItemSelect}
                  mode="multiple"
                  allowClear
                >
                  {uses &&
                    uses
                      .filter((option) =>
                        option.toLowerCase().includes(keyword.toLowerCase())
                      )
                      .map((use) => {
                        return (
                          <Option vaue={use} key={use}>
                            {use}
                          </Option>
                        );
                      })}
                </Select>
              </Form.Item>
            </div>
          </div>
          <div className="row mx-3 w-100">
            <div className="col-lg-12 row flex-nowrap">
              <PrePendLabel title="Condition" />
              <ConditionWrapper>{condition}</ConditionWrapper>
            </div>

            <div className="col-lg-12 row flex">
              <div className="card mt-4 w-100">
                <h5 className="card-header">Condition Builder</h5>
                <div className="card-body pb-0">
                  <div className="col-lg-12 m-0 row justify-content-between">
                    <div className="col-lg-6 col-sm-12 row flex-nowrap">
                      <PrePendLabel title="Period Length" />
                      <Form.Item
                        style={{ flexGrow: 1 }}
                        name="actionPeriodLength"
                        rules={[
                          {
                            required: true,
                            message: "Please select a period",
                          },
                        ]}
                      >
                        <Input
                          type="number"
                          placeholder=""
                          style={{ textAlign: "left" }}
                          size={"large"}
                        />
                      </Form.Item>
                    </div>

                    <div className="col-lg-6  col-sm-12 row flex-nowrap">
                      <PrePendLabel title="Period Unit" />
                      <Form.Item
                        style={{ flexGrow: 1 }}
                        name="actionPeriod"
                        rules={[
                          {
                            required: true,
                            message: "Please select a period",
                          },
                        ]}
                      >
                        <Select
                          style={{
                            textAlign: "left",
                          }}
                          size={"large"}
                        >
                          {actionPeriods.map((period) => (
                            <Option key={period} value={period}>
                              {period}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </div>
                  </div>

                  <div className="col-lg-12 m-0 row justify-content-between">
                    <div className="col-lg-6 row flex-nowrap">
                      <PrePendLabel title="Period Action" />
                      <Form.Item
                        style={{ flexGrow: 1 }}
                        name="actionPeriodAction"
                        rules={[
                          {
                            required: true,
                            message: "Please select an operation",
                          },
                        ]}
                      >
                        <Select
                          style={{
                            textAlign: "left",
                          }}
                          size={"large"}
                        >
                          {actionPeriodActions.map((opt) => (
                            <Option key={opt} value={opt}>
                              {opt}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </div>

                    <div className="col-lg-6 row flex-nowrap">
                      <PrePendLabel title="Operation" />
                      <Form.Item
                        style={{ flexGrow: 1 }}
                        name="actionOperation"
                        rules={[
                          {
                            required: true,
                            message: "Please select an operation",
                          },
                        ]}
                      >
                        <Select
                          style={{
                            textAlign: "left",
                          }}
                          size={"large"}
                        >
                          {actionOperations.map((opt) => (
                            <Option key={opt} value={opt}>
                              {opt}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </div>
                  </div>

                  <div className="col-lg-12 m-0 row justify-content-between">
                    <div className="col-lg-6 row flex-nowrap">
                      <PrePendLabel title="Inequality" />
                      <Form.Item
                        style={{ flexGrow: 1 }}
                        name="actionInequality"
                        rules={[
                          {
                            required: true,
                            message: "Please select a period",
                          },
                        ]}
                      >
                        <Select
                          style={{
                            textAlign: "left",
                          }}
                          size={"large"}
                        >
                          {actionInequalities.map((symbol) => (
                            <Option key={symbol} value={symbol}>
                              {symbol}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </div>

                    <div className="col-lg-6 row flex-nowrap">
                      <PrePendLabel title="Value" />
                      <Form.Item
                        style={{ flexGrow: 1 }}
                        name="actionValue"
                        rules={[
                          {
                            required: true,
                            message: "Please add a value",
                          },
                        ]}
                      >
                        <Input
                          type="number"
                          placeholder=""
                          style={{ textAlign: "left" }}
                          size={"large"}
                        />
                      </Form.Item>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="row container mt-4"
            style={{ display: "flex", justifyContent: "space-evenly" }}
          >
            {!saveLoading && (
              <button
                style={{ width: "140px" }}
                className="btn btn-success"
                htmltype="submit"
                onClick={() => form.submit}
                disabled={!crudAccess}
              >
                Save <i className="far fa-save pr-1"></i>
              </button>
            )}
            {saveLoading && (
              <button
                style={{ width: "140px" }}
                className="btn btn-success"
                disabled
              >
                <i className="fas fa-spinner fa-spin"></i>
              </button>
            )}

            <button
              style={{ width: "140px", height: "fit-content" }}
              className={!addMode ? "btn btn-info" : "btn btn-warning"}
              onClick={onAddClick}
              disabled={!crudAccess}
            >
              {!addMode && (
                <span>
                  Add <i className="fas fa-plus"></i>
                </span>
              )}
              {addMode && (
                <span>
                  Cancel <i className="fas fa-window-close"></i>
                </span>
              )}
            </button>
            {!delLoading && (
              <button
                style={{ width: "140px" }}
                className="btn btn-danger"
                onClick={onDelete}
                disabled={!crudAccess}
              >
                Delete <i className="far fa-trash-alt"></i>
              </button>
            )}
            {delLoading && (
              <span
                style={{ width: "140px" }}
                className="btn btn-danger"
                disabled
              >
                <i className="fas fa-spinner fa-spin"></i>
              </span>
            )}
          </div>
        </Form>
      </div>
    </div>
  );
};

export default NumericEventTypes;
