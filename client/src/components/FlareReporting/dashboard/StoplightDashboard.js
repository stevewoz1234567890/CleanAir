import { Table, Alert } from "antd";
import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import styled, { keyframes, css } from "styled-components";
import {
  fetchStoplightDashboardSchemaData,
  stoplightDashboardSchemaSelector,
} from "../../../redux/slices/FMT/stoplightDashboardInitSlice";
import {
  fetchStoplightDashboardStatusData,
  stoplightDashboardStatusSelector,
} from "../../../redux/slices/FMT/stoplightDashboardStatusSlice";
import Spinner from "../../Layout/Spinner";

const blinkRed = keyframes`
  from { background-color: #F00; }
  50% { background-color: #A00; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 7px 1px, inset #441313 0 -1px 9px, rgba(255, 0, 0, 0.5) 0 2px 0;}
  to { background-color: #F00; }
`;

const blinkYellow = keyframes`
  from { background-color: #FF0; }
  50% { background-color: #9e8932; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 7px 1px, inset #9e8932 0 -1px 9px, #FF0 0 2px 0; }
  to { background-color: #FF0; }
`;

const blinkGreen = keyframes`
  from { background-color: #ABFF00; }
  50% { background-color: #87ab49; box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 7px 1px, inset #63793b 0 -1px 9px, #ABFF00 0 2px 0;}
  to { background-color: #ABFF00; }
`;

const LED_ANIMATION = {
  red: blinkRed,
  green: blinkGreen,
  yellow: blinkYellow,
};

const animation = (props) => css`
  ${LED_ANIMATION[props.color]} 3s infinite
`;

const Light = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 100%;
  display: flex;
  justify-content: center;
  background-color: ${(props) =>
    props.color === "red"
      ? "#F00"
      : props.color === "green"
      ? "#ABFF00"
      : props.color === "yellow"
      ? "#FF0"
      : "#999999"};
  box-shadow: ${(props) =>
    props.color === "red"
      ? "rgba(0, 0, 0, 0.2) 0 -1px 7px 1px, inset #441313 0 -1px 9px, rgba(255, 0, 0, 0.5) 0 2px 12px;"
      : props.color === "green"
      ? "rgba(0, 0, 0, 0.2) 0 -1px 7px 1px, inset #304701 0 -1px 9px, #89FF00 0 2px 12px"
      : props.color === "yellow"
      ? "rgba(0, 0, 0, 0.2) 0 -1px 7px 1px, inset #9e8932 0 -1px 9px, #FF0 0 2px 12px"
      : "none"};

  animation: "none";
  color: ${(props) => (props.color ? "white" : "palevioletred")};
`;

const StyledTable = styled(Table)`
  &&& {
    table th,
    table tr,
    table td {
      padding: 0;
      background-color: transparent;
    }

    table th::before {
      width: 0 !important;
    }
    tr:nth-child(even) {
        background-color: #f2f2f2;
    }
    tr:nth-child(even):hover {
      .custom {
        background-color: #f2f2f2;
      }
    }

    .ant-table-cell-fix-left,
    .ant-table-cell-fix-right {
      background-color: transparent;
    }
  }
`;

const StoplightDashboard = () => {
  const dispatch = useDispatch();

  const dashboardSchema = useSelector(stoplightDashboardSchemaSelector);
  const dashboardStatus = useSelector(stoplightDashboardStatusSelector);

  useEffect(() => {
    dispatch(fetchStoplightDashboardSchemaData());
    dispatch(fetchStoplightDashboardStatusData());
  }, []);

  if (!dashboardSchema || !dashboardStatus) {
    return <Spinner />;
  }

  let columnsData = dashboardSchema.data.columns.periods.map((period) => ({
    title: (
      <div style={{ background: "#cccccc", padding: "10px" }}>{period}</div>
    ),
    children: dashboardSchema.data.columns.flares.map((flare) => ({
      title: <div className="custom" style={{ background: "#fff", padding: "10px" }}>{flare.name}</div>,
      dataIndex: flare._id + period,
      key: flare._id,
      width: 200,
      align: "center",
      render: (color) => (
        <div
          className="custom"
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            padding: "10px",
          }}
        >
          <Light color={color ? color : "gray"}></Light>
        </div>
      ),
    })),
  }));

  const firstColumun = {
    title: "",
    dataIndex: "name",
    key: "name",
    width: 150,
    fixed: "left",
    align: "right",
  };
  const gap = {
    title: "",
    width: 100,
  };

  columnsData = columnsData.reverse().reduce(
    (result, column) => [gap, column, ...result],
    []
  );

  const complianceRows = dashboardSchema.data.sections[0].rows;
  const uptimeRows = dashboardSchema.data.sections[1].rows;
  columnsData.unshift(firstColumun);

  const compliance = dashboardStatus.data.filter(
    (status) => status.section === "compliance"
  );

  const uptime = dashboardStatus.data.filter(
    (status) => status.section === "uptime"
  );

  const complianceData = complianceRows.map((row) => {
    const result = {
      name: row.name,
      key: row._id,
    };

    compliance
      .filter((c) => c.rowID === row._id)
      .forEach((c) => {
        result[`${c.flareID}${c.period}`] = c.color.name;
      });

    return result;
  });

  const uptimeData = uptimeRows.map((row) => {
    const result = {
      name: row.name,
      key: row._id,
    };

    uptime
      .filter((c) => c.rowID === row._id)
      .forEach((c) => {
        result[`${c.flareID}${c.period}`] = c.color.name;
      });

    return result;
  });

  return (
    <div className="container">
      <div className="card mt-4">
        <h5 className="card-header">Compliance</h5>
        <div className="card-body pt-5 pb-4">
          <StyledTable
            columns={columnsData}
            dataSource={complianceData}
            pagination={false}
            style={{ fontSize: "18px" }}
          />
        </div>
      </div>

      <div className="card mt-4 mb-4">
        <h5 className="card-header">Uptime</h5>
        <div className="card-body pt-5 pb-4">
          <StyledTable
            columns={columnsData}
            dataSource={uptimeData}
            pagination={false}
            style={{ fontSize: "18px" }}
          />
        </div>
      </div>
    </div>
  );
};

export default StoplightDashboard;
