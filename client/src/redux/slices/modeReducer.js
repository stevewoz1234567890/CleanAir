import { createSlice } from "@reduxjs/toolkit";

export const initialState = {
  mode: false,
};

const modeSlice = createSlice({
  name: "mode",
  initialState,
  reducers: {
    setMode: (state, action) => {
      state.mode = action.payload;
    },
  },
});

// The reducer
export default modeSlice.reducer;

// Actions
export const { setMode } = modeSlice.actions;
