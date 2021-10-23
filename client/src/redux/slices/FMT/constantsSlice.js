import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import SortByName from '../../../components/FlareReporting/utilityFunctions/sortByName';

export const initialState = {
  loading: false,
  hasErrors: false,
  constants: null,
};

// A slice for recipes with our three reducers
const constantsSlice = createSlice({
  name: 'constantsSlice',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    crudConstantsSuccess: (state, { payload }) => {
      state.constants = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudConstantsFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
  },
});

// Three actions generated from the slice
export const {
  setLoading,
  crudConstantsSuccess,
  crudConstantsFailure,
} = constantsSlice.actions;

export function fetchConstants() {
  return async (dispatch, state) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get(
        '/api/widgets/flarereporting/constants/'
      );
      dispatch(crudConstantsSuccess(SortByName(data.data)));
    } catch (error) {
      console.log('fetch consant error!', error);

      dispatch(crudConstantsFailure());
    }
  };
}

export function createConstant(payload) {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.post(
        '/api/widgets/flarereporting/constants',
        payload
      );
      console.log('create constant:  ', data);
    } catch (error) {
      console.log('create constant err: ', error);
    }
  };
}

export const constantsSelector = (state) => state.constants.constants;

// The reducer
export default constantsSlice.reducer;
