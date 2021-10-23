import React, { Fragment } from "react";
import AceEditor from "react-ace";
import Spinner from "./Spinner";

import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/ext-language_tools";

export const Editor = (props) => {
  const onChange = (value) => {
    if (props.onChange) {
      props.onChange(value);
    }
  };

  const aceProps = {
    mode: "javascript",
    theme: "github",
    highlightActiveLine: true,
    height: "100%",
    width: "100%",
    showPrintMargin: false,
    setOptions: {
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: true,
      enableSnippets: true,
      fontSize: 15,
      tabSize: 2,
    },
    readOnly: props.readOnly ? props.readOnly : false,
    editorProps: { $blockScrolling: true },
  };

  const title = props.title ? props.title : "Editor";

  if (props.loading) {
    return (
      <div className="card" style={{ width: "100%" }}>
        <div className="card-header">{title}</div>
        <Spinner></Spinner>
      </div>
    );
  }

  return (
    <Fragment>
      <div className="card" style={{ width: "100%" }}>
        <div className="card-header">{title}</div>
        <div className="code-block">
          <AceEditor
            {...aceProps}
            value={props.value ? props.value : ""}
            onChange={(value) => onChange(value)}
          />
        </div>
      </div>
    </Fragment>
  );
};
