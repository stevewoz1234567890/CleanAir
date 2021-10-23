import React, { useEffect, useState } from 'react';
import { Input, Select, Form, notification, Modal } from 'antd';
import SensorTemplate from './treeSensor';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHeaders, headersSelector } from '../../../../redux/slices/FMT/headerSlice';
import validateDuplicateName from '../../utilityFunctions/duplicateNameTree';
import crudSave, { crudDelete } from '../../utilityFunctions/crudSave';
import { TreeButton } from './Tree';
const { Option } = Select;

const HeaderTemplate = (props) => {

  const { data, parentData, setActiveNodeData, onDeleteNode } = props;
  
  const [addSensorMode, setAddSensorMode] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modeStatus, setModeStatus] = useState('');
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [formValue, setFormValue] = useState(null)
  
  const headers = useSelector(headersSelector);
  const [form] = Form.useForm();
  const dispatch = useDispatch();


  useEffect(() => {
    //this is used since the antd form lags behind on rerenders of switching
    //between the same type of element (flare to flare, etc.)
    form.resetFields();
  }, [props, form]);

  const validateHeaderSave = (formData) => {
    let edit_id = data ? data._id : parentData._id;
    let parent_id = data ? data.parent_id : parentData._id;

    if (!validateDuplicateName(headers, formData.name, edit_id, parent_id))
      return;

    return true;
  };

  const revertAfterSave = () => {
    setActiveNodeData({ type: null, data: null });
  };

  const onSave = async (formData) => {
    setFormValue(formData);
    if (!validateHeaderSave(formData)) return;
    setSaveLoading(true);

    if (!data) {
      setModeStatus('save');
      showModal();
    } else {
      saveData(formData);
    }
  };

  const saveData = async (formData) => {
    if (!validateHeaderSave(formData)) return;
    setSaveLoading(true);

    const schema = {
      name: formData.name,
      flare: data ? data.flare : parentData._id,
      sealed: formData.sealed,
      cemsInstalled: formData.cemsInstalled,
      processList: data ? data.processList : []
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
        { schema: schema, collection: 'headers' },
        dispatch
      );
      dispatch(fetchHeaders());
      setSaveLoading(false);
      setActiveNodeData({
        frt_data: res.data.data,
        type: "header"
      });
      notification['success']({
        message: 'Successfully Saved',
        placement: 'bottomLeft',
        description: 'Save Success',
      });
    } catch (err) {
      console.log('Header save error', err);
      setSaveLoading(false);
    }
  };

  let initialValues = data
    ? {
        name: data.name,
        cemsInstalled: data.cemsInstalled,
        sealed: data.sealed,
      }
    : {};

  const onAddSensorClick = () => {
    setAddSensorMode(!addSensorMode);
  };

  const onDeleteHeader = async () => {
    setDeleteLoading(true);
    const res = await crudDelete('headers', data._id);
    dispatch(fetchHeaders());
    onDeleteNode(data, 'headers');
    setDeleteLoading(false);
  }

  const handleOk = async () => {
    setButtonEnabled(false)
    if (modeStatus === 'delete') {
      onDeleteHeader();
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

  return (
    <div>
      <div
        className="row mb-2"
        style={{ display: 'flex', justifyContent: 'space-evenly' }}
      >
        {/* show only when NOT in adding a new one mode */}
        {data && (
          <TreeButton
            className={!addSensorMode ? 'btn btn-info' : 'btn btn-warning'}
            onClick={onAddSensorClick}
          >
            {!addSensorMode && (
              <span>
                Add Sensor <i className="fas fa-broadcast-tower"></i>
              </span>
            )}
            {addSensorMode && (
              <span>
                Cancel <i className="fas fa-window-close"></i>
              </span>
            )}
          </TreeButton>
        )}
        {data && !addSensorMode &&  !deleteLoading && (
          <TreeButton
            className="btn btn-danger mb-3"
            onClick={onDeleteClick}
          >
            Delete <i className="fas fa-trash-alt "></i>
          </TreeButton>
        )}
        {data && !addSensorMode &&  deleteLoading && (
          <span
            style={{ width: '140px', height: 'fit-content' }}
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

      {!addSensorMode && (
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
                Save Header <i className="far fa-save"></i>
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
            label={<div style={{ width: '50em' }}>CEMs Installed</div>}
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
          <Form.Item
            label={<div style={{ width: '50em' }}>Seal Installed</div>}
            name={'sealed'}
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
      {addSensorMode && (
        <SensorTemplate
          data={null}
          parentData={data}
          parentType={'header'}
          setActiveNodeData={setActiveNodeData}
        />
      )}
    </div>
  );
};

export default HeaderTemplate;
