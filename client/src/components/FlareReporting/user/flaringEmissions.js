import React, { useState } from 'react';
import { Modal } from 'antd';

const FlaringEmissions = () => {
  const [flareEmissionVocModal, setFlareEmissionVocModal] = useState(false);
  const [shutdownNoxModal, setShutdownNoxModal] = useState(false);
  const [shutdownSo2Modal, setShutdownSo2Modal] = useState(false);

  return (
    <div className="card" style={{ width: '100%' }}>
      <h5 className="card-header">Flaring Emissions</h5>
      <div className="card-body" style={{ textAlign: 'center' }}>
        <div className="row">
          <div
            type="button"
            className=" col-lg-4"
            onClick={() => setFlareEmissionVocModal(!flareEmissionVocModal)}
          >
            <img
              src="../FlareReporting/demo/flareEmissionVoc.png"
              className="img-fluid"
              alt="flareEmissionVoc.png"
            ></img>
          </div>

          <Modal
            visible={flareEmissionVocModal}
            onOk={() => setFlareEmissionVocModal(!flareEmissionVocModal)}
            onCancel={() => setFlareEmissionVocModal(!flareEmissionVocModal)}
            width={'60%'}
            centered={true}
            footer={null}
          >
            <center>
              <img
                src="../FlareReporting/demo/flareEmissionVoc.png"
                className="img-fluid"
                alt="flareEmissionVoc.png"
              ></img>
            </center>
          </Modal>

          <div
            type="button"
            className=" col-lg-4"
            onClick={() => setShutdownNoxModal(!shutdownNoxModal)}
          >
            <img
              src="../FlareReporting/demo/shutdownStartupNox.png"
              className="img-fluid"
              alt="shutdownStartupNox.png"
            ></img>
          </div>

          <Modal
            visible={shutdownNoxModal}
            onOk={() => setShutdownNoxModal(!shutdownNoxModal)}
            onCancel={() => setShutdownNoxModal(!shutdownNoxModal)}
            width={'60%'}
            centered={true}
            footer={null}
          >
            <center>
              <img
                src="../FlareReporting/demo/shutdownStartupNox.png"
                className="img-fluid"
                alt="shutdownStartupNox.png"
              ></img>
            </center>
          </Modal>

          <div
            type="button"
            className=" col-lg-4"
            onClick={() => setShutdownSo2Modal(!shutdownSo2Modal)}
          >
            <img
              src="../FlareReporting/demo/shutdownStartupSo2.png"
              className="img-fluid"
              alt="shutdownStartupSo2.png..."
            ></img>
          </div>

          <Modal
            visible={shutdownSo2Modal}
            onOk={() => setShutdownSo2Modal(!shutdownSo2Modal)}
            onCancel={() => setShutdownSo2Modal(!shutdownSo2Modal)}
            width={'60%'}
            centered={true}
            footer={null}
          >
            <center>
              <img
                src="../FlareReporting/demo/shutdownStartupSo2.png"
                className="img-fluid"
                alt="shutdownStartupSo2.png..."
              ></img>
            </center>
          </Modal>
        </div>
      </div>
    </div>
  );
};

export default FlaringEmissions;
