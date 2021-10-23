/* eslint-disable no-lone-blocks */
/* eslint-disable no-unused-expressions */
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Select, Input, notification, Form, Modal } from "antd";
import PrePendLabel from "../utilityComponents/prependLabel";
import EditName from "../utilityComponents/editName";
import CancelEditName from "../utilityComponents/cancelEditName";
import CrudButtons from "../utilityComponents/crudButtons";
import crudSave, { crudDelete } from "../utilityFunctions/crudSave";
import { orgIdSelector } from "../../../redux/slices/userReducer";
import { fetchParameters } from "../../../redux/slices/FMT/parametersSlice";
import { fetchConstants } from "../../../redux/slices/FMT/constantsSlice";

const { Option } = Select;

//for styling purposes...
const longVariables = [
  "Carbon Molar Number",
  "Lower Flammability Limit",
  "Molecular Weight Unit of Measure",
  "Volatile Organic Compound",
  "Sulfur Molar Number"
];

const PopulateFields = (props) => {
  const { data_arr, var_arr, var_type, disabled_fields, loading } = props;

  const [addMode, setAddMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedObj, setSelectedObj] = useState();
  const [latestSavedID, setLatestSavedID] = useState();
  const [saveLoading, setSaveLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [modeStatus, setModeStatus] = useState('');
  const [formValue, setFormValue] = useState(null)
  const [confirmText, setConfirmText] = useState('');

  const org = useSelector(orgIdSelector);

  const [form] = Form.useForm();

  const dispatch = useDispatch();

  const initiateValues = () => {
    let initialValues = {};
    if (data_arr && data_arr.length) {
      const element = latestSavedID
        ? data_arr.find((el) => el._id === latestSavedID)
        : data_arr[0];

      var_arr.forEach((variable) => {
        if (
          element[variable.name] &&
          typeof element[variable.name] === "string" &&
          element[variable.name].split("_").includes("array")
        ) {
          // still need this?
          //this is for converting any "array_boolean, array_num, or array_string"
          //to just the boolean, num, or string
          initialValues[variable.name] = element[variable.name]
            .split("_")
            .sort()[1];
        } else {
          initialValues[variable.name] = element[variable.name];
        }
      });
      setSelectedObj(element);
    }
    form.setFieldsValue(initialValues);
  };

  useEffect(() => {
    initiateValues();
  }, [data_arr, form, var_arr]);

  //this is used to put the dropdown to the latest newly saved on after saving
  useEffect(() => {
    if (latestSavedID) {
      onParameterChange(latestSavedID);
    }
  }, [latestSavedID]);

  const onParameterChange = (id) => {
    const newObj = data_arr.filter((option) => option._id === id)[0];
    let obj = {};

    var_arr.forEach((variable) => {
      if (
        newObj[variable.name] &&
        typeof newObj[variable.name] === "string" &&
        newObj[variable.name].split("_").includes("array")
      ) {
        //this is for converting any "array_boolean, array_num, or array_string"
        //to just the boolean, num, or string
        obj[variable.name] = newObj[variable.name].split("_").sort()[1];
      } else {
        obj[variable.name] = newObj[variable.name];
      }
    });

    form.setFieldsValue(obj);

    //must be last
    setSelectedObj(newObj);
  };

  const onEditClick = () => {
    setEditMode(!editMode);

    if (editMode) {
      var_type === "parameters"
        ? form.setFieldsValue({
            parameter: selectedObj.parameter,
          })
        : form.setFieldsValue({
            name: selectedObj.name,
          });
    }
  };

  const toggleAddMode = (e) => {
    e?.preventDefault();
    
    setAddMode(!addMode);
    
    if (editMode === true) {
      setEditMode(false);
    }

    if (addMode === false) {
      form.resetFields();
      
      let obj = {};
      var_arr.forEach((variable) => {
        obj[variable.name] = null;
      });
      
      form.setFieldsValue(obj);
    } else {
      //revert to selected item on cancel add
      onParameterChange(selectedObj._id);
    }
  };
  
  const onDeleteClick = () => {
    showModal();
    setModeStatus('delete');
  };

  const deleteItem = async () => {

    setSaveLoading(true);
    await crudDelete(var_type, selectedObj._id);
    if (var_type === "constants") {
      dispatch(fetchConstants());
    } else {
      dispatch(fetchParameters());
    }
    initiateValues();
    setSaveLoading(false);
  }

  const onItemSelect = () => {
    setKeyword('')
  }

  const revertAfterSave = (newID) => {
    setLatestSavedID(newID);
    setAddMode(false);
    setEditMode(false);
    setFormValue(null);
  };

  const onSave =  (formData) => {
    setFormValue(formData);
    if (
      addMode &&
      data_arr.find(
        (element) =>
          (element.name || element.parameter) ===
          (formData.name || formData.parameter)
      )
    ) {
      notification["error"]({
        message: "Error",
        placement: "bottomLeft",
        description: `Name already exists`,
      });
      return;
    } else {
      for (let element of data_arr) {
        if (
          selectedObj._id !== element._id &&
          (formData.name || formData.parameter) ===
            (element.name || element.parameter)
        ) {
          notification["error"]({
            message: "Error",
            placement: "bottomLeft",
            description: "Name already exists",
          });
          return;
        }
      }
    }

    if (addMode) {
      setModeStatus('save');
      showModal();
    } else {
      saveData(formData);
    }
  };

  const saveData = async (formData) => {
    setSaveLoading(true);

    let saveObj = formData;
    if (!addMode) {
      saveObj._id = selectedObj._id;
    }

    formData.org = org;
    const addModeAndRevertFNobj = {
      addMode: addMode,
      revertAfterSave: revertAfterSave,
    };

    try {
      await crudSave(
        addModeAndRevertFNobj,
        { schema: saveObj, collection: var_type },
        dispatch
      );
      if (var_type === "constants") {
        dispatch(fetchConstants());
      } else {
        dispatch(fetchParameters());
      }
    } catch (err) {
      console.log("crud save error: ", err);
    }

    setSaveLoading(false);

    if (editMode) {
      setEditMode(false);
    }

    if (addMode) {
      toggleAddMode();
    }
  }

  const onChangeConfirmText = ({ target: { value }}) => {
    setConfirmText(value);
    setButtonEnabled(value === 'confirm');
  }

  const showModal = () => {
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setConfirmText('');
  }

  const handleOk = async () => {
    setButtonEnabled(false)
    if (modeStatus === 'delete') {
      deleteItem();
    } else {
      saveData(formValue);
    }
    closeModal();
    setModeStatus('');
  };

  return (
    <div>
      {data_arr && (
        <Form form={form} onFinish={onSave}>
          {var_arr.map((variable, index) => {
            if (variable.type === "name") {
              return (
                <div key={index}>
                  {!editMode && !addMode && (
                    <div
                      className="input-group col-lg-7 no-gutters"
                      style={{ flexWrap: "nowrap" }}
                    >
                      <PrePendLabel
                        title="Name"
                        width="160px"
                        whiteSpace={true}
                      />
                      <Form.Item
                        style={{ textAlign: "left" }}
                        className="col"
                        name={variable.name}
                        rules={[
                          {
                            required: !editMode && !addMode ? true : false,
                            message: `Please select Name`,
                          },
                        ]}
                      >
                        <Select
                          size={"large"}
                          style={{ textAlign: "left", flexGrow: 1 }}
                          showSearch={true}
                          onChange={(id) => onParameterChange(id)}
                          onSearch={setKeyword}
                          filterOption={false}
                          onSelect={onItemSelect}
                        >
                          {data_arr &&
                            data_arr
                              .filter((item) =>
                                (item.name)
                                  .toLowerCase()
                                  .includes(keyword.toLowerCase())
                              )
                              .map((option, index) => (
                                <Option value={option._id} key={index}>
                                  {option.name || option.parameter}
                                </Option>
                              ))}
                        </Select>
                      </Form.Item>
                      {!disabled_fields && <EditName onClick={onEditClick} />}
                    </div>
                  )}

                  {editMode && !addMode && (
                    <div
                      className="input-group col-lg-7 no-gutters"
                      style={{ flexWrap: "nowrap" }}
                    >
                      <PrePendLabel
                        title="Name"
                        width="160px"
                        whiteSpace={true}
                      />
                      <Form.Item
                        style={{ flexGrow: 1, textAlign: "left" }}
                        name={variable.name}
                        rules={[
                          {
                            required: editMode && !addMode ? true : false,
                            message: `Please enter Name`,
                          },
                        ]}
                      >
                        <Input
                          type="text"
                          placeholder=""
                          size={"large"}
                          allowClear
                          style={{
                            height: longVariables.includes(variable.alias)
                              ? "64px"
                              : "auto",
                          }}
                        />
                      </Form.Item>
                      <CancelEditName onClick={onEditClick} />
                    </div>
                  )}

                  {addMode && (
                    <div
                      className="input-group col-lg-7 no-gutters"
                      style={{ flexWrap: "nowrap" }}
                    >
                      <PrePendLabel
                        title="Name"
                        width="160px"
                        whiteSpace={true}
                      />
                      <Form.Item
                        style={{ flexGrow: 1, textAlign: "left" }}
                        name={variable.name}
                        rules={[
                          {
                            required: addMode ? true : false,
                            message: `Please enter ${variable.name}`,
                          },
                        ]}
                      >
                        <Input
                          type="text"
                          placeholder=""
                          size={"large"}
                          allowClear
                          style={{
                            height: longVariables.includes(variable.alias)
                              ? "64px"
                              : "auto",
                          }}
                        />
                      </Form.Item>
                    </div>
                  )}
                </div>
              );
            }

            if (variable.type === "string" || variable.type === "num") {
              return (
                <div
                  className="input-group col-lg-7 no-gutters"
                  style={{ flexWrap: "nowrap" }}
                  key={index}
                >
                  <PrePendLabel
                    title={variable.alias}
                    width="160px"
                    whiteSpace={true}
                  />
                  <Form.Item
                    name={variable.name}
                    style={{ flexGrow: 1, textAlign: "left" }}
                    rules={[
                      {
                        required:
                          variable.name === "description" ? false : true,
                        message: `Please enter ${variable.alias}`,
                      },
                    ]}
                  >
                    <Input
                      type="text"
                      placeholder=""
                      style={{
                        height: longVariables.includes(variable.alias)
                          ? "64px"
                          : "auto",
                      }}
                      size={"large"}
                      disabled={disabled_fields}
                    />
                  </Form.Item>
                </div>
              );
            }

            if (variable.type === "dropdown") {
              return (
                <div
                  className="input-group col-lg-7 no-gutters"
                  style={{ flexWrap: "nowrap" }}
                  key={index}
                >
                  <PrePendLabel
                    title={variable.alias}
                    width="160px"
                    whiteSpace={true}
                  />
                  <Form.Item
                    name={variable.name}
                    style={{ textAlign: "left" }}
                    className="col"
                    rules={[
                      {
                        required: variable.name === "uom" || variable.name === "unitOfMeasure" ? false : true,
                        message: `Please enter ${variable.alias}`,
                      },
                    ]}
                  >
                    <Select
                      style={{
                        textAlign: "left",
                        flexGrow: 1,
                        lineHeight: longVariables.includes(variable.alias)
                          ? "64px"
                          : "auto",

                        height: longVariables.includes(variable.alias)
                          ? "64px"
                          : "auto",
                      }}
                      value={selectedObj && selectedObj[variable.name]}
                      disabled={disabled_fields}
                      size={"large"}
                    >
                      {variable.options &&
                        variable.options.map((option, index) => {
                          return (
                            <Option value={option} key={index}>
                              {option}
                            </Option>
                          );
                        })}
                    </Select>
                  </Form.Item>
                </div>
              );
            }
            if (variable.type === "nestedOptionsObj") {
              return (
                <div
                  className="input-group col-lg-7 no-gutters"
                  style={{ flexWrap: "nowrap" }}
                  key={index}
                >
                  <PrePendLabel
                    title={variable.alias}
                    width="160px"
                    whiteSpace={true}
                  />
                  <Form.Item
                    name={variable.name}
                    style={{ textAlign: "left" }}
                    className="col"
                    rules={[
                      {
                        required: true,
                        message: `Please enter ${variable.alias}`,
                      },
                    ]}
                  >
                    <Select
                      style={{
                        textAlign: "left",
                        flexGrow: 1,

                        height: longVariables.includes(variable.alias)
                          ? "64px"
                          : "auto",
                      }}
                      disabled={disabled_fields}
                      size={"large"}
                      value={selectedObj && selectedObj[variable.name]}
                    >
                      {variable.options &&
                        variable.options.map((option, index) => {
                          return (
                            <Option value={option.data} key={index}>
                              {option.type}
                            </Option>
                          );
                        })}
                    </Select>
                  </Form.Item>
                </div>
              );
            }

            if (variable.type === "boolean") {
              return (
                <div
                  className="input-group col-lg-7 no-gutters"
                  style={{ flexWrap: "nowrap" }}
                  key={index}
                >
                  <PrePendLabel
                    title={variable.alias}
                    width="160px"
                    whiteSpace={true}
                  />
                  <Form.Item
                    name={variable.name}
                    style={{
                      textAlign: "left",
                      height: longVariables.includes(variable.alias)
                        ? "64px"
                        : "auto",
                    }}
                    className="col"
                    rules={[
                      {
                        required: true,
                        message: `Please enter ${variable.alias}`,
                      },
                    ]}
                  >
                    <Select
                      style={{
                        textAlign: "left",
                        flexGrow: 1,
                        height: longVariables.includes(variable.alias)
                          ? "64px"
                          : "auto",
                      }}
                      disabled={disabled_fields}
                      size={"large"}
                    >
                      <Option value={true}>True</Option>
                      <Option value={false}>False</Option>
                    </Select>
                  </Form.Item>
                </div>
              );
            }
            return null;
          })}
          {!disabled_fields && !saveLoading && !loading && (
            <CrudButtons
              orientation="horizontal"
              addMode={addMode}
              onAddClick={toggleAddMode}
              onDelete={onDeleteClick}
            />
          )}
          {(saveLoading || loading) && (
            <div>
              <center>
                <i className="fas fa-spinner fa-spin fa-2x"></i>
              </center>
            </div>
          )}
          <Modal
            title="Confirm your action by typing 'confirm'"
            centered
            visible={isModalVisible}
            onOk={handleOk}
            onCancel={closeModal}
            okButtonProps={{ disabled: !buttonEnabled }}
          >
            {!loading && <Input placeholder="confirm" value={confirmText} onChange={onChangeConfirmText}/>}
          </Modal>
        </Form> 
      )}
      {!data_arr && (
        <div>
          <i className="fas fa-spinner fa-spin fa-2x" />
        </div>
      )}
    </div>
  );
};
export default PopulateFields;
