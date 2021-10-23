import React from 'react';

const FlarePlan = () => {
  return (
    <div className="card" style={{ width: '100%' }}>
      <h5 className="card-header">Flare Management Plan</h5>
      <div
        className="card-body"
        style={{
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          marginLeft: '15px',
        }}
      >
        <button
          type="button"
          className="form-group btn btn-primary"
          id="fmp-download"
        >
          <a
            href="https://flare-reporting.s3.amazonaws.com/Lima+Refining+FMP_R0.pdf"
            style={{ color: 'white' }}
            download
            rel="noopener noreferrer"
            target="_blank"
          >
            Flare Management Plan{' '}
          </a>
        </button>
      </div>
    </div>
  );
};

export default FlarePlan;
