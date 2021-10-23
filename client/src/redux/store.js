import { configureStore } from '@reduxjs/toolkit';
import user from './slices/userReducer';
import FormulasReducer from './slices/FMT/formulasSlice';
import ConstantsReducer from './slices/FMT/constantsSlice';
import CompoundsReducer from './slices/FMT/compoundsSlice';
import DashboardFlaresReducer from './slices/FMT/dashboardFlareSlice';
import EventRulesReducer from './slices/FMT/eventRulesSlice';
import NumericEventRulesReducer from './slices/FMT/numericEventRulesSlice';
import FlaresReducer from './slices/FMT/flareSlice';
import HeadersReducer from './slices/FMT/headerSlice';
import PiTagsReducer from './slices/FMT/pitagsSlice';
import SensorsReducer from './slices/FMT/sensorsSlice';
import ParametersReducer from './slices/FMT/parametersSlice';
import DataExportReducer from './slices/FMT/dataExportSlice';
import VisibleEmissionsReducer from './slices/FMT/visibleEmissionSlice';
import EmissionsReportOptionsReducer from './slices/FMT/emissionsReportOptionsSlice';
import StoplightDashboardInitReducer from './slices/FMT/stoplightDashboardInitSlice';
import StoplightDashboardStatusReducer from './slices/FMT/stoplightDashboardStatusSlice';
import ModeReducer from './slices/modeReducer';


const store = configureStore({
  reducer: {
    user: user,
    formulas: FormulasReducer,
    constants: ConstantsReducer,
    compounds: CompoundsReducer,
    dashboardFlares: DashboardFlaresReducer,
    eventRules: EventRulesReducer,
    numericEventRules: NumericEventRulesReducer,
    flares: FlaresReducer,
    headers: HeadersReducer,
    piTags: PiTagsReducer,
    sensors: SensorsReducer,
    parameters: ParametersReducer,
    exportOptions: DataExportReducer,
    mode: ModeReducer,
    visibleEmissions: VisibleEmissionsReducer,
    emissionsReportOptions: EmissionsReportOptionsReducer,
    stoplightDashboardSchema: StoplightDashboardInitReducer,
    stoplightDashboardStatus: StoplightDashboardStatusReducer,
  },
});
export default store;
