import React, { useEffect, useState } from 'react';
import { Input, Select, Form, notification, Modal } from 'antd';
import PiTagTemplate from './treePiTag';
import validateDuplicateName from '../../utilityFunctions/duplicateNameTree';
import { useDispatch, useSelector } from 'react-redux';
import { sensorsSelector, fetchSensors } from '../../../../redux/slices/FMT/sensorsSlice';
import crudSave, { crudDelete } from '../../utilityFunctions/crudSave';
import { TreeButton } from './Tree';
const { Option } = Select;

const SensorTemplate = (props) => {

  const { data, parentData, parentType, setActiveNodeData, onDeleteNode } = props;

  const sensors = useSelector(sensorsSelector);
  const [form] = Form.useForm();
  const dispatch = useDispatch();

  const [addPiTagMode, setAddPiTagMode] = useState(false);
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

  const validateSensorSave = (formData) => {
    let edit_id = data ? data._id : parentData._id;
    let parent_id = data ? data.parent_id : parentData._id;

    if (!validateDuplicateName(sensors, formData.name, edit_id, parent_id))
      return;

    return true;
  };

  const revertAfterSave = () => {
    setActiveNodeData({ type: null, data: null });
    setFormValue(null);
  };

  const removeEmpty = obj => {
    Object.keys(obj).forEach(key => obj[key] == null && delete obj[key]);
  };

  const onSave = async (formData) => {
    setFormValue(formData);
    if (!validateSensorSave(formData)) return;
    setSaveLoading(true);

    if (!data) {
      setModeStatus('save');
      showModal();
    } else {
      saveData(formData);
    }
  };

  const saveData = async(formData) => {
    const schema = {
      name: formData.name,
      description: formData.description,
      isPrimary: formData.isPrimary,
      cemsInstalled: formData.cemsInstalled,
      flare : data ? data.flare : parentType === 'flare' ? parentData._id : parentData.flare,
      header : data ? data.header : parentType === 'header' ? parentData._id : undefined
    };

    //for PUT
    if (data) {
      schema._id = data._id;
    }

    removeEmpty(schema);

    const addModeAndRevertFNobj = {
      addMode: !data,
      revertAfterSave: revertAfterSave,
    };

    try {
      const res = await crudSave(
        addModeAndRevertFNobj,
        { schema: schema, collection: 'sensors' },
        dispatch
      );
      dispatch(fetchSensors());
      setActiveNodeData({
        frt_data: res.data.data,
        type: "sensor"
      });
      notification['success']({
        message: 'Successfully Saved',
        placement: 'bottomLeft',
        description: 'Save Success',
      });
      setSaveLoading(false);

    } catch (err) {
      console.log('save sensor error', err);
      setSaveLoading(false);
    }
  }

  const handleOk = async () => {
    setButtonEnabled(false)
    if (modeStatus === 'delete') {
      onDeleteSensor();
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
        isPrimary: data.isPrimary,
        cemsInstalled: data.cemsInstalled,
      }
    : {};

  const onAddPiTagClick = () => {
    setAddPiTagMode(!addPiTagMode);
  };

  const onDeleteSensor = async () => {
    setDeleteLoading(true);
    const res = await crudDelete('sensors', data._id);
    dispatch(fetchSensors());
    onDeleteNode(data, 'sensors');
    setDeleteLoading(false);
  }

  return (
    <div>
      <div
        className="row mb-2"
        style={{ display: 'flex', justifyContent: 'space-evenly' }}
      >
        {data && (
          <TreeButton
            className={!addPiTagMode ? 'btn btn-info' : 'btn btn-warning'}
            onClick={onAddPiTagClick}
          >
            {!addPiTagMode && (
              <span>
                Add Pi Tag <i className="fas fa-database"></i>
              </span>
            )}
            {addPiTagMode && (
              <span>
                Cancel <i className="fas fa-window-close"></i>
              </span>
            )}
          </TreeButton>
        )}
        {data && !addPiTagMode &&  !deleteLoading && (
          <TreeButton
            className="btn btn-danger mb-3"
            onClick={onDeleteClick}
          >
            Delete <i className="fas fa-trash-alt "></i>
          </TreeButton>
        )}
        {data && !addPiTagMode &&  deleteLoading && (
          <TreeButton
            className="btn btn-danger mb-3"
          >
            <i className="fas fa-spinner fa-spin"></i>
          </TreeButton>
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
      {!addPiTagMode && (
        <Form
          form={form}
          initialValues={initialValues}
          labelAlign={'left'}
          onFinish={onSave}
        >
          <center>
            {!saveLoading && (
              <TreeButton
                className="btn btn-success"
                htmltype="submit"
                onClick={() => form.submit}
              >
                Save Sensor <i className="far fa-save"></i>
              </TreeButton>
            )}
            {saveLoading && (
              <button
                style={{ width: '140px' }}
                className="btn btn-success"
                htmltype="submit"
              >
                <i className="fas fa-spinner fa-spin"></i>
              </button>
            )}
          </center>
          <Form.Item
            label={<div style={{ width: '50em' }}>Name</div>}
            name={'name'}
            rules={[
              {
                required: true,
                message: 'Please enter a name',
              },
            ]}
          >
            <Input type="text" style={{ textAlign: 'left' }} size={'large'} />
          </Form.Item>
          <Form.Item
            label={<div style={{ width: '50em' }}>Description</div>}
            name={'description'}
            rules={[
              {
                required: false,
              },
            ]}
          >
            <Input type="text" style={{ textAlign: 'left' }} size={'large'} />
          </Form.Item>
          <Form.Item
            label={<div style={{ width: '50em' }}>Primary</div>}
            name={'isPrimary'}
            rules={[
              {
                required: true,
                message: 'Please select a value',
              },
            ]}
          >
            <Select
              style={{
                textAlign: 'left',
              }}
              size={'large'}
            >
              <Option value={true}>True</Option>
              <Option value={false}>False</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label={<div style={{ width: '50em' }}>CEMs</div>}
            name={'cemsInstalled'}
            rules={[
              {
                required: true,
                message: 'Please select a value',
              },
            ]}
          >
            <Select
              style={{
                textAlign: 'left',
              }}
              size={'large'}
            >
              <Option value={true}>True</Option>
              <Option value={false}>False</Option>
            </Select>
          </Form.Item>
        </Form>
      )}
      {addPiTagMode && (
        <PiTagTemplate
          data={null}
          parentData={data}
          parentType={'sensor'}
          setActiveNodeData={setActiveNodeData}
        />
      )}
    </div>
  );
};

export default SensorTemplate;
