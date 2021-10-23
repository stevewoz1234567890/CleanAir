import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import moment from "moment";
import axios from "axios";
import { Select, notification } from "antd";
import {
  flaresSelector,
  fetchFlares,
} from "../../../redux/slices/FMT/flareSlice";
import DateRangePicker from "../utilityComponents/dateRangePicker";
import PrePendLabel from "../utilityComponents/prependLabel";
import usePermissions from "../../../utilities/usePermissions";
import { DATA_DATA_UPLOAD_BTN_UPLOAD } from "../../../constants/permissions";

const { Option } = Select;

const DataTemplate = () => {
  const ranges = {
    Today: [moment(), moment()],
    Yesterday: [moment().add(-1, "days"), moment()],
    "Last 7 Days": [moment().add(-7, "days"), moment()],
    "Last 30 Days": [moment().add(-30, "days"), moment()],
    "Last 90 Days": [moment().add(-90, "days"), moment()],
    "Last 180 Days": [moment().add(-180, "days"), moment()],
    "Last 365 Days": [moment().add(-365, "days"), moment()],
    "Current Week": [moment().startOf("week"), moment().endOf("week")],
    "Current Month": [moment().startOf("month"), moment().endOf("month")],
    "Current Quarter": [moment().startOf("quarter"), moment().endOf("quarter")],
    "Current Semester": [
      moment().set("month", Math.floor(moment().month() / 6) * 6).startOf("month"),
      moment().set("month", Math.floor(moment().month() / 6) * 6 + 5).endOf("month"),
    ],
    "Current Year": [moment().startOf("year"), moment().endOf("year")],
    "Previous Week": [
      moment().subtract(1, "weeks").startOf("week"),
      moment().subtract(1, "weeks").endOf("week"),
    ],
    "Previous Month": [
      moment().subtract(1, "months").startOf("month"),
      moment().subtract(1, "months").endOf("month"),
    ],
    "Previous Quarter": [
      moment().subtract(1, "quarters").startOf("quarter"),
      moment().subtract(1, "quarters").endOf("quarter"),
    ],
    "Previous Semester": [
      moment().set("month", Math.floor(moment().month() / 6) * 6).subtract(6, "months").startOf("month"),
      moment().set("month", Math.floor(moment().month() / 6) * 6 + 5).subtract(6, "months").endOf("month"),
    ],
    "Previous Year": [
      moment().subtract(1, "years").startOf("year"),
      moment().subtract(1, "years").endOf("year"),
    ],
  };
  const { checkPermission } = usePermissions();
  const [flaresSelected, setFlaresSelected] = useState([]);
  const [dateRangePicker, setDateRangePicker] = useState();
  const [templateLink, setTemplateLink] = useState();
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const flares = useSelector(flaresSelector);

  useEffect(() => {
    dispatch(fetchFlares());
  }, []);

  const changeFlare = (value) => {
    setFlaresSelected(value);
  };

  const validateGenerateTemplate = () => {
    if (!dateRangePicker) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Please select a data range",
      });
      return false;
    }

    if (flaresSelected.length === 0) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Please select at least one flare",
      });
      return false;
    }

    return true;
  };

  const generateTemplate = async () => {
    if (!validateGenerateTemplate()) return;

    setTemplateLink();

    const template_schema = {
      flare_ids: flaresSelected,
      param_ids: [],
      start_date: dateRangePicker[0],
      end_date: dateRangePicker[1],
    };

    try {
      setLoading(true);

      const { data } = await axios.post(
        "/api/widgets/flarereporting/datatransfer",
        {
          schema: template_schema,
        }
      );
      setTemplateLink(data.fileLink);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.log("Error creating template", err);
    }
  };

  return (
    <div className="col-md-6" style={{ diplay: "flex" }}>
      <div className="card" style={{ width: "100%" }}>
        <h5 className="card-header">Data Template</h5>
        <div className="card-body">
          <div className="input-group mb-3 justify-content-center">
            <PrePendLabel title="Dates" width="65px" />
            <DateRangePicker setDateRangePicker={setDateRangePicker} ranges={ranges} />
          </div>

          <div className=" input-group mb-3 justify-content-center">
            <PrePendLabel title="Flare" width="65px" />
            <Select
              id="data-dump-selector"
              mode="multiple"
              placeholder="Choose one or more"
              optionFilterProp="children"
              showArrow={true}
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
              onChange={changeFlare}
              value={flaresSelected}
              style={{ width: "220px", display: "grid" }}
              size={"large"}
              allowClear={true}
            >
              {flares &&
                flares.map((flare) => (
                  <Option value={flare._id} key={flare._id}>
                    {flare.name}
                  </Option>
                ))}
            </Select>
          </div>
          <center className="col">
            {!loading && (
              <span>
                <button
                  style={{ width: "140px" }}
                  type="button"
                  className="btn btn-success"
                  onClick={generateTemplate}
                  disabled={!checkPermission(DATA_DATA_UPLOAD_BTN_UPLOAD)}
                >
                  Generate <i className="far fa-file-excel"></i>
                </button>
                {templateLink && (
                  <div style={{ textAlign: "center", marginBottom: "-0.5rem", marginTop: "1rem" }}>
                    <a href={templateLink}>File Link</a>
                  </div>
                )}
              </span>
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
          </center>
        </div>
      </div>
    </div>
  );
};

export default DataTemplate;
