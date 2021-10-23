import React from 'react';
import usePermissions from '../../../utilities/usePermissions';


const CrudButtons = (props) => {
  const { crudAccess } = usePermissions();

  const col = props.orientation === 'horizontal' ? 'col-lg-7 mt-3' : '';
  const display = props.orientation === 'horizontal' ? 'flex' : '';
  const width = props.orientation === 'horizontal' ? '140px' : '100%';

  return (
    <div
      className={col}
      style={{
        display: display,
        justifyContent: 'space-between',
      }}
    >
      <button
        type="submit"
        style={{ width: width }}
        className=" btn btn-success mb-3"
        onClick={props.onSave}
        disabled={!crudAccess}
      >
        Save <i className="far fa-save"></i>
      </button>

      <button
        type="button"
        style={{ width: width, height: 'fit-content' }}
        className="btn btn-danger mb-3"
        onClick={props.onDelete}
        disabled={!crudAccess}
      >
        Delete <i className="fas fa-trash-alt "></i>
      </button>

      <button
        type="button"
        style={{ width: width, height: 'fit-content' }}
        className={
          !props.addMode ? 'btn btn-info mb-3' : 'btn btn-warning mb-3'
        }
        onClick={props.onAddClick}
        disabled={!crudAccess}
      >
        {!props.addMode && (
          <span>
            Add <i className="fas fa-plus"></i>
          </span>
        )}
        {props.addMode && (
          <span>
            Cancel <i className="fas fa-window-close"></i>
          </span>
        )}
      </button>
    </div>
  );
};

export default CrudButtons;
