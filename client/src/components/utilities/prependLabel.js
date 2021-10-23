import React from 'react';

const PrePendLabel = (props) => {
  return (
    <div className="input-group-prepend">
      <label
        className="input-group-text"
        style={{
          fontSize: '16px',
          height: 'fit-content',
          paddingTop: '7px',
          paddingBottom: '7px',
          borderTopRightRadius: '0',
          borderBottomRightRadius: '0',
          borderTopLeftRadius: props.borderTopLeftRadius
            ? props.borderTopLeftRadius
            : null,
          borderBottomLeftRadius: props.borderBottomLeftRadius
            ? props.borderBottomLeftRadius
            : null,
          width: props.width ? props.width : null,
          whiteSpace: props.whiteSpace ? 'normal' : null,
          textAlign: 'left',
        }}
      >
        {props.title}
      </label>
    </div>
  );
};

export default PrePendLabel;
