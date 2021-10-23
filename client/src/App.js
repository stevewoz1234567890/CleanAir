import "./App.css";
import "antd/dist/antd.css"; // or 'antd/dist/antd.less'
import "bootstrap/dist/css/bootstrap.css";
import "@fortawesome/fontawesome-free/js/all.js";

import { Route, Switch, useLocation } from "react-router-dom";
import React, { useEffect } from "react";
import { Layout } from "antd";
import { Header } from "./components/Layout/Header";
import Sidebar from "./components/Layout/Sidebar";
import PublicHome from "./components/public/PublicHome";
import Login from "./components/public/Login";
import FMTRouting from "./components/Private/FMTRouting";
import Contact from "./components/public/Contact";
import Register from "./components/public/register";
import ForgotPassword from "./components/public/ForgotPassword";
import axios from "axios";
import TwoFactorAuthForgotPassword from "./components/public/TwoFactorAuthForgotPassword";
import ConfirmPassword from "./components/public/ConfirmPassword";

let timeOut;

axios.interceptors.response.use(
  (response) => {
    if (timeOut) {
      clearTimeout(timeOut);
    }
    timeOut = setTimeout(() => {
      if (window) {
        window.location.href = "/login";
      }
    }, 60 * 60 * 1000);
    return response;
  },
  function (error) {
    return Promise.reject(error);
  }
);

const { Content } = Layout;

function App() {
  const location = useLocation();
  const mainAppStyle = {
    display: "flex",
    justifyContent: "center",
    padding: 0,
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location?.pathname]);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header></Header>
      <Layout>
        <Sidebar />
        <Content
          className="container-fluid position-relative"
          style={mainAppStyle}
        >
          <Switch>
            <Route exact path="/" component={PublicHome}></Route>
            <Route exact path="/login" component={Login}></Route>
            <Route exact path="/signup" component={Register}></Route>
            <Route exact path="/contact" component={Contact}></Route>
            <Route
              exact
              path="/forgot-password"
              component={ForgotPassword}
            ></Route>
            <Route
              exact
              path="/verify-code"
              component={TwoFactorAuthForgotPassword}
            ></Route>
            <Route
              exact
              path="/reset-password"
              component={ConfirmPassword}
            ></Route>
            <FMTRouting></FMTRouting>
          </Switch>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
