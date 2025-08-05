import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { View, Text, Colors, Card, Button, Chip, Dialog, TextField } from 'react-native-ui-lib';
import { collection, getDocs, doc, updateDoc, query, orderBy, where, getDoc } from 'firebase/firestore';
import { db, formatDate } from '../../utils';
import { Icon } from '../../components';

const ComplaintsScreen = () => {

    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [responseText, setResponseText] = useState('');
    const [showResponseDialog, setShowResponseDialog] = useState(false);

    const fetchComplaints = async () => {
        try {
        setLoading(true);
        const complaintsQuery = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
        const complaintsSnapshot = await getDocs(complaintsQuery);
        
        // Get all complaints
        let complaintsData = complaintsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Get user details for each complaint
        const complaintPromises = complaintsData.map(async (complaint) => {
            try {
            // Get user details
            const userQuery = query(collection(db, 'users'), where('uid', '==', complaint.userId));
            const userSnapshot = await getDocs(userQuery);
            const userData = !userSnapshot.empty ? userSnapshot.docs[0].data() : null;
            
            // Get booking details if available
            let bookingData = null;
            if (complaint.bookingId) {
                const bookingDoc = await getDoc(doc(db, 'bookings', complaint.bookingId));
                bookingData = bookingDoc.exists() ? bookingDoc.data() : null;
            }
            
            return {
                ...complaint,
                userName: userData ? userData.name : 'Unknown User',
                userEmail: userData ? userData.email : 'Unknown Email',
                bookingRef: bookingData ? bookingData.id.substring(0, 8) : null
            };
            } catch (error) {
            console.log('Error fetching complaint details:', error);
            return complaint;
            }
        });
        
        const enrichedComplaints = await Promise.all(complaintPromises);
        setComplaints(enrichedComplaints);
        } catch (error) {
        console.log('Error fetching complaints:', error);
        Alert.alert('Error', 'Failed to load complaints. Please try again.');
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchComplaints();
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
        case 'open': return Colors.red;
        case 'in-progress': return Colors.orange40;
        case 'resolved': return Colors.green;
        default: return Colors.grey;
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
        case 'open': return 'Open';
        case 'in-progress': return 'In Progress';
        case 'resolved': return 'Resolved';
        default: return 'Unknown';
        }
    };

    const handleStatusChange = (complaintId, currentStatus) => {
        const statusOptions = [];
        
        // Define possible status transitions based on current status
        switch (currentStatus) {
        case 'open':
            statusOptions.push(
            { label: 'Mark as In Progress', value: 'in-progress' }
            );
            break;
        case 'in-progress':
            statusOptions.push(
            { label: 'Mark as Resolved', value: 'resolved' }
            );
            break;
        case 'resolved':
            statusOptions.push(
            { label: 'Reopen', value: 'open' }
            );
            break;
        default:
            Alert.alert('Info', 'No status changes available for this complaint.');
            return;
        }
        
        // Show alert with options
        Alert.alert(
        'Update Complaint Status',
        'Select new status:',
        [
            ...statusOptions.map(option => ({
            text: option.label,
            onPress: () => updateComplaintStatus(complaintId, option.value)
            })),
            { text: 'Cancel', style: 'cancel' }
        ]
        );
    };

    const updateComplaintStatus = async (complaintId, newStatus) => {
        try {
        setLoading(true);
        
        // Update complaint status
        await updateDoc(doc(db, 'complaints', complaintId), {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
        
        Alert.alert('Success', `Complaint status updated to ${getStatusLabel(newStatus)}`);
        fetchComplaints();
        } catch (error) {
        console.log('Error updating complaint status:', error);
        Alert.alert('Error', 'Failed to update complaint status. Please try again.');
        } finally {
        setLoading(false);
        }
    };

    const handleAddResponse = (complaint) => {
        setSelectedComplaint(complaint);
        setResponseText('');
        setShowResponseDialog(true);
    };

    const submitResponse = async () => {
        if (!responseText.trim()) {
        Alert.alert('Error', 'Please enter a response');
        return;
        }
        
        try {
        setLoading(true);
        
        const response = {
            text: responseText.trim(),
            timestamp: new Date().toISOString(),
            from: 'admin'
        };
        
        // Get current responses or initialize empty array
        const currentResponses = selectedComplaint.responses || [];
        
        // Update complaint with new response
        await updateDoc(doc(db, 'complaints', selectedComplaint.id), {
            responses: [...currentResponses, response],
            status: 'in-progress',
            updatedAt: new Date().toISOString()
        });
        
        setShowResponseDialog(false);
        Alert.alert('Success', 'Response added successfully');
        fetchComplaints();
        } catch (error) {
        console.log('Error adding response:', error);
        Alert.alert('Error', 'Failed to add response. Please try again.');
        } finally {
        setLoading(false);
        }
    };

    const filteredComplaints = filterStatus === 'all' ? complaints : complaints.filter(complaint => complaint.status === filterStatus);

    const renderComplaintItem = ({ item }) => (

        <Card style={styles.complaintCard} marginB-15>
            <View padding-15>
                <View row spread centerV marginB-10>
                    <Text text70 bold numberOfLines={1}>{item.subject}</Text>
                    <Chip 
                    label={getStatusLabel(item.status)}
                    labelStyle={{ color: 'white' }}
                    containerStyle={{ backgroundColor: getStatusColor(item.status) }}/>
                </View>

                <Text text80 grey30 marginB-5>From: {item.userName}</Text>
                {item.bookingRef && (<Text text80 grey30 marginB-5>Booking: {item.bookingRef}</Text>)}

                <Text text80 grey30 marginB-5>Date: {formatDate(item.createdAt)}</Text>
            
                <View style={styles.messageContainer} marginV-10>
                    <Text text80>{item.message}</Text>
                </View>
            
                {item.responses && item.responses.length > 0 && (
                <View marginT-10>
                    <Text text80 bold marginB-5>Responses:</Text>
                    {item.responses.map((response, index) => (
                    <View key={index} style={[styles.responseContainer, response.from === 'admin' ? styles.adminResponse : styles.userResponse]} marginB-5>
                        <Text text80>{response.text}</Text>
                        <Text text90 right grey30 marginT-5>{formatDate(response.timestamp)}</Text>
                    </View>
                    ))}
                </View>)}
            
                <View row spread marginT-15>
                    <Button 
                    label="Change Status" 
                    size="small"
                    backgroundColor={Colors.blue}
                    onPress={() => handleStatusChange(item.id, item.status)}/>
                    <Button 
                    label="Add Response" 
                    size="small"
                    backgroundColor={Colors.green}
                    onPress={() => handleAddResponse(item)}/>
                </View>
            </View>
        </Card>

    );

    const renderFilterChips = () => (

        <View width='100%' height={60} bg-bg1 centerV paddingB-22>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Chip 
                label="All"
                labelStyle={{ color: filterStatus === 'all' ? 'white' : Colors.blue }}
                containerStyle={{
                    backgroundColor: filterStatus === 'all' ? Colors.blue : 'white',
                    marginLeft: 16,
                    borderWidth: 1,
                    borderColor: Colors.blue
                }}
                onPress={() => setFilterStatus('all')}/>
                <Chip 
                label="Open"
                labelStyle={{ color: filterStatus === 'open' ? 'white' : Colors.red }}
                containerStyle={{
                    backgroundColor: filterStatus === 'open' ? Colors.red : 'white',
                    marginLeft: 8,
                    borderWidth: 1,
                    borderColor: Colors.red
                }}
                onPress={() => setFilterStatus('open')}/>
                <Chip 
                label="In Progress"
                labelStyle={{ color: filterStatus === 'in-progress' ? 'white' : Colors.orange40 }}
                containerStyle={{
                    backgroundColor: filterStatus === 'in-progress' ? Colors.orange40 : 'white',
                    marginLeft: 8,
                    borderWidth: 1,
                    borderColor: Colors.orange40
                }}
                onPress={() => setFilterStatus('in-progress')}/>
                <Chip 
                label="Resolved"
                labelStyle={{ color: filterStatus === 'resolved' ? 'white' : Colors.green }}
                containerStyle={{
                    backgroundColor: filterStatus === 'resolved' ? Colors.green : 'white',
                    marginLeft: 8,
                    borderWidth: 1,
                    borderColor: Colors.green
                }}
                onPress={() => setFilterStatus('resolved')}/>
            </ScrollView>
        </View>

    );

    if (loading && complaints.length === 0) {

        return (

            <View flex center>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>

        );

    }

    return (
        <View flex useSafeArea paddingT-46 bg-bg1>
            {renderFilterChips()}
            <View flex bg-bg2>
                <FlatList
                data={filteredComplaints}
                renderItem={renderComplaintItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View flex center padding-20>
                        <Icon name="chatbox-outline" type="ion" size={50} color={Colors.grey30} marginB-10/>
                        <Text text70 center>No complaints found</Text>
                        {filterStatus !== 'all' && (<Text text80 center marginT-10>Try changing the filter</Text>)}
                    </View>
                }/>
            </View>
        
            <Dialog statusBarTranslucent visible={showResponseDialog} onDismiss={() => setShowResponseDialog(false)} containerStyle={styles.dialogContainer}>
                <View padding-20>
                    <Text text60 bold marginB-15>Add Response</Text>
            
                    <TextField
                        title="Your Response"
                        placeholder="Type your response here..."
                        value={responseText}
                        onChangeText={setResponseText}
                        multiline
                        numberOfLines={4}
                        marginB-20
                    />
            
                    <View row spread>
                        <Button 
                        label="Cancel" 
                        outline
                        outlineColor={Colors.blue}
                        onPress={() => setShowResponseDialog(false)}/>
                        <Button 
                        label="Submit" 
                        backgroundColor={Colors.blue}
                        onPress={submitResponse}/>
                    </View>
                </View>
            </Dialog>
        </View>

    );

};

const styles = StyleSheet.create({
    listContent: {
        padding: 15,
    },
    complaintCard: {
        borderRadius: 10,
    },
    messageContainer: {
        backgroundColor: Colors.grey70,
        padding: 10,
        borderRadius: 8,
    },
    responseContainer: {
        padding: 10,
        borderRadius: 8,
        marginVertical: 5,
    },
    adminResponse: {
        backgroundColor: Colors.blue30,
        alignSelf: 'flex-end',
        maxWidth: '90%',
    },
    userResponse: {
        backgroundColor: Colors.grey70,
        alignSelf: 'flex-start',
        maxWidth: '90%',
    },
    dialogContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        width: '90%',
    },
});

export default ComplaintsScreen;
