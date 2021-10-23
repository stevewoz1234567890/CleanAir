import { createSlice, current } from "@reduxjs/toolkit";
import axios from "axios";
import { showMessage } from "../../../components/Layout/Toaster";

export const initialState = {
  loading: false,
  hasErrors: false,
  formulas: [],
  typeSelected: null,
  selectedFormula: null,
  lastSelectedId: null,
  editedFormula: null,
  testResults: undefined,
  testLoading: false,
  dates: {
    start: null,
    end: null,
  },
};

const formulasSlice = createSlice({
  name: "formulasSlice",
  initialState,
  reducers: {
    setLoading: (state, { payload }) => {
      state.loading = true;
    },
    setFormulas: (state, { payload }) => {
      state.formulas = payload.formulasData;
      state.typeSelected = payload.typeSelected;
      state.selectedFormula = payload.selectedFormula;
      state.lastSelectedId = payload.lastSelectedId;
      state.loading = false;
    },
    setSelectedFormula: (state, { payload }) => {
      state.selectedFormula = payload;
    },
    formulaChanged: (state, { payload }) => {
      state.typeSelected = payload.typeSelected;
      state.selectedFormula = payload.selectedFormula;
      state.lastSelectedId = payload.lastSelectedId;
      state.editedFormula = null;
    },
    typeChanged: (state, { payload }) => {
      state.typeSelected = payload;
    },
    formulaEdited: (state, { payload }) => {
      state.editedFormula = payload;
    },
    formulaSaved: (state, { payload }) => {
      state.formulas = payload;
      state.editedFormula = null;
    },
    socketPush: (state, { payload }) => {
      state.formulas = payload;
      state.loading = false;
    },
    testComplete: (state, { payload }) => {
      state.testResults = payload;
      state.testLoading = false;
    },
    testFail: (state, { payload }) => {
      state.testResults = "";
      state.testLoading = false;
    },
    testIsLoading: (state, { payload }) => {
      state.testLoading = true;
    },
    formulaDeleted: (state, { payload }) => {
      state.selectedFormula = null;
      state.editedFormula = null;
      state.lastSelectedId = null;
    },
  },
});

// Three actions generated from the slice
export const {
  setFormulas,
  setSelectedFormula,
  formulaChanged,
  typeChanged,
  setLoading,
  formulaEdited,
  formulaDeleted,
  formulaSaved,
  socketPush,
  testComplete,
  testFail,
  testIsLoading,
} = formulasSlice.actions;

export const loadFormulas = () => async (dispatch, state) => {
  try {
    dispatch(setLoading());
    const formulasState = state().formulas;
    const res = await axios.get("/api/widgets/flarereporting/formulas/all");
    const formulasData = res.data.data;

    /* Set the default formula */
    if (!formulasState.lastSelectedId) {
      const selectedFormula = formulasData[0];
      const typeSelected = selectedFormula.to;
      const lastSelectedId = selectedFormula._id;
      dispatch(
        setFormulas({
          formulasData,
          selectedFormula,
          typeSelected,
          lastSelectedId,
        })
      );
    } else {
      const selectedFormula = formulasData.filter(
        (formula) => formula._id === formulasState.lastSelectedId
      )[0];
      const typeSelected = selectedFormula.to;
      const lastSelectedId = selectedFormula._id;
      dispatch(
        setFormulas({
          formulasData,
          selectedFormula,
          typeSelected,
          lastSelectedId,
        })
      );
    }
  } catch (err) {
    console.log("error!:", err.message);
    return err.message;
  }
};

export const onFormulaChange = (formulaId) => async (dispatch, state) => {
  try {
    const formulas = state().formulas.formulas;
    const selectedFormula = formulas.filter(
      (formula) => formula._id === formulaId
    )[0];
    const typeSelected = selectedFormula.to;
    const lastSelectedId = selectedFormula._id;
    dispatch(formulaChanged({ typeSelected, selectedFormula, lastSelectedId }));
  } catch (err) {
    console.log("error!:", err.message);
    return err.message;
  }
};

export const onTypeChange = (type) => async (dispatch, state) => {
  try {
    dispatch(typeChanged(type));
  } catch (err) {
    console.log("error!:", err.message);
    return err.message;
  }
};

export const onFormulaEdit = (value) => async (dispatch, state) => {
  try {
    dispatch(formulaEdited(value));
  } catch (err) {
    console.log("error!:", err.message);
    return err.message;
  }
};

export const onSocketPush = (data) => async (dispatch, state) => {
  try {
    console.log(data);
  } catch (err) {
    console.log("error!:", err.message);
    return err.message;
  }
};

export const onFormulaSave = () => async (dispatch, state) => {
  try {
    const currentState = state().formulas;
    const url = `/api/widgets/flarereporting/formulas`;

    if (currentState.editedFormula) {
      if (currentState.editedFormula._id) {
        await axios.put(
          url,
          currentState.editedFormula
        );
      } else {
        await axios.post(
          url,
          currentState.editedFormula
        );
      }
    }
  } catch (err) {
    showMessage("Error", err.message);
    console.log("error!:", err);
    return err.message;
  }
};

export const onFormulaTest = (data) => async (dispatch, state) => {
  try {
    dispatch(testIsLoading());
    const url = `/api/widgets/flarereporting/formulas/test`;
    const res = await axios.post(url, data);
    dispatch(testComplete(res.data));
  } catch (err) {
    showMessage("Error", err.message);
    console.log("error!:", err);
    dispatch(testFail());
    return err.message;
  }
};

export const onFormulaDelete = () => async (dispatch, state) => {
  const selectedFormula = state().formulas.selectedFormula;
  try {
    const url = `/api/widgets/flarereporting/formulas/${selectedFormula._id}`;
    const res = await axios.delete(url);
    dispatch(formulaDeleted(res.data.data));
  } catch (err) {
    showMessage("Error", err.message);
    console.log("error!:", err);
    return err.message;
  }
};

export const formulaSelector = (state) => state.formulas;

// export const formulaSelector = (state) => state.forumlaSlice.formulas;

// The reducer
export default formulasSlice.reducer;
