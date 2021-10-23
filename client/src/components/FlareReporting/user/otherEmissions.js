import React, { useState } from 'react';
import { Modal } from 'antd';

const OtherEmissions = () => {
  const [otherEmissionsModal, setOtherEmissionsModal] = useState(false);
  return (
    <div className="card mt-4" style={{ width: '100%' }}>
      <h5 className="card-header">Other Emissions</h5>
      <div className="card-body" style={{ textAlign: 'center' }}>
        <div className="row" style={{ justifyContent: 'center' }}>
          <div
            type="button"
            onClick={() => setOtherEmissionsModal(!otherEmissionsModal)}
          >
            <img
              src="../FlareReporting/demo/otherEmissions.png"
              className="img-fluid"
              alt="other emissions.png"
            ></img>
          </div>

          <Modal
            visible={otherEmissionsModal}
            onOk={() => setOtherEmissionsModal(!otherEmissionsModal)}
            onCancel={() => setOtherEmissionsModal(!otherEmissionsModal)}
            width={'60%'}
            centered={true}
            footer={null}
          >
            <center>
              <img
                src="/FlareReporting/demo/otherEmissions.png"
                className="img-fluid"
                alt="other emissions.png"
              ></img>
            </center>
          </Modal>
        </div>
      </div>
    </div>
  );
};

export default OtherEmissions;
