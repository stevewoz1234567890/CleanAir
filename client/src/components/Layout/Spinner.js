import React, { Fragment } from "react";

export const Spinner = ({ size }) => {
  const iconSize = size ? size : '2x';
  return (
    <Fragment>
      <div>
        <i className={"fas fa-spinner fa-spin fa-" + iconSize} />
      </div>
    </Fragment>
  );
};
export default Spinner;
