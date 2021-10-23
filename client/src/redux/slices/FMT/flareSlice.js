import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import SortByName from '../../../components/FlareReporting/utilityFunctions/sortByName';

export const initialState = {
  loading: false,
  hasErrors: false,
  flares: null,
};

// A slice for recipes with our three reducers
const flaresSlice = createSlice({
  name: 'flaresSlice',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    crudFlaresSuccess: (state, { payload }) => {
      state.flares = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudFlaresFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
  },
});

// Three actions generated from the slice
export const {
  setLoading,
  crudFlaresSuccess,
  crudFlaresFailure,
} = flaresSlice.actions;

// Asynchronous thunk action
// // The function below is called a thunk and allows us to perform async logic. It
// // can be dispatched like a regular action: `dispatch(incrementAsync(10))`. This
// // will call the thunk with the `dispatch` function as the first argument. Async
// // code can then be executed and other actions can be dispatched
export function fetchFlares() {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get('/api/widgets/flarereporting/flares/all');

      dispatch(crudFlaresSuccess(SortByName(data.data)));
    } catch (error) {
      console.log('fetch flare error!', error);

      dispatch(crudFlaresFailure());
    }
  };
}

// a Selector
// // The function below is called a selector and allows us to select a value from
// // the state. Selectors can also be defined inline where they're used instead of
// // in the slice file. For example: `useSelector((state) => state.counter.value)`

export const flaresSelector = (state) => state.flares.flares;

// The reducer
export default flaresSlice.reducer;
