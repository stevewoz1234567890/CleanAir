import React, { Fragment,useEffect } from 'react';
import PrePendLabel from '../utilityComponents/prependLabel';
import { Select } from 'antd';
import { useDispatch,useSelector } from 'react-redux';
import { onFormulaChange,onTypeChange } from '../../../redux/slices/FMT/formulasSlice';
import Spinner from '../../Layout/Spinner'
const { Option } = Select;


const FormulaPulldown = () => {
  const dispatch = useDispatch();
  const formulasState = useSelector(state => state.formulas)
  const {
    formulas,
    selectedFormula,
    typeSelected,
    loading

  } = formulasState

  if(loading || !selectedFormula){
    return <Spinner></Spinner>
  }

  const onfChange = (value)=>{
    dispatch(onFormulaChange(value))
  }
  const changeType = (value) => {
    dispatch(onTypeChange(value))
  };

  const pullDownOptions = (
    formulas.map(formula=>{
      return (
        <Option value={formula._id} key={formula._id}>
          {formula.name}
        </Option>
      )
    })
  )
  const pullDownMenu = (
    <Fragment>
        <div className="col-lg-8">
          <div className="input-group mb-3" style={{ flexWrap: 'nowrap' }}>
            <PrePendLabel title="Formula Name" />
              <Select
                  id="formula-list"
                  style={{ flexGrow: 1 }}
                  size={'large'}
                  showSearch
                  value={selectedFormula._id}
                  onChange={onfChange}
                >
                {pullDownOptions}
              </Select>
          </div>
        </div>
    </Fragment>
  )

  const typePulldown = (
    <Fragment>
        <div
          className="input-group mb-3 col-lg-2"
          style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}
        >
      <div className="input-group-prepend">
        <label className="input-group-text">Type</label>
      </div>
      <Select
        id="formula-list"
        value={typeSelected}
        style={{ flexGrow: 1 }}
        size={'large'}
        onChange={changeType}
      >
        <Option value="flare">Flare</Option>
        <Option value="headers">Header</Option>
      </Select>
        </div>

    </Fragment>
  )

  return (
    <span>
      <div className="row">
        {pullDownMenu}
        {typePulldown}
      </div>
    </span>
  )
};

export default FormulaPulldown;
