import React from 'react';

import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-github';

const TestBlock = (props) => {
  const testingBlockResult = props.testingBlockResult;
  return (
    <div className="col-lg-10">
      <div className="card">
        <div className="card-header">Test Results</div>
        <div className="code-block">
          <AceEditor
            mode="json"
            theme="github"
            name="testingBlock"
            readOnly={true}
            editorProps={{ $blockScrolling: true }}
            setOptions={{
              useWorker: false,
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
              enableSnippets: true,
              fontSize: 15,
              tabSize: 2,
              wrap: true,
            }}
            showPrintMargin={false}
            height="100%"
            width="100%"
            value={testingBlockResult}
          />
        </div>
      </div>
    </div>
  );
};

export default TestBlock;
