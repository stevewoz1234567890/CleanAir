import { createSlice } from "@reduxjs/toolkit";
import axios from "axios";

export const initialState = {
  loading: false,
  hasErrors: false,
  status: null,
};

// A slice for recipes with our three reducers
const stoplightDashboardStatusSlice = createSlice({
  name: "stoplightDashboardStatusSlice",
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    fetchStoplightDashboardStatus: (state, { payload }) => {
      state.status = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudStoplightDashboardStatusSuccess: (state, { payload }) => {
      state.loading = false;
      state.hasErrors = false;
    },
    crudStoplightDashboardStatusFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
  },
});

// Four actions generated from the slice
export const {
  setLoading,
  fetchStoplightDashboardStatus,
  crudStoplightDashboardStatusSuccess,
  crudStoplightDashboardStatusFailure,
} = stoplightDashboardStatusSlice.actions;

export function fetchStoplightDashboardStatusData() {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get(
        `/api/widgets/flarereporting/stoplightDashboard/status`
      );
      dispatch(fetchStoplightDashboardStatus(data));
    } catch (error) {
      dispatch(crudStoplightDashboardStatusFailure());
    }
  };
}

export const stoplightDashboardStatusSelector = (state) => state.stoplightDashboardStatus.status;

// The reducer
export default stoplightDashboardStatusSlice.reducer;
