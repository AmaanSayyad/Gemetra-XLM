import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStellarWallet } from '../utils/stellar-wallet';
import type { Notification } from '../lib/supabase';

export const useNotifications = () => {
  const { walletState } = useStellarWallet();
  const address = walletState.publicKey;
  const isConnected = walletState.isConnected;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isConnected || !address) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Use wallet address as user_id for wallet-based authentication
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', address)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setNotifications(data || []);
      setUnreadCount(data?.filter(notification => !notification.is_read).length || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
      // Fallback to empty array on error
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    fetchNotifications();
    
    const interval = setInterval(() => {
      fetchNotifications();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const calculatedUnreadCount = notifications.filter(n => !n.is_read).length;
    setUnreadCount(calculatedUnreadCount);
  }, [notifications]);

  const addNotification = useCallback(async (message: string): Promise<Notification | null> => {
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return null;
    }

    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('notifications')
        .insert([
          {
            user_id: address, // Use wallet address as user_id
            message,
            is_read: false
          }
        ])
        .select()
        .single();

      if (error) throw error;
      
      setNotifications(prev => [data, ...prev]);
      
      return data;
    } catch (err) {
      console.error('Error adding notification:', err);
      setError(err instanceof Error ? err.message : 'Failed to add notification');
      return null;
    }
  }, [address, isConnected]);

  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return false;
    }

    try {
      setError(null);
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', address);

      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true } 
            : notification
        )
      );
      
      return true;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError(err instanceof Error ? err.message : 'Failed to update notification');
      return false;
    }
  }, [address, isConnected]);

  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return false;
    }

    try {
      setError(null);
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', address)
        .eq('is_read', false);

      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, is_read: true }))
      );
      
      return true;
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError(err instanceof Error ? err.message : 'Failed to update notifications');
      return false;
    }
  }, [address, isConnected]);

  const deleteNotification = useCallback(async (notificationId: string): Promise<boolean> => {
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return false;
    }

    try {
      setError(null);
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', address);

      if (error) throw error;
      
      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      return true;
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
      return false;
    }
  }, [address, isConnected, notifications]);

  const clearAllNotifications = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return false;
    }

    try {
      setError(null);
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', address);

      if (error) throw error;
      
      // Update local state
      setNotifications([]);
      
      return true;
    } catch (err) {
      console.error('Error clearing notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear notifications');
      return false;
    }
  }, [address, isConnected]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
  };
};