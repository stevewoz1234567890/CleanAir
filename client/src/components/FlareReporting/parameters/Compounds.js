import React, { useEffect } from "react";
import PopulateFields from "./populatefields";
import { useSelector, useDispatch } from "react-redux";
import {
  compoundsSelector,
  fetchCompounds,
} from "../../../redux/slices/FMT/compoundsSlice";

const compound_variables = [
  { name: "name", alias: "Name", type: "name" },
  { name: "abbreviation", alias: "Abbreviation", type: "string" },
  { name: "carbonMolarNumber", alias: "Carbon Molar Number", type: "num" },
  { name: "hydroCarbon", alias: "Hydrocarbon", type: "boolean" },
  {
    name: "lowerFlamabilityLimit",
    alias: "Lower Flammability Limit",
    type: "num",
  },
  { name: "molecularWeight", alias: "Molecular Weight", type: "num" },
  {
    name: "molecularWeightUom",
    alias: "Molecular Weight Unit of Measure",
    type: "dropdown",
  },
  { name: "netHeatingValue", alias: "Net Heating Value", type: "num" },
  { name: "sulfur", alias: "Sulfur", type: "boolean" },
  {
    name: "sulfurMolarNumber",
    alias: "Sulfur Molar Number",
    type: "num",
  },
  {
    name: "volatileOrganicCompound",
    alias: "Volatile Organic Compound",
    type: "boolean",
  },
];

const Compounds = () => {
  const dispatch = useDispatch();
  const compounds = useSelector(compoundsSelector);

  useEffect(() => {
    dispatch(fetchCompounds());
  }, []);

  return (
    <center className="container-fluid">
      <div className="card mt-4">
        <h5 className="card-header">Compounds (Read Only)</h5>
        <div
          className="card-body"
          id="compound-body"
          style={{ paddingBottom: 0 }}
        >
          <PopulateFields
            data_arr={compounds}
            var_arr={compound_variables}
            var_type="compounds"
            disabled_fields={!!true}
          />
        </div>
      </div>
    </center>
  );
};

export default Compounds;
