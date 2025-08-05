// RAG (Retrieval-Augmented Generation) utilities for the AI receptionist
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './init';

// Vector embedding simulation (in a real app, you would use a proper vector DB or embedding API)
const createSimpleEmbedding = (text) => {
  // This is a simplified embedding function for demonstration
  // In production, use a proper embedding model like OpenAI's text-embedding-ada-002
  const words = text.toLowerCase().split(/\W+/).filter(word => word.length > 0);
  return words;
};

// Cosine similarity function to compare embeddings
const calculateSimilarity = (embedding1, embedding2) => {
  // Find common words
  const common = embedding1.filter(word => embedding2.includes(word));
  // Calculate similarity score (simplified version of cosine similarity)
  return common.length / Math.sqrt(embedding1.length * embedding2.length) || 0;
};

// Function to retrieve relevant documents based on query
export const retrieveRelevantDocuments = async (query, collections = ['rooms', 'bookings', 'complaints', 'faqs']) => {
  const queryEmbedding = createSimpleEmbedding(query);
  let relevantDocs = [];
  
  // Search through specified collections
  for (const collectionName of collections) {
    const snapshot = await getDocs(collection(db, collectionName));
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      // Create a text representation of the document
      const docText = Object.values(data).filter(val => typeof val === 'string').join(' ');
      const docEmbedding = createSimpleEmbedding(docText);
      
      // Calculate similarity
      const similarity = calculateSimilarity(queryEmbedding, docEmbedding);
      
      // If similarity is above threshold, add to relevant docs
      if (similarity > 0.1) {
        relevantDocs.push({
          id: doc.id,
          collection: collectionName,
          data,
          similarity
        });
      }
    });
  }
  
  // Sort by similarity (highest first)
  relevantDocs.sort((a, b) => b.similarity - a.similarity);
  
  // Return top results (limit to 5 for performance)
  return relevantDocs.slice(0, 5);
};

// Function calling implementations
export const functionDefinitions = [
  {
    name: 'bookRoom',
    description: 'Book a room for a guest',
    parameters: {
      roomId: 'ID of the room to book',
      checkInDate: 'Check-in date in YYYY-MM-DD format',
      checkOutDate: 'Check-out date in YYYY-MM-DD format',
      guestName: 'Name of the guest',
      guestEmail: 'Email of the guest',
      specialRequests: 'Any special requests (optional)'
    },
    implementation: async (params) => {
      try {
        // Check if room exists and is available
        const roomRef = doc(db, 'rooms', params.roomId);
        const roomSnapshot = await getDocs(roomRef);
        
        if (!roomSnapshot.exists()) {
          return { success: false, message: 'Room not found' };
        }
        
        const roomData = roomSnapshot.data();
        if (roomData.status !== 'available') {
          return { success: false, message: 'Room is not available for booking' };
        }
        
        // Create booking
        const bookingRef = await addDoc(collection(db, 'bookings'), {
          roomId: params.roomId,
          roomName: roomData.name,
          roomType: roomData.type,
          userId: auth.currentUser?.uid || 'guest',
          guestName: params.guestName,
          guestEmail: params.guestEmail,
          checkInDate: params.checkInDate,
          checkOutDate: params.checkOutDate,
          specialRequests: params.specialRequests || '',
          status: 'confirmed',
          totalAmount: roomData.price * calculateNights(params.checkInDate, params.checkOutDate),
          paymentStatus: 'pending',
          createdAt: serverTimestamp()
        });
        
        // Update room status
        await updateDoc(roomRef, {
          status: 'booked'
        });
        
        return { 
          success: true, 
          message: 'Room booked successfully', 
          bookingId: bookingRef.id,
          roomDetails: roomData
        };
      } catch (error) {
        console.error('Error booking room:', error);
        return { success: false, message: 'Failed to book room: ' + error.message };
      }
    }
  },
  {
    name: 'upgradeRoom',
    description: 'Upgrade a guest\'s room to a better category',
    parameters: {
      bookingId: 'ID of the current booking',
      newRoomId: 'ID of the room to upgrade to'
    },
    implementation: async (params) => {
      try {
        // Check if booking exists
        const bookingRef = doc(db, 'bookings', params.bookingId);
        const bookingSnapshot = await getDocs(bookingRef);
        
        if (!bookingSnapshot.exists()) {
          return { success: false, message: 'Booking not found' };
        }
        
        const bookingData = bookingSnapshot.data();
        
        // Check if new room exists and is available
        const newRoomRef = doc(db, 'rooms', params.newRoomId);
        const newRoomSnapshot = await getDocs(newRoomRef);
        
        if (!newRoomSnapshot.exists()) {
          return { success: false, message: 'New room not found' };
        }
        
        const newRoomData = newRoomSnapshot.data();
        if (newRoomData.status !== 'available') {
          return { success: false, message: 'New room is not available for upgrade' };
        }
        
        // Free up the old room
        const oldRoomRef = doc(db, 'rooms', bookingData.roomId);
        await updateDoc(oldRoomRef, {
          status: 'available'
        });
        
        // Update booking with new room
        await updateDoc(bookingRef, {
          roomId: params.newRoomId,
          roomName: newRoomData.name,
          roomType: newRoomData.type,
          totalAmount: newRoomData.price * calculateNights(bookingData.checkInDate, bookingData.checkOutDate),
          updatedAt: serverTimestamp()
        });
        
        // Update new room status
        await updateDoc(newRoomRef, {
          status: 'booked'
        });
        
        return { 
          success: true, 
          message: 'Room upgraded successfully', 
          oldRoom: bookingData.roomName,
          newRoom: newRoomData.name,
          priceDifference: newRoomData.price - bookingData.totalAmount / calculateNights(bookingData.checkInDate, bookingData.checkOutDate)
        };
      } catch (error) {
        console.error('Error upgrading room:', error);
        return { success: false, message: 'Failed to upgrade room: ' + error.message };
      }
    }
  },
  {
    name: 'getRoomAvailability',
    description: 'Get real-time availability of rooms',
    parameters: {
      roomType: 'Type of room (optional)',
      checkInDate: 'Check-in date in YYYY-MM-DD format (optional)',
      checkOutDate: 'Check-out date in YYYY-MM-DD format (optional)'
    },
    implementation: async (params) => {
      try {
        let roomQuery = query(collection(db, 'rooms'), where('status', '==', 'available'));
        
        // Add room type filter if provided
        if (params.roomType) {
          roomQuery = query(roomQuery, where('type', '==', params.roomType));
        }
        
        const roomSnapshot = await getDocs(roomQuery);
        const availableRooms = roomSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // If dates are provided, check for conflicts with existing bookings
        if (params.checkInDate && params.checkOutDate) {
          // This is a simplified version - in a real app, you would need more complex logic
          // to check for booking conflicts across the date range
          return {
            success: true,
            availableRooms,
            count: availableRooms.length,
            dateRange: `${params.checkInDate} to ${params.checkOutDate}`
          };
        }
        
        return {
          success: true,
          availableRooms,
          count: availableRooms.length
        };
      } catch (error) {
        console.error('Error getting room availability:', error);
        return { success: false, message: 'Failed to get room availability: ' + error.message };
      }
    }
  },
  {
    name: 'submitComplaint',
    description: 'Submit a complaint or feedback',
    parameters: {
      subject: 'Subject of the complaint',
      description: 'Detailed description of the complaint',
      category: 'Category of complaint (e.g., room, service, food)',
      priority: 'Priority level (low, medium, high)'
    },
    implementation: async (params) => {
      try {
        const complaintRef = await addDoc(collection(db, 'complaints'), {
          userId: auth.currentUser?.uid || 'guest',
          subject: params.subject,
          description: params.description,
          category: params.category,
          priority: params.priority || 'medium',
          status: 'pending',
          createdAt: serverTimestamp()
        });
        
        return { 
          success: true, 
          message: 'Complaint submitted successfully', 
          complaintId: complaintRef.id,
          estimatedResponseTime: params.priority === 'high' ? '24 hours' : '48 hours'
        };
      } catch (error) {
        console.error('Error submitting complaint:', error);
        return { success: false, message: 'Failed to submit complaint: ' + error.message };
      }
    }
  },
  {
    name: 'getBookingDetails',
    description: 'Get details of a specific booking',
    parameters: {
      bookingId: 'ID of the booking'
    },
    implementation: async (params) => {
      try {
        const bookingRef = doc(db, 'bookings', params.bookingId);
        const bookingSnapshot = await getDocs(bookingRef);
        
        if (!bookingSnapshot.exists()) {
          return { success: false, message: 'Booking not found' };
        }
        
        const bookingData = bookingSnapshot.data();
        
        return { 
          success: true, 
          booking: {
            id: bookingSnapshot.id,
            ...bookingData,
            createdAt: bookingData.createdAt?.toDate().toISOString() || null,
            updatedAt: bookingData.updatedAt?.toDate().toISOString() || null
          }
        };
      } catch (error) {
        console.error('Error getting booking details:', error);
        return { success: false, message: 'Failed to get booking details: ' + error.message };
      }
    }
  }
];

// Helper function to calculate number of nights between two dates
const calculateNights = (checkInDate, checkOutDate) => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const diffTime = Math.abs(checkOut - checkIn);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays || 1; // Minimum 1 night
};

// Function to execute a function by name with parameters
export const executeFunction = async (functionName, parameters) => {
  const functionDef = functionDefinitions.find(fn => fn.name === functionName);
  
  if (!functionDef) {
    return { success: false, message: `Function ${functionName} not found` };
  }
  
  try {
    return await functionDef.implementation(parameters);
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error);
    return { success: false, message: `Error executing function: ${error.message}` };
  }
};
