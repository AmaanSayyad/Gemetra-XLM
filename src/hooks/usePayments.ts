import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Payment } from '../lib/supabase';
import { useStellarWallet } from '../utils/stellar-wallet';
import { getCurrentNetwork } from '../config/stellar';
import { getStellarExpertTxUrl } from '../utils/stellar';
import { filterLegitimateXlmVatRefunds } from '../utils/vatRefundPayments';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const usePayments = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { walletState } = useStellarWallet();
  const address = walletState.publicKey;
  const isConnected = walletState.isConnected;
  
  useEffect(() => {
    const checkWalletConnection = () => {
      if (isConnected && address) {
        setWalletAddress(address);
      } else {
        setWalletAddress(null);
      }
    };
    checkWalletConnection();
  }, [isConnected, address]);
  
  useEffect(() => {
    if (walletAddress) {
      const localStorageKey = `gemetra_payments_${walletAddress}`;
      const storedPayments = localStorage.getItem(localStorageKey);
      
      if (storedPayments) {
        try {
          const raw = JSON.parse(storedPayments) as Payment[];
          const parsedPayments = filterLegitimateXlmVatRefunds(raw);
          setPayments(parsedPayments);
          if (parsedPayments.length !== raw.length) {
            localStorage.setItem(localStorageKey, JSON.stringify(parsedPayments));
          }
          console.log('Loaded payments from localStorage:', parsedPayments.length);
        } catch (parseError) {
          console.error('Error parsing payments from localStorage:', parseError);
          setPayments([]);
        }
      } else {
        setPayments([]);
      }
    } else {
      setPayments([]);
    }
  }, [walletAddress]);

  const createPayment = useCallback(async (paymentData: Omit<Payment, 'id' | 'user_id' | 'created_at' | 'blockchain_type' | 'network'>) => {
    setLoading(true);
    setError(null);
    
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    try {
      const now = new Date().toISOString();
      const network = getCurrentNetwork();
      
      const newPayment: Payment = {
        id: generateUUID(),
        user_id: walletAddress,
        ...paymentData,
        token: paymentData.token || 'XLM',
        blockchain_type: 'stellar',
        network: network,
        created_at: now,
        memo: paymentData.memo,
        ledger: paymentData.ledger
      };
      
      setPayments(prevPayments => {
        const updatedPayments = [newPayment, ...prevPayments];
        const localStorageKey = `gemetra_payments_${walletAddress}`;
        localStorage.setItem(localStorageKey, JSON.stringify(updatedPayments));
        
        console.log(`💾 Added payment to localStorage for employee ${paymentData.employee_id}:`, {
          id: newPayment.id,
          employee_id: paymentData.employee_id,
          amount: paymentData.amount,
          txHash: paymentData.transaction_hash,
          network: newPayment.network,
          memo: paymentData.memo,
          ledger: paymentData.ledger
        });
        
        return updatedPayments;
      });
      
      try {
        const { data, error } = await supabase
          .from('payments')
          .upsert([{
            ...paymentData,
            id: newPayment.id,
            user_id: walletAddress,
            token: paymentData.token || 'XLM',
            blockchain_type: 'stellar',
            network: network,
          }], {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select();
        
        if (error) {
          if (error.code === '23505') {
            console.log('ℹ️ Payment already exists in Supabase (duplicate key):', newPayment.id);
          } else {
            console.error('❌ Failed to save payment to Supabase:', error);
          }
        } else {
          console.log('✅ Successfully saved payment to Supabase:', data);
        }
      } catch (supabaseError) {
        console.error('❌ Exception saving payment to Supabase:', supabaseError);
      }
      
      return newPayment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create payment';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, payments]);

  const updatePaymentStatus = useCallback(async (
    id: string, 
    status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'blacklisted',
    transactionHash?: string
  ) => {
    setLoading(true);
    setError(null);
    
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    try {
      const paymentToUpdate = payments.find(payment => payment.id === id);
      if (!paymentToUpdate) {
        throw new Error(`Payment with ID ${id} not found`);
      }
      
      const updateData: Partial<Payment> = { status };
      if (transactionHash) {
        updateData.transaction_hash = transactionHash;
      }
      
      const updatedPayment = {
        ...paymentToUpdate,
        ...updateData
      };
      
      const updatedPayments = payments.map(payment => payment.id === id ? updatedPayment : payment);
      setPayments(updatedPayments);
      
      const localStorageKey = `gemetra_payments_${walletAddress}`;
      localStorage.setItem(localStorageKey, JSON.stringify(updatedPayments));
      
      try {
        await supabase
          .from('payments')
          .update(updateData)
          .eq('id', id);
      } catch (supabaseError) {
        console.error('Failed to update payment in Supabase (continuing anyway):', supabaseError);
      }
      
      return updatedPayment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update payment';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, payments]);

  const getPaymentsByEmployee = useCallback(async (employeeId: string) => {
    setLoading(true);
    setError(null);
    
    if (!walletAddress) {
      return [];
    }

    try {
      const employeePayments = payments.filter(payment => payment.employee_id === employeeId);
      return [...employeePayments].sort((a, b) => {
        const dateA = a.payment_date ? new Date(a.payment_date).getTime() : 0;
        const dateB = b.payment_date ? new Date(b.payment_date).getTime() : 0;
        return dateB - dateA;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch payments';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, payments]);

  const getAllPayments = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!walletAddress) {
      return [];
    }

    try {
      return [...payments].sort((a, b) => {
        const dateA = a.payment_date ? new Date(a.payment_date).getTime() : 0;
        const dateB = b.payment_date ? new Date(b.payment_date).getTime() : 0;
        return dateB - dateA;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch all payments';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, payments]);

  const getBlockchainTypeName = useCallback((_payment: Payment): string => 'Stellar', []);

  const getBlockchainTypeBadge = useCallback((_payment: Payment): { label: string; color: string } => ({
    label: 'Stellar',
    color: 'purple',
  }), []);

  const getExplorerLink = useCallback((payment: Payment): string | null => {
    if (!payment.transaction_hash) {
      return null;
    }
    return getStellarExpertTxUrl(payment.transaction_hash, payment.network);
  }, []);

  const formatTransactionHash = useCallback((payment: Payment): string => {
    if (!payment.transaction_hash) {
      return 'N/A';
    }

    const hash = payment.transaction_hash;
    if (hash.length >= 16) {
      return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
    }
    return hash;
  }, []);

  const getNetworkName = useCallback((payment: Payment): string => {
    return payment.network === 'mainnet' ? 'Mainnet' : 'Testnet';
  }, []);

  return {
    loading,
    error,
    createPayment,
    updatePaymentStatus,
    getPaymentsByEmployee,
    getAllPayments,
    getBlockchainTypeName,
    getBlockchainTypeBadge,
    getExplorerLink,
    formatTransactionHash,
    getNetworkName,
  };
};
