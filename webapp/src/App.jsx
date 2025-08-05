import React from "react";
import "./style.css";
import * as faceapi from "face-api.js";
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp, getApp, getApps } from 'firebase/app';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { onSnapshot, addDoc, collection, getFirestore, doc, query, where, limit, getDocs } from 'firebase/firestore';

const synth = window.speechSynthesis;

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_PROJECT_ID,
    storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_APP_ID,
    measurementId: process.env.REACT_APP_MEASUREMENT_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

const emailModel = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: `
    You will be provided with a transcript. 
    Your task is to extract the email from the transcript.
    The transcript will not be accurate, so you need to understand and extract as email.
    The transcript will be like example at the rate email dot com. So you must understand it and extract as example@gmail.com.
    It will be most likely gmail.
    Provide reponse with just the email address, eg: example@gmail.com.
    If no email address is found, respond with "No email found".
    Be accurate and clever as much as you can, as this can be tricky`
});

export default function App() {

    const {
        transcript,
        resetTranscript,
        browserSupportsSpeechRecognition
    } = useSpeechRecognition();

    const sessionId = React.useRef(Date.now());

    const videoRef = React.useRef(null);
    const faceActive = React.useRef(false);
    const inactivityTimeout = React.useRef(null);

    const emailRef = React.useRef(null);

    const [speaking, setSpeaking] = React.useState(true);
    const [processing, setProcessing] = React.useState(false);

    const processRef = React.useRef(false);

    const vid1 = React.useRef(null);
    const vid2 = React.useRef(null);

    const setProcess = (bool) => {
        setProcessing(bool || false);
        processRef.current = bool || false;
        vid1.current.style.opacity = bool ? 0 : 1;
        vid2.current.style.opacity = bool ? 1 : 0;
    };

    const startVideo = () => {
        navigator.mediaDevices.getUserMedia({ video: {} }).then((stream) => {
            if(videoRef.current) videoRef.current.srcObject = stream;
        }).catch((err) => {
            console.error("Error accessing camera:", err);
        });
    };

    const stopTalking = () => {
        if(synth.speaking){
            synth.cancel();
            if(vid1.current){
                vid1.current.pause();
                vid1.current.currentTime = 0;
            }if(vid2.current){
                vid2.current.pause();
                vid2.current.currentTime = 0;
            }
            setSpeaking(false);
        }
    };

    const speak = React.useCallback((text) => {
        stopTalking();
        setTimeout(() => {
            setSpeaking(true);
            if(vid1.current) vid1.current.play();
            if(vid2.current) vid2.current.play();
            const utterance = new SpeechSynthesisUtterance(text || `
                Hello I am Laura, Welcome to YB Hotels! Please tell me your email address to continue.
            `);
            utterance.voice = synth.getVoices().find((voice) => voice.lang === "en-AU");
            synth.speak(utterance);
            utterance.onend = () => {
                if(vid1.current){
                    vid1.current.pause();
                    vid1.current.currentTime = 0;
                }if(vid2.current){
                    vid2.current.pause();
                    vid2.current.currentTime = 0;
                }
                setSpeaking(false);
            };
        }, 100);
    }, []);

    const stopListening = async(transcript) => {
        stopTalking();
        SpeechRecognition.stopListening();
        resetTranscript();
        console.log(transcript);
        setProcess(true);
        if(emailRef.current === null){
            const result = await emailModel.generateContent(transcript);
            const response = await result.response;
            const rawResponse = response.text().trim();
            if(rawResponse === "No email found"){
                speak("Sorry, I couldn't understand. Please try again.");
                setProcess(false);
                return;
            }
            speak(`Got it! Your email address is ${rawResponse}. Let me check whether you are registered with this email`);
            const docRef = query(collection(db, 'users'), where('email', '==', rawResponse), limit(1));
            const snapshot = await getDocs(docRef).catch(console.log);
            if(snapshot.empty){
                speak("Sorry, I couldn't find you in our records. Please register using our app and try again.");
                setProcess(false);
                return;
            }else{
                setProcess(false);
                speak("Alright! You are registered. Thank you for being a loyal customer at YB Hotels. How may I help you?");
                emailRef.current = rawResponse;
            }
        }else{
            const docRef = collection(db, "reception");
            setTimeout(() => {
                speak("Alright! Let me see what I can do for you!");
            }, 1000);
            await addDoc(docRef, {
                transcript: transcript, 
                sessionId: sessionId.current, 
                email: emailRef.current, 
            }).then((res) => {
                console.log("Document written with ID: ", res.id);
                const newDocRef = doc(db, "reception", res.id);
                const listener = onSnapshot(newDocRef, (doc) => {
                    const data = doc.data();
                    if(data && data.result){
                        setProcess(false);
                        const response = data.result;
                        speak(response);
                        listener();
                    }
                });
            }).catch((error) => {
                console.error("Error adding document: ", error);
            });
        }
    };

    React.useEffect(() => {
        const loadModels = async () => {
            try{
                await faceapi.nets.tinyFaceDetector.loadFromUri("/models").catch(console.log);
                startVideo();
            }catch(err){
                console.error("Error loading models:", err);
            }
        };
        loadModels();
        const interval = setInterval(async () => {
            if(videoRef.current && videoRef.current.readyState === 4){
                try {
                    const detections = await faceapi.detectAllFaces(
                        videoRef.current,
                        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
                    );
                    if(detections.length > 0){
                        if (inactivityTimeout.current) {
                            clearTimeout(inactivityTimeout.current);
                            inactivityTimeout.current = null;
                        }
                        if(!faceActive.current){
                            speak(null);
                            faceActive.current = true;
                            sessionId.current = Date.now();
                            emailRef.current = null;
                        }
                    }else{
                        if(faceActive.current && !inactivityTimeout.current){
                            inactivityTimeout.current = setTimeout(() => {
                                faceActive.current = false;
                                inactivityTimeout.current = null;
                            }, 10000);
                        }
                    }
                }catch(error){
                    console.error("Face detection error:", error);
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [speak]);

    if(!browserSupportsSpeechRecognition) return <div className="App"><span>Your browser does not support speech recognition.</span></div>;

    return (

        <div className="App">
            <div className="video-container">
                <video
                loop muted
                className="vid1"
                src="./vid1.mp4"
                width="auto"
                height="100%"
                ref={vid1}/>
                <video
                loop muted
                className="vid2"
                src="./vid2.mp4"
                width="auto"
                height="100%"
                ref={vid2}/>
            </div>
            <div className="dummy">
                {(speaking || processing) ? 
                speaking ? 
                <div className="button" style={{ backgroundColor: "#FF595A" }} onClick={stopTalking}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#FFFFFF" viewBox="0 0 16 16">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
                    </svg>
                </div> : 
                processing ? 
                <div className="button" style={{ backgroundColor: "#0D6EFD" }}>
                    <svg width="30" height="30" viewBox="0 0 50 50">
                        <circle cx="25" cy="25" r="20" stroke="#FFFFFF" strokeWidth="5" strokeDasharray="20 80" strokeDashoffset="0" fill="none" />
                        <animateTransform attributeName="stroke-dashoffset" from="0" to="100" dur="1s" repeatCount="indefinite" />
                    </svg>
                </div> : null : 
                <div className="button"
                onMouseDown={SpeechRecognition.startListening}
                onMouseUp={() => stopListening(transcript)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#FFFFFF" viewBox="0 0 16 16">
                        <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"/>
                        <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5"/>
                    </svg>
                </div> }
            </div>
            <video
            ref={videoRef}
            autoPlay
            muted
            width="720"
            height="560"
            id="user_video"/>
        </div>

    );

};