import React from 'react';
import { useDispatch } from 'react-redux';

import CrudButtons from '../utilityComponents/crudButtons';

const EditorButtons = (props) => {
  const setAddMode = props.setAddMode;
  const setEditMode = props.setEditMode;
  const setInputFormulaName = props.setInputFormulaName;
  const setInputFormula = props.setInputFormula;
  const setSelectedType = props.setSelectedType;
  const setLatestSavedID = props.setLatestSavedID;

  const addMode = props.addMode;
  const editMode = props.editMode;
  const selectedFormulaObj = props.selectedFormulaObj;
  const placeHoldersToNames = props.placeHoldersToNames;
  const validateFormulaSave = props.validateFormulaSave;

  const onSave = async () => {
    const value_type = await validateFormulaSave();
    if (!value_type) return null;
    return;
  };

  const onAddClick = () => {
    if (!addMode) {
      setInputFormulaName(null);
      setInputFormula(null);
      setSelectedType(null);
    } else {
      setInputFormula(placeHoldersToNames(selectedFormulaObj.formula));
      setSelectedType(selectedFormulaObj.to);
    }

    setAddMode(!addMode);

    if (editMode === true) {
      setEditMode(false);
    }
  };

  const refreshFormulas = () => {
    console.log('refreshing');
  };

  return (
    <div className="col-lg-2">
      <div className="card">
        <div className="card-header">Options</div>
        <div className="card-body" style={{ padding: '5px' }}>
          <center>
            <CrudButtons
              orientation="vertical"
              onSave={onSave}
              addMode={addMode}
              onAddClick={onAddClick}
            />

            <button
              type="button"
              style={{ width: '100%' }}
              className="btn btn-outline-info"
              onClick={refreshFormulas}
            >
              Refresh <i className="fa fa-sync"></i>
            </button>
          </center>
        </div>
      </div>
    </div>
  );
};

export default EditorButtons;
