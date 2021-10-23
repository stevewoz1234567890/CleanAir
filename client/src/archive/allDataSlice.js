import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import SortByName from '../../../components/FlareReporting/utilityFunctions/sortByName';

export const initialState = {
  loading: false,
  hasErrors: false,
  data: [],
};

// A slice for recipes with our three reducers
const allDataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    getAllData: (state) => {
      state.loading = true;
    },
    getAllDataSuccess: (state, { payload }) => {
      state.data = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    getAllDataFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
    addElement: (state, action) => {
      state.data[action.payload.collection].push(action.payload.schema);
    },
    editElement: (state, action) => {
      const index = state.data[action.payload.collection].findIndex(
        (element) => element._id === action.payload.schema._id
      );
      state.data[action.payload.collection][index] = action.payload.schema;
    },
  },
});

// Three actions generated from the slice
export const {
  getAllData,
  getAllDataSuccess,
  getAllDataFailure,
  addElement,
  editElement,
} = allDataSlice.actions;

// Asynchronous thunk action
// // The function below is called a thunk and allows us to perform async logic. It
// // can be dispatched like a regular action: `dispatch(incrementAsync(10))`. This
// // will call the thunk with the `dispatch` function as the first argument. Async
// // code can then be executed and other actions can be dispatched
export function fetchAllData() {
  return async (dispatch) => {
    dispatch(getAllData());

    try {
      const { data } = await axios.get('/flarereporting');
      console.log('fetched root data!', data);

      dispatch(getAllDataSuccess(data));
    } catch (error) {
      console.log('fetch data error!', error);

      dispatch(getAllDataFailure());
    }
  };
}

// a Selector
// // The function below is called a selector and allows us to select a value from
// // the state. Selectors can also be defined inline where they're used instead of
// // in the slice file. For example: `useSelector((state) => state.counter.value)`
export const allDataSelector = (state) => state.data;
export const flareSelector = (state) => SortByName(state.data.data.flares);
export const headerSelector = (state) => SortByName(state.data.data.headers);
export const plantSelector = (state) => SortByName(state.data.data.plants);
export const sensorSelector = (state) => SortByName(state.data.data.sensors);
export const pi_tagSelector = (state) => SortByName(state.data.data.pi_tags);
export const parameterSelector = (state) =>
  SortByName(state.data.data.parameters, 'parameter');
export const formulaSelector = (state) => SortByName(state.data.data.formulas);
export const constantSelector = (state) =>
  SortByName(state.data.data.constants);
export const compoundSelector = (state) =>
  SortByName(state.data.data.compounds);
export const event_ruleSelector = (state) =>
  SortByName(state.data.data.event_rules);

// The reducer
export default allDataSlice.reducer;
