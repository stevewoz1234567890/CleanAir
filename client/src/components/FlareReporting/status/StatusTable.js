import PrePendLabel from "../utilityComponents/prependLabel";
import { FlareName, FlareNameWrapper } from "./Status";

const StatusTable = (props) => {
  const { tableData } = props;

  return (
    <>
      <h5 className="mb-3">{tableData[0]?.timeStamp}</h5>
      <div className="d-flex flex-wrap">
        {tableData.map(item => (
          <div className="mr-3 pb-3" key={item.key}>
            <FlareNameWrapper>
              <PrePendLabel title={item?.name} />
              <FlareName>{item?.value}</FlareName>
            </FlareNameWrapper>
          </div>
        ))}
      </div>
    </>
  );
};

export default StatusTable;
