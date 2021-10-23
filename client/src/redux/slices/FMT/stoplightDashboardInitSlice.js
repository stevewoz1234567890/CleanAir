import { createSlice } from "@reduxjs/toolkit";
import axios from "axios";

export const initialState = {
  loading: false,
  hasErrors: false,
  schema: null,
};

// A slice for recipes with our three reducers
const stoplightDashboardInitSlice = createSlice({
  name: "stoplightDashboardInitSlice",
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    fetchStoplightDashboardSchema: (state, { payload }) => {
      state.schema = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudStoplightDashboardSchemaSuccess: (state, { payload }) => {
      state.loading = false;
      state.hasErrors = false;
    },
    crudStoplightDashboardSchemaFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
  },
});

// Four actions generated from the slice
export const {
  setLoading,
  fetchStoplightDashboardSchema,
  crudStoplightDashboardSchemaSuccess,
  crudStoplightDashboardSchemaFailure,
} = stoplightDashboardInitSlice.actions;

export function fetchStoplightDashboardSchemaData() {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get(
        `/api/widgets/flarereporting/stoplightDashboard/init`
      );
      dispatch(fetchStoplightDashboardSchema(data));
    } catch (error) {
      console.log(error)
      dispatch(crudStoplightDashboardSchemaFailure());
    }
  };
}

export const stoplightDashboardSchemaSelector = (state) => state.stoplightDashboardSchema.schema;

// The reducer
export default stoplightDashboardInitSlice.reducer;
