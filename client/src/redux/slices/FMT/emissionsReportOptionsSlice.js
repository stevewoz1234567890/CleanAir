import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import SortByName from '../../../components/FlareReporting/utilityFunctions/sortByName';

export const initialState = {
  loading: false,
  hasErrors: false,
  emissionsReportOptions: null,
};

// A slice for recipes with our three reducers
const emissionsReportOptionsSlice = createSlice({
  name: 'emissionsReportOptionsSlice',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    crudEmissionsReportOptionsSuccess: (state, { payload }) => {
      state.emissionsReportOptions = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudEmissionsReportOptionsFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
  },
});

// Three actions generated from the slice
export const {
  setLoading,
  crudEmissionsReportOptionsSuccess,
  crudEmissionsReportOptionsFailure,
} = emissionsReportOptionsSlice.actions;

// Asynchronous thunk action
// // The function below is called a thunk and allows us to perform async logic. It
// // can be dispatched like a regular action: `dispatch(incrementAsync(10))`. This
// // will call the thunk with the `dispatch` function as the first argument. Async
// // code can then be executed and other actions can be dispatched
export function fetchEmissionsReportOptions() {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get('/api/widgets/flarereporting/generatereport/emissions/options');
      dispatch(crudEmissionsReportOptionsSuccess(data.options));
    } catch (error) {
      dispatch(crudEmissionsReportOptionsFailure());
    }
  };
}

export const emissionsReportOptionsSelector = (state) => state.emissionsReportOptions;

// The reducer
export default emissionsReportOptionsSlice.reducer;
