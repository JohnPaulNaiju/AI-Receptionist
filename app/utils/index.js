// Export Firebase services and authentication
export { auth, db, storage, functions } from './init';

// Export theme and styling utilities
export { theme } from './theme';

// Export models and helper functions
export {
  createRoom,
  createBooking,
  createComplaint,
  calculateTotalPrice,
  formatDate,
  isRoomAvailable
} from './models';



// Helper function to unsubscribe from Firebase listeners
const listeners = [];

export const addListener = (listener) => {
  listeners.push(listener);
};

export const unsubListeners = () => {
  listeners.forEach(listener => {
    if (typeof listener === 'function') {
      listener();
    }
  });
  listeners.length = 0;
};

// Format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
};

// Get user role from Firestore
export const getUserRole = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      return userDoc.data().role;
    }
    return 'user'; // Default role
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'user'; // Default role on error
  }
};

// Check if user is admin
export const isUserAdmin = async (userId) => {
  const role = await getUserRole(userId);
  return role === 'admin';
};

// Date utility functions
export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getDateRange = (startDate, endDate) => {
  const dates = [];
  let currentDate = new Date(startDate);
  const lastDate = new Date(endDate);
  
  while (currentDate <= lastDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
};
