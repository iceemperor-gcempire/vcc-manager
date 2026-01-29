import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { authAPI } from '../services/api';
import { queryClient } from '../App';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = Cookies.get('token');
      if (token) {
        const response = await authAPI.getProfile();
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      Cookies.remove('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (token) => {
    console.log('🍪 Setting token in cookies');
    Cookies.set('token', token, { expires: 7 });
    
    queryClient.clear();
    console.log('🧹 Cleared all query cache on login');
    
    try {
      console.log('👤 Fetching user profile');
      const response = await authAPI.getProfile();
      setUser(response.data.user);
      console.log('✅ User profile set:', response.data.user.email);
    } catch (error) {
      console.error('❌ Failed to fetch profile after login:', error);
      Cookies.remove('token');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      Cookies.remove('token');
      queryClient.clear();
      console.log('🧹 Cleared all query cache on logout');
    }
  };

  const updateProfile = (updatedUser) => {
    setUser(prev => ({ ...prev, ...updatedUser }));
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateProfile,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin || false
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}