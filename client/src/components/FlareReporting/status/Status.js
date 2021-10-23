import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useIdleTimer } from "react-idle-timer";
import axios from "axios";
import { loadFormulas } from "../../../redux/slices/FMT/formulasSlice";

import { PullDown } from "../../Layout/PulldownMenu";
import Spinner from "../../Layout/Spinner";
import StatusChart from "./StatusChart";
import StatusTable from "./StatusTable";
import { useParams } from "react-router-dom";
import { dashboardFlaresSelector } from "../../../redux/slices/FMT/dashboardFlareSlice";
import PrePendLabel from "../../utilities/prependLabel";
import styled from "styled-components";
import { Select } from "antd";

let intervalId;
const { Option } = Select;
const AVERAGE_OPTIONS = [
  {
    id: "dynamic",
    value: "dynamic",
    name: "Dynamic",
  },
  {
    id: "raw",
    value: "raw",
    name: "Raw",
  },
];

export const FlareNameWrapper = styled.div`
  display: flex;
  align-items: center;
  `;

export const FlareName = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.125);
  flex: 1;
  background-color: white;
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  min-width: 70px;
`;

const Status = () => {
  const dispatch = useDispatch();
  const { flare } = useParams();
  const [selectedAverage, setSelectedAverage] = useState();
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [dashboardData, setDashboardData] = useState([]);
  const [allTagsData, setAllTagsData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const debugMode = useSelector((state) => state.mode.mode);
  const formulas = useSelector((state) => state.formulas);
  const { flares } = useSelector(dashboardFlaresSelector);
  const selectedFlare = flares.find((f) => f.flare === flare);

  const onAverageChange = (value) => {
    setSelectedAverage(value);
  };

  const getDashboardData = async () => {
    setIsLoading(true);
    const res = await axios.get(
      `/api/widgets/flarereporting/dashboard/data?debug=${debugMode}`
    );
    if (selectedFlare && selectedFlare.data) {
      const filteredData = res?.data?.data.filter((item) => {
        if (item.displayInfo.type === "formula") {
          return (
            selectedFlare.data.map((s) => s.id).includes(item.id) &&
            selectedFlare.data
              .map((s) => s.flare)
              .includes(item.displayInfo.flare)
          );
        } else {
          return selectedFlare.data.map((s) => s.id).includes(item.id);
        }
      });
      const chartData = filteredData.map((item) => ({
        ...item,
        name: item.displayInfo.parameter,
      }));

      setDashboardData(chartData);
      const data = filteredData.map((item) => {
        let name = item.displayInfo.parameter;
        let parent = item.displayInfo.parent;
        if (name.includes("Header")) {
          parent = parent.substring(parent.indexOf(" ") + 1);
          name = name.replace("Header", parent);
        }
        if (name.includes("Flare - ")) {
          name = name.replace("Flare - ", "");
        }
        return {
          key: item.id.concat(item.displayInfo.parent.replace(" ", "_")),
          name,
          type: item.type === "pitag" ? "PiTag" : "Formulas",
          value: item.recent === "n/a" ? "Null" : item.recent[1],
          timeStamp: item.recent === "n/a" ? "Null" : item.recent[0],
          parent,
        };
      });
      setAllTagsData(data || []);
      // fill in dropdown options
      setSelectedOptions(data.map(item => item.key) || [])
      setIsLoading(false);
    }
  };

  const handleOnIdle = () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };

  const handleOnActive = () => {
    getDashboardData();
    if (intervalId) {
      clearInterval(intervalId);
    }
    intervalId = setInterval(() => {
      getDashboardData();
    }, 1000 * 120);
  };

  const onSelectChartData = (selectedOptions) => {
    setSelectedOptions(selectedOptions);
  }

  useIdleTimer({
    timeout: 1000 * 60 * 15,
    onIdle: handleOnIdle,
    onActive: handleOnActive,
    debounce: 500,
  });

  useEffect(() => {
    if (flares && flares.length > 0) {
      getDashboardData();

      if (intervalId) {
        clearInterval(intervalId);
      }

      // fetch chart data every 60 seconds
      intervalId = setInterval(() => {
        getDashboardData();
      }, 1000 * 120);
    }
  }, [flares, selectedFlare, debugMode]);

  useEffect(() => {
    dispatch(loadFormulas());
    setSelectedAverage("dynamic");

    // when unmount, clear interval
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const tagsData = allTagsData.filter(data => selectedOptions.includes(data.key))
  const chartData = dashboardData.filter(data => selectedOptions.some(option => option.includes(data.id)))

  return (
    <div className="container mt-4">
      <div className="d-flex">
        <div className="col-lg-4 pl-0">
          <FlareNameWrapper>
            <PrePendLabel title="Flare Name" width={"105px"} />
            <FlareName>{selectedFlare?.name}</FlareName>
          </FlareNameWrapper>
        </div>
        <div className="col-lg-4">
          <PullDown
            value={selectedAverage}
            onChange={onAverageChange}
            options={AVERAGE_OPTIONS}
            label={"Average"}
          ></PullDown>
        </div>
        <div className="col-lg-4 input-group mb-3 justify-content-flex-start pr-0" style={{ flexWrap: "nowrap" }}>
          <PrePendLabel title="Data" width="65px" />
          <Select
            mode="multiple"
            placeholder="Select data"
            value={selectedOptions}
            onChange={onSelectChartData}
            maxTagCount={0}
            style={{ width: '100%', display: "grid" }}
          >
            {allTagsData.map(item => (
              <Option key={item.key} value={item.key}>
                {item.name}
              </Option>
            ))}
          </Select>
        </div>
      </div>
      {formulas && dashboardData && dashboardData.length > 0 && !isLoading && (
        <div>
          <div className="card mb-4">
            <div className="card-body pt-4 pb-0">
              <StatusTable tableData={tagsData} />
              <div className="position-relative">
                <button className="btn btn-info">ADD 24hrs</button>
                <StatusChart
                  chartData={chartData}
                  average={selectedAverage}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {(!formulas ||
        !dashboardData ||
        dashboardData.length === 0 ||
        isLoading) && (
        <div className="container-fluid d-flex align-items-center justify-content-center h-100 pb-5">
          <Spinner />
        </div>
      )}
    </div>
  );
};

export default Status;
