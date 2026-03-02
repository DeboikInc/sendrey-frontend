const mongoose = require("mongoose");

const {SERVICE_TYPE,FLEET} = require("../config/constants");

const taskSchema = new mongoose.Schema({
 taskId:{
    type:String,
    required:true,
    unique:true,
    index:true
 },

 //who requested the task
 userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    required:true,
 },

 // who completed it 
 runnerId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Runner",
    default:null,
 },

 // bussiness context 
 businessAccount:{
   type: mongoose.Types.ObjectId,
   ref:"User",
   default:null,
 },
 createdByMemmber:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    default:null,
 },
 //mirrors whats in current request 
 ServiceType:{
    type:String,
    enum:["pickup","run-errand"],

 },
 fleetType:{
    type:String,
    enum:["cycling", "bike", "car", "van", "pedestrian"],
 },
 // pick-up fields
    pickupLocation: { type: String },
    pickupPhone: { type: String },
    pickupItems: { type: String },
    pickupCoordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },

    // errand fields
    marketLocation: { type: String },
    marketItems: { type: String },
    budget: { type: String },
    budgetFlexibility: {
      type: String,
      enum: ["stay within budget", "can adjust slightly"],
    },
    marketCoordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },

    // shared fields
    deliveryLocation: { type: String },
    dropoffPhone: { type: String },
    specialInstructions: { type: String },
     // what the user actually paid — used for expense reports
    amount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["completed", "cancelled"],
      required: true,
    },

    completedAt: { type: Date },
    cancelledAt: { type: Date },

}, { timestamps: true })
// makes it fast to pull all tasks for a business in a date range
taskSchema.index({ businessAccount: 1, completedAt: -1 });
// makes it fast to pull all tasks for a specific user
taskSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Task", taskSchema);