import React, { useState } from "react";
import { Select } from "antd";
const { Option } = Select;

export const PullDown = (props) => {
  const [keyword, setKeyword] = useState("");
  const onChange = (value) => {
    if (props.onChange) {
      props.onChange(value);
    }
  };
  const onItemSelect = () => {
    setKeyword("");
  };

  const selectOptions = {
    style: { flexGrow: 1, width: "100%" },
    size: "large",
    value: props.value ? props.value : "",
    mode: props.multi ? "multiple" : null,
    placeholder: props.multi ? "Inserted are removed" : null,
    defaultValue: [],
    maxTagTextLength: 5,
    allowClear: props.multi,
    showSearch: true,
    filterOption: false,
  };

  const prePend = () => {
    if (!props.label) return;
    return (
      <>
        <div className="input-group-prepend">
          <label
            className="input-group-text"
            style={{
              fontSize: "16px",
              height: "fit-content",
              paddingTop: "7px",
              paddingBottom: "7px",
              borderTopRightRadius: "0",
              borderBottomRightRadius: "0",
              width: props.width ? props.width : null,
              whiteSpace: props.whiteSpace ? "normal" : null,
              textAlign: "left",
            }}
          >
            {props.label}
          </label>
        </div>
      </>
    );
  };

  const renderOptions = () => {
    if (!props.options) return;

    return props.options
      .filter((option) =>
        option.name.toLowerCase().includes(keyword.toLowerCase())
      )
      .map((option, index) => {
        const id = option._id ? option._id : option.id;
        const subtxt = option.subtext ? (
          <span style={{ opacity: "60%" }}>{option.subtext}</span>
        ) : null;
        return (
          <Option value={id} key={index}>
            {option.name}{" "}
            {subtxt ? (
              <span style={{ opacity: "60%" }}>{option.subtext}</span>
            ) : null}
          </Option>
        );
      });
  };

  return (
    <>
      <div className="input-group mb-3" style={{ flexWrap: "nowrap" }}>
        {prePend()}
        <Select
          {...selectOptions}
          onChange={(value) => onChange(value)}
          onSearch={setKeyword}
          onSelect={onItemSelect}
        >
          {renderOptions()}
        </Select>
      </div>
    </>
  );
};
