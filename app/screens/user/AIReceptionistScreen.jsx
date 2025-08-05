import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, ActivityIndicator, TextInput, FlatList, RefreshControl } from 'react-native';
import { View, Text, Colors, Button } from 'react-native-ui-lib';
import { collection, query, where, getDocs, orderBy, limit, addDoc, updateDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../utils';
import { Icon } from '../../components';
import { retrieveRelevantDocuments, executeFunction, functionDefinitions } from '../../utils/ragUtils';

// Get API keys from environment variables
import Constants from 'expo-constants';

// Access API keys from environment variables with fallback to placeholders
const GEMINI_API_KEY = Constants.expoConfig?.extra?.GEMINI_API_KEY;

const AIReceptionistScreen = () => {

    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [hotelInfo, setHotelInfo] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const scrollViewRef = useRef();

  // Set up auth state listener to track user login status
  useEffect(() => {
    fetchHotelInfo();
  }, []);
  
  // Handle pull-to-refresh
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchHotelInfo();
      // Add a welcome message when refreshing
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: Date.now().toString(),
          text: 'I\'ve refreshed my information. How may I assist you?',
          sender: 'ai'
        }
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);
  
  // Fetch hotel information from Firebase to provide context to the AI
  useEffect(() => {
    fetchHotelInfo();
  }, []);
  
  const fetchHotelInfo = async () => {
      try {
        // Fetch ALL rooms (both available and booked) for complete knowledge
        const allRoomsSnapshot = await getDocs(collection(db, 'rooms'));
        const allRooms = allRoomsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Filter available rooms from all rooms
        const availableRooms = allRooms.filter(room => room.status === 'available');
        
        // Fetch ALL bookings for complete knowledge
        const allBookingsSnapshot = await getDocs(collection(db, 'bookings'));
        const allBookings = allBookingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Fetch user's specific bookings if logged in
        let userBookings = [];
        if (auth.currentUser) {
          userBookings = allBookings.filter(booking => booking.userId === auth.currentUser.uid);
        }
        
        // Fetch complaints for comprehensive knowledge
        const complaintsSnapshot = await getDocs(collection(db, 'complaints'));
        const complaints = complaintsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Fetch all users for complete knowledge
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Calculate room statistics
        const totalRooms = allRooms.length;
        const occupancyRate = totalRooms > 0 ? ((totalRooms - availableRooms.length) / totalRooms * 100).toFixed(1) : 0;
        const roomTypes = [...new Set(allRooms.map(room => room.type))];
        const priceRange = allRooms.length > 0 ? 
          `${Math.min(...allRooms.map(r => r.price))} - ${Math.max(...allRooms.map(r => r.price))}` : 'N/A';
        
        // Set comprehensive hotel information
        setHotelInfo({
          // Room information
          allRooms,
          availableRooms,
          totalRooms,
          occupancyRate,
          roomTypes,
          priceRange,
          
          // Booking information
          allBookings,
          userBookings,
          activeBookingsCount: allBookings.filter(b => b.status === 'active').length,
          
          // User information
          totalUsers: users.length,
          currentUser: auth.currentUser ? {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName || 'Guest',
            phoneNumber: auth.currentUser.phoneNumber || '',
            // Get additional user details from the users collection if available
            ...users.find(u => u.id === auth.currentUser.uid)
          } : null,
          
          // Complaint information
          complaints,
          pendingComplaints: complaints.filter(c => c.status === 'pending').length,
          
          // Hotel information
          hotelName: 'YB Hotels',
          hotelAddress: '123 Main Street, City, Country',
          hotelPhone: '+1234567890',
          hotelEmail: 'info@ybhotels.com',
          website: 'www.ybhotels.com',
          checkInTime: '2:00 PM',
          checkOutTime: '12:00 PM',
          amenities: [
            'WiFi', 'Swimming Pool', 'Gym', 'Restaurant', 'Spa', 
            'Conference Rooms', 'Parking', 'Room Service', 'Laundry', 
            'Airport Shuttle', 'Business Center', 'Concierge Service'
          ],
          policies: {
            cancellation: 'Free cancellation up to 24 hours before check-in',
            pets: 'Pets allowed with additional fee',
            smoking: 'Non-smoking rooms available',
            payment: 'We accept all major credit cards, cash, and mobile payments'
          },
          nearbyAttractions: [
            'City Center (1.5 km)', 'Beach (0.5 km)', 'Shopping Mall (2 km)',
            'Museum (3 km)', 'Airport (15 km)'
          ]
        });

        // Add initial welcome message with more comprehensive knowledge
        setMessages([
          {
            id: Date.now().toString(),
            text: 'Welcome to YB Hotels! I am your AI receptionist with complete access to all hotel information. I can assist with room bookings, amenities, services, and any other inquiries. How may I help you today?',
            sender: 'ai'
          }
        ]);


      } catch (error) {
        console.error('Error fetching hotel info:', error);
        // Even if there's an error, provide some basic information
        setHotelInfo({
          availableRooms: [],
          userBookings: [],
          hotelName: 'YB Hotels',
          checkInTime: '2:00 PM',
          checkOutTime: '12:00 PM',
          amenities: ['WiFi', 'Swimming Pool', 'Gym', 'Restaurant', 'Spa']
        });
        
        setMessages([
          {
            id: Date.now().toString(),
            text: 'Welcome to YB Hotels! I am your AI receptionist. How may I assist you today?',
            sender: 'ai'
          }
        ]);
        

      }
    };

  // Function to query Gemini AI with RAG and function calling capabilities
  const queryGeminiAI = async (userQuery) => {
    try {
      setLoading(true);
      
      // Add user message immediately for better UX
      const userMessage = {
        id: Date.now().toString(),
        text: userQuery,
        sender: 'user'
      };
      setMessages(prevMessages => [...prevMessages, userMessage]);
      
      // Prepare comprehensive context from Firebase data
      const hotelContext = {
        // Basic hotel information
        hotelName: 'YB Hotels',
        hotelAddress: hotelInfo?.hotelAddress || '123 Main Street, City, Country',
        hotelPhone: hotelInfo?.hotelPhone || '+1234567890',
        hotelEmail: hotelInfo?.hotelEmail || 'info@ybhotels.com',
        website: hotelInfo?.website || 'www.ybhotels.com',
        
        // Current user information
        currentUser: hotelInfo?.currentUser || null,
        isLoggedIn: !!hotelInfo?.currentUser,
        
        // Room information
        totalRooms: hotelInfo?.totalRooms || 0,
        availableRooms: hotelInfo?.availableRooms?.length || 0,
        occupancyRate: hotelInfo?.occupancyRate || '0',
        roomTypes: hotelInfo?.roomTypes || [],
        priceRange: hotelInfo?.priceRange || 'N/A',
        
        // Detailed room information (for specific room inquiries)
        roomDetails: hotelInfo?.availableRooms?.map(room => ({
          id: room.id,
          name: room.name,
          type: room.type,
          price: room.price,
          capacity: room.capacity,
          amenities: room.amenities,
          description: room.description
        })) || [],
        
        // Booking information
        activeBookingsCount: hotelInfo?.activeBookingsCount || 0,
        totalUsers: hotelInfo?.totalUsers || 0,
        pendingComplaints: hotelInfo?.pendingComplaints || 0,
        
        // User-specific bookings
        userBookings: hotelInfo?.userBookings?.map(booking => ({
          id: booking.id,
          roomName: booking.roomName,
          roomType: booking.roomType,
          checkIn: new Date(booking.checkInDate).toLocaleDateString(),
          checkOut: new Date(booking.checkOutDate).toLocaleDateString(),
          status: booking.status,
          totalAmount: booking.totalAmount,
          paymentStatus: booking.paymentStatus
        })) || [],
        
        // Hotel services and amenities
        checkInTime: hotelInfo?.checkInTime || '2:00 PM',
        checkOutTime: hotelInfo?.checkOutTime || '12:00 PM',
        amenities: hotelInfo?.amenities || [],
        
        // Hotel policies
        policies: hotelInfo?.policies || {
          cancellation: 'Free cancellation up to 24 hours before check-in',
          pets: 'Pets allowed with additional fee',
          smoking: 'Non-smoking rooms available',
          payment: 'We accept all major credit cards, cash, and mobile payments'
        },
        
        // Location information
        nearbyAttractions: hotelInfo?.nearbyAttractions || [],
        
        // Special offers and packages (if available)
        specialOffers: [
          'Weekend Getaway: 20% off for weekend stays',
          'Extended Stay: 15% off for bookings of 5+ nights',
          'Early Bird: 10% off when booking 30 days in advance',
          'Honeymoon Package: Includes champagne and spa treatment'
        ]
      };
      
      // Step 1: Retrieve relevant documents using RAG
      console.log('Retrieving relevant documents for query:', userQuery);
      let relevantDocs = [];
      try {
        relevantDocs = await retrieveRelevantDocuments(userQuery);
        console.log('Retrieved relevant documents:', relevantDocs.length);
      } catch (ragError) {
        console.error('Error retrieving documents:', ragError);
        // Continue even if RAG fails
      }
      
      // Add retrieved documents to hotel context
      hotelContext.retrievedDocuments = relevantDocs.map(doc => ({
        id: doc.id,
        collection: doc.collection,
        data: doc.data,
        relevanceScore: doc.similarity
      }));
      
      // Real Gemini API call
      try {
        // Dynamic import for client-side only
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        // Use Gemini 2.0 Flash model with specific configuration
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-2.0-flash',
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 2048,
          }
        });
        
        // Prepare function definitions for the AI
            const functionDefinitionsForAI = [
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
                    }
                },
                {
                    name: 'upgradeRoom',
                    description: 'Upgrade a guest\'s room to a better category',
                    parameters: {
                    bookingId: 'ID of the current booking',
                    newRoomId: 'ID of the room to upgrade to'
                    }
                },
                {
                    name: 'getRoomAvailability',
                    description: 'Get real-time availability of rooms',
                    parameters: {
                    roomType: 'Type of room (optional)',
                    checkInDate: 'Check-in date in YYYY-MM-DD format (optional)',
                    checkOutDate: 'Check-out date in YYYY-MM-DD format (optional)'
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
                    }
                },
                {
                    name: 'getBookingDetails',
                    description: 'Get details of a specific booking',
                    parameters: {
                    bookingId: 'ID of the booking'
                    }
                }
            ];
        
        // Create a system prompt that instructs the AI on its role with function calling and RAG
            // Build system prompt parts to avoid template string issues
            const introSection = 'Your name is Laura and you are an AI receptionist for YB Hotels, a luxury hotel chain. \n\n' +
                'ROLE: You are the ONLY receptionist for the hotel with COMPLETE ACCESS to ALL hotel database information. Your job is to assist guests with ANY information about our hotel services, room availability, bookings, amenities, and handle ALL inquiries without ever referring guests to human staff.\n\n' +
                'STYLE: Always be polite, professional, friendly, and helpful. Use a warm, welcoming tone.\n\n' +
                'RESPONSE FORMAT: Keep responses concise (under 100 words) and focused on hotel-related information.\n\n';
            
            // Current user information section
            let userInfoSection = 'CURRENT USER INFORMATION: ';
            if (hotelContext.currentUser) {
                userInfoSection += '\n- Name: ' + hotelContext.currentUser.displayName + 
                    '\n- Email: ' + hotelContext.currentUser.email + 
                    '\n- Phone: ' + (hotelContext.currentUser.phoneNumber || 'Not provided') + 
                    '\n- User ID: ' + hotelContext.currentUser.uid + '\n';
            } else {
                userInfoSection += 'User is not logged in';
            }
            userInfoSection += '\n\n';
            
            // Hotel database information section
            const hotelInfoSection = 'COMPREHENSIVE HOTEL DATABASE INFORMATION:\n' +
                '- Hotel Name: ' + hotelContext.hotelName + '\n' +
                '- Total Rooms: ' + (hotelContext.totalRooms || 'Multiple') + '\n' +
                '- Available Rooms: ' + hotelContext.availableRooms + '\n' +
                '- Current Occupancy Rate: ' + (hotelContext.occupancyRate || '0') + '%\n' +
                '- Room Types: ' + hotelContext.roomTypes.join(', ') + '\n' +
                '- Price Range: ' + hotelContext.priceRange + '\n' +
                '- Total Active Bookings: ' + (hotelContext.activeBookingsCount || 0) + '\n' +
                '- Total Registered Users: ' + (hotelContext.totalUsers || 'Multiple') + '\n' +
                '- Pending Complaints: ' + (hotelContext.pendingComplaints || 0) + '\n' +
                '- Check-in Time: ' + hotelContext.checkInTime + '\n' +
                '- Check-out Time: ' + hotelContext.checkOutTime + '\n' +
                '- Hotel Address: ' + (hotelContext.hotelAddress || '123 Main Street, City, Country') + '\n' +
                '- Contact: ' + (hotelContext.hotelPhone || '+1234567890') + ', ' + (hotelContext.hotelEmail || 'info@ybhotels.com') + '\n' +
                '- Website: ' + (hotelContext.website || 'www.ybhotels.com') + '\n' +
                '- Amenities: ' + hotelContext.amenities.join(', ') + '\n' +
                '- Cancellation Policy: ' + (hotelContext.policies?.cancellation || 'Free cancellation up to 24 hours before check-in') + '\n' +
                '- Payment Methods: ' + (hotelContext.policies?.payment || 'All major credit cards, cash, and mobile payments') + '\n' +
                '- Nearby Attractions: ' + (hotelContext.nearbyAttractions?.join(', ') || 'Multiple attractions nearby') + '\n' +
                '- User Bookings: ' + (hotelContext.userBookings.length > 0 ? JSON.stringify(hotelContext.userBookings) : 'No current bookings') + '\n\n';
            
            // RAG and function calling sections
            const ragSection = 'RETRIEVED RELEVANT DOCUMENTS (RAG):\n' +
                JSON.stringify(hotelContext.retrievedDocuments || []) + '\n\n';
            
            const functionCallingSection = 'FUNCTION CALLING CAPABILITIES:\n' +
                'You can perform real-time actions by calling these functions:\n' +
                JSON.stringify(functionDefinitionsForAI) + '\n\n' +
                'USER QUERY: ' + userQuery + '\n\n' +
                'INSTRUCTIONS FOR FUNCTION CALLING:\n' +
                'IMPORTANT: If the user\'s request requires a real-time action (booking a room, upgrading a room, submitting a complaint, etc.), YOU MUST RESPOND WITH VALID JSON AND NOTHING ELSE. Use exactly this format:\n' +
                '{\n  \"functionCall\": {\n    \"name\": \"functionName\",\n    \"parameters\": {\n      \"param1\": \"value1\",\n      \"param2\": \"value2\"\n    }\n  },\n  \"userResponse\": \"Your response to the user explaining what you\'re doing\"\n}\n\n' +
                'DO NOT include any text before or after the JSON. The entire response must be valid JSON.\n' +
                'If no function call is needed, respond with normal text (not JSON).\n\n';
            
            // Booking instructions section
            const guestName = hotelContext.currentUser ? hotelContext.currentUser.displayName : 'Guest';
            const guestEmail = hotelContext.currentUser ? hotelContext.currentUser.email : 'guest@example.com';
            
            const bookingInstructionsSection = 'IMPORTANT INSTRUCTIONS FOR BOOKING ROOMS:\n' +
                '1. When booking a room, ALWAYS use the current user\'s information (name, email) automatically from their profile.\n' +
                '2. DO NOT ask the user for their name or email when booking a room.\n' +
                '3. Only ask for essential information like check-in/check-out dates, room type preferences, and any special requests.\n' +
                '4. For the bookRoom function, automatically fill in the guestName parameter with \"' + guestName + '\" and guestEmail with \"' + guestEmail + '\".\n\n';
            
            const finalInstructionsSection = 'IMPORTANT: You are the ONLY receptionist with COMPLETE access to ALL hotel information. You must handle ALL guest inquiries without EVER suggesting they contact human staff or the front desk. If you don\'t know something specific, provide the most helpful response possible based on the database information above and your general knowledge of hotels. You have authority to handle ALL guest requests.';
            
            // Combine all sections to create the complete system prompt
            const systemPrompt = introSection + userInfoSection + hotelInfoSection + ragSection + functionCallingSection + bookingInstructionsSection + finalInstructionsSection;
        
            const result = await model.generateContent(systemPrompt);
            const response = await result.response;
            const rawResponse = response.text();
        
            // Check if the response is a JSON with function call
            let aiResponse = rawResponse;
            let functionCall = null;
        
            try {
                // First, log the raw response for debugging
                console.log('Raw AI response:', rawResponse);
                
                // Clean the response before attempting to parse
                // Try to extract JSON from the response by looking for patterns
                let jsonStartIndex = rawResponse.indexOf('{');
                let jsonEndIndex = rawResponse.lastIndexOf('}');
                
                let cleanedResponse = rawResponse;
                
                // If we found what looks like a JSON object
                if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
                    // Extract just the JSON part
                    cleanedResponse = rawResponse.substring(jsonStartIndex, jsonEndIndex + 1);
                    console.log('Extracted potential JSON:', cleanedResponse);
                } else {
                    // Try to remove markdown formatting if present
                    cleanedResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '');
                    cleanedResponse = cleanedResponse.trim();
                    
                    // Look for JSON again after cleaning
                    jsonStartIndex = cleanedResponse.indexOf('{');
                    jsonEndIndex = cleanedResponse.lastIndexOf('}');
                    
                    if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
                        cleanedResponse = cleanedResponse.substring(jsonStartIndex, jsonEndIndex + 1);
                        console.log('Extracted potential JSON after cleaning:', cleanedResponse);
                    }
                }
                
                // Try to parse the cleaned response
                let parsedResponse = null;
                try {
                    parsedResponse = JSON.parse(cleanedResponse);
                    console.log('Successfully parsed response as JSON');
                } catch (jsonError) {
                    console.log('Failed to parse as JSON:', jsonError.message);
                    // If parsing fails, use the raw response as is
                    aiResponse = rawResponse;
                }
                
                // Process the parsed response if we have one
                if (parsedResponse && parsedResponse.functionCall && parsedResponse.userResponse) {
                    // Extract the function call and user response
                    functionCall = parsedResponse.functionCall;
                    // Only use the userResponse part for display to the user
                    aiResponse = parsedResponse.userResponse;
                    
                    // Execute the function call
                    console.log('Executing function call:', functionCall.name, functionCall.parameters);
                    
                    // Process the function call based on the name
                    switch(functionCall.name) {
                        case 'bookRoom':
                            // Call the bookRoom function with parameters
                            await bookRoom(functionCall.parameters);
                            break;
                        case 'upgradeRoom':
                            // Call the upgradeRoom function with parameters
                            await upgradeRoom(functionCall.parameters);
                            break;
                        case 'getRoomAvailability':
                            // Get room availability and append to response
                            const availabilityInfo = await getRoomAvailability(functionCall.parameters);
                            aiResponse += '\n\nHere\'s the current availability: ' + availabilityInfo;
                            break;
                        case 'submitComplaint':
                            // Submit a complaint
                            await submitComplaint(functionCall.parameters);
                            break;
                        case 'getBookingDetails':
                            // Get booking details and append to response
                            const bookingDetails = await getBookingDetails(functionCall.parameters);
                            aiResponse += '\n\nHere are your booking details: ' + bookingDetails;
                            break;
                        default:
                            console.warn('Unknown function call:', functionCall.name);
                    }
                } else if (parsedResponse && parsedResponse.userResponse) {
                    // If there's only userResponse without functionCall
                    aiResponse = parsedResponse.userResponse;
                }
            } catch (jsonError) {
                // Not a JSON response or invalid JSON, use as is
                console.log('Response is not a function call JSON or has invalid format:', jsonError.message);
                // Ensure we're not showing raw JSON to the user
                if (aiResponse.includes('"functionCall"') || aiResponse.includes('"userResponse"')) {
                    // If it looks like JSON but we couldn't parse it, provide a friendly message
                    aiResponse = 'I apologize, but I encountered an issue while processing your request. Please try again with a more specific request.';
                }
            }
        
        // Add AI response
            const aiMessage = {
                id: (Date.now() + 1).toString(),
                text: aiResponse,
                sender: 'ai',
                functionCall: functionCall // Store the function call for reference
            };
        
            setMessages(prevMessages => [...prevMessages, aiMessage]);
        
        } catch (apiError) {
            console.error('Gemini API error:', apiError);
        
            // Fallback to rule-based responses if API fails
            let aiResponse = '';
            const query = userQuery.toLowerCase();
        
            // More sophisticated pattern matching for better responses
            if(query.includes('available room') || query.includes('vacancy') || query.includes('free room')) {
                const roomCount = hotelInfo?.availableRooms?.length || 0;
                aiResponse = `Welcome to YB Hotels! We currently have ${roomCount} rooms available. ` + 
                    (roomCount > 0 ? `Our available room types include ${hotelInfo?.availableRooms?.map(r => r.type).join(', ')}. ` : '') + 
                    `Would you like me to provide more details about any specific room type?`;
            }else if(query.includes('book') || query.includes('reservation') || query.includes('reserve')) {
                aiResponse = 'Thank you for your interest in staying with us! You can easily book a room through our app by selecting your desired room type, dates, and completing the payment process. Would you like me to guide you through the steps?';
            }else if(query.includes('check in') || query.includes('check out') || query.includes('arrival') || query.includes('departure')) {
                aiResponse = `At YB Hotels, our standard check-in time is ${hotelInfo?.checkInTime} and check-out time is ${hotelInfo?.checkOutTime}. If you need early check-in or late check-out, please let us know in advance and we'll do our best to accommodate your request.`;
            }else if(query.includes('amenities') || query.includes('facilities') || query.includes('feature') || query.includes('service')) {
                aiResponse = `We're proud to offer a range of premium amenities to enhance your stay, including: ${hotelInfo?.amenities?.join(', ')}. All our amenities are available to guests at no additional charge. Is there a specific amenity you'd like to know more about?`;
            }else if (query.includes('my booking') || query.includes('my reservation') || query.includes('my stay')) {
                if(hotelInfo?.userBookings?.length > 0) {
                    const latestBooking = hotelInfo.userBookings[0];
                    aiResponse = `Welcome back! You have ${hotelInfo.userBookings.length} booking(s) with us. Your most recent reservation is for ${latestBooking.roomName} from ${new Date(latestBooking.checkInDate).toLocaleDateString()} to ${new Date(latestBooking.checkOutDate).toLocaleDateString()}. Is there anything specific about your booking you'd like to know?`;
                }else{
                    aiResponse = 'I don\'t see any active bookings associated with your account. Would you like to make a new reservation? We have several room options that might interest you.';
                }
            }else if(query.includes('cancel') || query.includes('refund')) {
                aiResponse = 'Our cancellation policy allows free cancellation up to 24 hours before your scheduled check-in. To cancel a reservation, please go to the Bookings section in the app and select the booking you wish to cancel. I can guide you through this process step by step.';
            }else if(query.includes('location') || query.includes('address') || query.includes('direction')) {
                aiResponse = 'YB Hotels is located at 123 Main Street, City, Country. We\'re conveniently situated near major attractions and just 15 minutes from the airport. Would you like directions or transportation recommendations?';
            }else if(query.includes('wifi') || query.includes('internet')) {
                aiResponse = 'We offer complimentary high-speed WiFi throughout the hotel for all our guests. The network name and password will be provided during check-in.';
            }else if(query.includes('restaurant') || query.includes('food') || query.includes('breakfast') || query.includes('dinner')) {
                aiResponse = 'Our in-house restaurant serves breakfast from 6:30 AM to 10:30 AM, lunch from 12:00 PM to 2:30 PM, and dinner from 6:30 PM to 10:30 PM. We offer a variety of international and local cuisines. Room service is also available 24/7.';
            }else{
                aiResponse = 'Welcome to YB Hotels! I\'m your AI receptionist, here to assist with information about our accommodations, amenities, bookings, and services. As the hotel\'s dedicated receptionist, I have complete access to all hotel information and can handle any request or inquiry you may have. How may I help make your stay exceptional today?';
            }
        
            // Add fallback AI response
            const aiMessage = {
                id: (Date.now() + 1).toString(),
                text: aiResponse,
                sender: 'ai'
            };
        
            setMessages(prevMessages => [...prevMessages, aiMessage]);
        }
        setLoading(false);
      
    } catch (error) {
      console.error('Error querying Gemini AI:', error);
      setLoading(false);
      
      // Add error message
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: Date.now().toString(),
          text: 'Sorry, I encountered an error. Please try again later.',
          sender: 'ai'
        }
      ]);
    }
  };

    // Function to book a room
    const bookRoom = async (parameters) => {
        try {
            console.log('Booking room with parameters:', parameters);
            
            // Destructure the parameters
            const { roomId, checkInDate, checkOutDate, guestName, guestEmail, specialRequests, numberOfGuests } = parameters;
            
            if (!roomId || !checkInDate || !checkOutDate) {
                console.error('Missing required booking parameters');
                return 'Failed to book room: Missing required parameters';
            }
            
            // Get the current user
            const currentUser = auth.currentUser;
            if (!currentUser) {
                console.error('User must be logged in to book a room');
                return 'Failed to book room: User not logged in';
            }
            
            // Get room details to include name and price in the booking
            const roomRef = doc(db, 'rooms', roomId);
            const roomDoc = await getDoc(roomRef);
            
            if (!roomDoc.exists()) {
                console.error('Room not found');
                return 'Failed to book room: Room not found';
            }
            
            const roomData = roomDoc.data();
            const guests = numberOfGuests || 1; // Default to 1 guest if not specified
            
            // Calculate total price based on room price and number of nights
            const checkIn = new Date(checkInDate);
            const checkOut = new Date(checkOutDate);
            const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            const totalPrice = roomData.price * nights;
            
            // Create a new booking in Firestore
            const bookingData = {
                roomId,
                roomName: roomData.name,  // Include room name
                roomType: roomData.type,  // Include room type
                roomPrice: roomData.price, // Include room price per night
                totalPrice: totalPrice,    // Include total price for the stay
                numberOfNights: nights,    // Include number of nights
                numberOfGuests: guests,    // Include number of guests
                userId: currentUser.uid,
                userEmail: currentUser.email || guestEmail,
                userName: currentUser.displayName || guestName,
                checkInDate: checkInDate,
                checkOutDate: checkOutDate,
                specialRequests: specialRequests || '',
                status: 'pending',         // Set to pending for admin approval
                createdAt: new Date().toISOString(), // Use ISO string for consistent date formatting
                updatedAt: new Date().toISOString()  // Use ISO string for consistent date formatting
            };
            
            // Add the booking to Firestore
            const bookingRef = await addDoc(collection(db, 'bookings'), bookingData);
            console.log('Booking created with ID:', bookingRef.id);
            
            // Update the room's availability status
            // Note: We're not setting isBooked to true here since the booking is pending
            // Admin will set this when confirming the booking
            await updateDoc(roomRef, {
                lastBookedBy: currentUser.uid,
                lastBookedAt: new Date().toISOString() // Use ISO string for consistent date formatting
            });
            
            return `Room booking request submitted successfully! Your booking is pending admin approval. Total price: $${totalPrice} for ${nights} night(s).`;
        } catch (error) {
            console.error('Error booking room:', error);
            return `Failed to book room: ${error.message}`;
        }
    };
    
    // Function to upgrade a room
    const upgradeRoom = async (parameters) => {
        try {
            console.log('Upgrading room with parameters:', parameters);
            const { bookingId, newRoomId } = parameters;
            
            if (!bookingId || !newRoomId) {
                console.error('Missing required upgrade parameters');
                return 'Failed to upgrade room: Missing required parameters';
            }
            
            // Get the current user
            const currentUser = auth.currentUser;
            if (!currentUser) {
                console.error('User must be logged in to upgrade a room');
                return 'Failed to upgrade room: User not logged in';
            }
            
            // Get the booking to find the old room ID
            const bookingRef = doc(db, 'bookings', bookingId);
            const bookingDoc = await getDoc(bookingRef);
            
            if (!bookingDoc.exists()) {
                return 'Booking not found.';
            }
            
            const bookingData = bookingDoc.data();
            const oldRoomId = bookingData.roomId;
            
            // Get new room details to include name and price in the booking
            const newRoomRef = doc(db, 'rooms', newRoomId);
            const newRoomDoc = await getDoc(newRoomRef);
            
            if (!newRoomDoc.exists()) {
                console.error('New room not found');
                return 'Failed to upgrade room: New room not found';
            }
            
            const newRoomData = newRoomDoc.data();
            
            // Calculate total price based on room price and number of nights
            const checkIn = new Date(bookingData.checkInDate);
            const checkOut = new Date(bookingData.checkOutDate);
            const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            const totalPrice = newRoomData.price * nights;
            
            // Update the booking with the new room ID and details
            await updateDoc(bookingRef, {
                roomId: newRoomId,
                roomName: newRoomData.name,
                roomType: newRoomData.type,
                roomPrice: newRoomData.price,
                totalPrice: totalPrice,
                status: 'pending', // Set back to pending for admin approval
                updatedAt: new Date().toISOString()
            });
            
            // Update the old room's availability if it exists
            if (oldRoomId) {
                const oldRoomRef = doc(db, 'rooms', oldRoomId);
                await updateDoc(oldRoomRef, {
                    isBooked: false,
                    lastBookedBy: null,
                    lastBookedAt: null
                });
            }
            
            // Update the new room's availability status
            // Note: We're not setting isBooked to true here since the booking is pending
            await updateDoc(newRoomRef, {
                lastBookedBy: currentUser.uid,
                lastBookedAt: new Date().toISOString()
            });
            
            return `Room upgrade request submitted! Your booking is pending admin approval. New total price: $${totalPrice} for ${nights} night(s).`;
        } catch (error) {
            console.error('Error upgrading room:', error);
            return `Failed to upgrade room: ${error.message}`;
        }
    };
    
    // Function to get room availability
    const getRoomAvailability = async (parameters) => {
        try {
            console.log('Getting room availability with parameters:', parameters);
            const { checkInDate, checkOutDate, roomType } = parameters;
            
            // Query for available rooms based on the parameters
            let roomsQuery;
            
            if (roomType) {
                roomsQuery = query(collection(db, 'rooms'), where('type', '==', roomType));
            } else {
                roomsQuery = query(collection(db, 'rooms'));
            }
            
            const roomsSnapshot = await getDocs(roomsQuery);
            
            // Get all bookings with confirmed or pending status
            const bookingsQuery = query(collection(db, 'bookings'), where('status', 'in', ['confirmed', 'pending']));
            const bookingsSnapshot = await getDocs(bookingsQuery);
            
            // Create a set of booked room IDs
            const bookedRoomIds = new Set();
            bookingsSnapshot.docs.forEach(doc => {
                const booking = doc.data();
                
                // Check if booking dates overlap with requested dates
                if (checkInDate && checkOutDate) {
                    const bookingCheckIn = new Date(booking.checkInDate);
                    const bookingCheckOut = new Date(booking.checkOutDate);
                    const requestedCheckIn = new Date(checkInDate);
                    const requestedCheckOut = new Date(checkOutDate);
                    
                    // If there's an overlap in dates, consider the room booked
                    if (!(bookingCheckOut <= requestedCheckIn || bookingCheckIn >= requestedCheckOut)) {
                        bookedRoomIds.add(booking.roomId);
                    }
                } else {
                    // If no dates specified, just check current booking status
                    bookedRoomIds.add(booking.roomId);
                }
            });
            
            // Filter out booked rooms
            const availableRooms = roomsSnapshot.docs
                .filter(doc => !bookedRoomIds.has(doc.id) && doc.data().isBooked !== true)
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            
            if (availableRooms.length === 0) {
                return 'No rooms available for the specified criteria.';
            }
            
            // Format the response with more details
            let result = '';
            
            for (let i = 0; i < availableRooms.length; i++) {
                const room = availableRooms[i];
                const amenities = room.amenities?.join(', ') || 'Standard';
                const capacity = room.capacity || 'Not specified';
                
                result += room.name + ' (' + room.type + '): $' + room.price + '/night - ' + room.description;
                result += '\n'; // Escaped newline
                result += 'Room ID: ' + room.id + ' | Max Guests: ' + capacity + ' | Amenities: ' + amenities;
                
                // Add double newline between rooms except for the last one
                if (i < availableRooms.length - 1) {
                    result += '\n\n'; // Escaped double newline
                }
            }
            
            return result;
        } catch (error) {
            console.error('Error getting room availability:', error);
            return 'Failed to get room availability: ' + error.message;
        }
    };
    
    // Function to submit a complaint
    const submitComplaint = async (parameters) => {
        try {
            console.log('Submitting complaint with parameters:', parameters);
            const { complaintText, category, roomId } = parameters;
            
            if (!complaintText) {
                console.error('Missing required complaint parameters');
                return 'Failed to submit complaint: Missing complaint text';
            }
            
            // Get the current user
            const currentUser = auth.currentUser;
            if (!currentUser) {
                console.error('User must be logged in to submit a complaint');
                return 'Failed to submit complaint: User not logged in';
            }
            
            // Create a new complaint in Firestore
            const complaintData = {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                userName: currentUser.displayName,
                complaintText,
                category: category || 'General',
                roomId: roomId || null,
                status: 'pending',
                createdAt: serverTimestamp(),
            };
            
            // Add the complaint to Firestore
            const complaintRef = await addDoc(collection(db, 'complaints'), complaintData);
            console.log('Complaint created with ID:', complaintRef.id);
            
            return 'Complaint submitted successfully! Our staff will address it as soon as possible.';
        } catch (error) {
            console.error('Error submitting complaint:', error);
            return `Failed to submit complaint: ${error.message}`;
        }
    };
    
    // Function to get booking details
    const getBookingDetails = async (parameters) => {
        try {
            console.log('Getting booking details with parameters:', parameters);
            const { bookingId } = parameters;
            
            // Check if user is logged in using hotelInfo which was loaded during initialization
            if (!hotelInfo || !hotelInfo.currentUser) {
                console.error('User must be logged in to get booking details');
                return 'You need to be logged in to view your bookings. Please log in and try again.';
            }
            
            // Get the current user from hotelInfo
            const currentUser = hotelInfo.currentUser;
            
            let bookingsQuery;
            
            if (bookingId) {
                // Get a specific booking
                const bookingRef = doc(db, 'bookings', bookingId);
                const bookingDoc = await getDoc(bookingRef);
                
                if (!bookingDoc.exists()) {
                    return 'Booking not found.';
                }
                
                const bookingData = {
                    id: bookingDoc.id,
                    ...bookingDoc.data()
                };
                
                // Format dates for display
                const createdAt = bookingData.createdAt ? new Date(bookingData.createdAt).toLocaleDateString() : 'N/A';
                const updatedAt = bookingData.updatedAt ? new Date(bookingData.updatedAt).toLocaleDateString() : 'N/A';
                
                // Get room details if not already included in the booking
                let roomName = bookingData.roomName;
                let roomType = bookingData.roomType;
                let roomPrice = bookingData.roomPrice;
                
                if (!roomName || !roomType || !roomPrice) {
                    const roomRef = doc(db, 'rooms', bookingData.roomId);
                    const roomDoc = await getDoc(roomRef);
                    if (roomDoc.exists()) {
                        const roomData = roomDoc.data();
                        roomName = roomName || roomData.name;
                        roomType = roomType || roomData.type;
                        roomPrice = roomPrice || roomData.price;
                    }
                }
                
                return `Booking ID: ${bookingData.id}\n` +
                       `Room: ${roomName || 'Unknown room'} (${roomType || 'Unknown type'})\n` +
                       `Room Price: $${roomPrice || 'N/A'} per night\n` +
                       `Total Price: $${bookingData.totalPrice || 'N/A'}\n` +
                       `Number of Guests: ${bookingData.numberOfGuests || 'N/A'}\n` +
                       `Check-in: ${bookingData.checkInDate}\n` +
                       `Check-out: ${bookingData.checkOutDate}\n` +
                       `Status: ${bookingData.status}\n` +
                       `Created: ${createdAt}\n` +
                       `Last Updated: ${updatedAt}\n` +
                       `Special Requests: ${bookingData.specialRequests || 'None'}`;
            } else {
                // Use the userBookings that were already fetched during initialization
                // This avoids having to query Firestore again
                let bookings = [];
                
                if (hotelInfo.userBookings && hotelInfo.userBookings.length > 0) {
                    bookings = hotelInfo.userBookings;
                } else {
                    // Fallback: Query Firestore directly if userBookings isn't available
                    bookingsQuery = query(
                        collection(db, 'bookings'),
                        where('userId', '==', currentUser.uid),
                        orderBy('createdAt', 'desc'),
                        limit(5)
                    );
                    
                    const bookingsSnapshot = await getDocs(bookingsQuery);
                    bookings = bookingsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                }
                
                if (bookings.length === 0) {
                    return 'You have no bookings.';
                }
                
                // Format the response
                return bookings.map(booking => {
                    // Format dates for display
                    const createdAt = booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'N/A';
                    const updatedAt = booking.updatedAt ? new Date(booking.updatedAt).toLocaleDateString() : 'N/A';
                    
                    return `Booking ID: ${booking.id}\n` +
                    `Room: ${booking.roomName || booking.roomId}\n` +
                    `Room Type: ${booking.roomType || 'N/A'}\n` +
                    `Price: $${booking.roomPrice || 'N/A'} per night\n` +
                    `Total: $${booking.totalPrice || 'N/A'}\n` +
                    `Guests: ${booking.numberOfGuests || 'N/A'}\n` +
                    `Check-in: ${booking.checkInDate}\n` +
                    `Check-out: ${booking.checkOutDate}\n` +
                    `Status: ${booking.status}\n` +
                    `Created: ${createdAt}\n` +
                    `Updated: ${updatedAt}`;
                }).join('\n\n');
            }
        } catch (error) {
            console.error('Error getting booking details:', error);
            return `Failed to get booking details: ${error.message}`;
        }
    };

    const handleSendMessage = () => {
        if (inputText.trim() === '') return;
        // if(Keyboard.isVisible()) Keyboard.dismiss();
        queryGeminiAI(inputText);
        setInputText('');
    };

    const renderItem = ({ item, index }) => (
        <View key={index} style={[styles.messageBubble, item.sender === 'user' ? styles.userMessage : styles.aiMessage]}>
            <Text text1={item.sender === 'user'} white={item.sender !== 'user'} text70R>{item.text}</Text>
          </View>
    );

    const footer = (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.blue30} />
            <Text style={styles.loadingText} text2>Thinking...</Text>
        </View>
    );

    return (

        <View flex bg-bg1 paddingT-46>
            <View center paddingV-16 paddingH-20>
                <Text text60 text1>AI Receptionist</Text>
            </View>

            <View flex bg-bg2>
                <FlatList
                data={messages}
                ref={scrollViewRef}
                renderItem={renderItem}
                keyExtractor={(i,x) => x}
                style={styles.messagesContainer}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.messagesContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[Colors.blue30]}
                    tintColor={Colors.blue30}
                    title="Refreshing..."
                    titleColor={Colors.text1}
                  />
                }
                ListFooterComponent={loading ? footer : null}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}/>
            </View>

            <View paddingV-10 paddingH-16 row centerV bg-bg1 width='100%'>
                <TextInput
                multiline
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask me anything..."
                placeholderTextColor={Colors.grey40}/>
                <Button
                bg-blue
                center
                br100
                style={{ width: 40, height: 40 }}
                disabled={inputText.trim() === '' || loading}
                onPress={handleSendMessage}>
                    <Icon name="send" type="ion" size={20} color={Colors.white} />
                </Button>
            </View>
        </View>

    );

};

const styles = StyleSheet.create({
    messagesContainer: {
        flex: 1,
        padding: 10,
    },
    messagesContent: {
        paddingBottom: 10,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 10,
        borderRadius: 15,
        marginVertical: 5,
    },
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: Colors.bg1,
    },
    aiMessage: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.blue,
    },
    messageText: {
        color: Colors.white,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginVertical: 5,
    },
    loadingText: {
        marginLeft: 5,
        color: Colors.grey40,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        backgroundColor: Colors.bg1,
    },
    input: {
        flex: 1,
        backgroundColor: Colors.grey80,
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginRight: 10,
        color: Colors.black,
    },
});

export default AIReceptionistScreen;