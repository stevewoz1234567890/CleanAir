import React from 'react';

const EditName = (props) => {
  return (
    <button
      className="btn btn-outline-secondary"
      onClick={props.onClick}
      style={{
        height: '40px',
        borderTopLeftRadius: '0',
        borderBottomLeftRadius: '0',
        whiteSpace: 'nowrap',
      }}
    >
      Edit Name
    </button>
  );
};

export default EditName;
