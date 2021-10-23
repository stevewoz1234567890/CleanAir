import React, { useState } from 'react';
import { Modal } from 'antd';

const FlaringEvents = () => {
  const [flaringEventsModal, setFlaringEventsModal] = useState(false);

  return (
    <div className="col-lg-6">
      <div className="card mt-4" style={{ width: '100%' }}>
        <h5 className="card-header">Flaring Events</h5>
        <div className="card-body" style={{ textAlign: 'center' }}>
          <div
            type="button"
            onClick={() => setFlaringEventsModal(!flaringEventsModal)}
          >
            <img
              src="../FlareReporting/demo/flaringEvents.png"
              className="img-fluid"
              alt="flaringEvents.png"
            ></img>
          </div>

          <Modal
            visible={flaringEventsModal}
            onOk={() => setFlaringEventsModal(!flaringEventsModal)}
            onCancel={() => setFlaringEventsModal(!flaringEventsModal)}
            width={'60%'}
            centered={true}
            footer={null}
          >
            <center>
              <img
                src="../FlareReporting/demo/flaringEvents.png"
                className="img-fluid"
                alt="flaringEvents.png"
              ></img>
            </center>
          </Modal>
        </div>
      </div>
    </div>
  );
};

export default FlaringEvents;
