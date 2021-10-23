import React, { useEffect, useState, useCallback } from "react";
import DateRangePicker from "../utilityComponents/dateRangePicker";
import { Select, notification, Alert } from "antd";
import PrePendLabel from "../utilityComponents/prependLabel";
import usePermissions from "../../../utilities/usePermissions";
import { REPORTING_PAGE_BTNS_PERMISSION } from "../../../constants/permissions";
import { useSelector, useDispatch } from "react-redux";
import {
  flaresSelector,
  fetchFlares,
} from "../../../redux/slices/FMT/flareSlice";
import axios from "axios";
import moment from "moment";
import {
  eventrulesSelector,
  fetchEventRules,
} from "../../../redux/slices/FMT/eventRulesSlice";
import {
  numericEventRulesSelector,
  fetchNumericEventRules,
} from "../../../redux/slices/FMT/numericEventRulesSlice";

const { Option, OptGroup } = Select;
let intervalId;

const GeneralReports = () => {
  const ranges = {
    YTD: [moment().startOf("year"), moment()],
    MTD: [moment().startOf("month"), moment()],
    "Last Year": [moment().add(-1, "year"), moment()],
    "Last 30 Days": [moment().add(-30, "days"), moment()],
    "Last 365 Days": [moment().add(-365, "days"), moment()],
    "Previous Year": [
      moment().subtract(1, "years").startOf("year"),
      moment().subtract(1, "years").endOf("year"),
    ],
  };
  const { checkPermission } = usePermissions();
  const dispatch = useDispatch();
  const flares = useSelector(flaresSelector);
  const eventRules = useSelector(eventrulesSelector);
  const numericEventRules = useSelector(numericEventRulesSelector);
  // console.log("HERE: ", numericEventRules)
  const visibleEmissionsSpecialRule = {
    _id: "VISIBLE_EMISSIONS",
    name: "Visible Emissions",
    type: "special"
  };
  const reportsFiltered = eventRules
    ? eventRules.filter((e) => e.use !== "unassigned")
    : eventRules;
  const reports = eventRules && numericEventRules
    ? { reportsFiltered, numericEventRules, specialRules: [visibleEmissionsSpecialRule] }
    : eventRules;

  const debugMode = useSelector((state) => state.mode.mode);

  const [selectedFlare, setSelectedFlare] = useState();
  const [optionsSelected, setOptionsSelected] = useState([]);
  const [dateRangePicker, setDateRangePicker] = useState();
  const [loading, setLoading] = useState(false);
  const [reportLink, setReportLink] = useState();

  useEffect(() => {
    dispatch(fetchFlares());
    dispatch(fetchEventRules());
    dispatch(fetchNumericEventRules());
  }, []);

  const changeFlare = (value) => {
    setSelectedFlare(value);
  };

  const handleChange = (value) => {
    setOptionsSelected(value);
  };

  const setIntervalImmediate = (fn, time) => {
    fn();
    return setInterval(fn, time);
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

    if (!selectedFlare) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Please select a flare",
      });
      return false;
    }

    if (optionsSelected.length === 0) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Please select at least one report",
      });
      return false;
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
      flareID: selectedFlare,
      ruleIDs: optionsSelected.map(o => { return { _id: o[0], type: o[1] } }),
      start: moment(dateRangePicker[0]).format("YYYY/MM/DD"),
      end: moment(dateRangePicker[1]).format("YYYY/MM/DD"),
      debug: debugMode,
    };

    try {
      setLoading(true);

      const timeoutId = setTimeout(showTimeoutNotification, 15 * 60 * 1000);
      const { data } = await axios.post(
        "/api/widgets/flarereporting/generatereport",
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
                description: jobDetails?.data?.msg || "Report ready to download",
              });
            }
            if (jobDetails?.data?.job?.failed) {
              notification["error"]({
                message: "Error",
                placement: "bottomLeft",
                description: jobDetails?.data?.msg || "Failed",
                duration: null,
              });
              setLoading(false);
              clearTimeout(timeoutId);
              clearInterval(intervalId);
            }
          } catch (err) {
            if (err.response) {
              // The request was made and the server responded with a status code
              // that falls out of the range of 2xx
              notification["error"]({
                message: "Error",
                placement: "bottomLeft",
                description: err.response.data.msg || 'Error generating report',
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
      notification["error"]({
        message: "Error",
        placement: "bottomLeft",
        description: `Error generating report ${err}`,
        duration: 0,
      });
    }
  };

  return (
    <div className="container">
      <div className="card mt-4">
        <h5 className="card-header">Event Reports</h5>
        <div className="card-body pt-5 pb-4">
          <div className="ant-form ant-form-horizontal">
            <div
              className="container-fluid d-flex"
              id="report-header-bar"
              style={{ justifyContent: "space-between" }}
            >
              <div
                className="input-group no-gutters d-flex justify-content-center mb-3 col-lg-12"
                style={{ flexWrap: "nowrap" }}
              >
                <PrePendLabel title="Dates" width="150px" whiteSpace={true} />
                <DateRangePicker
                  setDateRangePicker={setDateRangePicker}
                  ranges={ranges}
                />
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
                <PrePendLabel title="Flare" width="150px" whiteSpace={true} />
                <Select
                  id="report-flare-id"
                  placeholder="Choose One"
                  style={{ width: "220px" }}
                  size={"large"}
                  value={selectedFlare}
                  onChange={changeFlare}
                >
                  {flares &&
                    flares.map((flare) => {
                      return (
                        <Option value={flare._id} key={flare._id}>
                          {flare.name}
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
                  title={"Reports"}
                  width="150px"
                  whiteSpace={true}
                />
                <Select
                  id="flare-report-selectorr"
                  mode="multiple"
                  placeholder="Choose one or more"
                  optionFilterProp="children"
                  showArrow={true}
                  filterOption={(input, option) =>
                    option.children
                      .toLowerCase()
                      .indexOf(input.toLowerCase()) >= 0
                  }
                  onChange={handleChange}
                  value={optionsSelected}
                  style={{ width: "220px", display: "grid", textAlign: "left" }}
                  size={"large"}
                  allowClear={true}
                  maxTagCount={0}
                >
                  <OptGroup label="Boolean Events">
                    {reports?.reportsFiltered &&
                      reports.reportsFiltered.map((report) => (
                        <Option value={[report._id, report.type]} key={report._id}>
                          {report.name}
                        </Option>
                      ))}
                  </OptGroup>
                  <OptGroup label="Numeric Events">
                    {reports?.numericEventRules &&
                      reports.numericEventRules.map((report) => (
                        <Option value={[report._id, report.type]} key={report._id}>
                          {report.name}
                        </Option>
                      ))}
                  </OptGroup>
                  <OptGroup label="Special Events">
                    {reports?.specialRules &&
                      reports.specialRules.map((report) => (
                        <Option value={[report._id, report.type]} key={report._id}>
                          {report.name}
                        </Option>
                      ))}
                  </OptGroup>
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

export default GeneralReports;
