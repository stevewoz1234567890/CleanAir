import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Select, notification, Alert } from "antd";
import axios from "axios";
import moment from "moment";
import DateRangePicker from "../utilityComponents/dateRangePicker";
import PrePendLabel from "../utilityComponents/prependLabel";
import {
  fetchExportOptions,
  exportOptionsSelector,
} from "../../../redux/slices/FMT/dataExportSlice";
import SortByName from "../utilityFunctions/sortByName";

const { Option, OptGroup } = Select;
let intervalId;

const DataExport = () => {
  const ranges = {
    YTD: [moment().startOf("year"), moment()],
    MTD: [moment().startOf("month"), moment()],
    "Last 7 Days": [moment().add(-7, "days"), moment()],
    "Last 30 Days": [moment().add(-30, "days"), moment()],
    "Last 365 Days": [moment().add(-365, "days"), moment()],
    "Previous Year": [
      moment().subtract(1, "years").startOf("year"),
      moment().subtract(1, "years").endOf("year"),
    ],
  };
  const dispatch = useDispatch();
  const [optionsSelected, setOptionsSelected] = useState([]);
  const [dateRangePicker, setDateRangePicker] = useState();
  const [dumpLink, setDumpLink] = useState();
  const [dataPoints, setDataPoints] = useState();
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const debugMode = useSelector((state) => state.mode.mode);

  const dataExportOptions = useSelector(exportOptionsSelector);

  const columns = [
    {
      title: "PI ID",
      dataIndex: "pi_id",
      key: "pi_id",
    },
    {
      title: "FLARE ID",
      dataIndex: "flare_id",
      key: "flare_id",
    },
    {
      title: "Parent Name",
      dataIndex: "parentName",
      key: "parentName",
    },
    {
      title: "Parameter",
      dataIndex: "parameter",
      key: "parameter",
    },
    {
      title: "Date Time",
      dataIndex: "date_time",
      key: "date_time",
    },
  ];

  useEffect(() => {
    const options = {
      piTagOptions:
        SortByName(
          dataExportOptions?.tags.map((tag) => ({
            ...tag,
            name: tag.primary,
          }))
        ) || [],
      formulaOptions: SortByName(dataExportOptions?.formulas) || [],
    };

    setDataPoints(options);
  }, [dataExportOptions]);

  const changeDataPoints = (value) => {
    setOptionsSelected(value);
  };

  const validateDataDump = () => {
    if (!dateRangePicker) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Please select a data range",
      });
      return false;
    }

    if (optionsSelected.length === 0) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Please select a least one data point",
      });
      return false;
    }

    return true;
  };

  const generateDataDump = async () => {
    if (!validateDataDump()) return;

    setDumpLink();

    const template_schema = {
      debug: debugMode,
      requested: getIdTypeParentName(optionsSelected),
      start: dateRangePicker[0],
      end: dateRangePicker[1],
    };

    try {
      setLoading(true);
      const { data } = await axios.post(
        "/api/widgets/flarereporting/dataexport",
        template_schema
      );
      if (data && data.jobID) {
        if (intervalId) {
          clearInterval(intervalId);
        }

        intervalId = setIntervalImmediate(async () => {
          const jobDetails = await axios.get(
            `/api/widgets/flarereporting/jobs?id=${data.jobID}`
          );

          if (jobDetails?.data?.job?.isComplete) {
            clearInterval(intervalId);
            setDumpLink(jobDetails.data.job.info.link);
            setLoading(false);
          }
        }, 1000 * 10);

        setTimeout(() => {
          clearInterval(intervalId);
          setLoading(false);
        }, 5 * 60 * 1000);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
      console.error("Data export error");
    }
  };

  const setIntervalImmediate = (fn, time) => {
    fn();
    return setInterval(fn, time);
  };

  /**
   * Hot fix for names with slashes in them... like units with slashes...
   * @param {} parts 
   * @returns 
   */
  const getNameFromParts = (parts) => {
    let name = parts[0];
    if (parts.length > 2) {
      for (let i = 1; i < parts.length-1; i++) {
        name = name + "/" + parts[i]
      }
      return name;
    } 
    else {
      return parts[0]
    }
  }

  const getIdTypeParentName = (selectedOptions) => {
    const updated = [];
    selectedOptions.forEach((option) => {
      const parts = option.split("/");
      const type = parts[parts.length - 1];
      const name = getNameFromParts(parts);
      if (type === "formula") {
        const selected = dataPoints.formulaOptions.find((formula) => {
            return (formula.primary + formula.secondary) === name
          }
        );
        updated.push({
          id: selected.id,
          type: "formula",
          parentName: selected.secondary,
        });
      } else {
        const selected = dataPoints.piTagOptions.find(
          (pitag) => pitag.primary + pitag.secondary === name
        );
        updated.push({
          id: selected.id,
          type: "pitag",
          parentName: selected.secondary,
        });
      }
    });
    return updated;
  };

  useEffect(() => {
    dispatch(fetchExportOptions());
  }, []);

  return (
    <div className="col-lg-12 mt-4" style={{ display: "flex" }}>
      <div className="card" id="data-dump" style={{ width: "100%" }}>
        <h5 className="card-header">Data Export</h5>
        <div className="card-body">
          <div className="row">
            <div
              className="col-lg-4 input-group mb-3 justify-flex-start"
              style={{ flexWrap: "nowrap" }}
            >
              <PrePendLabel title="Dates" width="65px" />
              <DateRangePicker setDateRangePicker={setDateRangePicker} ranges={ranges} />
            </div>

            <div
              className="col-lg-4 input-group mb-3 justify-content-flex-start"
              style={{ width: "1000px", flexWrap: "nowrap" }}
            >
              <PrePendLabel title="Data" width="65px" />
              <Select
                mode="multiple"
                placeholder="Select up to 20 points"
                optionFilterProp="children"
                showArrow
                filterOption={false}
                onSearch={setKeyword}
                onChange={changeDataPoints}
                value={optionsSelected}
                style={{ width: "75%", display: "grid" }}
                size={"large"}
                allowClear
                maxTagCount={0}
                dropdownMatchSelectWidth={false}
                onDropdownVisibleChange={() => setKeyword("")}
              >
                <OptGroup label="Formulas">
                  {(!dataPoints || !dataPoints.formulaOptions.length) && (
                    <Option key="formulas_loader" disabled>
                      <i className="fas fa-spinner fa-spin mx-auto d-block"></i>
                    </Option>
                  )}
                  {dataPoints &&
                    dataPoints.formulaOptions &&
                    dataPoints.formulaOptions
                      .filter((formula) =>
                        (formula.primary + " " + formula.secondary)
                          .toLowerCase()
                          .includes(keyword.toLowerCase())
                      )
                      .map((formula) => (
                        <Option
                          disabled={
                            optionsSelected && optionsSelected.length > 19 //filter length is always 1 less than wanted (5 max)
                              ? optionsSelected.includes(
                                formula.primary + formula.secondary
                              )
                                ? false
                                : true
                              : false
                          }
                          label={formula.name}
                          key={formula.primary + formula.secondary}
                          value={
                            formula.primary + formula.secondary + "/formula"
                          }
                        >
                          {formula.primary}{" "}
                          <span style={{ opacity: "60%" }}>
                            {formula.secondary}
                          </span>
                        </Option>
                      ))}
                </OptGroup>
                <OptGroup label="Pi Tags">
                  {(!dataPoints || !dataPoints.piTagOptions.length) && (
                    <Option key="pi_tags_loader" disabled>
                      <i className="fas fa-spinner fa-spin mx-auto d-block"></i>
                    </Option>
                  )}
                  {dataPoints &&
                    dataPoints.piTagOptions &&
                    dataPoints.piTagOptions
                      .filter((pi_tag) =>
                        (pi_tag.primary + " " + pi_tag.secondary)
                          .toLowerCase()
                          .includes(keyword.toLowerCase())
                      )
                      .map((pi_tag) => (
                        <Option
                          disabled={
                            optionsSelected && optionsSelected.length > 19 //filter length is always 1 less than wanted (5 max)
                              ? optionsSelected.includes(
                                pi_tag.primary + pi_tag.secondary
                              )
                                ? false
                                : true
                              : false
                          }
                          label={pi_tag.primary}
                          key={pi_tag.primary + pi_tag.secondary}
                          value={pi_tag.primary + pi_tag.secondary + "/pitag"}
                        >
                          {pi_tag.primary}{" "}
                          <span style={{ opacity: "60%" }}>
                            {pi_tag.secondary}
                          </span>
                        </Option>
                      ))}
                </OptGroup>
              </Select>
            </div>

            <div
              className="col-lg-2"
              style={{
                display: "flex",
                justifyContent: "space-between",
                height: "fit-content",
              }}
            >
              {!loading && (
                <button
                  style={{ width: "140px" }}
                  type="button"
                  className="btn btn-success"
                  onClick={generateDataDump}
                >
                  Generate <i className="far fa-file-excel"></i>
                </button>
              )}
              {loading && (
                <button
                  style={{ width: "140px" }}
                  type="button"
                  className="btn btn-success"
                  disabled
                >
                  <i className="fas fa-spinner fa-spin"></i>
                </button>
              )}
            </div>

            {dumpLink && (
              <div
                className="col-lg-2"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  height: "fit-content",
                }}
              >
                <a
                  style={{ width: "140px" }}
                  type="button"
                  className="btn btn-info"
                  href={dumpLink}
                >
                  Download <i className="far fa-file-excel"></i>
                </a>
              </div>
            )}
          </div>

          {loading && (
            <div className="d-flex justify-content-center">
              <Alert
                className="text-center mt-4 w-50"
                message="This may take a few minutes, please do not close this page"
                type="info"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataExport;
