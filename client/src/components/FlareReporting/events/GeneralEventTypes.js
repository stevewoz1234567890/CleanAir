import React, { useEffect, useState } from "react";
import { Select, Input, notification, Form } from "antd";
import PrePendLabel from "../utilityComponents/prependLabel";
import EditName from "../utilityComponents/editName";
import CancelEditName from "../utilityComponents/cancelEditName";
import { useSelector, useDispatch } from "react-redux";
import {
  eventrulesSelector,
  fetchEventRules,
} from "../../../redux/slices/FMT/eventRulesSlice";
import { loadFormulas } from "../../../redux/slices/FMT/formulasSlice";
import {
  parametersSelector,
  fetchParameters,
} from "../../../redux/slices/FMT/parametersSlice";
import crudSave, { crudDelete } from "../utilityFunctions/crudSave";
import usePermissions from "../../../utilities/usePermissions";

const { Option, OptGroup } = Select;

const GeneralEventTypes = (props) => {
  const dispatch = useDispatch();
  const { crudAccess } = usePermissions();

  const { formulas } = useSelector((state) => state.formulas);
  const formulasBoolean = formulas.filter((f) => f.dataType === "boolean");
  const formulasNum = formulas.filter((f) => f.dataType === "num");
  const parameters = useSelector(parametersSelector);
  const parametersNum = parameters.filter((p) => p.valueType === "num");

  const reports = useSelector(eventrulesSelector);

  const [addMode, setAddMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedObj, setSelectedObj] = useState();
  const [withValues, setWithValues] = useState();
  const [latestSavedID, setLatestSavedID] = useState();
  const [saveLoading, setSaveLoading] = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const [keyword, setKeyword] = useState("");

  const [form] = Form.useForm();

  //set initial fields
  useEffect(() => {
    if (reports) {
      const report = latestSavedID
        ? reports.find((item) => item._id === latestSavedID)
        : reports[0];
      setSelectedObj(report);
      form.setFieldsValue({
        name: report.name,
        formula: report.formula,
        checkFor: report.checkFor,
        withValues: report.withValues,
        checkForValue: report.checkForValue,
        chunkSize: report.chunkSize,
        resolution: report.resolution,
        sensitivity: report.sensitivity,
      });
      setWithValues(report.withValues);
    }
  }, [reports, latestSavedID, form]);

  useEffect(() => {
    dispatch(loadFormulas());
    dispatch(fetchEventRules());
    dispatch(fetchParameters());
  }, []);

  const onReportChange = (id) => {
    const newObj = reports.filter((option) => option._id === id)[0];

    form.setFieldsValue({
      name: newObj.name,
      formula: newObj.formula,
      checkFor: newObj.checkFor,
      withValues: newObj.withValues,
      checkForValue: newObj.checkForValue,
      chunkSize: newObj.chunkSize,
      resolution: newObj.resolution,
      sensitivity: newObj.sensitivity,
    });
    setWithValues(newObj.withValues);

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
        formula: null,
        checkFor: null,
        withValues: null,
        checkForValue: null,
        chunkSize: null,
        resolution: null,
        sensitivity: null,
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
    } else {
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
    let saveObj = formData;
    if (!withValues) {
      saveObj.checkForValue = null;
    }
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
        { schema: saveObj, collection: "eventrules" },
        dispatch
      );
      dispatch(fetchEventRules());
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
      await crudDelete("eventrules", selectedObj._id);
      dispatch(fetchEventRules());
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
    <div className="card">
      <h5 className="card-header">Boolean Event Types</h5>
      <div className="card-body">
        <Form form={form} onFinish={onSave}>
          <div
            className="row mx-3"
            style={{
              justifyContent: "space-between",
            }}
          >
            {!editMode && !addMode && (
              <span className="col-lg-6 row flex-nowrap">
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
              </span>
            )}

            {editMode && !addMode && (
              <span className="col-lg-6 row">
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
              </span>
            )}

            {addMode && (
              <span className="col-lg-6 row">
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
              </span>
            )}

            <span className="col-lg-6 row flex-nowrap">
              <PrePendLabel title="Formula" />
              <Form.Item
                style={{ flexGrow: 1 }}
                name="formula"
                rules={[{ required: true, message: "Please select a formula" }]}
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
                  {formulasBoolean &&
                    formulasBoolean
                      .filter((option) =>
                        option.name
                          .toLowerCase()
                          .includes(keyword.toLowerCase())
                      )
                      .map((formula) => {
                        return (
                          <Option vaue={formula._id} key={formula._id}>
                            {formula.name}
                          </Option>
                        );
                      })}
                </Select>
              </Form.Item>
            </span>
          </div>
          <div className="row mx-3 justify-content-between">
            <span className="col-lg-3 row flex-nowrap">
              <PrePendLabel title="Check For" />
              <Form.Item
                style={{ flexGrow: 1 }}
                name="checkFor"
                rules={[
                  {
                    required: true,
                    message: 'Please select a "Check For" Option',
                  },
                ]}
              >
                <Select
                  style={{
                    textAlign: "left",
                  }}
                  size={"large"}
                >
                  <Option value={true}>True</Option>
                  <Option value={false}>False</Option>
                </Select>
              </Form.Item>
            </span>

            <span className="col-lg-3 row flex-nowrap">
              <PrePendLabel title="With Values?" />
              <Form.Item
                style={{ flexGrow: 1 }}
                name="withValues"
                rules={[
                  {
                    required: true,
                    message: 'Please select a "With Values" Option',
                  },
                ]}
              >
                <Select
                  style={{
                    textAlign: "left",
                  }}
                  size={"large"}
                  onChange={(value) => setWithValues(value)}
                >
                  <Option value={true}>True</Option>
                  <Option value={false}>False</Option>
                </Select>
              </Form.Item>
            </span>

            <span
              className="col-lg-5 row"
              style={{
                flexWrap: "nowrap",
              }}
            >
              <PrePendLabel title="Target Variable" />
              <Form.Item
                style={{ flexGrow: 1 }}
                name="checkForValue"
                rules={[
                  {
                    required: withValues,
                    message:
                      'Please select a target variable when "With Values" is true',
                  },
                ]}
              >
                <Select
                  style={{
                    textAlign: "left",
                  }}
                  size={"large"}
                  disabled={!withValues}
                  showSearch={true}
                  onSearch={setKeyword}
                  filterOption={false}
                  onSelect={onItemSelect}
                >
                  <OptGroup label="Formulas">
                    {formulasNum &&
                      formulasNum
                        .filter((option) =>
                          option.name
                            .toLowerCase()
                            .includes(keyword.toLowerCase())
                        )
                        .map((formula) => {
                          return (
                            <Option value={formula._id} key={formula._id}>
                              {formula.name}
                            </Option>
                          );
                        })}
                  </OptGroup>
                  <OptGroup label="Parameters">
                    {parametersNum &&
                      parametersNum
                        .filter((option) =>
                          option.name
                            .toLowerCase()
                            .includes(keyword.toLowerCase())
                        )
                        .map((parameter) => {
                          return (
                            <Option value={parameter._id} key={parameter._id}>
                              {parameter.name}
                            </Option>
                          );
                        })}
                  </OptGroup>
                </Select>
              </Form.Item>
            </span>
          </div>
          <div className="row mx-3 justify-content-between">
            <span className="col-lg-6 row flex-nowrap">
              <PrePendLabel title="Resolution" />
              <Form.Item
                style={{ flexGrow: 1 }}
                name="resolution"
                rules={[
                  {
                    required: true,
                    message: "Enter resolution number",
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
            </span>

            <span className="col-lg-6 row flex-nowrap">
              <PrePendLabel title="Sensitivity" />
              <Form.Item
                style={{ flexGrow: 1 }}
                name="sensitivity"
                rules={[
                  {
                    required: true,
                    message: "Enter sensitivity number",
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
            </span>
          </div>
          <div
            className="row container"
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

export default GeneralEventTypes;
