/* 
https://mongoosejs.com/docs/models.html
https://www.npmjs.com/package/mongoose-paginate-v2
*/
const mongoose = require("mongoose");
const { Schema } = mongoose;
const mongoosePaginate = require("mongoose-paginate-v2");

const FormulaSchmea = new Schema({
  name: {
    type: String,
    required: true,
  },
  formula: {
    type: String,
    required: true,
  },
  newFormula: {
    type: String,
    required: true,
  },
  to: {
    type: String,
    required: true,
    enum: ["flare", "headers"],
  },
  dataType: {
    type: String,
    required: true,
    enum: ["boolean", "num", "array_num", "array_boolean"],
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
  org: {
    type: Schema.Types.ObjectId,
    ref: "Org",
    required: true,
  },
  committed: {
    type: Boolean,
    default: false,
  },
  eventRule: {
    type: Schema.Types.ObjectId,
    ref: "EventRule",
    default: null,
  },
});

const FlareSchmea = new Schema({
  name: {
    type: String,
    required: true,
  },
  steamAssisted: {
    type: Boolean,
    required: true,
  },
  airAssisted: {
    type: Boolean,
    required: true,
  },
  permitId: {
    type: String,
  },
  tipDiameterValue: {
    type: Number,
  },
  tipDiameterUom: {
    type: String,
    enum: ["ft", null],
  },
  unobstructedTipAreaValue: {
    type: Number,
  },
  unobstructedTipAreaUom: {
    type: String,
    enum: ["sq ft", null],
  },
  smokelessCapacityValue: {
    type: Number,
  },
  smokelessCapacityUom: {
    type: String,
    enum: ["lb/hr", null],
  },
  effectiveTipDiameterValue: {
    type: Number,
  },
  effectiveTipDiameterUom: {
    type: String,
    enum: ["in", null],
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
  org: {
    type: Schema.Types.ObjectId,
    ref: "Org",
    required: true,
  },
});

const HeaderSchmea = new Schema({
  name: {
    type: String,
    required: true,
  },
  org: {
    type: Schema.Types.ObjectId,
    ref: "Org",
    required: true,
  },
  flare: {
    type: Schema.Types.ObjectId,
    ref: "Flare",
    required: true,
  },
  sealed: {
    type: Boolean,
    required: true,
  },
  cemsInstalled: {
    type: Boolean,
    required: true,
  },
  processList: [
    {
      type: String,
    },
  ],
  createdDate: {
    type: Date,
    default: Date.now,
  },
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
});

const SensorSchmea = new Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  org: {
    type: Schema.Types.ObjectId,
    ref: "Org",
    required: true,
  },
  flare: {
    type: Schema.Types.ObjectId,
    ref: "Flare",
  },
  header: {
    type: Schema.Types.ObjectId,
    ref: "Header",
  },
  isPrimary: {
    type: Boolean,
    required: true,
  },
  cemsInstalled: {
    type: Boolean,
    required: true,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
});

const piTagSchema = new Schema({
  identifier: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  org: {
    type: Schema.Types.ObjectId,
    ref: "Org",
    required: true,
  },
  flare: {
    type: Schema.Types.ObjectId,
    ref: "Flare",
    default: null,
  },
  header: {
    type: Schema.Types.ObjectId,
    ref: "Header",
    default: null,
  },
  sensor: {
    type: Schema.Types.ObjectId,
    ref: "Sensor",
    required: true,
  },
  parameter: {
    type: Schema.Types.ObjectId,
    ref: "Parameter",
    required: true,
  },
  max: {
    type: Number,
    default: null,
  },
  min: {
    type: Number,
    default: null,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
});

const compoundSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  abbreviation: {
    type: String,
    default: null,
  },
  molecularWeight: {
    type: Number,
    default: null,
  },
  molecularWeightUom: {
    type: String,
    enum: ["lb/lbmol", null],
    default: null,
  },
  netHeatingValue: {
    type: Number,
    default: null,
  },
  lowerFlamabilityLimit: {
    type: Number,
    default: null,
  },
  volatileOrganicCompound: {
    type: Boolean,
    default: null,
  },
  sulfur: {
    type: Boolean,
    default: null,
  },
  hydroCarbon: {
    type: Boolean,
    default: null,
  },
  inert: {
    type: Boolean,
    default: null,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
  sulfurMolarNumber: {
    type: Number,
    default: null
  },
  carbonMolarNumber: {
    type: Number,
    default: null
  },
});

const compoundGroup = new Schema({
  name: {
    type: String,
    required: true,
  },
  compounds: [
    {
      type: Schema.Types.ObjectId,
      ref: "Compound",
    },
  ],
  org: {
    type: Schema.Types.ObjectId,
    ref: "Org",
    required: true,
  },
});

const parameterSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  resolution: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    default: null,
  },
  unitOfMeasure: {
    type: String,
    enum: [
      "mol",
      "degF",
      "SCFM",
      "ppm",
      "Btu/scf",
      "lb/lbmol",
      "MPPH",
      "MSCFH",
      "PSIA",
      "in H2O",
      "RPM",
      "psia",
      null,
    ],
  },
  valueType: {
    type: String,
    enum: ["num", "string", "boolean"],
    required: true,
  },
  compound: {
    type: Schema.Types.ObjectId,
    ref: "Compound",
    default: null,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
});

const eventSchema = new Schema({
  eventRule: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "EventRule",
  },
  flare: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Flare",
  },
  header: {
    type: Schema.Types.ObjectId,
    default: null,
    ref: "Header",
  },
  start: {
    type: Date,
    required: true,
  },
  end: {
    type: Date,
    required: true,
  },
  reason: {
    type: String,
    default: null,
  },
  action: {
    type: String,
    default: null,
  },
  chunks: [
    {
      _id: false,
      piValue: {
        type: Schema.Types.ObjectId,
      },
      value: {
        type: Number,
      },
    },
  ],
  values: [
    {
      _id: false,
      piValue: {
        type: Schema.Types.ObjectId,
      },
    },
  ],
});

const eventRuleSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  resolution: {
    type: Number,
    required: true,
  },
  chunkSize: {
    type: Number,
    required: true,
  },
  sensitivity: {
    type: Number,
    required: true,
  },
  org: {
    type: Schema.Types.ObjectId,
    ref: "Org",
    required: true,
  },
  formula: {
    type: Schema.Types.ObjectId,
    ref: "Formula",
    required: true,
  },
  checkFor: {
    type: Boolean,
    required: true,
  },
  withValues: {
    type: Boolean,
    required: true,
  },
  checkForValue: {
    type: Schema.Types.ObjectId,
    ref: "Formula",
    default: null,
  },
  subscribers: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  use: {
    type: String,
    required: true,
    default: "unassigned",
    enum: ["reporting", "alarming", "unassigned"],
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
});

const constantSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    required: true,
  },
  org: {
    type: Schema.Types.ObjectId,
    ref: "Org",
    required: true,
  },
});

const piValueSchema = new Schema({
  piTag: {
    type: Schema.Types.ObjectId,
    ref: "PiTag",
    required: true,
  },
  org: {
    type: Schema.Types.ObjectId,
    ref: "Org",
    required: true,
  },
  value: {
    type: Schema.Types.Mixed,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  // testData: {
  //   type: Boolean,
  //   default: true,
  // },
  // createdDate: {
  //   type: Date,
  //   default: Date.now,
  // },
  // lastUpdate: {
  //   type: Date,
  //   default: Date.now,
  // },
});

const formulaValueSchema = new Schema({
  org: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  formula: {
    type: Schema.Types.ObjectId,
    ref: "Formula",
    required: true,
  },
  flare: {
    type: Schema.Types.ObjectId,
    ref: "Flare",
    default: null,
  },
  header: {
    type: Schema.Types.ObjectId,
    ref: "Header",
    default: null,
  },
  value: {
    type: Schema.Types.Mixed,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  start: {
    type: Date,
    required: true,
  },
  withValues: [
    {
      _id: false,
      valID: {
        type: Schema.Types.ObjectId,
      },
      value: {
        type: Number,
      },
    },
  ],
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
});

const JobSchema = new Schema({
  type: {
    type: String,
    required: true,
  },
  org: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  progress: {
    type: Schema.Types.Mixed,
    default: 0,
  },
  isComplete: {
    type: Schema.Types.Boolean,
    default: false,
  },
  failed: {
    type: Schema.Types.Boolean,
    default: false,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    default: null,
  },
  info: {
    type: Schema.Types.Mixed,
    default: null,
  },
});

const VisibleEmissionSchema = new Schema({
  org: {
    type: Schema.Types.ObjectId,
    ref: "Org",
    required: true,
  },
  flare: {
    type: Schema.Types.ObjectId,
    ref: "Flare",
    required: true,
  },
  startDate: {
    type: Date,
    default: null,
  },
  endDate: {
    type: Date,
    default: null,
  },
  notes: {
    type: String,
  },
});


const userSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  passwordChangeDate: {
    type: Date,
    default: Date.now
  },
  createdDate: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
  },
  defaultOrg: {
    type: Schema.Types.ObjectId,
    ref: 'Org',
    required: true
  },
  orgs: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Org'
    }
  ],
  previousPasswords: [
    {
      type: String,
    }
  ],
  countPasswordChanges: {
    type: Number
  },
  permissions: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Permission',
    },
  ],
  permissionGroups: [
    {
      type: Schema.Types.ObjectId,
      ref: 'PermissionGroup',
    },
  ],
  recentAlarms: [{
    _id: false,
    start : {
      type : Date
    },
    end : {
      type : Date
    },
    eventID : {
      type : Schema.Types.ObjectId
    },
    eventRule : {
      type : Schema.Types.ObjectId,
      default: null
    },
    flare : {
      type : Schema.Types.ObjectId,
      default: null
    },
    header : {
      type : Schema.Types.ObjectId,
      default: null
    },
    created : {
      type : Date,
      default : null,
    }
  }],
  recentNumRuleAlarms: [{
    _id: false,
    start : {
      type : Date
    },
    end : {
      type : Date
    },
    eventID : {
      type : Schema.Types.ObjectId
    },
    eventRule : {
      type : Schema.Types.ObjectId,
      default: null
    },
    flare : {
      type : Schema.Types.ObjectId,
      default: null
    },
    header : {
      type : Schema.Types.ObjectId,
      default: null
    },
    created : {
      type : Date,
      default : null,
    }
  }],
  forceLogout: {
    type: Boolean,
    default: false
  },
});

const orgSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  logGroup: {
    type: String,
    required: true,
    unique: true,
    immutable: true
  },
  require2FA: {
    type: Boolean,
    required: true
  },
  logoUrl: {
    type: String,
    default: 'https://www.cleanair.com/wp-content/uploads/2018/10/logo.png'
  },
  widgets: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Widgets'
    }
  ]
});


FormulaSchmea.plugin(mongoosePaginate);
FlareSchmea.plugin(mongoosePaginate);
HeaderSchmea.plugin(mongoosePaginate);
SensorSchmea.plugin(mongoosePaginate);
piTagSchema.plugin(mongoosePaginate);
eventRuleSchema.plugin(mongoosePaginate);
parameterSchema.plugin(mongoosePaginate);
compoundSchema.plugin(mongoosePaginate);
constantSchema.plugin(mongoosePaginate);
VisibleEmissionSchema.plugin(mongoosePaginate);

const Formula = mongoose.model("Formula", FormulaSchmea);
const Flare = mongoose.model("Flare", FlareSchmea);
const Header = mongoose.model("Header", HeaderSchmea);
const Sensor = mongoose.model("Sensor", SensorSchmea);
const PiTag = mongoose.model("PiTag", piTagSchema);
const PiValue = mongoose.model("piValue", piValueSchema);
const PiValuesDebug = mongoose.model(
  "PiValuesDebug",
  piValueSchema,
  "piValuesDebug"
);
const FormulaValue = mongoose.model(
  "FormulaValue",
  formulaValueSchema,
  "formulaValues"
);
const DebugFormulaValue = mongoose.model(
  "DebugFormulaValue",
  formulaValueSchema,
  "formulaValuesDebug"
);

const Org = mongoose.model('Org', orgSchema, "orgs");
const EventRule = mongoose.model("EventRule", eventRuleSchema);
const Parameter = mongoose.model("Parameter", parameterSchema);
const Compound = mongoose.model("Compound", compoundSchema);
const Constant = mongoose.model("Constant", constantSchema);
const CompoundGroup = mongoose.model("CompoundGroup", compoundGroup);
const Event = mongoose.model("Event", eventSchema, "events");
const DebugEvent = mongoose.model("DebugEvent", eventSchema, "debugEvents");
// const CalcStore = mongoose.model('calcStore', calcStoreSchema, 'calcStore');
const Job = mongoose.model("Job", JobSchema, "jobs");
const VisibleEmission = mongoose.model("VisibleEmission", VisibleEmissionSchema);
const User = mongoose.model("User", userSchema, "users");

module.exports = {
  Formula,
  Flare,
  Header,
  Sensor,
  PiTag,
  EventRule,
  Parameter,
  Compound,
  Constant,
  FormulaValue,
  PiValue,
  CompoundGroup,
  Event,
  DebugEvent,
  PiValuesDebug,
  DebugFormulaValue,
  Job,
  VisibleEmission,
  User,
  Org
};
