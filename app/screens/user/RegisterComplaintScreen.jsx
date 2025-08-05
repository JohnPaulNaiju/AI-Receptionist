import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { View, Text, Colors, Button, Picker } from 'react-native-ui-lib';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../utils';
import { createComplaint } from '../../utils/models';
import { Input } from '../../components';

const RegisterComplaintScreen = ({ route, navigation }) => {

    const { bookingId } = route.params || {};
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [loading, setLoading] = useState(false);
    const [bookingDetails, setBookingDetails] = useState(null);
    const [fetchingBooking, setFetchingBooking] = useState(false);

    useEffect(() => {
        if (bookingId) {
        fetchBookingDetails();
        }
    }, [bookingId]);

    const fetchBookingDetails = async () => {
        try {
            setFetchingBooking(true);
            const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
        if (bookingDoc.exists()) {
            setBookingDetails({ id: bookingDoc.id, ...bookingDoc.data() });
        }
        } catch (error) {
            console.log('Error fetching booking details:', error);
        } finally {
            setFetchingBooking(false);
        }
    };

    const handleSubmitComplaint = async () => {
        if (!title.trim()) {
            Alert.alert('Error', 'Please enter a title for your complaint');
            return;
        }

        if (!description.trim()) {
            Alert.alert('Error', 'Please describe your complaint');
            return;
        }

        try {
            setLoading(true);

            const complaintData = createComplaint({
                userId: auth.currentUser.uid,
                bookingId: bookingId || null,
                title: title.trim(),
                description: description.trim(),
                priority,
                status: 'open',
            });

            await addDoc(collection(db, 'complaints'), complaintData);

            Alert.alert(
                'Complaint Registered',
                'Your complaint has been successfully registered. Our team will review it shortly.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.log('Error registering complaint:', error);
            Alert.alert('Error', 'Failed to register complaint. Please try again.');
        }finally{
            setLoading(false);
        }
    };

    return (

        <View flex useSafeArea bg-bg1 paddingT-46>
            <View paddingH-16 style={styles.header}>
                <Text text60 bold>Register a Complaint</Text>
            </View>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
                <ScrollView contentContainerStyle={{ flex: 1 }}>
                    {bookingId && (
                        <View style={styles.bookingInfoContainer}>
                            {fetchingBooking ? (
                            <ActivityIndicator size="small" color={Colors.blue} />
                            ) : bookingDetails ? (
                            <>
                                <Text text80 grey30 marginB-5>Related to Booking:</Text>
                                <Text text70>{bookingDetails.roomName}</Text>
                            </>
                            ) : (
                            <Text text80 red30>Booking information not available</Text>
                            )}
                        </View>
                    )}

                    <View style={styles.formContainer}>

                        <Input
                        marginT-16
                        value={title}
                        onChange={setTitle}
                        placeholder="Complaint Title"/>

                        <Input
                        marginT-16
                        multiline
                        maxLength={500}
                        value={description}
                        onChange={setDescription}
                        placeholder="Describe your complaint in detail"/>

                        <View paddingH-26>
                            <Text text80 text1 marginB-5 marginT-18 style={{ fontWeight: 'bold' }}>Priority Level</Text>
                            <Picker
                            value={priority}
                            onChange={(value) => setPriority(value)}
                            showSearch={false}>
                                <Picker.Item value="low" label="Low" />
                                <Picker.Item value="medium" label="Medium" />
                                <Picker.Item value="high" label="High" />
                            </Picker>
                        </View>

                        <View paddingH-18>
                            <Button
                            label={loading ? '' : 'Submit Complaint'}
                            bg-blue
                            white
                            text70
                            marginT-30
                            br100
                            style={{ fontWeight: 'bold', height: 50 }}
                            onPress={handleSubmitComplaint}
                            disabled={loading}>

                                {loading && <ActivityIndicator color={Colors.white} />}

                            </Button>
                        </View>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>

    );

};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg2,
    },
    scrollContainer: {
        flexGrow: 1,
        padding: 15,
    },
    header: {
        marginBottom: 20,
    },
    bookingInfoContainer: {
        backgroundColor: Colors.grey70,
        padding: 15,
        borderRadius: 10,
        marginBottom: 20,
    },
    formContainer: {
        width: '100%',
    },
    input: {
        marginBottom: 15,
        borderWidth: 1,
        borderColor: Colors.grey50,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: Colors.white,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    picker: {
        borderWidth: 1,
        borderColor: Colors.grey50,
        borderRadius: 8,
        backgroundColor: Colors.white,
    },
    button: {
        height: 50,
        borderRadius: 8,
    },
});

export default RegisterComplaintScreen;