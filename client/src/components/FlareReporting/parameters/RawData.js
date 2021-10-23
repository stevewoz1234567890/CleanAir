import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  parametersSelector,
  fetchParameters,
} from "../../../redux/slices/FMT/parametersSlice";
import PopulateFields from "./populatefields";

const parameter_variables = [
  { name: "name", alias: "Name", type: "name" },
  { name: "description", alias: "Description", type: "string" },
  {
    name: "unitOfMeasure",
    alias: "Unit of Measure",
    type: "dropdown",
    options: [
      "%",
      "Btu/scf",
      "degF",
      "in H2O",
      "lb/lbmol",
      "mol",
      "MPPH",
      "MSCFH",
      "ppm",
      "PSIA",
      "RPM",
      "SCFM",
    ],
  },
  {
    name: "resolution",
    alias: "Resolution",
    type: "dropdown",
    options: [1, 15],
  },
  {
    name: "valueType",
    alias: "Value Type",
    type: "nestedOptionsObj",
    options: [
      { type: "Boolean", data: "boolean" },
      { type: "Number", data: "num" },
      { type: "String", data: "string" },
    ],
  },
];

const RawData = () => {
  const dispatch = useDispatch();
  const parameters = useSelector(parametersSelector);
  const parametersLoading = useSelector((state) => state.parameters.loading);

  useEffect(() => {
    dispatch(fetchParameters());
  }, []);
  return (
    <center className="container">
      <div className="card mt-4">
        <h5 className="card-header">Raw Data</h5>
        <div className="card-body" id="parameter-body">
          <PopulateFields
            data_arr={parameters}
            var_arr={parameter_variables}
            var_type="parameters"
            loading={parametersLoading}
          />
        </div>
      </div>
    </center>
  );
};

export default RawData;
