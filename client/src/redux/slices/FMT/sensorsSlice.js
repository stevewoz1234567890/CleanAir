import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import SortByName from '../../../components/FlareReporting/utilityFunctions/sortByName';

export const initialState = {
  loading: false,
  hasErrors: false,
  sensors: null,
};

// A slice for recipes with our three reducers
const sensorsSlice = createSlice({
  name: 'sensorsSlice',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    crudSensorsSuccess: (state, { payload }) => {
      state.sensors = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudSensorsFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
  },
});

// Three actions generated from the slice
export const {
  setLoading,
  crudSensorsSuccess,
  crudSensorsFailure,
} = sensorsSlice.actions;

// Asynchronous thunk action
// // The function below is called a thunk and allows us to perform async logic. It
// // can be dispatched like a regular action: `dispatch(incrementAsync(10))`. This
// // will call the thunk with the `dispatch` function as the first argument. Async
// // code can then be executed and other actions can be dispatched
export function fetchSensors() {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get('/api/widgets/flarereporting/sensors/');
      dispatch(crudSensorsSuccess(SortByName(data.data)));
    } catch (error) {
      console.log('fetch sensor error!', error);

      dispatch(crudSensorsFailure());
    }
  };
}

// a Selector
// // The function below is called a selector and allows us to select a value from
// // the state. Selectors can also be defined inline where they're used instead of
// // in the slice file. For example: `useSelector((state) => state.counter.value)`

export const sensorsSelector = (state) => state.sensors.sensors;

// The reducer
export default sensorsSlice.reducer;
