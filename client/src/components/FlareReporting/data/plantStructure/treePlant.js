import React, { useEffect, useState } from 'react';
import FlareTemplate from './treeFlare';
import { Input, Form } from 'antd';
import { TreeButton } from './Tree';

const PlantTemplate = (props) => {
  const data = props.data;
  const setActiveNodeData = props.setActiveNodeData;

  const [form] = Form.useForm();

  const [addFlareMode, setAddFlareMode] = useState(false);

  useEffect(() => {
    //this is used since the antd form lags behind on rerenders of switching
    //between the same type of element (flare to flare, etc.)
    form.resetFields();
  }, [props, form]);

  const onSave = () => {
    console.log('saving');
  };

  let initialValues = data ? { name: data.title } : {};

  const onAddFlareClick = () => {
    setAddFlareMode(!addFlareMode);
  };

  return (
    <div>
      <div
        className="row mb-2"
        style={{ display: 'flex', justifyContent: 'space-evenly' }}
      >
        {data && (
          <TreeButton
            className={!addFlareMode ? 'btn btn-info' : 'btn btn-warning'}
            onClick={onAddFlareClick}
          >
            {!addFlareMode && (
              <span>
                Add Flare <i className="fas fa-burn"></i>
              </span>
            )}
            {addFlareMode && (
              <span>
                Cancel <i className="fas fa-window-close"></i>
              </span>
            )}
          </TreeButton>
        )}
      </div>
      {!addFlareMode && (
        <Form
          form={form}
          initialValues={initialValues}
          labelAlign={'left'}
          onFinish={onSave}
        >
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
        </Form>
      )}
      {addFlareMode && (
        <FlareTemplate
          data={null}
          parentData={data}
          parentType={'plant'}
          setActiveNodeData={setActiveNodeData}
        />
      )}
    </div>
  );
};

export default PlantTemplate;
