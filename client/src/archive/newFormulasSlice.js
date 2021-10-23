import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import SortByName from '../../../components/FlareReporting/utilityFunctions/sortByName';

export const initialState = {
  loading: false,
  hasErrors: false,
  newFormulas: null,
  newFormulasBoolean: null,
  newFormulasNum: null,
};

// A slice for recipes with our three reducers
const newFormulasSlice = createSlice({
  name: 'newFormulasSlice',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    crudNewFormulasSuccess: (state, { payload }) => {
      state.newFormulas = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudNewFormulasBooleanSuccess: (state, { payload }) => {
      state.newFormulasBoolean = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudNewFormulasNumSuccess: (state, { payload }) => {
      state.newFormulasNum = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudNewFormulasFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
  },
});

// Three actions generated from the slice
export const {
  setLoading,
  crudNewFormulasSuccess,
  crudNewFormulasFailure,
  crudNewFormulasBooleanSuccess,
  crudNewFormulasNumSuccess,
} = newFormulasSlice.actions;

export function fetchNewFormulas(type) {
  return async (dispatch, state) => {
    dispatch(setLoading());

    try {
      const { data } = type
        ? await axios.get(
            `/api/widgets/flarereporting/formulas/?dataType=${type}`
          )
        : await axios.get(`/api/widgets/flarereporting/formulas/`);

      if (type === 'boolean') {
        dispatch(crudNewFormulasBooleanSuccess(SortByName(data.data)));
      } else if (type === 'num') {
        dispatch(crudNewFormulasNumSuccess(SortByName(data.data)));
      } else {
        dispatch(crudNewFormulasSuccess(SortByName(data.data)));
      }
    } catch (error) {
      console.log('fetch formula error!', error);

      dispatch(crudNewFormulasFailure());
    }
  };
}

export function createFormula(payload) {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.post(
        '/api/widgets/flarereporting/formulas',
        payload
      );
      console.log('create formula:  ', data);
    } catch (error) {
      console.log('create formula err: ', error);
    }
  };
}

export const newFormulasSelector = (state) => state.newFormulas.newFormulas;
export const newFormulasBooleanSelector = (state) =>
  state.newFormulas.newFormulasBoolean;
export const newFormulasNumSelector = (state) =>
  state.newFormulas.newFormulasNum;

// The reducer
export default newFormulasSlice.reducer;
