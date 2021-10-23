import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import AceEditor from "react-ace";
import styled, { css } from "styled-components";
import {
  Select,
  Checkbox,
  DatePicker,
  TimePicker,
  notification,
  Modal,
  Input,
} from "antd";
import "ace-builds/src-noconflict/theme-github";
import {
  addCompleter,
  setCompleters,
} from "ace-builds/src-noconflict/ext-language_tools";
import 'ace-builds/webpack-resolver';
import CsvDownload from 'react-json-to-csv'
import moment from "moment";

import Spinner from "../../Layout/Spinner";
import {
  SaveBtn,
  DeleteBtn,
  TestBtn,
  EditBtn,
  CreateBtn,
  CopyBtn,
  CancelBtn,
  CommitBtn,
} from "../../Layout/Buttons";
import {
  loadFormulas,
  onFormulaSave,
  onFormulaEdit,
  onFormulaTest,
  formulaEdited,
  onFormulaChange,
  onFormulaDelete,
} from "../../../redux/slices/FMT/formulasSlice";
import PrePendLabel from "../utilityComponents/prependLabel";
import usePermissions from "../../../utilities/usePermissions";
import {
  flaresSelector,
  fetchFlares,
} from "../../../redux/slices/FMT/flareSlice";
import {
  headersSelector,
  fetchHeaders,
} from "../../../redux/slices/FMT/headerSlice";
import {
  constantsSelector,
  fetchConstants,
} from "../../../redux/slices/FMT/constantsSlice";
import {
  compoundsSelector,
  fetchCompounds,
} from "../../../redux/slices/FMT/compoundsSlice";
import {
  parametersSelector,
  fetchParameters,
} from "../../../redux/slices/FMT/parametersSlice";

const EditorWrapper = styled.div`
  height: 30vh;
  padding-right: 0;
  padding-left: 0;
  background-color: #ccc;
  font-size: 15px;
  border: ${(props) => !props.editorReadOnly && "2px solid green"};

  .ace_layer {
    opacity: ${(props) => (props.editorReadOnly ? 0.5 : 1)};
  }
`;

const FormulaTitleInput = styled.input`
  width: 100%;
  border: 2px solid green;
  outline-color: green;
  padding-left: 4px;

  &:focus {
    border: 2px solid green;
    outline-color: green;
  }
`;

const TypeDropdown = styled.div`
  flex-grow: 1;

  .ant-select-selector {
    ${(props) =>
      props.mode &&
      css`
        box-shadow: inset 0 0 0 1px green;
        border-color: green !important;
      `}
  }
`;

const { Option } = Select;

const Formulas = () => {
  useEffect(() => {
    dispatch(loadFormulas());
  }, []);

  const { crudAccess } = usePermissions();
  const flares = useSelector(flaresSelector);
  const headers = useSelector(headersSelector);
  const constants = useSelector(constantsSelector);
  const formulasState = useSelector((state) => state.formulas);
  const debugMode = useSelector((state) => state.mode.mode);
  const compounds = useSelector(compoundsSelector);
  const parameters = useSelector(parametersSelector);

  const [mode, setMode] = useState();
  const [editorValue, setEditorValue] = useState(null);
  const [testEditorValue, setTestEditorValue] = useState(null);
  const [fullResults, setFullResults] = useState(true);
  const [startDate, setStartDate] = useState(moment(new Date()).format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState(moment(new Date()).format("HH:mm"));
  const [testValue, setTestValue] = useState("");
  const [flare, setFlare] = useState("Flare");
  const [header, setHeader] = useState("all_headers");
  const [headerList, setHeaderList] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isOpenConfirmModal, setIsOpenConfirmModal] = useState(false);
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [modeStatus, setModeStatus] = useState("");

  const dispatch = useDispatch();
  const {
    formulas,
    selectedFormula,
    editedFormula,
    loading,
    testResults,
    testLoading,
  } = formulasState;

  useEffect(() => {
    if (testResults) {
      setTestValue(JSON.stringify(testResults.body, null, 4));
    }
    if (testResults === null) {
      setTestValue("Null");
    }
  }, [testResults]);

  useEffect(() => {
    dispatch(loadFormulas());
    dispatch(fetchFlares());
    dispatch(fetchHeaders());
    dispatch(fetchConstants());
    dispatch(fetchParameters());
    dispatch(fetchCompounds());
  }, []);

  useEffect(() => {
    if (formulas && constants && parameters && compounds) {
      const formulasDropdown = formulas.map((formula) => ({
        ...formula,
        value: `"${formula.name}"`,
        meta: "Formula",
      }));
      const constantsDropdown = constants.map((constant) => ({
        ...constant,
        value: `"${constant.name}"`,
        meta: "Constant",
      }));
      const parametersDropdown = parameters.map((param) => ({
        ...param,
        value: `"${param.name}"`,
        meta: "Parameter",
      }));
      const compoundsDropdown = compounds.map((compound) => ({
        ...compound,
        value: `"${compound.name}"`,
        meta: "Compound",
      }));

      setCompleters([]);
      addCompleter({
        getCompletions(editor, session, pos, prefix, callback) {
          let allOptions = [];
          const currentRow = session.doc.$lines[pos.row];
          if (inParenthesis(currentRow, pos)) {
            allOptions = [
              ...formulasDropdown,
              ...constantsDropdown,
              ...parametersDropdown,
              ...compoundsDropdown,
            ];
          } else {
            allOptions = [];
          }
          callback(null, allOptions);
        },
      });
    }
  }, [formulas, constants, parameters, compounds]);

  function inParenthesis(currentRowStr, pos) {
    const inVariableRow =
      currentRowStr.includes("let") &&
      currentRowStr.includes("=") &&
      currentRowStr.includes("(") &&
      currentRowStr.includes(")");
    if (inVariableRow) {
      const left = currentRowStr.indexOf("(");
      const right = currentRowStr.indexOf(")");
      return pos.column > left && pos.column < right + 1;
    }
    return false;
  }

  useEffect(() => {
    if (selectedFormula) {
      setEditorValue(selectedFormula.formula);
      setTestEditorValue("");
    }
  }, [selectedFormula]);

  if (loading || !selectedFormula) {
    return (
      <div className="h-100 d-flex align-items-center">
        <Spinner />
      </div>
    );
  }

  const onSave = () => {
    showModal();
    setModeStatus("save");
  };

  const onfChange = (value) => {
    dispatch(onFormulaChange(value));
  };

  const onChangeParentType = (value) => {
    dispatch(onFormulaEdit({ ...editedFormula, to: value }));
  };

  const onChangeResultType = (value) => {
    dispatch(onFormulaEdit({ ...editedFormula, dataType: value }));
  };

  const handleFormulaEdit = (value) => {
    dispatch(onFormulaEdit({ ...editedFormula, formula: value }));
  };

  const onEditFormula = () => {
    dispatch(
      formulaEdited({ ...selectedFormula, formula: selectedFormula.uiDisplay })
    );
    setMode("edit");
  };

  const onDeleteFormula = async () => {
    showModal();
    setModeStatus("delete");
  };

  const onCreateFormula = () => {
    dispatch(formulaEdited({}));
    setMode("create");
  };

  const onChangeFormulaTitleInput = (e) => {
    dispatch(formulaEdited({ ...editedFormula, name: e.target.value }));
  };

  const onCancelClick = () => {
    setMode();
  };

  const onChangeFullResults = (e) => {
    setFullResults(e.target.checked);
  };

  const datePickerChange = (date, dateString) => {
    setStartDate(dateString);
  };

  const timePickerChange = (time, timeString) => {
    setStartTime(timeString);
  };

  const onChangeFlare = (value) => {
    const filteredHeaders = headers.filter((header) => header.flare === value);
    setHeaderList(filteredHeaders);
    setHeader("all_headers");
    setFlare(value);
  };

  const onChangeHeader = (value) => {
    setHeader(value);
  };

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = async () => {
    setButtonEnabled(false);
    if (modeStatus === "delete") {
      await dispatch(onFormulaDelete(selectedFormula));
    } else {
      await dispatch(onFormulaSave());
      notification["info"]({
        message: "Reminder",
        placement: "bottomLeft",
        description:
          "Remember to 'commit' your formula when it's ready to run live",
        duration: null,
      });
    }
    dispatch(loadFormulas());
    setMode();
    setIsModalVisible(false);
    setModeStatus("");
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const onChangeConfirmText = ({ target: { value } }) => {
    setButtonEnabled(value === "confirm");
  };

  const copyToClipBoard = async (copyMe) => {
    try {
      await navigator.clipboard.writeText(testValue);
      notification["success"]({
        message: "Copied!",
        placement: "bottomLeft",
      });
    } catch (err) {
      notification["warning"]({
        message: "Failed to copy!",
        placement: "bottomLeft",
      });
    }
  };

  const commit = () => {
    setIsOpenConfirmModal(true);
  };

  const onConfirm = async () => {
    const url = `/api/widgets/flarereporting/formulas/commit`;
    const data = {
      _id: selectedFormula._id,
    };
    const res = await axios.put(url, data);
    notification["success"]({
      message: res.data.msg,
      placement: "bottomLeft",
    });
    setIsOpenConfirmModal(false);
    return;
  };

  const onTestFormula = () => {
    if (flare === "Flare") {
      notification["warning"]({
        message: "Please select a flare.",
        placement: "bottomLeft",
      });
      return;
    }
    if (!startDate || !startTime) {
      notification["warning"]({
        message: "Please pick a date and time.",
        placement: "bottomLeft",
      });
      return;
    }
    const isNewFormula = !!mode;
    const testFormula = isNewFormula ? editedFormula : selectedFormula;

    if (!testFormula.formula) {
      notification["warning"]({
        message: "There is nothing to test.",
        placement: "bottomLeft",
        description: "Add your formula to the editor",
      });
      return;
    }

    let to = null;
    if (isNewFormula) {
      if (testFormula.to == "flare") to = "flare";
      else to = "headers";
    } else to = undefined;

    const data = {
      formula: {
        isNewFormula,
        id: isNewFormula ? null : testFormula._id,
        name: isNewFormula ? testFormula.name : testFormula.name + " test",
        logic: testFormula.formula,
        to: to, //isNewFormula ? 'headers' : undefined
      },
      date: startDate + "T" + startTime,
      flareID: flare,
      headerID: header === "all_headers" ? "All Headers" : header,
      debug: debugMode,
    };
    dispatch(onFormulaTest(data));
  };

  const pullDownMenu = () => (
    <div className="col-lg-10">
      <div className="input-group mb-3" style={{ flexWrap: "nowrap" }}>
        <PrePendLabel title="Formula Name" width="130px" />
        {!!mode && (
          <FormulaTitleInput
            type="text"
            placeholder=""
            size={"large"}
            value={editedFormula.name}
            onChange={onChangeFormulaTitleInput}
          />
        )}

        {!mode && (
          <Select
            id="formula-list"
            style={{ flexGrow: 1 }}
            size={"large"}
            showSearch
            value={selectedFormula._id}
            onChange={onfChange}
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
          >
            {formulas &&
              formulas.map((formula) => (
                <Option value={formula._id} key={formula._id}>
                  {formula.name}
                </Option>
              ))}
          </Select>
        )}
      </div>
    </div>
  );

  const parentTypePulldown = () => (
    <div
      className="input-group mb-3 col-lg-5"
      style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}
    >
      <PrePendLabel title="Parent Type" width="130px" />
      <TypeDropdown mode={mode}>
        <Select
          id="formula-list"
          value={!!mode ? editedFormula.to : selectedFormula.to}
          style={{ width: "100%" }}
          size={"large"}
          onChange={onChangeParentType}
          disabled={!mode}
        >
          <Option value="flare">Flare</Option>
          <Option value="headers">Header</Option>
        </Select>
      </TypeDropdown>
    </div>
  );

  const resultTypeDropdown = () => (
    <div
      className="input-group mb-3 col-lg-5"
      style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}
    >
      <PrePendLabel title="Result Type" textAlign="center" />
      <TypeDropdown mode={mode} className="w-100">
        <Select
          id="formula-list"
          value={!!mode ? editedFormula.dataType : selectedFormula.dataType}
          size={"large"}
          onChange={onChangeResultType}
          disabled={!mode}
          className="w-100"
        >
          <Option value="num">Number</Option>
          <Option value="boolean">Boolean</Option>
        </Select>
      </TypeDropdown>
    </div>
  );

  const FlaresDropdown = () => (
    <Select
      id="flares-list"
      value={flare}
      className="mt-2 w-100"
      size={"large"}
      onChange={onChangeFlare}
    >
      {flares?.map((flareItem) => {
        return (
          <Option key={flareItem._id} value={flareItem._id}>
            {flareItem.name}
          </Option>
        );
      })}
    </Select>
  );

  const HeadersDropdown = () => (
    <Select
      id="headers-list"
      value={header}
      style={{ width: "100%" }}
      size={"large"}
      className="mt-2"
      onChange={onChangeHeader}
    >
      <Option
        style={{ fontWeight: "bolder" }}
        key="all_headers"
        value="all_headers"
      >
        All Headers
      </Option>
    </Select>
  );

  const EditorButtons = () => (
    <>
      <div className="card-body" style={{ padding: "5px" }}>
        {!!mode && <SaveBtn disabled={!crudAccess} onClick={onSave}></SaveBtn>}
        <DeleteBtn disabled={!crudAccess} onClick={onDeleteFormula}></DeleteBtn>

        {mode !== "create" && (
          <EditBtn disabled={!crudAccess} onClick={onEditFormula}></EditBtn>
        )}
        {mode !== "edit" && (
          <CreateBtn
            disabled={!crudAccess}
            onClick={onCreateFormula}
          ></CreateBtn>
        )}
        {!!mode && <CancelBtn onClick={onCancelClick}></CancelBtn>}
        {!mode && (
          <CommitBtn onclick={commit} disabled={selectedFormula.committed} />
        )}
      </div>
    </>
  );

  const renderEditor = () => {
    return (
      <>
        <div className="card-header">Editor</div>
        <EditorWrapper editorReadOnly={!mode}>
          <AceEditor
            mode="javascript"
            theme="github"
            name="formulaBlock"
            highlightActiveLine={true}
            editorProps={{ $blockScrolling: true }}
            setOptions={{
              enableLiveAutocompletion: true,
              enableSnippets: true,
              useWorker: false,
              fontSize: 15,
              tabSize: 2,
              wrap: true,
            }}
            showPrintMargin={false}
            height="100%"
            width="100%"
            value={
              !!mode ? editedFormula.formula || "" : selectedFormula.uiDisplay
            }
            readOnly={!mode}
            onChange={(formula) => handleFormulaEdit(formula)}
          />
        </EditorWrapper>
      </>
    );
  };

  const RenderTestBlock = () => {
    return (
      <>
        <div className="card-header">Testing</div>
        <div className="code-block">
          {testLoading && (
            <div className="h-100 d-flex align-items-center w-100 justify-content-center">
              <Spinner />
            </div>
          )}
          {!testLoading && (
            <AceEditor
              mode="javascript"
              theme="github"
              name="testblock"
              highlightActiveLine={true}
              editorProps={{ $blockScrolling: true }}
              setOptions={{
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                useWorker: false,
                fontSize: 15,
                tabSize: 2,
                wrap: true,
              }}
              showPrintMargin={false}
              height="100%"
              width="100%"
              value={testValue}
              onChange={(formula) => handleFormulaEdit(formula)}
            />
          )}
        </div>
      </>
    );
  };

  return (
    <div className="container mt-4">
      <Modal
        title="Confirm your action by typing 'confirm'"
        centered
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        okButtonProps={{ disabled: !buttonEnabled }}
      >
        {!loading && (
          <Input placeholder="confirm" onChange={onChangeConfirmText} />
        )}
      </Modal>
      <Modal
        title="Confirmation"
        visible={isOpenConfirmModal}
        onOk={onConfirm}
        onCancel={() => setIsOpenConfirmModal(false)}
      >
        <p>Are you sure to commit this formula?</p>
      </Modal>
      <div className="row">
        {pullDownMenu()}
        <div className="col-lg-2">
          <CsvDownload data={formulas} filename={`formulaList_${moment(new Date()).format("YYYYMMDD")}.csv`} class="btn btn-info mb-2 ml-2" />
        </div>
      </div>
      <div className="row">
        {parentTypePulldown()}
        {resultTypeDropdown()}
      </div>

      <div className="row mt-2">
        <div className="col-lg-10">{renderEditor()}</div>
        <div className="col-lg-2">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-header">Options</div>
            <div className="card-body" style={{ padding: "5px" }}>
              {EditorButtons()}
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-2">
        <div className="col-lg-10">{RenderTestBlock()}</div>

        <div className="col-lg-2">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-header">Options</div>
            <div className="card-body" style={{ padding: "5px" }}>
              <FlaresDropdown />
              <HeadersDropdown />
              <DatePicker
                format="YYYY-MM-DD"
                onChange={datePickerChange}
                style={{ width: "100%" }}
                className="mt-2"
                placeholder="Date"
                defaultValue={moment(new Date())}
              />
              <TimePicker
                minuteStep={1}
                format="HH:mm"
                placeholder="Time"
                onChange={timePickerChange}
                style={{ width: "100%" }}
                className="mt-2 mb-2"
                defaultValue={moment(new Date())}
              />
              <TestBtn onClick={onTestFormula} />
              <div className="d-flex justify-content-center my-2">
                <Checkbox checked={fullResults} onChange={onChangeFullResults}>
                  Full Results
                </Checkbox>
              </div>
              <CopyBtn onclick={copyToClipBoard} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Formulas;
