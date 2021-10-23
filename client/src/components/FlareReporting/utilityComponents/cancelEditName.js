import React from 'react';

const CancelEditName = (props) => {
  return (
    <button
      className="btn btn-outline-secondary"
      onClick={props.onClick}
      style={{
        height: '40px',
        borderTopLeftRadius: '0',
        borderBottomLeftRadius: '0',
      }}
    >
      Cancel
    </button>
  );
};

export default CancelEditName;
