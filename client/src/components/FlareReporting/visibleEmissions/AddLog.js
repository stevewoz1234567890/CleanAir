import { DatePicker, Input } from "antd";
import moment from "moment";
import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import PrePendLabel from "../utilityComponents/prependLabel";
import {
  flaresSelector,
  fetchFlares,
} from "../../../redux/slices/FMT/flareSlice";
import { Select, notification } from "antd";

const { Option } = Select;
const { RangePicker } = DatePicker;

const AddLog = (props) => {
	const {onCancel, onSave} = props;
  const dispatch = useDispatch();
  const flares = useSelector(flaresSelector);

  const [flaresSelected, setFlaresSelected] = useState(null);
  const [dateRangePicker, setDateRangePicker] = useState(null);
  const [notes, setNotes] = useState("");

  const changeFlare = (value) => {
    setFlaresSelected(value);
  };

  const dateRangePickerChange = (value, dateString) => {
    let dateRange;

    if (dateString[0] === "" || dateString[1] === "") {
      dateRange = null;
    } else {
      dateRange = [
        dateString[0].replace(" ","T"),
        dateString[1].replace(" ","T"),
      ];
    }

    setDateRangePicker(dateRange);
  };

  const onChangeNotes = ({ target: { value } }) => {
    setNotes(value);
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

    if (!flaresSelected) {
      notification["warning"]({
        message: "Invalid Input",
        placement: "bottomLeft",
        description: "Please select at least one flare",
      });
      return false;
    }

    return true;
  };

  const onSaveClick = () => {
		if (validateGenerateTemplate()) {
			const data = {
				flareId: flaresSelected,
				startDate: dateRangePicker[0],
				endDate: dateRangePicker[1],
				notes
			};
			onSave(data);
		}
	};

  useEffect(() => {
    dispatch(fetchFlares());
  }, []);

  return (
    <div className="d-flex flex-column mb-5">
			<div className="d-flex align-items-center justify-content-between mb-4 row">
        <div className="d-flex justify-content-center col-md-6">
          <PrePendLabel title="Dates" width="65px" />
          <RangePicker
            format="YYYY-MM-DD HH:mm"
						showTime
            onChange={dateRangePickerChange}
            size={"large"}
						className="w-100"
						disabledDate={(current) => {
							return moment() < current;
						}}
          />
        </div>
        <div className="d-flex justify-content-center col-md-4">
          <PrePendLabel title="Flare" width="65px" />
          <Select
            id="flare-selector"
            placeholder="Choose a Flare"
            optionFilterProp="children"
            showArrow={true}
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
            onChange={changeFlare}
            value={flaresSelected}
						className="w-100"
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
				<div className="col-md-2 d-flex justify-content-end">
					<button
						className="btn btn-success"
						onClick={onSaveClick}
						style={{ width: "100px", height: "fit-content" }}
					>
						Save <i className="far fa-save"></i>
					</button>
				</div>
			</div>
      <div className="d-flex align-items-center justify-content-between row">
        <div className="d-flex justify-content-center col-md-10">
          <PrePendLabel title="Notes" width="100px" />
          <Input
            type="text"
            size={"large"}
            allowClear
            onChange={onChangeNotes}
						className="w-100"
						placeholder="Enter Notes here"
          />
        </div>
        <div className="col-md-2 d-flex justify-content-end">
					<button
						className="btn btn-outline-secondary"
						onClick={onCancel}
						style={{ width: "100px", height: "fit-content" }}
					>
						Cancel
					</button>
				</div>
      </div>
    </div>
  );
};

export default AddLog;
