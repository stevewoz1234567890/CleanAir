import React from "react";
import GeneralReports from "./generalReports";
import EmissionsReports from "./emissionsReports";

const GenerateReports = () => {
  return (
    <div className="container">
      <GeneralReports />
      <EmissionsReports />
    </div>
  );
};

export default GenerateReports;
