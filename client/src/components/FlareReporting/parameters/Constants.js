import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  constantsSelector,
  fetchConstants,
} from "../../../redux/slices/FMT/constantsSlice";

import PopulateFields from "./populatefields";

const constant_variables = [
  { name: "name", alias: "Name", type: "name" },
  { name: "value", alias: "Value", type: "num" },
];

const Constants = () => {
  const dispatch = useDispatch();
  let constants = useSelector(constantsSelector);
  const constantsLoading = useSelector((state) => state.constants.loading);
  constants = constants
    ? constants.filter((constant) => constant.value !== null)
    : null;

  useEffect(() => {
    dispatch(fetchConstants());
  }, []);

  return (
    <center className="container-fluid">
      <div className="card mt-4">
        <h5 className="card-header">Constants</h5>
        <div className="card-body" id="constant-body">
          <PopulateFields
            data_arr={constants}
            var_arr={constant_variables}
            var_type="constants"
            loading={constantsLoading}
          />
        </div>
      </div>
    </center>
  );
};

export default Constants;
