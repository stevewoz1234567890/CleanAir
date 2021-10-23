import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import SortByName from '../../../components/FlareReporting/utilityFunctions/sortByName';

export const initialState = {
  loading: false,
  hasErrors: false,
  flares: []
};

// A slice for recipes with our three reducers
const dashboardFlaresSlice = createSlice({
  name: 'dashboardFlaresSlice',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    fetchDashboardFlaresSuccess: (state, { payload }) => {
      state.flares = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    fetchDashboardFlaresFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
  },
});

// Three actions generated from the slice
export const {
  setLoading,
  fetchDashboardFlaresSuccess,
  fetchDashboardFlaresFailure,
} = dashboardFlaresSlice.actions;

export function fetchDashboardFlares() {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get(`/api/widgets/flarereporting/dashboard/init`);
      const flareData = data?.map((flare) => ({
        ...flare,
        _id: flare.flare,
      }));
      dispatch(fetchDashboardFlaresSuccess(SortByName(flareData)));
    } catch (error) {
      console.log('fetch flare error!', error);

      dispatch(fetchDashboardFlaresFailure());
    }
  };
}

export const dashboardFlaresSelector = (state) => state.dashboardFlares;

export default dashboardFlaresSlice.reducer;
