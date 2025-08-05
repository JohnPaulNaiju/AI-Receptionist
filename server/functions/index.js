const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const serviceAccount = require("./key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const genAI = new GoogleGenerativeAI('GEMINI_API_KEY');

// Main Cloud Function handler - Firestore Trigger using v2
exports.processReceptionTranscript = onDocumentCreated('reception/{docId}',async (event) => {
    const docId = event.params?.docId;
    functions.logger.info(`Processing reception document: ${docId}`, { docId });
    
    try {
      // Get the message data and document reference
      const snapshot = event.data;
      if (!snapshot) {
        functions.logger.error('No data associated with the event', { docId });
        return;
      }
      
      const messageData = snapshot.data();
      const { transcript, email, sessionId } = messageData;
      
      functions.logger.info(`Received message data`, { 
        docId, 
        hasTranscript: Boolean(transcript), 
        email: email || 'anonymous',
        sessionId: sessionId || 'none',
        role: messageData.role || 'unknown',
        processed: Boolean(messageData.processed)
      });
      
      // Skip if already processed or not a user message
      if (messageData.processed || messageData.role === 'assistant') {
        functions.logger.info('Message already processed or is an assistant message, skipping', { 
          docId, 
          processed: Boolean(messageData.processed), 
          role: messageData.role || 'unknown' 
        });
        return;
      }
      
      if (!transcript) {
        functions.logger.error('Missing transcript in message data', { docId });
        await snapshot.ref.update({
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          error: 'Missing transcript in message data'
        });
        return;
      }
      
      functions.logger.info(`Processing transcript: '${transcript.substring(0, 100)}${transcript.length > 100 ? '...' : ''}'`, {
        docId,
        transcriptLength: transcript.length,
        email: email || 'anonymous',
        sessionId: sessionId || 'none'
      });
      
      // Get current user if email is provided
      let currentUser = null;
      let currentUserId = null;
      
      if (email) {
        try {
          const userData = await getUserByEmail(email);
          if (userData && userData.userId) {
            currentUser = userData.user;
            currentUserId = userData.userId;
            functions.logger.info(`Found user for email`, { 
              docId, 
              email, 
              userId: currentUserId, 
              userName: currentUser?.name || 'unknown' 
            });
          } else {
            functions.logger.info(`No user found for email`, { docId, email });
          }
        } catch (userError) {
          functions.logger.error(`Error getting user by email`, { 
            docId, 
            email, 
            error: userError.message 
          });
          // Continue processing even if user lookup fails
        }
      }
      
      // Fetch hotel information for context
      let hotelInfo;
      try {
        hotelInfo = await fetchHotelInfo();
        functions.logger.info(`Hotel info fetched successfully`, { 
          docId, 
          roomCount: hotelInfo.rooms?.length || 0,
          amenitiesCount: hotelInfo.amenities?.length || 0
        });
      } catch (hotelError) {
        functions.logger.error(`Error fetching hotel info`, { 
          docId, 
          error: hotelError.message 
        });
        // Use default hotel info if fetch fails
        hotelInfo = { name: 'YB Hotels' };
      }
      
      // Get conversation history using sessionId if provided
      let history = [];
      if (sessionId) {
        try {
          history = await getSessionHistory(sessionId);
          functions.logger.info(`Retrieved conversation history`, { 
            docId, 
            sessionId, 
            messageCount: history.length 
          });
        } catch (historyError) {
          functions.logger.error(`Error retrieving conversation history`, { 
            docId, 
            sessionId, 
            error: historyError.message 
          });
          // Continue with empty history if retrieval fails
        }
      }
      
      // Generate response
      functions.logger.info(`Generating AI response`, { docId });
      const aiResponse = await generateResponse(transcript, email, hotelInfo, currentUser, currentUserId, history);
      functions.logger.info(`AI response generated successfully`, { 
        docId, 
        responseLength: aiResponse.text?.length || 0,
        hasFunctionCall: Boolean(aiResponse.functionCall)
      });
      
      // Update the original message with the AI response
      try {
        await snapshot.ref.update({
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          result: aiResponse.text,
          functionCall: aiResponse.functionCall || null,
          functionResponse: aiResponse.functionResponse || null
        });
        
        functions.logger.info(`Document updated with AI response`, { 
          docId, 
          responseLength: aiResponse.text?.length || 0,
          hasFunctionCall: Boolean(aiResponse.functionCall)
        });
      } catch (updateError) {
        functions.logger.error(`Error updating document with AI response`, { 
          docId, 
          error: updateError.message 
        });
        
        // Try one more time with just the essential fields
        try {
          await snapshot.ref.update({
            processed: true,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            result: aiResponse.text
          });
          functions.logger.info(`Document updated with minimal AI response after initial failure`, { docId });
        } catch (finalError) {
          functions.logger.error(`Failed to update document with AI response after retry`, { 
            docId, 
            error: finalError.message 
          });
        }
      }
      
      return;
    } catch (error) {
      functions.logger.error(`Error processing reception message`, { 
        docId, 
        error: error.message, 
        stack: error.stack 
      });
      
      // Update the message with error information
      try {
        await snapshot.ref.update({
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          error: error.message
        });
        functions.logger.info(`Message updated with error information`, { docId });
      } catch (updateError) {
        functions.logger.error(`Failed to update message with error status`, { 
          docId, 
          originalError: error.message,
          updateError: updateError.message 
        });
      }
    }
  }
);

// Helper function to get session history from reception collection
async function getSessionHistory(sessionId) {
  if (!sessionId) {
    functions.logger.warn('getSessionHistory called with empty sessionId');
    return [];
  }
  
  functions.logger.info(`Retrieving session history`, { sessionId });
  
  try {
    // First try with composite query (requires index)
    try {
      const historySnapshot = await db.collection('reception')
        .where('sessionId', '==', sessionId)
        .where('processed', '==', true)  // Only include processed messages
        .orderBy('timestamp', 'asc')
        .limit(10)  // Limit to recent messages to avoid context overflow
        .get();
        
      const messages = historySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          role: data.role,
          parts: [{ text: data.content }]
        };
      });
      
      functions.logger.info(`Retrieved ${messages.length} messages with composite query`, { sessionId });
      return messages;
    } catch (indexError) {
      // If index error, try fallback query without the processed filter
      if (indexError.code === 'failed-precondition') {
        functions.logger.warn('Missing index for composite query, using fallback query', { 
          sessionId,
          error: indexError.message
        });
        
        functions.logger.error('Missing index detected. Please create the following index in Firestore:', {
          collection: 'reception',
          fields: ['sessionId', 'processed', 'timestamp'],
          queryType: 'collection query with filters and orderBy'
        });
        
        // Fallback query without the processed filter
        const fallbackSnapshot = await db.collection('reception')
          .where('sessionId', '==', sessionId)
          .orderBy('timestamp', 'asc')
          .limit(20)  // Get more to filter client-side
          .get();
          
        // Filter processed messages client-side
        const messages = fallbackSnapshot.docs
          .filter(doc => doc.data().processed === true)
          .slice(0, 10) // Limit to 10 messages
          .map(doc => {
            const data = doc.data();
            return {
              role: data.role,
              parts: [{ text: data.content }]
            };
          });
        
        functions.logger.info(`Retrieved ${messages.length} messages with fallback query`, { sessionId });
        return messages;
      } else {
        // If not an index error, rethrow
        throw indexError;
      }
    }
  } catch (error) {
    functions.logger.error('Error getting session history:', { 
      error: error.message, 
      code: error.code,
      sessionId: sessionId,
      stack: error.stack
    });
    
    // Return empty array to continue processing
    return [];
  }
}

// ===== USER AND BOOKING FUNCTIONS =====

async function getUserByEmail(email) {
  try {
    console.log(`Looking up user by email: ${email}`);
    const usersRef = db.collection('users');
    let snapshot;
    
    try {
      snapshot = await usersRef.where('email', '==', email).limit(1).get();
    } catch (error) {
      console.error('Error querying user by email:', error);
      functions.logger.error('Error querying user by email. This may indicate a missing index:', { 
        error: error.message, 
        code: error.code,
        email: email,
        query: 'users collection with email'
      });
      
      if (error.code === 'failed-precondition') {
        functions.logger.error('Missing index detected. Please create the following index in Firestore:', {
          collection: 'users',
          fields: ['email'],
          queryType: 'collection query with filter'
        });
      }
      throw error;
    }

    if (snapshot.empty) {
      console.log(`No user found with email: ${email}`);
      return { user: null, userId: null };
    }

    const userDoc = snapshot.docs[0];
    console.log(`Found user with email: ${email}, userId: ${userDoc.id}`);
    return { user: userDoc.data(), userId: userDoc.id };
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
}

async function getUserBookings(userId) {
  try {
    console.log(`Getting bookings for userId: ${userId}`);
    if (!userId) {
      console.error('Cannot get bookings: Missing userId');
      return [];
    }
    
    const bookingsRef = db.collection('bookings');
    let snapshot;
    
    try {
      snapshot = await bookingsRef.where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    } catch (error) {
      console.error('Error querying bookings:', error);
      functions.logger.error('Error querying bookings. This may indicate a missing index:', { 
        error: error.message, 
        code: error.code,
        userId: userId,
        query: 'bookings collection with userId and orderBy createdAt'
      });

      if (error.code === 'failed-precondition') {
        functions.logger.error('Missing index detected. Please create the following index in Firestore:', {
          collection: 'bookings',
          fields: ['userId', 'createdAt'],
          queryType: 'collection query with filter and orderBy'
        });
      }
      throw error;
    }

    if (snapshot.empty) {
      console.log(`No bookings found for userId: ${userId}`);
      return [];
    }

    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log(`Found ${bookings.length} bookings for userId: ${userId}`);
    return bookings;
  } catch (error) {
    console.error('Error getting user bookings:', error);
    throw error;
  }
}

async function bookRoom(userId, roomId, checkInDate, checkOutDate, guestCount = 1) {
  try {
    console.log(`Booking room: userId=${userId}, roomId=${roomId}, checkIn=${checkInDate}, checkOut=${checkOutDate}, guestCount=${guestCount}`);
    
    if (!userId || !roomId || !checkInDate || !checkOutDate) {
      console.error('Booking failed: Missing required parameters', { userId, roomId, checkInDate, checkOutDate });
      return { success: false, result: "Missing required parameters for booking. Please provide all required information." };
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      console.error('Booking failed: Invalid date format', { checkInDate, checkOutDate });
      return { success: false, result: "Invalid date format. Please use YYYY-MM-DD format." };
    }

    if (checkIn >= checkOut) {
      console.error('Booking failed: Check-out date must be after check-in date', { checkInDate, checkOutDate });
      return { success: false, result: "Check-out date must be after check-in date." };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      console.error('Booking failed: Check-in date in the past', { checkInDate, today: today.toISOString() });
      return { success: false, result: "Check-in date cannot be in the past." };
    }

    console.log(`Checking if room exists: ${roomId}`);
    const roomDoc = await db.collection('rooms').doc(roomId).get();
    if (!roomDoc.exists) {
      console.error(`Booking failed: Room not found with ID: ${roomId}`);
      return { success: false, result: "Room not found." };
    }

    const room = roomDoc.data();
    console.log(`Room found: ${room.name}, price: ${room.price}`);

    const bookingsRef = db.collection('bookings');
    let conflictingBookings;

    try {
      console.log(`Checking for conflicting bookings for room: ${roomId}`);
      conflictingBookings = await bookingsRef
        .where('roomId', '==', roomId)
        .where('status', 'in', ['confirmed', 'pending', 'checked-in'])
        .get();
    } catch (error) {
      console.error('Error querying conflicting bookings:', error);
      functions.logger.error('Error querying conflicting bookings. This may indicate a missing index:', { 
        error: error.message, 
        code: error.code,
        roomId: roomId,
        query: 'bookings collection with roomId and status'
      });

      if (error.code === 'failed-precondition') {
        functions.logger.error('Missing index detected. Please create the following index in Firestore:', {
          collection: 'bookings',
          fields: ['roomId', 'status'],
          queryType: 'collection query with multiple filters'
        });
      }
      throw error;
    }

    console.log(`Found ${conflictingBookings.size} potentially conflicting bookings`);
    for (const booking of conflictingBookings.docs) {
      const bookingData = booking.data();
      const existingCheckIn = new Date(bookingData.checkInDate);
      const existingCheckOut = new Date(bookingData.checkOutDate);

      if ((checkIn < existingCheckOut && checkOut > existingCheckIn)) {
        console.error('Booking failed: Date conflict with existing booking', { 
          requestedDates: { checkIn: checkInDate, checkOut: checkOutDate },
          existingBooking: { id: booking.id, checkIn: bookingData.checkInDate, checkOut: bookingData.checkOutDate }
        });
        const existingCheckInFormatted = formatDateForSpeech(bookingData.checkInDate);
        const existingCheckOutFormatted = formatDateForSpeech(bookingData.checkOutDate);
        
        return { 
          success: false, 
          result: `Room is not available for the requested dates. It is already booked from ${existingCheckInFormatted} to ${existingCheckOutFormatted}.` 
        };
      }
    }

    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const totalPrice = room.price * nights;
    console.log(`Calculated price: ${totalPrice} for ${nights} nights`);

    const bookingData = {
      userId,
      roomId,
      roomName: room.name,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      guests: guests,
      status: 'confirmed',
      totalPrice,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    console.log('Creating booking in Firestore with data:', JSON.stringify(bookingData));
    const newBooking = await db.collection('bookings').add(bookingData);
    console.log(`Booking created successfully with ID: ${newBooking.id}`);
  
    const checkInFormatted = formatDateForSpeech(checkInDate);
    const checkOutFormatted = formatDateForSpeech(checkOutDate);
    
    return { 
      success: true, 
      result: `Room ${room.name} has been successfully booked from ${checkInFormatted} to ${checkOutFormatted} for ${guests} ${guests === 1 ? 'guest' : 'guests'}. Your booking ID is ${newBooking.id}.`,
      bookingId: newBooking.id
    };
  } catch (error) {
    console.error('Error booking room:', error);
    return { success: false, result: "An error occurred while booking the room. Please try again." };
  }
}

async function cancelBooking(bookingId, userId) {
  try {
    functions.logger.info(`Attempting to cancel booking:`, { bookingId, userId });
    
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
  
    if (!bookingDoc.exists) {
      functions.logger.warn(`Booking not found for cancellation:`, { bookingId });
      return { success: false, result: 'I could not find that booking. Please check the booking ID and try again.' };
    }

    const booking = bookingDoc.data();

    if (booking.userId !== userId) {
      functions.logger.warn(`User not authorized to cancel booking:`, { bookingId, userId, bookingUserId: booking.userId });
      return { success: false, result: 'You do not have permission to cancel this booking. Only the person who made the booking can cancel it.' };
    }

    if (booking.status === 'cancelled') {
      functions.logger.info(`Booking already cancelled:`, { bookingId });
      return { success: false, result: 'This booking has already been cancelled. No further action is needed.' };
    }

    const checkInDate = new Date(booking.checkInDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      functions.logger.warn(`Cannot cancel past booking:`, { bookingId, checkInDate: checkInDate.toISOString() });
      return { success: false, result: 'I cannot cancel a booking after the check-in date has passed. Please contact the front desk for assistance.' };
    }

    functions.logger.info(`Cancelling booking:`, { bookingId, roomName: booking.roomName });
    await db.collection('bookings').doc(bookingId).update({
      status: 'cancelled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const checkInFormatted = formatDateForSpeech(booking.checkInDate);
    const checkOutFormatted = formatDateForSpeech(booking.checkOutDate);
    
    return { 
      success: true, 
      result: `Your booking for ${booking.roomName} from ${checkInFormatted} to ${checkOutFormatted} has been successfully cancelled.`
    };
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return { success: false, result: 'An error occurred while cancelling the booking. Please try again.' };
  }
}

async function orderFood(userId, items) {
  try {
    functions.logger.info(`Attempting to order food:`, { userId, items });
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      functions.logger.warn(`Invalid food order - no items specified:`, { userId });
      return { success: false, result: 'Please specify at least one food item to order.' };
    }

    // For simplicity in this implementation, we'll accept simple string items
    // In a real implementation, you would validate against a menu collection
    const orderData = {
      userId,
      items: items,
      status: 'pending',
      orderedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    functions.logger.info(`Creating new food order:`, { userId, itemCount: items.length });
    const newOrder = await db.collection('orders').add(orderData);
    
    // Format the items list for better speech readability
    let itemsFormatted = '';
    if (items.length === 1) {
      itemsFormatted = items[0];
    } else if (items.length === 2) {
      itemsFormatted = `${items[0]} and ${items[1]}`;
    } else {
      const lastItem = items[items.length - 1];
      const otherItems = items.slice(0, items.length - 1).join(', ');
      itemsFormatted = `${otherItems}, and ${lastItem}`;
    }

    functions.logger.info(`Food order placed successfully:`, { orderId: newOrder.id });
    return { 
      success: true, 
      result: `Your food order with ${itemsFormatted} has been placed successfully. Your order ID is ${newOrder.id}.`,
      orderId: newOrder.id
    };
  } catch (error) {
    console.error('Error ordering food:', error);
    return { success: false, result: 'An error occurred while placing your food order. Please try again.' };
  }
}

async function processCheckInOut(userId, bookingId, action) {
  try {
    functions.logger.info(`Processing ${action}:`, { userId, bookingId, action });
    
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
  
    if (!bookingDoc.exists) {
      functions.logger.warn(`Booking not found for ${action}:`, { bookingId });
      return { success: false, result: 'I could not find that booking. Please check the booking ID and try again.' };
    }

    const booking = bookingDoc.data();

    if (booking.userId !== userId) {
      functions.logger.warn(`User not authorized for ${action}:`, { bookingId, userId, bookingUserId: booking.userId });
      return { success: false, result: 'You do not have permission to manage this booking. Only the person who made the booking can perform this action.' };
    }

    if (booking.status !== 'confirmed' && action === 'check-in') {
      functions.logger.warn(`Invalid booking status for check-in:`, { bookingId, status: booking.status });
      return { success: false, result: `I cannot check you in because your booking status is ${booking.status}. Only confirmed bookings can be checked in.` };
    }

    if (booking.status !== 'checked-in' && action === 'check-out') {
      functions.logger.warn(`Invalid booking status for check-out:`, { bookingId, status: booking.status });
      return { success: false, result: 'You need to check in before you can check out. Please check in first.' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(booking.checkInDate);
    const checkOutDate = new Date(booking.checkOutDate);

    if (action === 'check-in') {
      if (today < checkInDate) {
        return { success: false, result: `Check-in is only available from ${booking.checkInDate}.` };
      }
      await db.collection('bookings').doc(bookingId).update({
        status: 'checked-in',
        checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { 
        success: true, 
        result: `You have successfully checked in to ${booking.roomName}. Enjoy your stay!`
      };
    } else if (action === 'check-out') {
      await db.collection('bookings').doc(bookingId).update({
        status: 'completed',
        checkedOutAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
  
      return { 
        success: true, 
        result: `You have successfully checked out from ${booking.roomName}. Thank you for staying with us!`
      };
    } else {
      return { success: false, result: 'Invalid action. Please specify either check-in or check-out.' };
    }
  } catch (error) {
    console.error(`Error processing ${action}:`, error);
    return { success: false, result: `An error occurred while processing your ${action}. Please try again.` };
  }
}

async function fetchHotelInfo() {
  try {
    const hotelDoc = await db.collection('hotel').doc('info').get();
    const hotelInfo = hotelDoc.exists ? hotelDoc.data() : { name: 'YB Hotels' };

    const roomsSnapshot = await db.collection('rooms').get();
    const rooms = roomsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const amenitiesSnapshot = await db.collection('amenities').get();
    const amenities = amenitiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const servicesSnapshot = await db.collection('services').get();
    const services = servicesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const foodSnapshot = await db.collection('foods').get();
    const foodMenu = foodSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      ...hotelInfo,
      rooms,
      amenities,
      services,
      foodMenu
    };
  } catch (error) {
    console.error('Error fetching hotel info:', error);
    return { name: 'YB Hotels' };
  }
}

// ===== HELPER FUNCTIONS =====

// Format date for natural speech (e.g., '25 March 2025')
function formatDateForSpeech(dateString) {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original if invalid
    }
    
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original on error
  }
}

// ===== AI RESPONSE GENERATION =====

async function generateResponse(transcript, email, hotelInfo, currentUser, currentUserId, history = []) {
  try {
    console.log(`Generating response for transcript: '${transcript}'`);
    
    // Direct pattern matching for common requests
    if (currentUserId) {
      // Check for VIEW BOOKINGS intent
      if (transcript.toLowerCase().includes('my bookings') || 
          transcript.toLowerCase().includes('show me my bookings') || 
          transcript.toLowerCase().includes('view my bookings') || 
          transcript.toLowerCase().includes('see my bookings')) {
        
        console.log('Direct request to view bookings detected - bypassing Gemini');
        const bookings = await getUserBookings(currentUserId);
        let bookingsText = '';
        
        if (bookings.length === 0) {
          bookingsText = 'You don\'t have any bookings at the moment.';
        } else {
          bookingsText = `You have ${bookings.length} booking${bookings.length === 1 ? '' : 's'}. `;
          bookings.forEach((booking, index) => {
            const checkInFormatted = formatDateForSpeech(booking.checkInDate);
            const checkOutFormatted = formatDateForSpeech(booking.checkOutDate);
            
            bookingsText += `${index + 1}. ${booking.roomName} from ${checkInFormatted} to ${checkOutFormatted}. Status is ${booking.status}. `;
          });
        }
        
        return {
          text: bookingsText,
          user: currentUser,
          userId: currentUserId,
          functionCall: {
            name: 'get_user_bookings',
            args: { user_id: currentUserId }
          },
          functionResponse: { success: true, bookings }
        };
      }
      
      // Check for BOOK ROOM intent
      if ((transcript.toLowerCase().includes('book a room') || 
          transcript.toLowerCase().includes('reserve a room') || 
          transcript.toLowerCase().includes('i need a room') || 
          transcript.toLowerCase().includes('get me a room')) && 
          !transcript.toLowerCase().includes('my bookings')) {
        
        console.log('Direct request to book a room detected - bypassing Gemini');
        
        // Extract room information from transcript if possible
        let roomId = null;
        let checkInDate = null;
        let checkOutDate = null;
        let guests = 1;
        
        // Try to find room information in the transcript
        for (const room of hotelInfo.rooms || []) {
          if (transcript.toLowerCase().includes(room.name.toLowerCase())) {
            roomId = room.id;
            console.log(`Found room in transcript: ${room.name}, ID: ${roomId}`);
            break;
          }
        }
        
        // If no specific room was mentioned, use the first available room
        if (!roomId && hotelInfo.rooms && hotelInfo.rooms.length > 0) {
          roomId = hotelInfo.rooms[0].id;
          console.log(`No specific room found in transcript, using first room: ${hotelInfo.rooms[0].name}, ID: ${roomId}`);
        }
        
        // Try to extract dates from transcript
        const dateRegex = /(\d{4}-\d{2}-\d{2})/g;
        const dates = transcript.match(dateRegex);
        
        if (dates && dates.length >= 2) {
          checkInDate = dates[0];
          checkOutDate = dates[1];
          console.log(`Found dates in transcript: checkIn=${checkInDate}, checkOut=${checkOutDate}`);
        } else {
          // Default to dates starting tomorrow for 2 days
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dayAfterTomorrow = new Date(tomorrow);
          dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
          
          checkInDate = tomorrow.toISOString().split('T')[0];
          checkOutDate = dayAfterTomorrow.toISOString().split('T')[0];
          console.log(`No dates found in transcript, using default: checkIn=${checkInDate}, checkOut=${checkOutDate}`);
        }
        
        // Try to extract number of guests
        const guestsRegex = /(\d+)\s+guests?/i;
        const guestsMatch = transcript.match(guestsRegex);
        if (guestsMatch && guestsMatch[1]) {
          guests = parseInt(guestsMatch[1], 10);
          console.log(`Found guests in transcript: ${guests}`);
        }
        
        // Check if we're missing any required information
        const missingInfo = [];
        if (!roomId) missingInfo.push('room number');
        if (!checkInDate) missingInfo.push('check-in date');
        if (!checkOutDate) missingInfo.push('check-out date');
        
        if (roomId && checkInDate && checkOutDate) {
          functions.logger.info(`Directly calling bookRoom with:`, { userId: currentUserId, roomId, checkInDate, checkOutDate, guestCount: guests });
          const bookingResult = await bookRoom(currentUserId, roomId, checkInDate, checkOutDate, guests);
          
          const checkInFormatted = formatDateForSpeech(checkInDate);
          const checkOutFormatted = formatDateForSpeech(checkOutDate);
          
          return {
            text: bookingResult.success 
              ? `I've booked the room for you from ${checkInFormatted} to ${checkOutFormatted} for ${guests} ${guests === 1 ? 'guest' : 'guests'}. Your booking ID is ${bookingResult.bookingId}.` 
              : `I couldn't book the room. ${bookingResult.result}`,
            user: currentUser,
            userId: currentUserId,
            functionCall: {
              name: 'book_room',
              args: { user_id: currentUserId, room_id: roomId, check_in_date: checkInDate, check_out_date: checkOutDate, guestCount: guests }
            },
            functionResponse: bookingResult
          };
        } else {
          // If we're missing information, ask follow-up questions
          let promptText = '';
          if (missingInfo.length > 0) {
            if (missingInfo.length === 3) {
              // Ask for all information if everything is missing
              promptText = `I'd be happy to help you book a room. Please provide the following details:
1. Which room would you like to book?
2. What is your check-in date? (YYYY-MM-DD format)
3. What is your check-out date? (YYYY-MM-DD format)
4. How many guests will be staying?`;
            } else {
              // Ask only for the missing information
              promptText = `To complete your booking, I need the following information: ${missingInfo.join(', ')}. `;
              
              if (!roomId) {
                promptText += 'Which room would you like to book? ';
              }
              
              if (!checkInDate) {
                promptText += 'What is your check-in date (YYYY-MM-DD format)? ';
              }
              
              if (!checkOutDate) {
                promptText += 'What is your check-out date (YYYY-MM-DD format)? ';
              }
            }
          }
          
          return {
            text: promptText,
            user: currentUser,
            userId: currentUserId
          };
        }
      }
      
      // Check for CANCEL BOOKING intent
      if (transcript.toLowerCase().includes('cancel booking') || 
          transcript.toLowerCase().includes('cancel my booking') || 
          transcript.toLowerCase().includes('cancel reservation') || 
          transcript.toLowerCase().includes('cancel my reservation')) {
        
        console.log('Direct request to cancel booking detected - bypassing Gemini');
        
        // Try to extract booking ID from transcript
        let bookingId = null;
        
        // Try to find booking ID in the transcript
        const bookingIdRegex = /booking\s+(?:id\s+)?([a-zA-Z0-9]+)|(?:id|number)\s+([a-zA-Z0-9]+)/i;
        const bookingMatch = transcript.match(bookingIdRegex);
        if (bookingMatch && (bookingMatch[1] || bookingMatch[2])) {
          bookingId = bookingMatch[1] || bookingMatch[2];
          console.log(`Found booking ID in transcript: ${bookingId}`);
        } else {
          // If no booking ID provided, get the user's bookings and cancel the most recent one
          const bookings = await getUserBookings(currentUserId);
          if (bookings.length > 0) {
            // Sort by check-in date to get the most recent booking
            bookings.sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate));
            bookingId = bookings[0].id;
            console.log(`No booking ID found in transcript, using most recent booking: ${bookingId}`);
          }
        }
        
        if (bookingId) {
          console.log(`Directly calling cancelBooking with: userId=${currentUserId}, bookingId=${bookingId}`);
          const cancelResult = await cancelBooking(bookingId, currentUserId);
          
          return {
            text: cancelResult.success 
              ? `I've canceled your booking with ID ${bookingId}. ${cancelResult.result}` 
              : `I couldn't cancel the booking. ${cancelResult.result}`,
            user: currentUser,
            userId: currentUserId,
            functionCall: {
              name: 'cancel_booking',
              args: { user_id: currentUserId, booking_id: bookingId }
            },
            functionResponse: cancelResult
          };
        } else {
          return {
            text: `I couldn't find any bookings to cancel. Please provide a booking ID or make sure you have an active booking.`,
            user: currentUser,
            userId: currentUserId
          };
        }
      }
      
      // Check for FOOD ORDER intent
      if (transcript.toLowerCase().includes('order food') || 
          transcript.toLowerCase().includes('room service') || 
          transcript.toLowerCase().includes('i\'m hungry') || 
          transcript.toLowerCase().includes('food delivery')) {
        
        console.log('Direct request for food detected - bypassing Gemini');
        
        // Extract food information from transcript if possible
        let foodItems = [];
        
        // Try to find food items in the transcript
        const foodKeywords = ['pizza', 'burger', 'sandwich', 'salad', 'pasta', 'breakfast', 'lunch', 'dinner', 'meal'];
        for (const keyword of foodKeywords) {
          if (transcript.toLowerCase().includes(keyword)) {
            foodItems.push(keyword);
          }
        }
        
        // If no specific food was mentioned, use a default
        if (foodItems.length === 0) {
          foodItems = ['room service meal'];
        }
        
        console.log(`Directly calling orderFood with: userId=${currentUserId}, items=${foodItems.join(', ')}`);
        const orderResult = await orderFood(currentUserId, foodItems);
        
        return {
          text: orderResult.success 
            ? `I've placed your order for ${foodItems.join(', ')}. ${orderResult.result}` 
            : `I couldn't place your food order: ${orderResult.result}`,
          user: currentUser,
          userId: currentUserId,
          functionCall: {
            name: 'order_food',
            args: { user_id: currentUserId, items: foodItems }
          },
          functionResponse: orderResult
        };
      }
      
      // Check for CHECK-IN/OUT intent
      if (transcript.toLowerCase().includes('check in') || 
          transcript.toLowerCase().includes('checking in') || 
          transcript.toLowerCase().includes('check out') || 
          transcript.toLowerCase().includes('checking out')) {
        
        console.log('Direct request for check-in/out detected - bypassing Gemini');
        
        // Determine if it's check-in or check-out
        const isCheckIn = transcript.toLowerCase().includes('check in') || transcript.toLowerCase().includes('checking in');
        const action = isCheckIn ? 'check-in' : 'check-out';
        
        // Try to extract booking ID from transcript
        let bookingId = null;
        
        // Try to find booking ID in the transcript
        const bookingIdRegex = /booking\s+(?:id\s+)?([a-zA-Z0-9]+)|(?:id|number)\s+([a-zA-Z0-9]+)/i;
        const bookingMatch = transcript.match(bookingIdRegex);
        if (bookingMatch && (bookingMatch[1] || bookingMatch[2])) {
          bookingId = bookingMatch[1] || bookingMatch[2];
          console.log(`Found booking ID in transcript: ${bookingId}`);
        } else {
          // If no booking ID provided, get the user's bookings and use the most relevant one
          const bookings = await getUserBookings(currentUserId);
          if (bookings.length > 0) {
            if (isCheckIn) {
              // For check-in, find the booking with the closest check-in date
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              const eligibleBookings = bookings.filter(b => 
                b.status === 'confirmed' && new Date(b.checkInDate) <= today
              );
              
              if (eligibleBookings.length > 0) {
                // Sort by check-in date (closest first)
                eligibleBookings.sort((a, b) => 
                  Math.abs(new Date(a.checkInDate) - today) - Math.abs(new Date(b.checkInDate) - today)
                );
                bookingId = eligibleBookings[0].id;
              }
            } else {
              // For check-out, find a checked-in booking
              const checkedInBooking = bookings.find(b => b.status === 'checked-in');
              if (checkedInBooking) {
                bookingId = checkedInBooking.id;
              }
            }
            
            if (bookingId) {
              console.log(`No booking ID found in transcript, using most relevant booking: ${bookingId}`);
            }
          }
        }
        
        if (bookingId) {
          console.log(`Directly calling processCheckInOut with: userId=${currentUserId}, bookingId=${bookingId}, action=${action}`);
          const processResult = await processCheckInOut(currentUserId, bookingId, action);
          
          return {
            text: processResult.success 
              ? processResult.result 
              : `I couldn't process your ${action}: ${processResult.result}`,
            user: currentUser,
            userId: currentUserId,
            functionCall: {
              name: 'process_check_in_out',
              args: { user_id: currentUserId, booking_id: bookingId, action }
            },
            functionResponse: processResult
          };
        } else {
          return {
            text: `I couldn't find a booking to ${action}. Please provide a booking ID or make sure you have an active booking.`,
            user: currentUser,
            userId: currentUserId
          };
        }
      }
    }
    
    // If no direct pattern matched or user is not logged in, use Gemini with function calling
    
    // Prepare context for Gemini
    let context = '';
    
    if (currentUser) {
      context = `
        You are 'Laura', an AI receptionist for YB Hotels. Be helpful, friendly, and concise.
        
        You are speaking with ${currentUser.name || 'a guest'} (email: ${email}).
        
        Here is information about our hotel that you can use to answer questions:
        
        Rooms: ${JSON.stringify(hotelInfo.rooms || [])}
        Amenities: ${JSON.stringify(hotelInfo.amenities || [])}
        Services: ${JSON.stringify(hotelInfo.services || [])}
        Food Menu: ${JSON.stringify(hotelInfo.foodMenu || [])}
      `;
    } else {
      context = `
        You are 'Laura', an AI receptionist for YB Hotels. Be helpful, friendly, and concise.
        
        You are speaking with a guest (email: ${email}).
        
        Here is information about our hotel that you can use to answer questions:
        
        Rooms: ${JSON.stringify(hotelInfo.rooms || [])}
        Amenities: ${JSON.stringify(hotelInfo.amenities || [])}
        Services: ${JSON.stringify(hotelInfo.services || [])}
        Food Menu: ${JSON.stringify(hotelInfo.foodMenu || [])}
      `;
    }
    
    // Define function declarations for Gemini
    const functionDeclarations = [
      {
        name: 'get_user_bookings',
        description: 'Get bookings for a user',
        parameters: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'ID of the user'
            }
          },
          required: ['user_id']
        }
      },
      {
        name: 'book_room',
        description: 'Book a room for a user',
        parameters: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'ID of the user'
            },
            room_id: {
              type: 'string',
              description: 'ID of the room to book'
            },
            check_in_date: {
              type: 'string',
              description: 'Check-in date in YYYY-MM-DD format'
            },
            check_out_date: {
              type: 'string',
              description: 'Check-out date in YYYY-MM-DD format'
            },
            guests: {
              type: 'number',
              description: 'Number of guests'
            }
          },
          required: ['user_id', 'room_id', 'check_in_date', 'check_out_date']
        }
      },
      {
        name: 'cancel_booking',
        description: 'Cancel a booking',
        parameters: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'ID of the user'
            },
            booking_id: {
              type: 'string',
              description: 'ID of the booking to cancel'
            }
          },
          required: ['user_id', 'booking_id']
        }
      },
      {
        name: 'process_check_in_out',
        description: 'Process check-in or check-out for a booking',
        parameters: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'ID of the user'
            },
            booking_id: {
              type: 'string',
              description: 'ID of the booking'
            },
            action: {
              type: 'string',
              description: 'Action to perform: check-in or check-out',
              enum: ['check-in', 'check-out']
            }
          },
          required: ['user_id', 'booking_id', 'action']
        }
      },
      {
        name: 'order_food',
        description: 'Order food items',
        parameters: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'ID of the user'
            },
            items: {
              type: 'array',
              description: 'List of food items to order',
              items: {
                type: 'string'
              }
            }
          },
          required: ['user_id', 'items']
        }
      }
    ];
    
    // Initialize Gemini model
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 2048,
      },
    });
    
    // Start chat with history
    const chat = model.startChat({
      history: history,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 2048,
      }
    });
    
    // Configure function calling
    const toolConfig = {
      functionDeclarations: functionDeclarations
    };
    
    // Add explicit instructions for function calling
    const userMessage = `${context}

IMPORTANT INSTRUCTIONS:
1. If the user is asking to book a room, you MUST use the book_room function.
2. If the user is asking to check their bookings, you MUST use the get_user_bookings function.
3. If the user is asking to cancel a booking, you MUST use the cancel_booking function.
4. If the user is asking to check in or out, you MUST use the process_check_in_out function.
5. If the user is asking to order food, you MUST use the order_food function.
6. NEVER respond as if you've completed an action without calling the appropriate function.

User query: ${transcript}`;
    
    console.log('Sending message to Gemini with function calling instructions');
    const geminiResult = await chat.sendMessage(userMessage, toolConfig);
    const response = geminiResult.response;
    
    // Check if Gemini called a function
    const functionCall = response.functionCalls?.[0];
    let functionResponse = null;
    
    if (functionCall) {
      const functionName = functionCall.name;
      const functionArgs = functionCall.args;
      
      console.log(`Function call detected: ${functionName}`, functionArgs);
      
      if (functionName === 'get_user_bookings') {
        const userId = functionArgs.user_id;
        if (!userId) {
          console.error('Missing userId for get_user_bookings function call');
          functionResponse = { success: false, error: 'Missing userId', bookings: [] };
        } else {
          console.log(`Getting bookings for userId: ${userId}`);
          const bookings = await getUserBookings(userId);
          functionResponse = { success: true, bookings };
        }
      } else if (functionName === 'book_room') {
        const userId = functionArgs.user_id;
        const roomId = functionArgs.room_id;
        const checkInDate = functionArgs.check_in_date;
        const checkOutDate = functionArgs.check_out_date;
        const guestCount = functionArgs.guestCount || 1;
        
        functions.logger.info(`Booking room with params:`, { userId, roomId, checkInDate, checkOutDate, guestCount });
        
        // Validate required parameters before calling bookRoom
        if (!userId || !roomId || !checkInDate || !checkOutDate) {
          functions.logger.error('Missing required parameters for booking', { userId, roomId, checkInDate, checkOutDate });
          functionResponse = { 
            success: false, 
            result: "Missing required parameters for booking. Please provide user ID, room ID, check-in date, and check-out date." 
          };
        } else {
          const result = await bookRoom(userId, roomId, checkInDate, checkOutDate, guestCount);
          functionResponse = result;
        }
      } else if (functionName === 'cancel_booking') {
        const bookingId = functionArgs.booking_id;
        const userId = functionArgs.user_id;
        
        functions.logger.info(`Cancelling booking:`, { bookingId, userId });
        
        if (!bookingId || !userId) {
          functions.logger.error('Missing required parameters for cancelling booking', { bookingId, userId });
          functionResponse = { 
            success: false, 
            result: "Missing required parameters for cancelling booking. Please provide booking ID and user ID." 
          };
        } else {
          const result = await cancelBooking(bookingId, userId);
          functionResponse = result;
        }
      } else if (functionName === 'process_check_in_out') {
        const bookingId = functionArgs.booking_id;
        const userId = functionArgs.user_id;
        const action = functionArgs.action;
        
        functions.logger.info(`Processing check-in/out:`, { action, bookingId, userId });
        
        if (!bookingId || !userId || !action) {
          functions.logger.error('Missing required parameters for check-in/out', { bookingId, userId, action });
          functionResponse = { 
            success: false, 
            result: "Missing required parameters for check-in/out. Please provide booking ID, user ID, and action." 
          };
        } else {
          const result = await processCheckInOut(userId, bookingId, action);
          functionResponse = result;
        }
      } else if (functionName === 'order_food') {
        const userId = functionArgs.user_id;
        const items = functionArgs.items;
        
        functions.logger.info(`Ordering food:`, { userId, items });
        
        if (!userId || !items || !Array.isArray(items) || items.length === 0) {
          functions.logger.error('Missing or invalid parameters for food order', { userId, items });
          functionResponse = { 
            success: false, 
            result: "Missing or invalid parameters for food order. Please provide user ID and at least one food item." 
          };
        } else {
          const result = await orderFood(userId, items);
          functionResponse = result;
        }
      } else {
        console.error(`Unknown function called: ${functionName}`);
        functionResponse = { success: false, error: `Unknown function: ${functionName}` };
      }
      
      // Send function response back to Gemini for final response
      if (functionResponse) {
        console.log('Sending function response to Gemini:', functionResponse);
        const functionResponseResult = await chat.sendMessage(JSON.stringify(functionResponse));
        return {
          text: functionResponseResult.response.text(),
          user: currentUser,
          userId: currentUserId,
          functionCall: {
            name: functionName,
            args: functionArgs
          },
          functionResponse
        };
      }
    }
    
    // If no function was called, return the text response
    return {
      text: response.text(),
      user: currentUser,
      userId: currentUserId
    };
  } catch (error) {
    console.error('Error generating response:', error);
    return {
      text: "I'm sorry, I encountered an error processing your request. Please try again.",
      error: error.message
    };
  }
}
