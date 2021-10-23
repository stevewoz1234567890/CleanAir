import React, { useEffect } from "react";
import { Route, Redirect, useHistory } from "react-router-dom";
import Spinner from "../components/Layout/Spinner";
import { useSelector, useDispatch } from "react-redux";
import { loadUser } from "../redux/slices/userReducer";

const PrivateRoute = ({ component: Component, ...rest }) => {
  const dispatch = useDispatch();
  const history = useHistory();
  const user = useSelector((state) => state.user);
  const { loading } = user;
  useEffect(() => {
    dispatch(loadUser());
  }, []);

  if (loading) {
    return (
      <div className="container-fluid d-flex align-items-center justify-content-center">
        <Spinner />
      </div>
    );
  }

  if (!user.loggedIn) {
    return (
      <Redirect to="/login"></Redirect>
    );
  }
  
  return <Route {...rest}>{<Component />}</Route>;
};

export default PrivateRoute;
