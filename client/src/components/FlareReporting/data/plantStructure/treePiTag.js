import React, { useEffect, useState } from "react";
import { Input, InputNumber, Select, notification, Form, Modal } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { parametersSelector } from "../../../../redux/slices/FMT/parametersSlice";
import {
  pitagsSelector,
  fetchPitags,
} from "../../../../redux/slices/FMT/pitagsSlice";
import validateDuplicateName from "../../utilityFunctions/duplicateNameTree";
import crudSave, { crudDelete } from "../../utilityFunctions/crudSave";
import { TreeButton } from "./Tree";
const { Option } = Select;

const PiTagTemplate = (props) => {
  const dispatch = useDispatch();
  const { data, parentData, setActiveNodeData, onDeleteNode } = props;

  const piTags = useSelector(pitagsSelector);
  const parameters = useSelector(parametersSelector);
  const [form] = Form.useForm();

  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modeStatus, setModeStatus] = useState('');
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [formValue, setFormValue] = useState(null)

  useEffect(() => {
    //this is used since the antd form lags behind on rerenders of switching
    //between the same type of element (flare to flare, etc.)
    form.resetFields();
  }, [props, form]);

  const validatePiTagSave = (formData) => {
    let edit_id = data ? data._id : parentData._id;
    let parent_id = data ? data.parent_id : parentData._id;

    if (!validateDuplicateName(piTags, formData.name, edit_id, parent_id))
      return false;

    if (formData.min > formData.max) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Min must be less than Max",
      });
      return false;
    }

    return true;
  };

  const revertAfterSave = () => {
    setActiveNodeData({ type: null, data: null });
    setFormValue(null);
  };

  const onSave = async (formData) => {
    setFormValue(formData);
    if (!validatePiTagSave(formData)) return;
    setSaveLoading(true);

    if (!data) {
      setModeStatus('save');
      showModal();
    } else {
      saveData(formData);
    }
  };

  const saveData = async (formData) => {
    const schema = {
      parent_id: data ? data.parent_id : parentData ? parentData._id : null,
      name: formData.name,
      description: formData.description,
      parameter: formData.parameter,
      max: formData.max,
      min: formData.min,
      flare: data ? data.flare : parentData ? parentData.flare : null,
      header: data ? data.header : parentData ? parentData.header : null,
      sensor: data ? data.sensor : parentData ? parentData._id : null,
    };

    //for PUT
    if (data) {
      schema._id = data._id;
    }

    const addModeAndRevertFNobj = {
      addMode: !data,
      revertAfterSave: revertAfterSave,
    };

    try {
      const res = await crudSave(
        addModeAndRevertFNobj,
        { schema: schema, collection: "pitags" },
        dispatch
      );
      dispatch(fetchPitags());
      setSaveLoading(false);
      setActiveNodeData({
        frt_data: res.data.data,
        type: "pi_tag",
      });
      notification["success"]({
        message: "Successfully Saved",
        placement: "bottomLeft",
        description: "Save Success",
      });
    } catch (err) {
      console.log("Pitag save error: ", err);
      setSaveLoading(false);
    }
  }

  const onDeletePitag = async () => {
    setDeleteLoading(true);
    const res = await crudDelete("pitags", data._id);
    dispatch(fetchPitags());
    onDeleteNode(data);
    setDeleteLoading(false);
  };

  const handleOk = async () => {
    setButtonEnabled(false)
    if (modeStatus === 'delete') {
      onDeletePitag();
    } else {
      saveData(formValue);
    }
    closeModal();
    setModeStatus('');
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setConfirmText('');
  }

  const showModal = () => {
    setIsModalVisible(true);
  };

  const onDeleteClick = () => {
    showModal();
    setModeStatus('delete');
  };

  const onChangeConfirmText = ({ target: { value }}) => {
    setConfirmText(value);
    setButtonEnabled(value === 'confirm');
  }

  let initialValues = data
    ? {
        name: data.name,
        description: data.description,
        parameter: data.parameter,
        max: data.max,
        min: data.min,
      }
    : {};
  return (
    <div>
      <div
        className="row mb-2"
        style={{ display: "flex", justifyContent: "space-evenly" }}
      >
        {data && !deleteLoading && (
          <TreeButton className="btn btn-danger mb-3" onClick={onDeleteClick}>
            Delete <i className="fas fa-trash-alt "></i>
          </TreeButton>
        )}
        {data && deleteLoading && (
          <span
            style={{ width: "140px", height: "fit-content" }}
            className="btn btn-danger mb-3"
          >
            <i className="fas fa-spinner fa-spin"></i>
          </span>
        )}
      </div>
      <Modal
        title="Confirm your action by typing 'confirm'"
        centered
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={closeModal}
        okButtonProps={{ disabled: !buttonEnabled }}
      >
        <Input placeholder="confirm" value={confirmText} onChange={onChangeConfirmText}/>
      </Modal>
      <Form
        form={form}
        initialValues={initialValues}
        labelAlign={"left"}
        onFinish={onSave}
      >
        <center>
          {!saveLoading && (
            <TreeButton
              className="btn btn-success"
              htmltype="submit"
              onClick={() => form.submit}
            >
              Save Pi Tag <i className="far fa-save"></i>
            </TreeButton>
          )}
          {saveLoading && (
            <TreeButton className="btn btn-success" htmltype="submit">
              <i className="fas fa-spinner fa-spin"></i>
            </TreeButton>
          )}
        </center>
        <Form.Item
          label={<div style={{ width: "50em" }}>Name</div>}
          name={"name"}
          rules={[
            {
              required: true,
              message: "Please enter a name",
            },
          ]}
        >
          <Input type="text" style={{ textAlign: "left" }} size={"large"} />
        </Form.Item>
        <Form.Item
          label={<div style={{ width: "50em" }}>Description</div>}
          name={"description"}
          rules={[
            {
              required: false,
            },
          ]}
        >
          <Input type="text" style={{ textAlign: "left" }} size={"large"} />
        </Form.Item>
        <Form.Item
          label={<div style={{ width: "50em" }}>Parameter</div>}
          name={"parameter"}
          rules={[
            {
              required: true,
              message: "Please select a parameter",
            },
          ]}
        >
          <Select
            style={{ textAlign: "left", flexGrow: 1 }}
            size={"large"}
            showSearch
          >
            {parameters.map((parameter) => {
              return (
                <Option key={parameter._id} value={parameter._id}>
                  {parameter.name}
                </Option>
              );
            })}
          </Select>
        </Form.Item>
        <Form.Item
          label={<div style={{ width: "50em" }}>Max</div>}
          name={"max"}
          rules={[
            {
              required: false,
            },
          ]}
        >
          <InputNumber style={{ width: "100%" }} size="large" />
        </Form.Item>
        <Form.Item
          label={<div style={{ width: "50em" }}>Min</div>}
          name={"min"}
          rules={[
            {
              required: false,
            },
          ]}
        >
          <InputNumber style={{ width: "100%" }} size="large" />
        </Form.Item>
      </Form>
    </div>
  );
};

export default PiTagTemplate;
