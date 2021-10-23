import React, { useState } from 'react';
import { Modal } from 'antd';

const FlareCompressors = () => {
  const [flareCompressorsModal, setFlareCompressorsModal] = useState(false);

  return (
    <div className="col-lg-6" style={{ display: 'flex' }}>
      <div className="card mt-4" style={{ width: '100%' }}>
        <h5 className="card-header">Flare Compressors</h5>
        <div className="card-body" style={{ textAlign: 'center' }}>
          <div
            type="button"
            onClick={() => setFlareCompressorsModal(!flareCompressorsModal)}
          >
            <img
              src="../FlareReporting/demo/flareCompressors.png"
              className="img-fluid"
              alt="flareCompressors.png"
            ></img>
          </div>

          <Modal
            visible={flareCompressorsModal}
            onOk={() => setFlareCompressorsModal(!flareCompressorsModal)}
            onCancel={() => setFlareCompressorsModal(!flareCompressorsModal)}
            width={'60%'}
            centered={true}
            footer={null}
          >
            <center>
              <img
                src="../FlareReporting/demo/flareCompressors.png"
                className="img-fluid"
                alt="flareCompressors.png"
              ></img>
            </center>
          </Modal>
        </div>
      </div>
    </div>
  );
};

export default FlareCompressors;
