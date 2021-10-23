import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import SortByName from '../../../components/FlareReporting/utilityFunctions/sortByName';

export const initialState = {
  loading: false,
  hasErrors: false,
  eventRules: null,
  subscriptions: null,
};

// A slice for recipes with our three reducers
const eventrulesSlice = createSlice({
  name: 'eventrulesSlice',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    crudEventRulesSuccess: (state, { payload }) => {
      state.eventRules = payload;
      state.loading = false;
      state.hasErrors = false;
    },
    crudEventRulesFailure: (state) => {
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
    },
  },
});

// Three actions generated from the slice
export const {
  setLoading,
  crudEventRulesSuccess,
  crudEventRulesFailure,
  getSubscriptionSuccess,
  getSubscriptionFailure,
  addSubscriptionSuccess,
  addSubscriptionFailure,
  unsubscribeSuccess,
  unsubscribeFailure,
} = eventrulesSlice.actions;

// Asynchronous thunk action
// // The function below is called a thunk and allows us to perform async logic. It
// // can be dispatched like a regular action: `dispatch(incrementAsync(10))`. This
// // will call the thunk with the `dispatch` function as the first argument. Async
// // code can then be executed and other actions can be dispatched
export function fetchEventRules() {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get(
        '/api/widgets/flarereporting/eventrules'
      );
      dispatch(crudEventRulesSuccess(SortByName(data.data)));
    } catch (error) {
      console.log('fetch event rules error!', error);

      dispatch(crudEventRulesFailure());
    }
  };
}

export function fetchBooleanEventSubscriptions() {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      const { data } = await axios.get(
        '/api/widgets/flarereporting/eventrules/subscriptions'
      );
      dispatch(getSubscriptionSuccess(SortByName(data.data)));
    } catch (error) {
      console.log('fetch subscriptions error!', error);

      dispatch(getSubscriptionFailure());
    }
  };
}

export function addBooleanEventSubscription(id) {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      await axios.put(`/api/widgets/flarereporting/eventrules/subscribe/${id}`);
      dispatch(addSubscriptionSuccess());
    } catch (error) {
      console.log('add subscription error!', error);
      dispatch(addSubscriptionFailure());
    }
  };
}

export function unsubscribeBooleanEvent(id) {
  return async (dispatch) => {
    dispatch(setLoading());

    try {
      await axios.put(
        `/api/widgets/flarereporting/eventrules/unsubscribe/${id}`
      );
      dispatch(unsubscribeSuccess());
    } catch (error) {
      console.log('add subscription error!', error);
      dispatch(unsubscribeFailure());
    }
  };
}

// a Selector
// // The function below is called a selector and allows us to select a value from
// // the state. Selectors can also be defined inline where they're used instead of
// // in the slice file. For example: `useSelector((state) => state.counter.value)`

export const eventrulesSelector = (state) => state.eventRules.eventRules;
export const booleanEventSubscriptionsSelector = (state) => state.eventRules.subscriptions;

// The reducer
export default eventrulesSlice.reducer;
