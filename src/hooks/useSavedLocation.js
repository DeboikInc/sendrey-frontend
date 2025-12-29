import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  fetchLocations, 
  addLocation, 
  deleteLocation, 
  clearError 
} from '../Redux/userSlice';

export const useLocations = () => {
  const dispatch = useDispatch();
  const { savedLocations, loading, error } = useSelector((state) => state.users);

  // Fetch locations on mount
  useEffect(() => {
    dispatch(fetchLocations());
  }, [dispatch]);

  const saveNewLocation = async (locationData) => {
    // locationData: { name, address, lat, lng }
    return await dispatch(addLocation(locationData)).unwrap();
  };

  const removeLocation = async (id) => {
    return await dispatch(deleteLocation(id)).unwrap();
  };

  const resetError = () => dispatch(clearError());

  return { 
    locations: savedLocations, 
    loading, 
    error, 
    saveNewLocation, 
    removeLocation,
    resetError 
  };
};