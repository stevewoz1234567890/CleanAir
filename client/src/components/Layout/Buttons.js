import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSave,
  faCode,
  faSpinner,
  faTrash,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";

export const SaveBtn = (props) => {
  const onClick = (value) => {
    if (props.onClick) {
      props.onClick(value);
    }
  };

  const options = {
    style: { width: "100%" },
    className: "btn btn-success mb-3",
    disabled: props.loading ? props.loading : props.disabled,
  };

  const iconOptions = {
    icon: props.loading ? faSpinner : faSave,
    spin: props.loading,
  };

  return (
    <button {...options} onClick={(value) => onClick(value)}>
      Save <FontAwesomeIcon {...iconOptions} />
    </button>
  );
};

export const DeleteBtn = (props) => {
  const onClick = (value) => {
    if (props.onClick) {
      props.onClick(value);
    }
  };

  const options = {
    style: { width: "100%" },
    className: "btn btn-danger mb-3",
    disabled: props.loading ? props.loading : props.disabled,
  };

  const iconOptions = {
    icon: props.loading ? faSpinner : faTrash,
    spin: props.loading,
  };
  return (
    <button {...options} onClick={(value) => onClick(value)}>
      Delete <FontAwesomeIcon {...iconOptions} />
    </button>
  );
};

export const AddBtn = (props) => {
  const onClick = (value) => {
    if (props.onClick) {
      props.onClick(value);
    }
  };

  const options = {
    style: { width: "100%" },
    className: "btn btn-info mb-3",
    disabled: props.loading ? props.loading : props.disabled,
  };

  const iconOptions = {
    icon: props.loading ? faSpinner : faPlus,
    spin: props.loading,
  };
  return (
    <button {...options} onClick={(value) => onClick(value)}>
      Add <FontAwesomeIcon {...iconOptions} />
    </button>
  );
};

export const EditBtn = (props) => {
  const icon = "fas fa-edit";
  return (
    <button
      style={{ width: "100%" }}
      className={`btn btn-warning mb-3`}
      disabled={props.disabled}
      onClick={props.onClick ? props.onClick : null}
    >
      Edit <i className={`${icon}`}></i>
    </button>
  );
};

export const CreateBtn = (props) => {
  const icon = "fa fa-plus";
  return (
    <button
      style={{ width: "100%" }}
      className={`btn btn-info mb-3`}
      disabled={props.disabled}
      onClick={props.onClick ? props.onClick : null}
    >
      Create <i className={`${icon}`}></i>
    </button>
  );
};

export const CancelBtn = (props) => {
  const icon = "far fa-window-close";
  return (
    <button
      style={{
        width: "100%",
        borderColor: "gray",
        backgroundColor: "lightgray",
      }}
      className={`btn mb-3`}
      onClick={props.onClick ? props.onClick : null}
    >
      Cancel <i className={`${icon}`}></i>
    </button>
  );
};

export const TestBtn = (props) => {
  const onClick = (value) => {
    if (props.onClick) {
      props.onClick(value);
    }
  };

  const options = {
    style: { width: "100%" },
    className: "btn btn-success",
    disabled: props.loading ? props.loading : props.disabled,
  };

  const iconOptions = {
    icon: props.loading ? faSpinner : faCode,
    spin: props.loading,
  };

  return (
    <button {...options} onClick={(value) => onClick(value)}>
      Test <FontAwesomeIcon {...iconOptions} />
    </button>
  );
};

export const CopyBtn = (props) => {
  const icon = "fas fa-copy";
  return (
    <button
      style={{ width: "100%" }}
      className={`btn btn-success`}
      disabled={props.disabled}
      onClick={props.onclick ? props.onclick : null}
    >
      Copy Results <i className={`${icon}`}></i>
    </button>
  );
};

export const CommitBtn = (props) => {
  const icon = "fas fa-file-upload";
  return (
    <button
      className={`btn btn-success mb-3`}
      style={{ width: "100%" }}
      disabled={props.disabled}
      onClick={props.onclick ? props.onclick : null}
    >
      Commit <i className={`${icon}`}></i>
    </button>
  );
};
