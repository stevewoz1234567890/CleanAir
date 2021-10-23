import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import TreeView from "react-treeview";
import "react-treeview/react-treeview.css";
import CsvDownload from 'react-json-to-csv'
import moment from "moment";

import PlantTemplate from "./treePlant";
import SensorTemplate from "./treeSensor";
import HeaderTemplate from "./treeHeader";
import PiTagTemplate from "./treePiTag";
import FlareTemplate from "./treeFlare";

import {
  flaresSelector,
  fetchFlares,
} from "../../../../redux/slices/FMT/flareSlice";
import {
  headersSelector,
  fetchHeaders,
} from "../../../../redux/slices/FMT/headerSlice";
import {
  sensorsSelector,
  fetchSensors,
} from "../../../../redux/slices/FMT/sensorsSlice";
import {
  pitagsSelector,
  fetchPitags,
} from "../../../../redux/slices/FMT/pitagsSlice";
import { fetchParameters, parametersSelector } from "../../../../redux/slices/FMT/parametersSlice";
import { orgNameSelector } from "../../../../redux/slices/userReducer";
import usePermissions from "../../../../utilities/usePermissions";

const build_tree_json = (data, expanded) => {
  const tree_data = [];
  for (let flare of data.flares) {
    const flare_schema = {
      title: flare.name,
      type: "flare",
      expanded: expanded,
      folder: true,
      icon: "fas fa-burn",
      frt_data: flare,
      children: [],
    };
    const flare_sensors = data.sensors.filter(
      (sensor) => sensor.flare === flare._id && !sensor.header
    );
    for (let sensor of flare_sensors) {
      const flare_sensors_schema = {
        title: sensor.name,
        type: "sensor",
        expanded: expanded,
        folder: true,
        icon: "fas fa-broadcast-tower",
        frt_data: sensor,
        children: [],
      };
      const sensor_pi_tags = data.piTags.filter(
        (tag) => tag.sensor === sensor._id
      );
      for (let tag of sensor_pi_tags) {
        const pi_tag_schema = {
          title: tag.name,
          type: "pi_tag",
          expanded: false,
          folder: false,
          icon: "fas fa-database",
          frt_data: tag,
          children: [],
        };
        flare_sensors_schema.children.push(pi_tag_schema);
      }
      flare_schema.children.push(flare_sensors_schema);
    }
    const flare_headers = data.headers.filter(
      (header) => header.flare === flare._id
    );

    for (let header of flare_headers) {
      const header_schema = {
        title: header.name,
        type: "header",
        expanded: expanded,
        folder: true,
        icon: "fas fa-adjust",
        frt_data: header,
        children: [],
      };
      const header_sensors = data.sensors.filter(
        (sensor) => sensor.header === header._id && sensor.flare
      );
      for (let sensor of header_sensors) {
        const header_sensors_schema = {
          title: sensor.name,
          type: "sensor",
          expanded: expanded,
          folder: true,
          icon: "fas fa-broadcast-tower",
          frt_data: sensor,
          children: [],
        };
        const sensor_pi_tags = data.piTags.filter(
          (tag) => tag.sensor === sensor._id
        );
        for (let tag of sensor_pi_tags) {
          const pi_tag_schema = {
            title: tag.name,
            type: "pi_tag",
            expanded: false,
            folder: false,
            icon: "fas fa-database",
            frt_data: tag,
          };
          header_sensors_schema.children.push(pi_tag_schema);
        }
        header_schema.children.push(header_sensors_schema);
      }
      flare_schema.children.push(header_schema);
    }
    tree_data.push(flare_schema);
  }

  const allData = [
    {
      title: data.plants,
      type: "plant",
      children: tree_data,
      expanded: expanded,
      folder: true,
    },
  ];
  return allData;
};

const legendBorder = {
  border: "1px grey solid",
  borderRadius: "10px",
  padding: "5px",
  margin: "2px",
  fontSize: "90%",
};

const Tree = () => {
  const dispatch = useDispatch();
  const flares = useSelector(flaresSelector);
  const headers = useSelector(headersSelector);
  const sensors = useSelector(sensorsSelector);
  const piTags = useSelector(pitagsSelector);
  const plants = useSelector(orgNameSelector);
  const parameters = useSelector(parametersSelector);

  const [activeNodeData, setActiveNodeData] = useState({});
  const [treeData, setTreeData] = useState([]);
  const [expandAll, setExpandAll] = useState(false);
  const [downloadData, setDownloadData] = useState(null);

  const onDeleteNode = (deletedItem) => {
    const parentNode = {};

    if (deletedItem.sensor) {
      parentNode.frt_data = sensors.find(
        (sensor) => sensor._id === deletedItem.sensor
      );
      parentNode.type = "sensor";
    } else if (deletedItem.header) {
      parentNode.frt_data = headers.find(
        (header) => header._id === deletedItem.header
      );
      parentNode.type = "header";
    } else if (deletedItem.flare) {
      parentNode.frt_data = flares.find(
        (flare) => flare._id === deletedItem.flare
      );
      parentNode.type = "flare";
    } else {
      parentNode.title = plants;
      parentNode.type = "plant";
    }

    setActiveNodeData(parentNode);
  };

  const toggleExpandedNodes = () => {
    setExpandAll(!expandAll);
    const data = {
      plants: plants,
      flares: flares,
      headers: headers,
      sensors: sensors,
      piTags: piTags,
    };
    if (data.flares && data.headers && data.sensors && data.piTags) {
      const tree_data = build_tree_json(data, expandAll);
      setTreeData(tree_data);
    }
  };

  const handleActiveNode = (node) => (e) => {
    e.stopPropagation();
    setActiveNodeData(node);
  };

  const getParameter = (node) => {
    if (node.type === 'pi_tag') {
      const selectedParameter = parameters.find(parameter => parameter._id === node.frt_data.parameter);
      return selectedParameter?.name || 'No Parameter';
    }
  }

  useEffect(() => {
    dispatch(fetchFlares());
    dispatch(fetchHeaders());
    dispatch(fetchSensors());
    dispatch(fetchPitags());
    dispatch(fetchParameters());
  }, []);

  useEffect(() => {
    const data = {
      flares: flares,
      headers: headers,
      sensors: sensors,
      piTags: piTags,
    };

    if (data.flares && data.headers && data.sensors && data.piTags && parameters) {
      
      const allPiTags = data.piTags.map(tag => ({
        ...tag,
        flareName: data.flares.find(flare => flare._id === tag.flare).name,
        headerName: data.headers.find(header => header._id === tag.header) ? data.headers.find(header => header._id === tag.header).name : '',
        sensorName: data.sensors.find(sensor => sensor._id === tag.sensor) ? data.sensors.find(sensor => sensor._id === tag.sensor).name : 'no sensor name',
        parameterName: parameters.find(param => param._id === tag.parameter) ? parameters.find(param => param._id === tag.parameter).name : '',
      }));
      setDownloadData(allPiTags);
      const tree_data = build_tree_json(data, true);
      setTreeData(tree_data);
      setExpandAll(false);
    }
  }, [flares, headers, sensors, piTags, parameters]);

  return (
    <div className="col">
      <div className="row mt-4">
        <div className="col-lg-6">
          <div className="card">
            <h5 className="card-header">Plant Structure</h5>
            <div className="card-body" id="tree" style={{ minHeight: "150px" }}>
              <p className="row">
                <span style={{ padding: "5px", margin: "2px" }}>Legend:</span>

                <span style={legendBorder}>
                  <i className="fas fa-city fa-sm" aria-hidden="true"></i> Plant
                </span>

                <span style={legendBorder}>
                  <i className="fas fa-burn fa-sm" aria-hidden="true"></i> Flare
                </span>

                <span style={legendBorder}>
                  <i className="fa fa-adjust fa-sm" aria-hidden="true"></i>{" "}
                  Header
                </span>

                <span style={legendBorder}>
                  <i
                    className="fas fa-broadcast-tower fa-sm"
                    aria-hidden="true"
                  ></i>{" "}
                  Sensor
                </span>

                <span style={legendBorder}>
                  <i className="fa fa-database fa-sm" aria-hidden="true"></i> Pi
                  Tag
                </span>
              </p>
              {(!treeData || !treeData.length) && (
                <div>
                  <i className="fas fa-spinner fa-spin mx-auto d-block"></i>
                </div>
              )}

              {treeData && treeData.length > 0 && (
                <>
                  <div className="d-flex">
                    <button
                      className="btn btn-info mr-4 mb-2"
                      onClick={toggleExpandedNodes}
                    >
                      {expandAll ? "Collapse All" : "Expand All"}
                    </button>
                    <CsvDownload data={downloadData} filename={`piTagList_${moment(new Date()).format("YYYYMMDD")}.csv`} class="btn btn-info mb-2" />
                  </div>

                  <div>
                    {treeData.map((node, i) => {
                      const type = node.type;
                      const labelPlant = (
                        <span
                          className="tree-node"
                          onClick={handleActiveNode(node)}
                        >
                          <i
                            className="fas fa-city fa-sm"
                            aria-hidden="true"
                          ></i>{" "}
                          {node.title}
                        </span>
                      );

                      return (
                        // first level
                        <TreeView
                          key={type + "|" + i}
                          nodeLabel={labelPlant}
                          defaultCollapsed={node.expanded}
                          collapsed={node.expanded}
                          onClick={toggleExpandedNodes}
                        >
                          {node.children.map((child) => {
                            const label = (
                              <span
                                className="tree-node"
                                onClick={() => setActiveNodeData(child)}
                              >
                                <i
                                  className="fas fa-burn fa-sm"
                                  aria-hidden="true"
                                ></i>{" "}
                                {child.title}{" "}
                              </span>
                            );
                            return (
                              // second level
                              <TreeView
                                key={child.title}
                                nodeLabel={label}
                                defaultCollapsed={child.expanded}
                              >
                                {child.children.map((firstChild) => {
                                  const label1 = (
                                    <span
                                      className="tree-node"
                                      onClick={() =>
                                        setActiveNodeData(firstChild)
                                      }
                                    >
                                      {firstChild.type === "header" ? (
                                        <i
                                          className="fas fa-adjust fa-sm"
                                          aria-hidden="true"
                                        ></i>
                                      ) : (
                                        <i
                                          className="fas fa-broadcast-tower fa-sm"
                                          aria-hidden="true"
                                        ></i>
                                      )}
                                      {" " + firstChild.title}
                                    </span>
                                  );
                                  return (
                                    // third level
                                    <TreeView
                                      nodeLabel={label1}
                                      key={firstChild.title}
                                      defaultCollapsed={firstChild.expanded}
                                    >
                                      {firstChild.children.map(
                                        (secondChild) => {
                                          const label2 = (
                                            <span
                                              className="tree-node"
                                              onClick={() =>
                                                setActiveNodeData(secondChild)
                                              }
                                            >
                                              {secondChild.type === "pi_tag" ? (
                                                <>
                                                  <i
                                                    className="fas fa-database fa-sm"
                                                    aria-hidden="true"
                                                  ></i>
                                                  {" " + getParameter(secondChild)}
                                                </>
                                              ) : (
                                                <>
                                                  <i
                                                    className="fas fa-broadcast-tower fa-sm"
                                                    aria-hidden="true"
                                                  ></i>
                                                  {" " + secondChild.title}
                                                </>
                                              )}
                                              
                                            </span>
                                          );
                                          return (
                                            // fourth level
                                            <TreeView
                                              nodeLabel={label2}
                                              key={secondChild.title}
                                              defaultCollapsed={
                                                secondChild.expanded
                                              }
                                            >
                                              {secondChild.children.map(
                                                (thirdChild) => {
                                                  return (
                                                    <p
                                                      className="tree-node"
                                                      style={{
                                                        marginBottom: 0,
                                                        paddingLeft: "22px",
                                                      }}
                                                      key={thirdChild.title}
                                                      onClick={() =>
                                                        setActiveNodeData(
                                                          thirdChild
                                                        )
                                                      }
                                                    >
                                                      <i
                                                        className="fas fa-database fa-sm"
                                                        aria-hidden="true"
                                                      ></i>{" "}
                                                      {getParameter(thirdChild)}
                                                    </p>
                                                  );
                                                }
                                              )}
                                            </TreeView>
                                          );
                                        }
                                      )}
                                    </TreeView>
                                  );
                                })}
                              </TreeView>
                            );
                          })}
                        </TreeView>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card" style={{ height: "100%" }}>
            <h5 className="card-header">Details</h5>
            <div className="card-body mb-5">
              {activeNodeData.type === "plant" && (
                <PlantTemplate
                  data={activeNodeData}
                  setActiveNodeData={setActiveNodeData}
                />
              )}
              {activeNodeData.type === "flare" && (
                <FlareTemplate
                  data={activeNodeData.frt_data}
                  setActiveNodeData={setActiveNodeData}
                  onDeleteNode={onDeleteNode}
                />
              )}
              {activeNodeData.type === "sensor" && (
                <SensorTemplate
                  data={activeNodeData.frt_data}
                  setActiveNodeData={setActiveNodeData}
                  onDeleteNode={onDeleteNode}
                />
              )}
              {activeNodeData.type === "header" && (
                <HeaderTemplate
                  data={activeNodeData.frt_data}
                  setActiveNodeData={setActiveNodeData}
                  onDeleteNode={onDeleteNode}
                />
              )}
              {activeNodeData.type === "pi_tag" && (
                <PiTagTemplate
                  data={activeNodeData.frt_data}
                  setActiveNodeData={setActiveNodeData}
                  onDeleteNode={onDeleteNode}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tree;

export const TreeButton = (props) => {
  const userState = useSelector((state) => state.user);
  const { crudAccess } = usePermissions();

  const onChange = (value) => {
    if (props.onClick) {
      props.onClick(value);
    }
  };

  const options = {
    style: { width: "140px", height: "fit-content" },
    className: props.className,
    disabled: !crudAccess,
  };

  return (
    <button {...options} onClick={(value) => onChange(value)}>
      {props.children}
    </button>
  );
};
