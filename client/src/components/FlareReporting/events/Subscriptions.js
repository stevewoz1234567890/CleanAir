import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  eventrulesSelector,
  fetchEventRules,
  unsubscribeBooleanEvent,
  fetchBooleanEventSubscriptions,
  booleanEventSubscriptionsSelector,
  addBooleanEventSubscription,
} from "../../../redux/slices/FMT/eventRulesSlice";
import PrePendLabel from "../utilityComponents/prependLabel";
import { Select, notification, Result, Table } from "antd";
import { parametersSelector } from "../../../redux/slices/FMT/parametersSlice";
import { loadFormulas } from "../../../redux/slices/FMT/formulasSlice";
import usePermissions from "../../../utilities/usePermissions";
import {
  addNumericEventSubscription,
  fetchNumericEventRules,
  fetchNumericEventSubscriptions,
  numericEventRulesSelector,
  numericEventsubscriptionsSelector,
  unsubscribeNumericEvent,
} from "../../../redux/slices/FMT/numericEventRulesSlice";
import styled from "styled-components";
import Spinner from "../../Layout/Spinner";
const { Option } = Select;

const UnsubscribeBtn = styled.div`
  padding: 5px 10px;
  background-color: #dc3545;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  box-sizing: border-box;
  color: white;
  cursor: pointer;
`;

const Subscriptions = () => {
  const dispatch = useDispatch();
  const { crudAccess } = usePermissions();
  const generalEvents = useSelector(eventrulesSelector);
  const numericEvents = useSelector(numericEventRulesSelector);
  const { formulas } = useSelector((state) => state.formulas);
  const [events, setEvents] = useState([]);
  const [booleanTypeSubscriptionData, setBooleanTypeSubscriptionData] =
    useState([]);
  const [numericTypeSubscriptionData, setNumericTypeSubscriptionData] =
    useState([]);

  const parameters = useSelector(parametersSelector);
  const booleanTypeSubscriptions = useSelector(
    booleanEventSubscriptionsSelector
  );
  const numericTypeSubscriptions = useSelector(
    numericEventsubscriptionsSelector
  );
  const [addSubscriptionId, setAddSubscriptionId] = useState(null);
  const [addSubLoading, setAddSubLoading] = useState(false);
  const [unsubLoading, setUnsubLoading] = useState(false);
  const [unsubscribingId, setUnsubscribingId] = useState(null);

  const booleanEvenTypeSubscriptionColumns = [
    {
      title: "Boolean Event Subscriptions",
      children: [
        {
          title: "Event Name",
          dataIndex: "name",
          align: "left",
          key: "event_name",
          width: 250,
          fixed: "left",
        },
        {
          title: "Formula",
          dataIndex: "formulaName",
          align: "left",
          key: "formula",
          width: 250,
        },
        {
          title: "Check For",
          dataIndex: "checkFor",
          align: "left",
          key: "check_for",
          width: 115,
          render: (value) => (
            <div style={{ textTransform: "capitalize" }}>
              {value.toString()}
            </div>
          ),
        },
        {
          title: "Target Variable",
          dataIndex: "checkForValueName",
          align: "left",
          key: "target_variable",
          width: 250,
        },
        {
          title: "Resolution",
          dataIndex: "resolution",
          align: "left",
          key: "resolution",
          width: 120,
        },
        {
          title: "Sensitivity",
          dataIndex: "sensitivity",
          align: "left",
          key: "sensitivity",
          width: 120,
        },
        {
          title: "",
          dataIndex: "_id",
          align: "center",
          key: "action",
          width: 150,
          fixed: "right",
          render: (id) => {
            return unsubLoading && id === unsubscribingId ? (
              <Spinner />
            ) : (
              <UnsubscribeBtn onClick={() => booleanEventUnsub(id)}>
                Unsubscribe
              </UnsubscribeBtn>
            );
          },
        },
      ],
    },
  ];

  const numericEvenTypeSubscriptionColumns = [
    {
      title: "Numeric Event Subscription",
      children: [
        {
          title: "Event Name",
          dataIndex: "name",
          align: "left",
          key: "numeric_event_name",
          width: 250,
          fixed: "left",
        },
        {
          title: "Parameter",
          dataIndex: "paramName",
          align: "left",
          key: "parameter",
          width: 250,
        },
        {
          title: "Condition",
          dataIndex: "condition",
          align: "left",
          key: "condition",
          width: 200,
        },
        {
          title: "Resolution",
          dataIndex: "resolution",
          align: "left",
          key: "resolution",
          width: 130,
        },
        {
          title: "",
          dataIndex: "_id",
          align: "center",
          key: "action",
          width: 150,
          fixed: "right",
          render: (id) => {
            return unsubLoading && id === unsubscribingId ? (
              <Spinner />
            ) : (
              <UnsubscribeBtn onClick={() => numericEventUnsub(id)}>
                Unsubscribe
              </UnsubscribeBtn>
            );
          },
        },
      ],
    },
  ];

  useEffect(() => {
    dispatch(fetchBooleanEventSubscriptions());
    dispatch(fetchNumericEventSubscriptions());
    dispatch(fetchEventRules());
    dispatch(fetchNumericEventRules());
    dispatch(loadFormulas());
  }, []);

  useEffect(() => {
    if (generalEvents && numericEvents) {
      setEvents([...generalEvents, ...numericEvents]);
    }
  }, [generalEvents, numericEvents]);

  useEffect(() => {
    //set inital addsub ID
    if (events && events.length >= 1) {
      setAddSubscriptionId(events[0]._id);
    }
  }, [events]);

  useEffect(() => {
    if (booleanTypeSubscriptions && formulas && parameters) {
      const data = booleanTypeSubscriptions.map((sub) => ({
        ...sub,
        formulaName: formulas.find((formula) => formula._id === sub.formula)
          ?.name,
        checkForValueName: formulas.find(
          (formula) => formula._id === sub.checkForValue
        )
          ? formulas.find((formula) => formula._id === sub.checkForValue).name
          : parameters.find((param) => param._id === sub.checkForValue)
          ? parameters.find((param) => param._id === sub.checkForValue).name
          : "n/a",
        key: sub._id
      }));
      setBooleanTypeSubscriptionData(data);
    }
  }, [booleanTypeSubscriptions, formulas, parameters]);

  useEffect(() => {
    if (numericTypeSubscriptions && formulas) {
      const data = numericTypeSubscriptions.map((sub) => ({
        ...sub,
        paramName: formulas.find((formula) => formula._id === sub.parameter)
          ?.name,
        condition:
          sub.actionPeriod +
          " " +
          sub.actionOperation +
          " " +
          sub.actionInequality +
          " " +
          sub.actionValue,
        key: sub._id
      }));
      setNumericTypeSubscriptionData(data);
    }
  }, [numericTypeSubscriptions, formulas]);

  const addSub = async (id) => {
    setAddSubLoading(true);
    const selectedEvent = events.find((event) => event._id === id);
    try {
      if (selectedEvent.type === "numeric") {
        await dispatch(addNumericEventSubscription(id));
        await dispatch(fetchNumericEventSubscriptions());
      } else {
        await dispatch(addBooleanEventSubscription(id));
        await dispatch(fetchBooleanEventSubscriptions());
      }

      notification["success"]({
        message: "Success",
        placement: "bottomLeft",
        description: "Event subscribed",
      });
      setAddSubLoading(false);
    } catch (err) {
      console.log(err);
      notification["error"]({
        message: "Error",
        placement: "bottomLeft",
        description: "Error subscribing to event",
      });
      setAddSubLoading(false);
    }
  };

  const booleanEventUnsub = async (id) => {
    setUnsubLoading(true);
    setUnsubscribingId(id);
    try {
      await dispatch(unsubscribeBooleanEvent(id));
      await dispatch(fetchBooleanEventSubscriptions());

      notification["success"]({
        message: "Success",
        placement: "bottomLeft",
        description: "Event unsubscribed",
      });
      setUnsubLoading(false);
    } catch (err) {
      console.log(err);
      notification["error"]({
        message: "Error",
        placement: "bottomLeft",
        description: "Error unsubscribing to event",
      });
      setUnsubLoading(false);
    }
  };

  const numericEventUnsub = async (id) => {
    setUnsubLoading(true);
    setUnsubscribingId(id);
    try {
      await dispatch(unsubscribeNumericEvent(id));
      await dispatch(fetchNumericEventSubscriptions());

      notification["success"]({
        message: "Success",
        placement: "bottomLeft",
        description: "Event unsubscribed",
      });
      setUnsubLoading(false);
    } catch (err) {
      console.log(err);
      notification["error"]({
        message: "Error",
        placement: "bottomLeft",
        description: "Error unsubscribing to event",
      });
      setUnsubLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <div className="card">
        <h5 className="card-header">Event Subscription Options</h5>
        <div className="card-body">
          <div className="row mx-2" style={{ justifyContent: "space-between" }}>
            <span className="col-lg-6 row" style={{ flexWrap: "nowrap" }}>
              <PrePendLabel title="Event Name" />
              <Select
                style={{
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  flexGrow: 1,
                }}
                size={"large"}
                showSearch={true}
                onChange={(id) => setAddSubscriptionId(id)}
                value={addSubscriptionId}
              >
                {events &&
                  events.map((report, index) => (
                    <Option value={report._id} key={index}>
                      {report.name}
                    </Option>
                  ))}
              </Select>
            </span>
            <button
              className="btn btn-info col-3"
              style={{ height: "fit-content" }}
              onClick={() => addSub(addSubscriptionId)}
              disabled={
                (booleanTypeSubscriptions &&
                  booleanTypeSubscriptions.length >= 1 &&
                  booleanTypeSubscriptions
                    .map((sub) => sub._id)
                    .includes(addSubscriptionId)) ||
                (numericTypeSubscriptions &&
                  numericTypeSubscriptions.length >= 1 &&
                  numericTypeSubscriptions
                    .map((sub) => sub._id)
                    .includes(addSubscriptionId)) ||
                addSubLoading
              }
            >
              {!addSubLoading ? (
                "Subscribe"
              ) : (
                <div>
                  <i className="fas fa-spinner fa-spin"></i>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
      <br />
      <div className="card mb-5">
        <h5 className="card-header">My Subscriptions</h5>
        <div className="card-body">
          {booleanTypeSubscriptions &&
            booleanTypeSubscriptions.length > 0 && (
              <Table
                columns={booleanEvenTypeSubscriptionColumns}
                dataSource={booleanTypeSubscriptionData}
                className="w-100"
                pagination={false}
                bordered
                scroll={{ x: 1200, y: 400 }}
              />
            )}

          {numericTypeSubscriptions &&
            numericTypeSubscriptions.length > 0 && (
              <Table
                columns={numericEvenTypeSubscriptionColumns}
                dataSource={numericTypeSubscriptionData}
                className="w-100 mt-4"
                pagination={false}
                bordered
                scroll={{ x: 1200, y: 400 }}
              />
            )}

          {(!booleanTypeSubscriptions ||
            booleanTypeSubscriptions.length === 0) &&
            (!numericTypeSubscriptions ||
              numericTypeSubscriptions.length === 0) && (
              <Result status="warning" title="You have not yet subscribed to any events." />
            )}
        </div>
      </div>
    </div>
  );
};

export default Subscriptions;
