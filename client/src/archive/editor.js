import React, { useState, useEffect } from 'react';
import { useDispatch,useSelector } from 'react-redux';
import AceEditor from 'react-ace';
import Spinner from '../../Layout/Spinner'
import { onFormulaEdit } from '../../../redux/slices/FMT/formulasSlice';
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/ext-language_tools"

const Editor = () => {
  const dispatch = useDispatch()
  const {
    selectedFormula,
    loading
  } = useSelector(state => state.formulas)

  const [editorValue,setValue] = useState(selectedFormula.uiDisplay)
  
  useEffect(() => {
    setValue(selectedFormula.uiDisplay)

    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFormula]);

  


  const onChange = (value)=>{
    dispatch(onFormulaEdit(value))
    setValue(value)
  }

  return (
    <div className="col-lg-10">
      <div className="card" style={{ width: '100%' }}>
        <div className="card-header">Editor</div>
        <div className="code-block">
          <AceEditor
            mode="json"
            theme="github"
            name="formulaBlock"
            editorProps={{ $blockScrolling: true }}
            setOptions={{
              useWorker: false,
              enableSnippets: true,
              fontSize: 15,
              tabSize: 2,
              wrap: true,
            }}
            showPrintMargin={false}
            height="100%"
            width="100%"
            value={editorValue}
            onChange={(formula) => onChange(formula)}
          />
        </div>
      </div>
    </div>
  );
};

export default Editor;
