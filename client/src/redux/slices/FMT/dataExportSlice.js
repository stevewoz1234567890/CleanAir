import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import SortByName from '../../../components/FlareReporting/utilityFunctions/sortByName';

export const initialState = {
  loading: false,
  hasErrors: false,
  exportOptions: null,
};

// A slice for recipes with our three reducers
const exportOptionsSlice = createSlice({
  name: 'exportOptionsSlice',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    crudExportOptionsSuccess: (state, { payload }) => {
      state.exportOptions = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudExportOptionsFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    }
  },
});

// Three actions generated from the slice
export const {
  setLoading,
  crudExportOptionsSuccess,
  crudExportOptionsFailure
} = exportOptionsSlice.actions;

export function fetchExportOptions() {
  return async (dispatch, state) => {
    // console.log('Fetching exportOptions, in slice...');
    dispatch(setLoading());

    try {
      const { data } = await axios.get(
        '/api/widgets/flarereporting/dataexport/options'
      );
      dispatch(crudExportOptionsSuccess(data));
    } catch (error) {
      console.log('fetch data export options error!', error);
      dispatch(crudExportOptionsFailure());
    }
  };
}

export const exportOptionsSelector = (state) => state.exportOptions.exportOptions;

// The reducer
export default exportOptionsSlice.reducer;