import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const Navbar = () => {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (!socket || !user) return;

    const handleNewNotification = (notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 5));
      setUnreadCount((count) => count + 1);

      if (notification.type === 'match' && notification.link) {
        toast.success(`${notification.title}: ${notification.message}`, {
          autoClose: 5000,
          onClick: () => navigate(notification.link)
        });
      } else {
        toast.info(`${notification.title}: ${notification.message}`, {
          autoClose: 4000
        });
      }
    };

    socket.on('new-notification', handleNewNotification);
    return () => socket.off('new-notification', handleNewNotification);
  }, [socket, user, navigate]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const notifs = res.data.notifications || [];
      setNotifications(notifs.slice(0, 5)); // Show only latest 5
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.read) {
        const token = localStorage.getItem('token');
        await axios.patch(
          `${process.env.REACT_APP_API_URL}/notifications/${notification._id}/read`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      setShowDropdown(false);
      
      if (notification.link) {
        navigate(notification.link);
      }
      
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now - notifDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notifDate.toLocaleDateString();
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          FindMe
        </Link>

        {user && (
          <div className="navbar-menu">
            <Link to="/" className="nav-link">Dashboard</Link>
            <Link to="/post" className="nav-link">Post Item</Link>
            <Link to="/my-items" className="nav-link">My Items</Link>
            <Link to="/matches" className="nav-link">Matches</Link>
            
            {/* Notification Bell Icon */}
            <div className="notification-bell-container" ref={dropdownRef}>
              <button 
                className="notification-bell"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '8px',
                  fontSize: '1.5rem'
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: '#e74c3c',
                    color: 'white',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '0.7rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: '0',
                  marginTop: '8px',
                  width: '350px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 1000
                }}>
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #eee',
                    fontWeight: 'bold',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span style={{
                        background: '#e74c3c',
                        color: 'white',
                        borderRadius: '12px',
                        padding: '2px 8px',
                        fontSize: '0.8rem'
                      }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{
                      padding: '32px 16px',
                      textAlign: 'center',
                      color: '#999'
                    }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔔</div>
                      <div>No notifications yet</div>
                    </div>
                  ) : (
                    <div>
                      {notifications.map(notification => (
                        <div
                          key={notification._id}
                          onClick={() => handleNotificationClick(notification)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #f0f0f0',
                            cursor: 'pointer',
                            background: notification.read ? 'white' : '#e3f2fd',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                          onMouseLeave={(e) => e.currentTarget.style.background = notification.read ? 'white' : '#e3f2fd'}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px'
                          }}>
                            <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>
                              {notification.type === 'match' ? '🎯' : '📢'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontWeight: notification.read ? 'normal' : 'bold',
                                fontSize: '0.9rem',
                                marginBottom: '4px'
                              }}>
                                {notification.title}
                              </div>
                              <div style={{
                                fontSize: '0.85rem',
                                color: '#666',
                                marginBottom: '4px'
                              }}>
                                {notification.message}
                              </div>
                              <div style={{
                                fontSize: '0.75rem',
                                color: '#999'
                              }}>
                                {formatTimeAgo(notification.createdAt)}
                              </div>
                            </div>
                            {!notification.read && (
                              <div style={{
                                width: '8px',
                                height: '8px',
                                background: '#3498db',
                                borderRadius: '50%',
                                flexShrink: 0,
                                marginTop: '4px'
                              }} />
                            )}
                          </div>
                        </div>
                      ))}
                      
                      <div
                        onClick={() => {
                          setShowDropdown(false);
                          navigate('/notifications');
                        }}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'center',
                          color: '#3498db',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '0.9rem'
                        }}
                      >
                        View all notifications
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <span className="nav-user">Hi, {user.name}</span>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
