//ref article for login/lougout:
//https://www.softkraft.co/how-to-setup-redux-with-redux-toolkit/

import { createSlice } from '@reduxjs/toolkit';

export const initialState = false;

const userSlice = createSlice({
  name: 'loading',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state = true;
    }
  },
});

// The reducer
export default userSlice.reducer;

// Actions
const {setLoading} = userSlice.actions;