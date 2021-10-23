import React, { useEffect } from "react";
import { Switch } from "react-router-dom";
import PrivateRoute from "../../routes/PrivateRoute";
import "../FlareReporting/App.css";

import Status from "../FlareReporting/status/Status";
import Chart from "../FlareReporting/chart/Chart";
import DataUpload from "../FlareReporting/data/DataUpload";
import DataExport from "../FlareReporting/data/DataExport";
import Constants from "../FlareReporting/parameters/Constants";
import RawData from "../FlareReporting/parameters/RawData";
import Compounds from "../FlareReporting/parameters/Compounds";
import FMP from "../FlareReporting/fmp/FMP";
import User from "../FlareReporting/user/User";
import EventTypes from "../FlareReporting/events/EventTypes";
import Subscriptions from "../FlareReporting/events/Subscriptions";
import GenerateReports from "../FlareReporting/reports/GenerateReports";
import Tree from "../FlareReporting/data/plantStructure/Tree";
import Formulas from "../FlareReporting/formulas/Formulas";
import CumulativeAgg from "../Aggregation/Cumulative";
import RollingAgg from "../Aggregation/Rolling";
import LoggedInHome from "./LoggedInHome";
import MyAccount from "./MyAccount";
import VisibleEmissions from "../FlareReporting/visibleEmissions/VisibleEmissions";
import StoplightDashboard from "../FlareReporting/dashboard/StoplightDashboard";

const FMTRoutes = () => {
  const routes = [
    { component: StoplightDashboard, path: "/fmt/dashboard"},
    { component: Status, path: "/fmt/status/:flare" },
    { component: Chart, path: "/fmt/charts" },
    { component: DataUpload, path: "/fmt/data/upload" },
    { component: DataExport, path: "/fmt/data/export" },
    { component: Tree, path: "/fmt/data/plantStructure" },
    { component: CumulativeAgg, path: "/fmt/aggregation/cumulative" },
    { component: RollingAgg, path: "/fmt/aggregation/rolling" },
    { component: Formulas, path: "/fmt/formulas" },
    { component: Constants, path: "/fmt/parameters/constants" },
    { component: RawData, path: "/fmt/parameters/rawData" },
    { component: Compounds, path: "/fmt/parameters/compounds" },
    { component: EventTypes, path: "/fmt/events/eventTypes" },
    { component: Subscriptions, path: "/fmt/events/subscriptions" },
    { component: GenerateReports, path: "/fmt/reports/generate" },
    { component: VisibleEmissions, path: "/fmt/visibleEmissions" },
    { component: FMP, path: "/fmt/fmp" },
    { component: User, path: "/fmt/user" },
    { component: LoggedInHome, path: "/home" },
    { component: MyAccount, path: "/myaccount" },
  ];

  const getRoutes = () => {
    return routes.map((route) => (
      <PrivateRoute
        exact
        path={route.path}
        component={route.component}
        key={route.path}
      />
    ));
  };

  const routeComps = getRoutes();

  return (
    <div className="container-fluid d-flex justify-content-center">
      <Switch>{routeComps}</Switch>
    </div>
  );
};

export default FMTRoutes;
