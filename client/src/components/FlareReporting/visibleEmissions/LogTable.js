import { Table } from "antd";
import moment from "moment";

const getColumns = (rowCount) => [
  {
    title: "Date and Time Deviation Started",
    dataIndex: "startDate",
    align: "center",
    key: "startDate",
  },
  {
    title: "Date and Time Deviation Ended",
    dataIndex: "endDate",
    align: "center",
    key: "endDate",
  },
  {
    title: "Notes",
    dataIndex: "notes",
    align: "center",
    key: "notes",
  },
];

const LogTable = (props) => {
  const { tableData } = props;

  const dateFormatted = tableData.map(data => ({
    ...data,
    startDate: data.startDate,
    endDate: data.endDate,
    key: data._id
  }))

  return (
    <Table
      columns={getColumns(tableData.length)}
      dataSource={dateFormatted}
      className="w-100"
      pagination={true}
      bordered
    />
  );
};

export default LogTable;
