import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Route, Switch } from 'react-router-dom';
import PublicHome from '../components/public/publicHome';
import Register from '../components/public/register';
import Login from '../components/public/login';
import PublicNavigation from '../components/public/publicNavigation';
import { Layout } from 'antd';
import { loadUser } from '../redux/slices/userReducer';
import PrivateRoute from './PrivateRoute';
import LoggedInHome from '../components/Private/LoggedInHome';
import LoggedInCommonRoutes from './LoggedInCommon';

const PublicRoutes = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  useEffect(() => {
    dispatch(loadUser());
  }, []);

  return (
    <Layout>

      {!user.loggedIn && (
        <div>
          <div
            className="container mt-3"
            style={{
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Switch>
              <Route exact path="/" component={PublicHome}></Route>
              <Route exact path="/register" component={Register}></Route>
              <Route exact path="/login" component={Login}></Route>
              <PrivateRoute
                exact
                path="/home"
                component={LoggedInHome}
              ></PrivateRoute>
            </Switch>
          </div>
        </div>
      )}
      {user.loggedIn && <LoggedInCommonRoutes />}
    </Layout>
  );
};

export default PublicRoutes;
