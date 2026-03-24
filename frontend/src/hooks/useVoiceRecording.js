import { useState, useRef } from 'react';

export const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState('');
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSpeechSupported = !!SpeechRecognition;

  const startRecording = async () => {
    try {
      setSpeechError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      if (isSpeechSupported) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          let finalText = '';
          let interimText = '';

          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalText += text;
            } else {
              interimText += text;
            }
          }

          if (finalText) {
            setTranscript((prev) => `${prev} ${finalText}`.trim());
          }
          setInterimTranscript(interimText.trim());
        };

        recognition.onerror = (event) => {
          if (event.error !== 'no-speech') {
            setSpeechError('Live transcription had an issue. Audio recording still continues.');
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setTranscript('');
    setInterimTranscript('');
    setSpeechError('');
    chunksRef.current = [];
  };

  return {
    isRecording,
    audioBlob,
    transcript,
    interimTranscript,
    speechError,
    isSpeechSupported,
    startRecording,
    stopRecording,
    resetRecording
  };
};
