import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define the shape of the filters in the app
export interface FiltersState {
  location: string;
  beds: string;
  baths: string;
  propertyType: string;
  amenities: string[];
  availableFrom: string;
  priceRange: [number, number] | [null, null];
  squareFeet: [number, number] | [null, null];
  coordinates: [number, number];
}

// Define the overall state for this slice
interface InitialStateTypes {
  filters: FiltersState; // The filters currently applied
  isFiltersFullOpen: boolean; // Whether the full filters sidebar is open
  viewMode: 'grid' | 'list'; // How listings are displayed
}

// Initial state of the slice when the app starts
export const initialState: InitialStateTypes = {
  filters: {
    location: 'Los Angeles',
    beds: 'any',
    baths: 'any',
    propertyType: 'any',
    amenities: [],
    availableFrom: 'any',
    priceRange: [null, null],
    squareFeet: [null, null],
    coordinates: [-118.25, 34.05] // Default coordinates for Los Angeles
  },
  isFiltersFullOpen: false, // Sidebar is closed by default
  viewMode: 'grid' // Listings default to grid view
};

// Create a Redux slice called 'global' with actions and reducers
export const globalSlice = createSlice({
  name: 'global', // Name of this slice in the Redux store
  initialState, // Set the initial state
  reducers: {
    // Action to update filters
    // Payload is a partial FiltersState object (only the filters that changed)
    setFilters: (state, action: PayloadAction<Partial<FiltersState>>) => {
      state.filters = { ...state.filters, ...action.payload };
      // Merge existing filters with new filters from the action
    },

    // Action to toggle the full filters sidebar open or closed
    toggleFiltersFullOpen: state => {
      state.isFiltersFullOpen = !state.isFiltersFullOpen; // Switch true/false
    },

    // Action to set the view mode for listings ('grid' or 'list')
    setViewMode: (state, action: PayloadAction<'grid' | 'list'>) => {
      state.viewMode = action.payload; // Update viewMode with new value
    }
  }
});

// Export the actions so components can dispatch them
export const { setFilters, toggleFiltersFullOpen, setViewMode } =
  globalSlice.actions;

  // Export the reducer to be added to the Redux store
export default globalSlice.reducer;
