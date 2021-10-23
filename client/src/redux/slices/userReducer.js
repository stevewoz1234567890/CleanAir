//ref article for login/lougout:
//https://www.softkraft.co/how-to-setup-redux-with-redux-toolkit/

import { createSlice } from "@reduxjs/toolkit";
import { notification } from "antd";
import axios from "axios";

export const initialState = {
  email: null,
  selectedOrg: null,
  orgs: null,
  lastLogin: null,
  require2FA: false,
  name: null,
  id: null,
  loggedIn: false,
  loading: true,
  error: null,
  permissions: [],
  permissionGroups: [],
  registered: false,
  resetToken: null
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = true;
    },
    loginSuccess: (state, action) => {
      state.loggedIn = true;
      state.error = null;
      state.loading = false;
    },
    registerSuccess: (state, action) => {
      state.registered = true;
      state.error = null;
      state.loading = false;
    },
    logoutSuccess: (state, action) => {
      //return to initial state.. cant seem to do state = {...initialState}
      state.email = null;
      state.selectedOrg = null;
      state.orgs = null;
      state.lastLogin = null;
      state.require2FA = false;
      state.name = null;
      state.id = null;
      state.loggedIn = false;
      state.loading = false;
      state.error = null;
      state.permissions = [];
      state.permissionGroups = [];
    },
    request2FA: (state, action) => {
      state.user = action.payload;
    },
    setUserData: (state, { payload }) => {
      state.selectedOrg = {
        id: payload.defaultOrg._id,
        logo: payload.defaultOrg.logoUrl,
        name: payload.defaultOrg.name,
      };
      state.require2FA = payload.defaultOrg.require2FA;
      state.email = payload.email;
      state.lastLogin = payload.lastLogin;
      state.name = payload.name;
      state.id = payload._id;
      state.loading = false;
      state.error = null;
      state.permissions = payload.permissions;
      state.permissionGroups = payload.permissionGroups;
      state.orgs = payload.orgs;
    },
    setAuthError: (state, action) => {
      state.selectedOrg = null;
      state.require2FA = null;
      state.email = null;
      state.lastLogin = null;
      state.name = null;
      state.id = null;
      state.loggedIn = false;
      state.loading = false;
      state.error = action.payload;
    },
    userLoaded: (state, { payload }) => {
      state.selectedOrg = {
        id: payload.defaultOrg._id,
        logo: payload.defaultOrg.logoUrl,
        name: payload.defaultOrg.name,
      };
      state.require2FA = payload.defaultOrg.require2FA;
      state.email = payload.email;
      state.lastLogin = payload.lastLogin;
      state.name = payload.name;
      state.id = payload._id;
      state.loggedIn = true;
      state.loading = false;
      state.error = null;
      state.permissions = payload.permissions;
      state.permissionGroups = payload.permissionGroups;
      state.orgs = payload.orgs;
    },
    saveResetToken: (state, action) => {
      state.resetToken = action.payload
    },
    reset: (state, action) => {
      return initialState
    }
  },
});

// The reducer
export default userSlice.reducer;

// Actions
export const {
  loginSuccess,
  registerSuccess,
  logoutSuccess,
  setUserData,
  setLoading,
  setAuthError,
  userLoaded,
  saveResetToken,
  reset
} = userSlice.actions;

export const loadUser = () => async (dispatch) => {
  try {
    dispatch(setLoading());
    const res = await axios.get("/api/auth");
    const user = res.data;
    dispatch(userLoaded(user));
    dispatch(loginSuccess());
  } catch (err) {
    dispatch(setAuthError(err.response?.data.msg));
    return console.log(err.message);
  }
};

export const login = (formdata) => async (dispatch) => {
  try {
    dispatch(setLoading());
    const { email, password } = formdata;
    const res = await axios.post("/api/auth/login", {
      email,
      password: password,
    });
    const user = res.data.user;
    dispatch(setUserData(user));
    if (!user.defaultOrg.require2FA) {
      dispatch(loginSuccess());
    }
  } catch (err) {
    dispatch(setAuthError(err.response.data.msg));
    return console.log(err.message);
  }
};

export const register = (formdata) => async (dispatch) => {
  try {
    dispatch(setLoading());
    const { email, password, inviteId, firstName, lastName } = formdata;
    const requestData = {
      id: inviteId,
      name: `${firstName} ${lastName}`,
      email,
      password,
    };
    const res = await axios.post("/api/users", requestData);
    return res;
  } catch (err) {
    dispatch(setAuthError(err));
    throw err;
  }
};

export const verify2FA = (formdata) => async (dispatch) => {
  try {
    dispatch(setLoading());
    await axios.post("/api/auth/confirm", formdata);
    return dispatch(loginSuccess());
  } catch (err) {
    dispatch(setAuthError(err.response.data.msg));
    return console.error(err.message);
  }
};

export const verifyResetPassword2FA = (formdata) => async (dispatch) => {
  try {
    dispatch(setLoading());
    const res = await axios.post("/api/passwords/confirm", formdata);

    dispatch(saveResetToken(res.data.code))
  } catch (err) {
    dispatch(setAuthError(err.response.data.msg));
    return console.error(err.message);
  }
};

export const logout = () => async (dispatch) => {
  try {
    await axios.post("/api/auth/logout");
    notification["success"]({
      message: "Logged out",
      placement: "bottomLeft",
      description: "Log out Success",
    });
    return dispatch(logoutSuccess());
  } catch (e) {
    notification["error"]({
      message: "Logout failure",
      placement: "bottomLeft",
      description: e.message,
    });
    return console.error(e.message);
  }
};

export const confirmEmail = (formdata) => async (dispatch) => {
  try {
    dispatch(setLoading());
    const { email } = formdata;
    const res = await axios.post("/api/passwords/forgot", {
      email
    });
    const user = res.data.user;
    dispatch(setUserData(user));
  } catch (err) {
    dispatch(setAuthError(err.response.data.msg));
    return console.log(err.message);
  }
};

export const resetPassword = (formData) => async (dispatch) => {
  try {
    dispatch(setLoading());
    const res = await axios.post("/api/passwords/reset", formData);
    return res.data;
  } catch (err) {
    dispatch(setAuthError(err.response.data.msg));
    return console.log(err.message);
  }
};



// a Selector
// // The function below is called a selector and allows us to select a value from
// // the state. Selectors can also be defined inline where they're used instead of
// // in the slice file. For example: `useSelector((state) => state.counter.value)`
export const orgLogoSelector = (state) => state.user.selectedOrg.logo;
export const orgNameSelector = (state) => state.user.selectedOrg.name;
export const orgIdSelector = (state) => state.user.selectedOrg.id;
export const usernameSelector = (state) => state.user.name;
export const loggedInSelector = (state) => state.user.loggedIn;
