import React, { useState } from 'react';
import DateTimePicker from '../utilityComponents/dateTimePicker';
import { Select, Checkbox, notification } from 'antd';
const { Option } = Select;

const TestBlockButtons = (props) => {
  const setSelectedFlare = props.setSelectedFlare;
  const setFullResponse = props.setFullResponse;
  const setDatePicker = props.setDatePicker;
  const setTimePicker = props.setTimePicker;

  const selectedFlare = props.selectedFlare;
  const inputFormulaName = props.inputFormulaName;
  const inputFormula = props.inputFormula;
  const selectedType = props.selectedType;
  const fullResponse = props.fullResponse;
  const datePicker = props.datePicker;
  const timePicker = props.timePicker;
  const flares = props.flares;

  const parseFormula = props.parseFormula;

  const [loading, setLoading] = useState(false);

  const changeFlare = (value) => {
    console.log('selected flare ', value);
    setSelectedFlare(value);
  };

  const changeFullResponse = (event) => {
    console.log('full response ', event.target.checked);
    setFullResponse(event.target.checked);
  };

  const validateTestFormula = () => {
    console.log('dat', datePicker);
    if (!datePicker) {
      notification['warning']({
        message: 'Invalid Input',
        placement: 'bottomLeft',
        description: 'Please select a date',
      });
      return false;
    }
    return true;
  };

  const testFormula = () => {
    if (!validateTestFormula()) return;
    const schema = {
      action: 'test_formula',
      formula: {
        name: inputFormulaName,
        formula: parseFormula(inputFormula),
        to: selectedType,
      },
      flare_id: selectedFlare,
      full_reponse: fullResponse,
      sample_date: datePicker + `${timePicker ? ' ' + timePicker : ''}`,
    };
    console.log('testing formula', schema);
  };

  return (
    <div className="col-lg-2">
      <div className="card mb-3">
        <div className="card-header">Options</div>
        <div className="card-body" style={{ padding: '5px' }}>
          <div className="input-group mb-3">
            <Select
              id="formula-flare-id"
              value={selectedFlare}
              style={{ width: '100%' }}
              size={'large'}
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

          <div className="mb-3">
            <DateTimePicker
              setDatePicker={setDatePicker}
              setTimePicker={setTimePicker}
            />
          </div>
          {!loading && (
            <button
              type="button"
              style={{ width: '100%' }}
              className="btn btn-primary"
              onClick={testFormula}
            >
              Test <i className="fas fa-code"></i>
            </button>
          )}
          {loading && (
            <button
              type="button"
              style={{ width: '100%' }}
              className="btn btn-primary"
              disabled
            >
              <i className="fas fa-spinner fa-spin"></i>
            </button>
          )}
          <center className="mb-2">
            <Checkbox
              id="formula-full-response"
              onChange={changeFullResponse}
              style={{ fontSize: '85%' }}
            >
              Full Results
            </Checkbox>
          </center>

          <button
            type="button"
            style={{
              width: '100%',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
            className="btn btn-outline-secondary"
            id="copy-test-results"
          >
            Copy Results <i className="fas fa-copy"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestBlockButtons;
