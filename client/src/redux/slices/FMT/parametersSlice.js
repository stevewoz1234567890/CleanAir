import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import SortByName from '../../../components/FlareReporting/utilityFunctions/sortByName';

export const initialState = {
  loading: false,
  hasErrors: false,
  parameters: [],
};

const parametersSlice = createSlice({
  name: 'parametersSlice',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    crudParametersSuccess: (state, { payload }) => {
      state.parameters = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudParametersFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
  },
});

export const {
  setLoading,
  crudParametersSuccess,
  crudParametersFailure,
} = parametersSlice.actions;

export function fetchParameters() {
  return async (dispatch) => {
    dispatch(setLoading());
    try {
      const { data } = await axios.get(
        '/api/widgets/flarereporting/parameters/'
      );
      dispatch(crudParametersSuccess(SortByName(data.data)));
    } catch (error) {
      dispatch(crudParametersFailure());
    }
  };
}

export const parametersSelector = (state) => state.parameters.parameters;

export default parametersSlice.reducer;
