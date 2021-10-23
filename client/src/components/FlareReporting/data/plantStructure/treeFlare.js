import React, { useEffect, useState } from 'react';
import { Select, Input, InputNumber, Form, notification, Modal } from 'antd';
import SensorTemplate from './treeSensor';
import HeaderTemplate from './treeHeader';
import { useDispatch, useSelector } from 'react-redux';
import { flaresSelector, fetchFlares } from '../../../../redux/slices/FMT/flareSlice';
import validateDuplicateName from '../../utilityFunctions/duplicateNameTree';
import crudSave, { crudDelete } from '../../utilityFunctions/crudSave';
import { TreeButton } from './Tree';
const { Option } = Select;

const FlareTemplate = (props) => {
  const { data, parentData, setActiveNodeData, onDeleteNode } = props;

  const flares = useSelector(flaresSelector);

  const [addSensorMode, setAddSensorMode] = useState(false);
  const [addHeaderMode, setAddHeaderMode] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modeStatus, setModeStatus] = useState('');
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [formValue, setFormValue] = useState(null)

  const [form] = Form.useForm();

  const dispatch = useDispatch();

  useEffect(() => {
    //this is used since the antd form lags behind on rerenders of switching
    //between the same type of element (flare to flare, etc.)
    form.resetFields();
  }, [props, form]);

  const validateFlareSave = (formData) => {
    let edit_id = data ? data._id : parentData._id;
    let parent_id = data ? data.parent_id : parentData._id;

    if (!validateDuplicateName(flares, formData.name, edit_id, parent_id))
      return;

    return true;
  };

  const revertAfterSave = () => {
    setActiveNodeData({ type: null, data: null });
    setFormValue(null);
  };

  const onSave = async (formData) => {
    setFormValue(formData);
    if (!validateFlareSave(formData)) return;
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
      name: formData.name,
      steamAssisted: formData.steamAssisted,
      airAssisted: formData.airAssisted,
      permitId: formData.permitId,
      tipDiameterValue: formData.tipDiameterValue,
      tipDiameterUom: formData.tipDiameterUom,
      effectiveTipDiameterValue: formData.effectiveTipDiameterValue,
      effectiveTipDiameterUom: formData.effectiveTipDiameterUom,
      unobstructedTipAreaValue: formData.unobstructedTipAreaValue,
      unobstructedTipAreaUom: formData.unobstructedTipAreaUom,
      smokelessCapacityValue: formData.smokelessCapacityValue,
      smokelessCapacityUom: formData.smokelessCapacityUom
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
        { schema: schema, collection: 'flares' },
        dispatch
      );
      dispatch(fetchFlares());
      setSaveLoading(false);
      setActiveNodeData({
        frt_data: res.data.data,
        type: "flare"
      });
      notification['success']({
        message: 'Successfully Saved',
        placement: 'bottomLeft',
        description: 'Save Success',
      });
    } catch (err) {
      console.log('save falre error: ', err);
      setSaveLoading(false);
    }
  };

  const onDeleteFlare = async () => {
    setDeleteLoading(true);
    const res = await crudDelete('flares', data._id);
    dispatch(fetchFlares());
    onDeleteNode(data, 'flares');
    setDeleteLoading(false);
  }

  const handleOk = async () => {
    setButtonEnabled(false)
    if (modeStatus === 'delete') {
      onDeleteFlare();
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

  let initialValues =
    data && !addSensorMode && !addHeaderMode
      ? {
          name: data.name,
          permitId: data.permitId,
          airAssisted: data.airAssisted,
          steamAssisted: data.steamAssisted,

          tipDiameterValue:  data.tipDiameterValue,
          tipDiameterUom: data.tipDiameterUom,

          effectiveTipDiameterValue: data.effectiveTipDiameterValue,
          effectiveTipDiameterUom: data.effectiveTipDiameterUom,

          unobstructedTipAreaValue: data.unobstructedTipAreaValue,
          unobstructedTipAreaUom: data.unobstructedTipAreaUom,

          smokelessCapacityValue: data.smokelessCapacityValue,
          smokelessCapacityUom: data.smokelessCapacityUom,
        }
      : {};

  const onAddHeaderClick = () => {
    setAddHeaderMode(!addHeaderMode);
  };

  const onAddSensorClick = () => {
    setAddSensorMode(!addSensorMode);
  };
  return (
    <div>
      <div
        className="row mb-2"
        style={{ display: 'flex', justifyContent: 'space-evenly' }}
      >
        {!addSensorMode && data && (
          <TreeButton
            className={!addHeaderMode ? 'btn btn-info' : 'btn btn-warning'}
            onClick={onAddHeaderClick}
          >
            {!addHeaderMode && (
              <span>
                Add Header <i className="fas fa-adjust"></i>
              </span>
            )}
            {addHeaderMode && (
              <span>
                Cancel <i className="fas fa-window-close"></i>
              </span>
            )}
          </TreeButton>
        )}
        {!addHeaderMode && data && (
          <TreeButton
            style={{ width: '140px', height: 'fit-content' }}
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
        {data && !addHeaderMode && !addSensorMode &&  !deleteLoading && (
          <TreeButton
            className="btn btn-danger mb-3"
            onClick={onDeleteClick}
          >
            Delete <i className="fas fa-trash-alt "></i>
          </TreeButton>
        )}
        {data && !addHeaderMode && !addSensorMode &&  deleteLoading && (
          <TreeButton
            style={{ width: '140px', height: 'fit-content' }}
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

      {!addSensorMode && !addHeaderMode && (
        <Form
          form={form}
          initialValues={initialValues}
          labelAlign={'left'}
          onFinish={onSave}
        >
          <center>
            { saveLoading && (
              <button
                className="btn btn-success"
                htmltype="submit"
              >
                <i className="fas fa-spinner fa-spin"></i>
              </button>
            )}
            { !saveLoading && (
              <TreeButton
                style={{ width: '140px' }}
                className="btn btn-success"
                htmltype="submit"
                onClick={() => form.submit}
              >
                Save Flare <i className="far fa-save"></i>
              </TreeButton>)}
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
            label={<div style={{ width: '50em' }}>Permit ID</div>}
            name={'permitId'}
            rules={[
              {
                required: false,
              },
            ]}
          >
            <Input type="text" style={{ textAlign: 'left' }} size={'large'} />
          </Form.Item>
          <Form.Item
            label={<div style={{ width: '50em' }}>Air Assisted</div>}
            name={'airAssisted'}
            rules={[
              {
                required: true,
                message: 'Please enter a selection',
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
            label={<div style={{ width: '50em' }}>Steam Assisted</div>}
            name={'steamAssisted'}
            rules={[
              {
                required: true,
                message: 'Please enter a selection',
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

          <div
            style={{
              border: '1px solid grey',
              borderRadius: '5px',
              padding: '5px',
            }}
            className="mb-4"
          >
            <p>Tip Diameter</p>
            <div className="row">
              <div className="col-sm-6">
                <Form.Item
                  label={<div style={{ width: '50em' }}>Value</div>}
                  name={'tipDiameterValue'}
                  rules={[
                    {
                      required: true,
                      message: 'Please enter a tip diameter',
                    },
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} size="large" min={0} />
                </Form.Item>
              </div>
              <div className="col-sm-6">
                <Form.Item
                  label={<div style={{ width: '50em' }}>Unit of Measure</div>}
                  name={'tipDiameterUom'}
                  rules={[
                    {
                      required: true,
                      message: 'Please enter a tip unit of measure',
                    },
                  ]}
                >
                  <Input
                    type="text"
                    style={{ textAlign: 'left' }}
                    size={'large'}
                  />
                </Form.Item>
              </div>
            </div>
          </div>

          <div
            style={{
              border: '1px solid grey',
              borderRadius: '5px',
              padding: '5px',
            }}
            className="mb-4"
          >
            <p>Effective Tip Diameter</p>
            <div className="row">
              <div className="col-sm-6">
                <Form.Item
                  label={<div style={{ width: '50em' }}>Value</div>}
                  name={'effectiveTipDiameterValue'}
                  rules={[
                    {
                      required: true,
                      message: 'Please enter an effective tip diameter',
                    },
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} size="large" min={0} />
                </Form.Item>
              </div>
              <div className="col-sm-6">
                <Form.Item
                  label={<div style={{ width: '50em' }}>Unit of Measure</div>}
                  name={'effectiveTipDiameterUom'}
                  rules={[
                    {
                      required: true,
                      message: 'Please enter a effective tip unit of measure',
                    },
                  ]}
                >
                  <Input
                    type="text"
                    style={{ textAlign: 'left' }}
                    size={'large'}
                  />
                </Form.Item>
              </div>
            </div>
          </div>
          <div
            style={{
              border: '1px solid grey',
              borderRadius: '5px',
              padding: '5px',
            }}
            className="mb-4"
          >
            <p>Unobstructed Tip Area</p>
            <div className="row">
              <div className="col-sm-6">
                <Form.Item
                  label={<div style={{ width: '50em' }}>Value</div>}
                  name={'unobstructedTipAreaValue'}
                  rules={[
                    {
                      required: true,
                      message:
                        'Please enter an unobstructed tip diameter value',
                    },
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} size="large" min={0} />
                </Form.Item>
              </div>
              <div className="col-sm-6">
                <Form.Item
                  label={<div style={{ width: '50em' }}>Unit of Measure</div>}
                  name={'unobstructedTipAreaUom'}
                  rules={[
                    {
                      required: true,
                      message:
                        'Please enter a unobstructed tip diameter unit of measure',
                    },
                  ]}
                >
                  <Input
                    type="text"
                    style={{ textAlign: 'left' }}
                    size={'large'}
                  />
                </Form.Item>
              </div>
            </div>
          </div>
          <div
            style={{
              border: '1px solid grey',
              borderRadius: '5px',
              padding: '5px',
            }}
            className="mb-4"
          >
            <p>Smokeless Capacity</p>
            <div className="row">
              <div className="col-sm-6">
                <Form.Item
                  label={<div style={{ width: '50em' }}>Value</div>}
                  name={'smokelessCapacityValue'}
                  rules={[
                    {
                      required: true,
                      message: 'Please enter an smokeless capacity value',
                    },
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} size="large" min={0} />
                </Form.Item>
              </div>
              <div className="col-sm-6">
                <Form.Item
                  label={<div style={{ width: '50em' }}>Unit of Measure</div>}
                  name={'smokelessCapacityUom'}
                  rules={[
                    {
                      required: true,
                      message:
                        'Please enter a smokeless capacity unit of measure',
                    },
                  ]}
                >
                  <Input
                    type="text"
                    style={{ textAlign: 'left' }}
                    size={'large'}
                  />
                </Form.Item>
              </div>
            </div>
          </div>
        </Form>
      )}
      {addSensorMode && !addHeaderMode && (
        <SensorTemplate
          data={null}
          parentData={data}
          parentType={'flare'}
          setActiveNodeData={setActiveNodeData}
        />
      )}
      {!addSensorMode && addHeaderMode && (
        <HeaderTemplate
          data={null}
          parentData={data}
          parentType={'flare'}
          setActiveNodeData={setActiveNodeData}
        />
      )}
    </div>
  );
};

export default FlareTemplate;
