import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import SortByName from '../../../components/FlareReporting/utilityFunctions/sortByName';

export const initialState = {
  loading: false,
  hasErrors: false,
  numericEventRules: null,
  subscriptions: null,
};

const numericEventRulesSlice = createSlice({
  name: 'numericEventRulesSlice',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    crudNumericEventRulesSuccess: (state, { payload }) => {
      state.numericEventRules = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudNumericEventRulesFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
    getSubscriptionSuccess: (state, { payload }) => {
      state.subscriptions = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    getSubscriptionFailure: (state) => {
      state.loading = false;
      state.hasErrors = true;
    },
    addSubscriptionSuccess: (state) => {
      state.loading = false;
      state.hasErrors = false;
    },
    addSubscriptionFailure: (state) => {
      state.loading = false;
      state.hasErrors = false;
    },
    unsubscribeSuccess: (state) => {
      state.loading = false;
      state.hasErrors = false;
    },
    unsubscribeFailure: (state) => {
      state.loading = false;
      state.hasErrors = false;
    }
  },
});

export const {
  setLoading,
  crudNumericEventRulesSuccess,
  crudNumericEventRulesFailure,
  getSubscriptionSuccess,
  getSubscriptionFailure,
  addSubscriptionSuccess,
  addSubscriptionFailure,
  unsubscribeSuccess,
  unsubscribeFailure,
} = numericEventRulesSlice.actions;

export function fetchNumericEventRules() {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get(
        '/api/widgets/flarereporting/numeric-event-rules'
      );
      dispatch(crudNumericEventRulesSuccess(SortByName(data.data)));
    } catch (error) {
      console.log('fetch event rules error!', error);

      dispatch(crudNumericEventRulesFailure());
    }
  };
}

export function fetchNumericEventSubscriptions() {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get(
        '/api/widgets/flarereporting/numeric-event-rules/subscriptions'
      );
      dispatch(getSubscriptionSuccess(SortByName(data.data)));
    } catch (error) {
      console.log('fetch subscriptions error!', error);
      dispatch(getSubscriptionFailure());
    }
  };
}

export function addNumericEventSubscription(id) {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      await axios.put(`/api/widgets/flarereporting/numeric-event-rules/subscribe/${id}`);
      dispatch(addSubscriptionSuccess());
    } catch (error) {
      console.log('add subscription error!', error);
      dispatch(addSubscriptionFailure());
    }
  };
}

export function unsubscribeNumericEvent(id) {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      await axios.put(
        `/api/widgets/flarereporting/numeric-event-rules/unsubscribe/${id}`
      );
      dispatch(unsubscribeSuccess());
    } catch (error) {
      console.log('add subscription error!', error);
      dispatch(unsubscribeFailure());
    }
  };
}

export const numericEventRulesSelector = (state) => state.numericEventRules.numericEventRules;
export const numericEventsubscriptionsSelector = (state) => state.numericEventRules.subscriptions;

// The reducer
export default numericEventRulesSlice.reducer;
