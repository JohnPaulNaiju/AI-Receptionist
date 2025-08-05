// Room model structure
/*
  Room document structure in Firestore:
  - id: string (auto-generated)
  - name: string
  - description: string
  - price: number
  - capacity: number
  - amenities: array of strings
  - images: array of strings (URLs)
  - type: string (e.g., 'standard', 'deluxe', 'suite')
  - status: string ('available', 'booked', 'maintenance')
  - createdAt: timestamp
  - updatedAt: timestamp
*/

// Booking model structure
/*
  Booking document structure in Firestore:
  - id: string (auto-generated)
  - userId: string (reference to user)
  - roomId: string (reference to room)
  - checkInDate: timestamp
  - checkOutDate: timestamp
  - totalPrice: number
  - status: string ('pending', 'confirmed', 'cancelled', 'completed')
  - guestCount: number
  - specialRequests: string
  - paymentStatus: string ('pending', 'paid')
  - createdAt: timestamp
  - updatedAt: timestamp
*/

// User model structure
/*
  User document structure in Firestore:
  - uid: string (from Firebase Auth)
  - name: string
  - email: string
  - phoneNumber: string
  - role: string ('user', 'admin')
  - createdAt: timestamp
*/

// Complaint model structure
/*
  Complaint document structure in Firestore:
  - id: string (auto-generated)
  - userId: string (reference to user)
  - bookingId: string (reference to booking, optional)
  - title: string
  - description: string
  - status: string ('open', 'in-progress', 'resolved')
  - priority: string ('low', 'medium', 'high')
  - createdAt: timestamp
  - updatedAt: timestamp
  - resolvedAt: timestamp (optional)
  - response: string (optional)
*/

// Helper functions for working with these models
export const createRoom = (roomData) => {
  return {
    ...roomData,
    status: roomData.status || 'available',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const createBooking = (bookingData) => {
  return {
    ...bookingData,
    status: bookingData.status || 'pending',
    paymentStatus: bookingData.paymentStatus || 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const createComplaint = (complaintData) => {
  return {
    ...complaintData,
    status: complaintData.status || 'open',
    priority: complaintData.priority || 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

// Calculate total price for a booking
export const calculateTotalPrice = (checkInDate, checkOutDate, pricePerNight, guestCount = 1) => {
  const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
  const diffDays = Math.round(Math.abs((new Date(checkOutDate) - new Date(checkInDate)) / oneDay));
  
  // Base price calculation (per night)
  let totalPrice = diffDays * pricePerNight;
  
  // Apply additional charge for extra guests (if more than 1)
  if (guestCount > 1) {
    // Add 50% of the base price for each additional guest
    totalPrice += (diffDays * pricePerNight * 0.5 * (guestCount - 1));
  }
  
  return totalPrice;
};

// Format date to display
export const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

// Check if a room is available for the given date range
export const isRoomAvailable = async (db, roomId, checkInDate, checkOutDate) => {
  // Implementation would query bookings collection to check for conflicts
  // This is a placeholder for the actual implementation
  return true;
};

// Favorites model structure
/*
  Favorites document structure in Firestore:
  - id: string (auto-generated)
  - userId: string (reference to user)
  - roomId: string (reference to room)
  - createdAt: timestamp
*/

// Wishlist model structure
/*
  Wishlists document structure in Firestore:
  - id: string (auto-generated)
  - userId: string (reference to user)
  - name: string
  - createdAt: timestamp
*/

// Wishlist item model structure
/*
  Wishlist_items document structure in Firestore:
  - id: string (auto-generated)
  - wishlistId: string (reference to wishlist)
  - roomId: string (reference to room)
  - createdAt: timestamp
*/

// Helper function to toggle favorite status
export const toggleFavorite = async (db, userId, roomId) => {
  const { collection, query, where, getDocs, addDoc, deleteDoc } = require('firebase/firestore');
  
  try {
    // Check if the room is already favorited
    const favoritesRef = collection(db, 'favorites');
    const q = query(favoritesRef, 
      where('userId', '==', userId),
      where('roomId', '==', roomId)
    );
    
    const querySnapshot = await getDocs(q);
    
    // If favorite exists, remove it
    if (!querySnapshot.empty) {
      await deleteDoc(querySnapshot.docs[0].ref);
      return { status: 'removed', message: 'Removed from favorites' };
    }
    
    // Otherwise, add it to favorites
    await addDoc(favoritesRef, {
      userId,
      roomId,
      createdAt: new Date().toISOString()
    });
    
    return { status: 'added', message: 'Added to favorites' };
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return { status: 'error', message: error.message };
  }
};

// Helper function to check if a room is favorited by a user
export const isRoomFavorited = async (db, userId, roomId) => {
  const { collection, query, where, getDocs } = require('firebase/firestore');
  
  try {
    const favoritesRef = collection(db, 'favorites');
    const q = query(favoritesRef, 
      where('userId', '==', userId),
      where('roomId', '==', roomId)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return false;
  }
};

// Helper function to add a room to a wishlist
export const addToWishlist = async (db, wishlistId, roomId) => {
  const { collection, query, where, getDocs, addDoc } = require('firebase/firestore');
  
  try {
    // Check if the room is already in the wishlist
    const wishlistItemsRef = collection(db, 'wishlist_items');
    const q = query(wishlistItemsRef, 
      where('wishlistId', '==', wishlistId),
      where('roomId', '==', roomId)
    );
    
    const querySnapshot = await getDocs(q);
    
    // If room already exists in wishlist, return early
    if (!querySnapshot.empty) {
      return { status: 'exists', message: 'Room already in wishlist' };
    }
    
    // Add room to wishlist
    await addDoc(wishlistItemsRef, {
      wishlistId,
      roomId,
      createdAt: new Date().toISOString()
    });
    
    return { status: 'added', message: 'Added to wishlist' };
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return { status: 'error', message: error.message };
  }
};

// Helper function to check if a room is in a wishlist
export const isRoomInWishlist = async (db, wishlistId, roomId) => {
  const { collection, query, where, getDocs } = require('firebase/firestore');
  
  try {
    const wishlistItemsRef = collection(db, 'wishlist_items');
    const q = query(wishlistItemsRef, 
      where('wishlistId', '==', wishlistId),
      where('roomId', '==', roomId)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking wishlist status:', error);
    return false;
  }
};
