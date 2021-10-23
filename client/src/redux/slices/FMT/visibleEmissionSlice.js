import { createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import SortByName from "../../../components/FlareReporting/utilityFunctions/sortByName";

export const initialState = {
  loading: false,
  hasErrors: false,
  logs: null,
};

// A slice for recipes with our three reducers
const visibleEmissionSlice = createSlice({
  name: "visibleEmissionSlice",
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    fetchVisibleEmissions: (state, { payload }) => {
      state.logs = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudVisibleEmissionLogsSuccess: (state, { payload }) => {
      state.loading = false;
      state.hasErrors = false;
    },
    crudVisibleEmissionLogsFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
  },
});

// Four actions generated from the slice
export const {
  setLoading,
  fetchVisibleEmissions,
  crudVisibleEmissionLogsSuccess,
  crudVisibleEmissionLogsFailure,
} = visibleEmissionSlice.actions;

// Asynchronous thunk action
// // The function below is called a thunk and allows us to perform async logic. It
// // can be dispatched like a regular action: `dispatch(incrementAsync(10))`. This
// // will call the thunk with the `dispatch` function as the first argument. Async
// // code can then be executed and other actions can be dispatched
export function fetctVisibleEmissionLogs(startDateStr, endDateStr) {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get(
        `/api/widgets/flarereporting/visible-emissions?startDate=${startDateStr}&&endDate=${endDateStr}`
      );
      dispatch(fetchVisibleEmissions(data));
    } catch (error) {
      dispatch(crudVisibleEmissionLogsFailure());
    }
  };
}

export function AddVisibleEmissionLog(data) {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      if (data.notes === undefined) data.notes = "";
      const { res } = await axios.post(
        `/api/widgets/flarereporting/visible-emissions`,
        data
      );
      dispatch(crudVisibleEmissionLogsSuccess(res));
    } catch (error) {
      console.log("fetch plant error!", error);
      dispatch(crudVisibleEmissionLogsFailure());
    }
  };
}

// a Selector
// // The function below is called a selector and allows us to select a value from
// // the state. Selectors can also be defined inline where they're used instead of
// // in the slice file. For example: `useSelector((state) => state.counter.value)`

export const visibleEmissionSelector = (state) => state.logs;

// The reducer
export default visibleEmissionSlice.reducer;
