import React, { useEffect, useState, useCallback } from "react";
import DateRangePicker from "../utilityComponents/dateRangePicker";
import { Select, notification, Alert } from "antd";
import PrePendLabel from "../utilityComponents/prependLabel";
import usePermissions from "../../../utilities/usePermissions";
import { REPORTING_PAGE_BTNS_PERMISSION } from "../../../constants/permissions";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import moment from "moment";
import {
  emissionsReportOptionsSelector,
  fetchEmissionsReportOptions,
} from "../../../redux/slices/FMT/emissionsReportOptionsSlice";

const { Option } = Select;
let intervalId;

const EmissionsReports = () => {
  const ranges = {
    YTD: [moment().startOf("year"), moment()],
    MTD: [moment().startOf("month"), moment()],
    "Last Year": [moment().add(-1, "years"), moment()],
    "Last 30 Days": [moment().add(-30, "days"), moment()],
    "Last 365 Days": [moment().add(-365, "days"), moment()],
    "Previous Year": [
      moment().subtract(1, "years").startOf("year"),
      moment().subtract(1, "years").endOf("year"),
    ],
  };
  const { checkPermission } = usePermissions();
  const dispatch = useDispatch();
  const { emissionsReportOptions } = useSelector(
    emissionsReportOptionsSelector
  );
  const {
    reportBinSizes = [],
    actions = [],
    parameters = [],
  } = emissionsReportOptions || {};
  const debugMode = useSelector((state) => state.mode.mode);

  const [parametersSelected, setParametersSelected] = useState([]);
  const [dateRangePicker, setDateRangePicker] = useState();
  const [loading, setLoading] = useState(false);
  const [reportInterval, setReportInterval] = useState(null);
  const [operation, setOperation] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [reportLink, setReportLink] = useState();

  useEffect(() => {
    dispatch(fetchEmissionsReportOptions());
  }, []);

  const setIntervalImmediate = (fn, time) => {
    fn();
    return setInterval(fn, time);
  };

  const changeInterval = (value) => {
    setReportInterval(value);
  };

  const changeOperation = (value) => {
    setOperation(value);
  };

  const changeParameters = (value) => {
    setParametersSelected(value);
  };

  const validateGenerateReport = () => {
    if (
      !dateRangePicker ||
      dateRangePicker[0] === "" ||
      dateRangePicker[1] === ""
    ) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Please select a date range",
      });
      return false;
    }

    if (parametersSelected.length === 0) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Please select at least one Parameter",
      });
      return false;
    }

    if (!reportInterval) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Please select an Interval",
      });
      return false;
    }

    if (!operation) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Please select an Operation",
      });
      return false;
    }

    if (dateRangePicker && dateRangePicker[0] && dateRangePicker[1] && reportInterval) {
      const diff = moment(dateRangePicker[1]).diff(moment(dateRangePicker[0]), 'days');
      console.log({diff})
      if (reportInterval === 'monthly' && diff < 28) {
        notification["warning"]({
          message: "Invalid Input",
          placement: "bottomLeft",
          description: "Range should be at least 28 days",
        });
        return false;
      }

      if (reportInterval === 'quarterly' && diff < 84) {
        notification["warning"]({
          message: "Invalid Input",
          placement: "bottomLeft",
          description: "Range should be at least 84 days",
        });
        return false;
      }

      if (reportInterval === 'semi-annual' && diff < 180) {
        notification["warning"]({
          message: "Invalid Input",
          placement: "bottomLeft",
          description: "Range should be at least 180 days",
        });
        return false;
      }

      if (reportInterval === 'annual' && diff < 365) {
        notification["warning"]({
          message: "Invalid Input",
          placement: "bottomLeft",
          description: "Range should be at least 365 days",
        });
        return false;
      }
    }
    return true;
  };

  const showTimeoutNotification = useCallback(() => {
    clearInterval(intervalId);
    notification["error"]({
      message: "Error",
      placement: "bottomLeft",
      description: "Timeout(02:00)",
      duration: null,
    });
    setLoading(false);
  }, [loading]);

  const generateReport = async () => {
    //check validations
    if (!validateGenerateReport()) return;
    setReportLink(null);

    const reportSchema = {
      start: moment(dateRangePicker[0]).toISOString(),
      end: moment(dateRangePicker[1]).toISOString(),
      parameters: parametersSelected.map((param) => ({
        id: param,
        paramType: "formula",
      })),
      reportBinSize: reportInterval,
      action: operation,
      debug: debugMode,
    };

    try {
      setLoading(true);

      const timeoutId = setTimeout(showTimeoutNotification, 15 * 60 * 1000);
      const { data } = await axios.post(
        "/api/widgets/flarereporting/generatereport/emissions",
        reportSchema
      );
      if (data && data.msg) {
        notification["success"]({
          message: "Success",
          placement: "bottomLeft",
          description: data.msg,
        });
      }
      if (data && data.jobID) {
        if (intervalId) {
          clearInterval(intervalId);
        }
        intervalId = setIntervalImmediate(async () => {
          try {
            const jobDetails = await axios.get(
              `/api/widgets/flarereporting/jobs?id=${data.jobID}`
            );
            if (jobDetails?.data?.job?.isComplete) {
              setReportLink(jobDetails.data.job.info.link);
              setLoading(false);
              clearTimeout(timeoutId);
              clearInterval(intervalId);
              notification["success"]({
                message: "Success",
                placement: "bottomLeft",
                description: "Report ready to download",
              });
            }
            if (jobDetails?.data?.job?.failed) {
              setLoading(false);
              clearTimeout(timeoutId);
              clearInterval(intervalId);
              notification["error"]({
                message: "Error",
                placement: "bottomLeft",
                description: "Failed",
                duration: null,
              });
            }
          } catch(err) {
            if (err.response) {
              // The request was made and the server responded with a status code
              // that falls out of the range of 2xx
              notification["error"]({
                message: "Error",
                placement: "bottomLeft",
                description: err.response.data?.msg || 'Error generating report',
                duration: 0,
              });
              
              setLoading(false);
              clearTimeout(timeoutId);
              clearInterval(intervalId);
            }
          }

        }, 1000 * 10);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
      setLoadingProgress(0);

      notification["error"]({
        message: "Error",
        placement: "bottomLeft",
        description: err.response.data?.msg || 'Error generating report',
        duration: 0,
      });
    }
  };

  return (
    <div className="container">
      <div className="card mt-4">
        <h5 className="card-header">Emission Reports</h5>
        <div className="card-body pt-5 pb-4">
          <div className="ant-form ant-form-horizontal">
            <div
              className="container-fluid d-flex"
              id="report-header-bar"
              style={{ justifyContent: "space-between" }}
            >
              <div
                className="input-group no-gutters d-flex justify-content-center mb-3 col-lg-6"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel title="Dates" width="150px" whiteSpace={true} />
                <DateRangePicker
                  setDateRangePicker={setDateRangePicker}
                  ranges={ranges}
                />
              </div>
              <div
                className="input-group no-gutters d-flex justify-content-center mb-3 col-lg-6"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel
                  title="Parameters"
                  width="150px"
                  whiteSpace={true}
                />
                <Select
                  mode="multiple"
                  id="report-emissions-id"
                  placeholder="Choose one or more"
                  style={{ width: "220px" }}
                  size={"large"}
                  value={parametersSelected}
                  onChange={changeParameters}
                  showArrow={true}
                  allowClear={true}
                  maxTagCount={0}
                >
                  {parameters?.formulas?.map((formula) => {
                    return (
                      <Option
                        key={
                          formula.id +
                          formula.flareName +
                          formula.primary +
                          formula.secondary
                        }
                        value={formula.id}
                      >
                        {formula.primary}
                      </Option>
                    );
                  })}
                </Select>
              </div>
            </div>

            <div
              className="container-fluid d-flex"
              id="report-header-bar"
              style={{ justifyContent: "space-between" }}
            >
              <div
                className="input-group no-gutters d-flex justify-content-center mb-3 col-lg-6"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel
                  title={"Interval"}
                  width="150px"
                  whiteSpace={true}
                />
                <Select
                  id="interval"
                  placeholder="Choose One"
                  size={"large"}
                  onChange={changeInterval}
                  value={reportInterval}
                  style={{ textTransform: "capitalize", width: "220px" }}
                >
                  {reportBinSizes.map((reportBinSize) => {
                    return (
                      <Option
                        key={reportBinSize}
                        value={reportBinSize}
                        style={{ textTransform: "capitalize" }}
                      >
                        {reportBinSize}
                      </Option>
                    );
                  })}
                </Select>
              </div>

              <div
                className="input-group no-gutters d-flex justify-content-center mb-3 col-lg-6"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel
                  title={"Operation"}
                  width="150px"
                  whiteSpace={true}
                />
                <Select
                  id="operation"
                  placeholder="Choose One"
                  style={{ textTransform: "capitalize", width: "220px" }}
                  size={"large"}
                  onChange={changeOperation}
                  value={operation}
                >
                  {actions.map((action) => {
                    return (
                      <Option
                        key={action}
                        value={action}
                        style={{ textTransform: "capitalize" }}
                      >
                        {action}
                      </Option>
                    );
                  })}
                </Select>
              </div>
            </div>

            <div
              className="container mt-2"
              id="reports-gen-bar"
              style={{ justifyContent: "space-evenly" }}
            >
              <div
                className="mb-2"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {!loading && (
                  <button
                    style={{ width: "240px", height: "fit-content" }}
                    type="button"
                    className="btn btn-success"
                    onClick={generateReport}
                    disabled={!checkPermission(REPORTING_PAGE_BTNS_PERMISSION)}
                  >
                    Generate <i className="ml-2 far fa-file-excel"></i>
                  </button>
                )}
                {loading && (
                  <button
                    style={{ width: "240px" }}
                    type="button"
                    className="btn btn-success"
                    disabled
                  >
                    <i className="fas fa-spinner fa-spin"></i>
                  </button>
                )}
                {reportLink && (
                  <div
                    className="mt-3"
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
                      href={reportLink}
                    >
                      Download <i className="far fa-file-excel"></i>
                    </a>
                  </div>
                )}
              </div>
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
    </div>
  );
};

export default EmissionsReports;
