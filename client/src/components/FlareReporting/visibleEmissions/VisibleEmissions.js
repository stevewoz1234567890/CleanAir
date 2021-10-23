import { Alert, DatePicker } from "antd";
import moment from "moment";
import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetctVisibleEmissionLogs, AddVisibleEmissionLog } from "../../../redux/slices/FMT/visibleEmissionSlice";
import PrePendLabel from "../utilityComponents/prependLabel";
import LogTable from "./LogTable";
import AddLog from "./AddLog";
import { VISIBLE_EMISSION_ADD_PERMISSION } from "../../../constants/permissions"
import usePermissions from "../../../utilities/usePermissions";

const { RangePicker } = DatePicker;

const VisibleEmissions = () => {
  const { checkPermission } = usePermissions();
  const lastYear = moment().year() - 1;
  const dispatch = useDispatch();
  const dateFormat = "YYYY-MM-DD"
  const startDate = moment.utc(new Date(lastYear,0));
  const endDate = moment.utc(new Date());

  const [dateRangePicker, setDateRangePicker] = useState(null);
  const [isAddMode, setIsAddMode] = useState(false);

  const visibleEmissionLogs = useSelector(
    (state) => state.visibleEmissions.logs
  );

  const onAddClick = () => {
    setIsAddMode(true);
  };

  const dateRangePickerChange = (value, dateString) => {
    let dateRange;

    if (dateString[0] === "" || dateString[1] === "") {
      dateRange = null;
    } else {
      dateRange = [
        moment(dateString[0]).format("YYYY-MM-DD"),
        moment(dateString[1]).format("YYYY-MM-DD"),
      ];
    }

    setDateRangePicker(dateRange);
  };

  const readableDate = (date) => {
    return moment(date).format("MMM DD, YYYY");
  };

  const onCancel = () => {
    setIsAddMode(false);
  };

  const onSave = async (data) => {
    await dispatch(AddVisibleEmissionLog(data))
    dispatch(fetctVisibleEmissionLogs(startDate, endDate));
    setIsAddMode(false);
  };

  useEffect(() => {
    if (dateRangePicker) {
      const startDateStr = dateRangePicker[0];
      const endDateStr = dateRangePicker[1];
      dispatch(fetctVisibleEmissionLogs(startDateStr, endDateStr));
    }
  }, [dateRangePicker]);

  useEffect(() => {
    dispatch(fetctVisibleEmissionLogs(startDate, endDate));
  }, []);

  return (
    <div className="container mt-4">
      {!isAddMode && (
        <div className="d-flex align-items-center position-relative">
          <div className="input-group mb-3 justify-content-center">
            <PrePendLabel title="Dates" width="65px" />
            <RangePicker
              format="YYYY-MM-DD"
              onChange={dateRangePickerChange}
              size={"large"}
              defaultValue={[startDate, endDate]}
            />
          </div>
          <button
            className="btn btn-info mb-3 position-absolute"
            onClick={onAddClick}
            style={{ width: "100px", height: "fit-content", right: 0 }}
            disabled={!checkPermission(VISIBLE_EMISSION_ADD_PERMISSION)}
          >
            <span>
              Add <i className="fas fa-plus"></i>
            </span>
          </button>
        </div>
      )}
      {isAddMode && <AddLog onSave={onSave} onCancel={onCancel} />}
      {visibleEmissionLogs &&
        visibleEmissionLogs.map((visibleEmission) => {
          return (
            <div
              className="card my-4"
              key={visibleEmission._id}
              style={{ width: "100%" }}
            >
              <h5 className="card-header">{visibleEmission.name} ({visibleEmission.permitId})</h5>
              <div className="container">
                <div className="d-flex justify-content-center my-2">
                  {visibleEmission.logData &&
                    visibleEmission.logData.length > 0 && (
                      <LogTable tableData={visibleEmission.logData} />
                    )}
                  {!visibleEmission.logData ||
                    (visibleEmission.logData.length === 0 && (
                      <div className="py-3 d-flex justify-content-center w-full">
                        <Alert
                          message={`No visible emissions for reporting period of ${
                            dateRangePicker
                              ? readableDate(dateRangePicker[0])
                              : readableDate(startDate)
                          } - ${
                            dateRangePicker
                              ? readableDate(dateRangePicker[1])
                              : readableDate(endDate)
                          }`}
                          type="info"
                        />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
};

export default VisibleEmissions;
