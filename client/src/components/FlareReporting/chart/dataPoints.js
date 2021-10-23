import React, { useState } from "react";
import { Select } from "antd";
import PrePendLabel from "../utilityComponents/prependLabel";
import styled from "styled-components";

const { Option, OptGroup } = Select;

const TagWrapper = styled.div`
  padding: 5px 10px;
  background-color: #ccc;
  font-size: 15px;
  margin-right: 5px;
`;

const DataPoints = (props) => {
  const {
    setOptionsSelected,
    optionsSelected,
    applyData,
    dataPoints,
    loading,
  } = props;

  const [keyword, setKeyword] = useState("");

  const changeDataPoints = (value) => {
    setOptionsSelected(value);
  };

  const tagRender = () => {
    if (optionsSelected.length === 1) {
      const selectedItem = [
        ...dataPoints.formulaOptions,
        ...dataPoints.piTagOptions,
      ].find((dp) => dp.primary + dp.secondary === optionsSelected[0]);
      return (
        <TagWrapper style={{ pointerEvents: "none" }}>
          {selectedItem.primary}
        </TagWrapper>
      );
    }

    return <TagWrapper>{optionsSelected.length} items selected </TagWrapper>;
  };

  return (
    <div
      className="col-lg-6 justify-content-center"
      style={{ display: "flex" }}
    >
      <div className="card" style={{ width: "100%" }}>
        <h5 className="card-header">Data Points</h5>
        <div className="card-body">
          <div className="row container">
            <div className="col-10">
              <div className="input-group">
                <PrePendLabel title="Data" width="65px" />
                <Select
                  mode="multiple"
                  placeholder="Select up to 5 points"
                  showArrow
                  onChange={changeDataPoints}
                  value={optionsSelected}
                  style={{ width: "75%", display: "grid" }}
                  size={"large"}
                  allowClear={true}
                  maxTagCount={0}
                  dropdownMatchSelectWidth={false}
                  tagRender={tagRender}
                  onSearch={setKeyword}
                  onDropdownVisibleChange={() => setKeyword("")}
                >
                  <OptGroup label="Formulas">
                    {!dataPoints && (
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
                              optionsSelected && optionsSelected.length > 4 //filter length is always 1 less than wanted (5 max)
                                ? optionsSelected.includes(
                                    formula.primary + formula.secondary
                                  )
                                  ? false
                                  : true
                                : false
                            }
                            key={formula.primary + formula.secondary}
                            value={formula.primary + formula.secondary}
                          >
                            {formula.primary}{" "}
                            <span style={{ opacity: "60%" }}>
                              {formula.secondary}
                            </span>
                          </Option>
                        ))}
                  </OptGroup>
                  <OptGroup label="Pi Tags">
                    {!dataPoints && (
                      <Option key="pi_tag_loader" disabled>
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
                              optionsSelected && optionsSelected.length > 4 //filter length is always 1 less than wanted (5 max)
                                ? optionsSelected.includes(
                                    pi_tag.primary + pi_tag.secondary
                                  )
                                  ? false
                                  : true
                                : false
                            }
                            key={pi_tag.primary + pi_tag.secondary}
                            value={pi_tag.primary + pi_tag.secondary}
                          >
                            {pi_tag.primary}{" "}
                            <span style={{ opacity: "60%" }}>
                              {pi_tag.secondary}
                            </span>
                          </Option>
                        ))}
                  </OptGroup>
                </Select>
                <div></div>
              </div>
            </div>
            {!loading && (
              <button
                type="button"
                className="col-2 btn btn-secondary"
                style={{
                  width: "140px",
                  height: "fit-content",
                  whiteSpace: "nowrap",
                }}
                onClick={applyData}
              >
                Apply
              </button>
            )}
            {loading && (
              <button
                type="button"
                className="col-2 btn btn-secondary"
                style={{
                  width: "140px",
                  height: "fit-content",
                  whiteSpace: "nowrap",
                }}
                disabled
              >
                <i className="fas fa-spinner fa-spin"></i>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataPoints;
