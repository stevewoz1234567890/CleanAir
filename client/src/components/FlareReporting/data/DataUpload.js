import React, { useState } from 'react';
import { notification } from 'antd';
import DataTemplate from './dataTemplate';
import usePermissions from '../../../utilities/usePermissions';
import { DATA_DATA_UPLOAD_BTN_UPLOAD } from '../../../constants/permissions';

const DataUpload = () => {
  const { checkPermission } = usePermissions();
  const [file, setFile] = useState();
  const [loading, setLoading] = useState(false);

  const onChange = (e) => {
    setFile(e.target.files[0]);
  };

  const validateUpload = () => {
    if (!file) {
      notification['warning']({
        message: 'Invalid Input',
        placement: 'bottomLeft',
        description: 'Please upload an xlsx template',
      });
      return false;
    }

    return true;
  };

  const upload_file_to_s3 = async () => {
    if (!validateUpload()) return;
    setLoading(true);
  };

  return (
    <div className="col mt-4">
      <div className="row ">
        <DataTemplate />
        <div className="col-md-6" style={{ display: 'flex' }}>
          <div className="card" style={{ width: '100%' }}>
            <h5 className="card-header">Data Upload</h5>
            <div className="card-body">
              <center className="col mt-3 form-group">
                <input type="file" accept=".xlsx" onChange={onChange} />
              </center>
              <br />
              <br />
              <center className="col">
                {!loading && (
                  <button
                    style={{ width: '140px' }}
                    type="button"
                    className="btn btn-primary"
                    onClick={upload_file_to_s3}
                    disabled={!checkPermission(DATA_DATA_UPLOAD_BTN_UPLOAD)}
                  >
                    Upload <i className="fas fa-cloud-upload-alt"></i>
                  </button>
                )}
                {loading && (
                  <button
                    style={{ width: '140px' }}
                    type="button"
                    className="btn btn-primary"
                    disabled
                  >
                    <i className="fas fa-spinner fa-spin"></i>
                  </button>
                )}
              </center>
              <center className="col" id="aws-status"></center>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataUpload;
