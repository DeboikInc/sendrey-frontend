import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Current draft order being built
  currentOrder: null,
  
  // Which field is being edited (for navigation return)
  editingField: null,
  
  // Whether we're in edit mode
  isEditing: false,
  
  // Original order before edit started (for cancel)
  originalOrder: null,
};

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    // Start building a new order
    startNewOrder: (state, action) => {
      state.currentOrder = action.payload;
      state.isEditing = false;
      state.editingField = null;
      state.originalOrder = null;
    },
    
    // Update entire order
    updateOrder: (state, action) => {
      state.currentOrder = {
        ...state.currentOrder,
        ...action.payload,
      };
    },
    
    // Start editing a specific field
    startEditing: (state, action) => {
      state.isEditing = true;
      state.editingField = action.payload.field;
      state.originalOrder = JSON.parse(JSON.stringify(state.currentOrder));
    },
    
    // Finish editing - return to confirm screen
    finishEditing: (state) => {
      state.isEditing = false;
      state.editingField = null;
      state.originalOrder = null;
    },
    
    // Cancel editing - restore original
    cancelEditing: (state) => {
      if (state.originalOrder) {
        state.currentOrder = state.originalOrder;
      }
      state.isEditing = false;
      state.editingField = null;
      state.originalOrder = null;
    },
    
    // Clear order (after confirmation)
    clearOrder: (state) => {
      state.currentOrder = null;
      state.isEditing = false;
      state.editingField = null;
      state.originalOrder = null;
    },
  },
});

export const {
  startNewOrder,
  updateOrder,
  startEditing,
  finishEditing,
  cancelEditing,
  clearOrder,
} = orderSlice.actions;

export default orderSlice.reducer;