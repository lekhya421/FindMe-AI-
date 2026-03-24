import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useVoiceRecording } from '../hooks/useVoiceRecording';

const PostItem = () => {
  const [formData, setFormData] = useState({
    type: 'lost',
    title: '',
    description: '',
    verificationInfo: '',
    category: 'electronics',
    date: '',
    address: ''
  });
  const [image, setImage] = useState(null);
  const [useVoice, setUseVoice] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const {
    isRecording,
    audioBlob,
    transcript,
    interimTranscript,
    speechError,
    isSpeechSupported,
    startRecording,
    stopRecording,
    resetRecording
  } = useVoiceRecording();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();
      data.append('type', formData.type);
      data.append('title', formData.title);
      const liveVoiceText = `${transcript}${interimTranscript ? ` ${interimTranscript}` : ''}`.trim();
      data.append('description', useVoice ? (liveVoiceText || formData.description) : formData.description);
      if (formData.verificationInfo) {
        data.append('verificationInfo', formData.verificationInfo);
      }
      data.append('category', formData.category);
      data.append('date', formData.date);
      data.append('location', JSON.stringify({
        address: formData.address
      }));

      if (image) {
        data.append('image', image);
      }

      if (audioBlob) {
        data.append('audio', audioBlob, 'recording.webm');
      }

      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/items`,
        data,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      toast.success('Item posted successfully! Searching for matches...');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to post item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="post-item-container">
      <h2>Post Lost/Found Item</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Type</label>
          <select name="type" value={formData.type} onChange={handleChange}>
            <option value="lost">Lost</option>
            <option value="found">Found</option>
          </select>
        </div>

        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="e.g., Black iPhone 13 Pro"
          />
        </div>

        <div className="form-group">
          <label>Category</label>
          <select name="category" value={formData.category} onChange={handleChange}>
            <option value="electronics">Electronics</option>
            <option value="documents">Documents</option>
            <option value="pets">Pets</option>
            <option value="accessories">Accessories</option>
            <option value="clothing">Clothing</option>
            <option value="keys">Keys</option>
            <option value="bags">Bags</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label>Date</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Location Address</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            placeholder="e.g., Central Park, New York"
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={useVoice}
              onChange={(e) => setUseVoice(e.target.checked)}
              style={{ marginRight: '0.5rem', transform: 'scale(1.15)', accentColor: '#3498db' }}
            />
            <span style={{ fontWeight: 500 }}>Use voice description instead of text</span>
          </label>
        </div>

        {!useVoice ? (
          <>
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows="4"
                placeholder="Detailed description of the item"
              />
            </div>

            {formData.type === 'lost' && (
              <div className="form-group">
                <label>Verification Information (Optional but Recommended)</label>
                <textarea
                  name="verificationInfo"
                  value={formData.verificationInfo}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Add specific details to verify ownership (e.g., unique marks, serial number, what's inside, etc.). This will be shared with the finder to confirm it's your item."
                  style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}
                />
                <small style={{ color: '#856404', display: 'block', marginTop: '0.5rem' }}>
                  💡 This information helps verify you're the real owner when someone finds your item
                </small>
              </div>
            )}
          </>
        ) : (
          <div className="form-group">
            <label>Voice Recording</label>
            <div className="voice-recorder">
              {!isSpeechSupported && (
                <small style={{ color: '#856404', display: 'block', marginBottom: '0.5rem' }}>
                  Live transcription is not supported in this browser, but audio recording still works.
                </small>
              )}

              {!isRecording && !audioBlob && (
                <button type="button" onClick={startRecording} className="btn-record">
                  Start Recording
                </button>
              )}
              {isRecording && (
                <button type="button" onClick={stopRecording} className="btn-stop">
                  Stop Recording
                </button>
              )}
              {audioBlob && (
                <div>
                  <audio src={URL.createObjectURL(audioBlob)} controls />
                  <button type="button" onClick={resetRecording} className="btn-reset">
                    Re-record
                  </button>
                </div>
              )}

              {(isRecording || transcript || interimTranscript) && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #d9edf7',
                  background: '#f4fbff'
                }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Live transcript
                  </div>
                  <div style={{ minHeight: '2.5rem', lineHeight: 1.5 }}>
                    {`${transcript}${interimTranscript ? ` ${interimTranscript}` : ''}`.trim() || 'Listening...'}
                  </div>
                  {speechError && (
                    <small style={{ color: '#b94a48', display: 'block', marginTop: '0.4rem' }}>
                      {speechError}
                    </small>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Image (optional)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            onChange={handleImageChange}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Posting...' : 'Post Item'}
        </button>
      </form>
    </div>
  );
};

export default PostItem;
