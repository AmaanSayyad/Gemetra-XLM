import React, { useState, useMemo, useEffect } from 'react';
import { Upload, FileCheck, CheckCircle, AlertCircle, Clock, FileText, FileUp, FormInput, ExternalLink, Sparkles, ChevronDown } from 'lucide-react';
import { isValidStellarAddress, getStellarExpertTxUrl } from '../utils/stellar';
import { useStellarWallet } from '../utils/stellar-wallet';
import { usePayments } from '../hooks/usePayments';
import { usePoints } from '../hooks/usePoints';
import { calculateVatClaimPoints } from '../utils/travelerPoints';
import { supabase, type VATRefundDetails } from '../lib/supabase';
import { requestTreasuryPayout, getConfiguredTreasuryAddress, classifyTreasuryError, isTreasuryLowBalanceError } from '../services/treasuryPayout';
import { checkClaimEligibility } from '../services/claimBlacklist';
import { formatStellarAddress } from '../config/treasury';
import { getCurrentNetwork } from '../config/stellar';
import { computeReceiptHashBytes32, submitClaimOnSorobanIfEnabled } from '../services/vatRefundOnchain';
import {
  VAT_COUNTRIES,
  getCountryByCode,
  calculateClaimAmounts,
  netRefundShort,
  REGIONS,
  getCountryClaimMeta,
  formatClaimMoney,
  billAmountLabel,
  countryFlag,
} from '../gemetra-ui/atlysAssets';
import { VATRefundWizardLayout } from './VATRefundWizardLayout';
import { PassportVerificationPanel } from './PassportVerificationPanel';
import type { PassportVerificationResult } from '../services/passportVerification';

interface VATRefundPageProps {
  onViewHistory?: () => void;
  onClaimComplete?: () => void;
  /** Country selected on landing/explore — pre-fills the claim destination */
  initialCountryCode?: string | null;
}

export const VATRefundPage: React.FC<VATRefundPageProps> = ({
  onViewHistory,
  onClaimComplete,
  initialCountryCode,
}) => {
  const { createPayment, updatePaymentStatus } = usePayments();
  const { earnPointsForVatClaim, getPointsForVatClaim } = usePoints();
  const { walletState, signTransaction } = useStellarWallet();
  const treasuryAddress = getConfiguredTreasuryAddress();
  const [step, setStep] = useState<'passport' | 'upload' | 'review' | 'sign' | 'confirmation' | 'error'>('passport');
  const [passportVerification, setPassportVerification] = useState<PassportVerificationResult | null>(null);
  const [passportSkipped, setPassportSkipped] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrValue, setQrValue] = useState<string>('');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [entryMode, setEntryMode] = useState<'upload' | 'manual'>('upload');
  const [selectedToken, setSelectedToken] = useState<'XLM'>('XLM');
  const [transactionStatus, setTransactionStatus] = useState<'waiting' | 'confirmed' | 'rejected'>('waiting');
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [lastEarnedPoints, setLastEarnedPoints] = useState<number | null>(null);
  const [claimCountryCode, setClaimCountryCode] = useState(() => {
    const fromProp = initialCountryCode?.toUpperCase();
    if (fromProp && getCountryByCode(fromProp)) return fromProp;
    const saved = localStorage.getItem('gemetra_claim_country');
    if (saved && getCountryByCode(saved)) return saved;
    return 'AE';
  });

  const claimCountry = useMemo(
    () => getCountryByCode(claimCountryCode) ?? getCountryByCode('AE')!,
    [claimCountryCode]
  );

  const claimMeta = useMemo(() => getCountryClaimMeta(claimCountry.code), [claimCountry.code]);

  const billDecimals = ['JPY', 'KRW', 'VND', 'IDR'].includes(claimMeta.currency) ? 0 : 2;

  const recalculateAmounts = (billAmountStr: string, countryCode: string = claimCountryCode) => {
    const country = getCountryByCode(countryCode);
    const billAmount = parseFloat(billAmountStr);
    if (!country || !billAmountStr || isNaN(billAmount) || billAmount <= 0) {
      return;
    }
    const meta = getCountryClaimMeta(country.code);
    const decimals = ['JPY', 'KRW', 'VND', 'IDR'].includes(meta.currency) ? 0 : 2;
    const { vatAmount, netRefund } = calculateClaimAmounts(billAmount, country);
    setFormData((prev) => ({
      ...prev,
      vatAmount: vatAmount.toFixed(decimals),
    }));
    setRefundAmount(netRefund);
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setClaimCountryCode(code);
    localStorage.setItem('gemetra_claim_country', code);
    if (formData.billAmount) {
      recalculateAmounts(formData.billAmount, code);
    }
  };

  // Form fields for manual entry
  const [formData, setFormData] = useState({
    vatRegNo: '',
    receiptNo: '',
    billAmount: '',
    vatAmount: '',
    passportNo: '',
    flightNo: '',
    nationality: '',
    dob: '',
    purchaseDate: '',
    merchantName: '',
    merchantAddress: '',
    receiverWalletAddress: ''
  });

  const claimAmounts = useMemo(() => {
    const bill = parseFloat(formData.billAmount);
    if (!formData.billAmount || isNaN(bill) || bill <= 0) return null;
    return calculateClaimAmounts(bill, claimCountry);
  }, [formData.billAmount, claimCountry]);

  useEffect(() => {
    if (initialCountryCode && getCountryByCode(initialCountryCode.toUpperCase())) {
      const code = initialCountryCode.toUpperCase();
      setClaimCountryCode(code);
      localStorage.setItem('gemetra_claim_country', code);
    }
  }, [initialCountryCode]);

  useEffect(() => {
    const wallet = walletState.publicKey;
    if (!wallet) return;

    const passport =
      formData.passportNo ||
      passportVerification?.mrz?.documentNumber ||
      undefined;

    checkClaimEligibility(wallet, passport).then((result) => {
      if (result.blocked) {
        setErrorMessage(
          `Your account cannot submit claims${result.reason ? `: ${result.reason}` : ''}. Contact support if you believe this is a mistake.`
        );
      }
    });
  }, [walletState.publicKey, formData.passportNo, passportVerification]);

  const estimatedPoints = useMemo(
    () => (refundAmount > 0 ? getPointsForVatClaim(refundAmount) : calculateVatClaimPoints(1)),
    [refundAmount, getPointsForVatClaim]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      if (formData.billAmount) {
        recalculateAmounts(formData.billAmount);
      } else {
        setRefundAmount(Math.floor(Math.random() * 9) + 1);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload');
      return;
    }

    if (!formData.receiverWalletAddress) {
      setErrorMessage('Please enter a receiver wallet address');
      return;
    }

    if (!formData.billAmount || !formData.vatAmount) {
      setErrorMessage('Enter the bill amount for your selected country');
      return;
    }

    // Validate wallet address format (Stellar address)
    if (!isValidStellarAddress(formData.receiverWalletAddress)) {
      setErrorMessage('Please enter a valid Stellar wallet address (G...)');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Simulate document processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStep('review');
    } catch (error) {
      setErrorMessage('Failed to process document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const [pendingRefundId, setPendingRefundId] = useState<string | null>(null);

  const buildRefundMemo = () => {
    const memoText = `VAT Refund - ${formData.receiptNo || formData.vatRegNo || 'N/A'}`;
    return memoText.length > 28 ? memoText.substring(0, 25) + '...' : memoText;
  };

  const executeTreasuryPayout = async (
    refundId: string,
    recipientAddress: string,
    amount: number,
    memo: string
  ): Promise<string> => {
    const result = await requestTreasuryPayout({
      paymentId: refundId,
      recipientAddress,
      amount,
      memo,
      payoutType: 'vat_refund',
      callerWallet: walletState.publicKey ?? undefined,
    });

    if (!result.ok || !result.txHash) {
      throw new Error(result.error || 'Treasury payout failed');
    }

    return result.txHash;
  };

  const handleApprove = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!walletState.isConnected || !walletState.publicKey) {
        throw new Error("Wallet not connected. Please connect your Stellar wallet.");
      }

      // Recipient wallet address
      const recipientAddress = entryMode === 'manual'
        ? formData.receiverWalletAddress
        : (formData.receiverWalletAddress || walletState.publicKey || '');

      if (!recipientAddress || !isValidStellarAddress(recipientAddress)) {
        throw new Error("Valid recipient Stellar wallet address is required");
      }

      const passportForCheck =
        formData.passportNo || passportVerification?.mrz?.documentNumber || undefined;
      const eligibility = await checkClaimEligibility(recipientAddress, passportForCheck);
      if (eligibility.blocked) {
        throw new Error(
          eligibility.reason
            ? `Claim blocked: ${eligibility.reason}`
            : 'This wallet or passport is blocked from submitting claims.'
        );
      }

      // Amount in XLM
      const amount = refundAmount;
      if (!amount) throw new Error("Refund amount is required");

      console.log("Processing VAT refund payment:", {
        recipient: recipientAddress,
        amount,
        token: "XLM",
      });

      // Create pending VAT refund record in database
      let refundId: string | null = null;
      try {
        const vatRefundDetails: VATRefundDetails = {
          ...buildVatRefundDetails(),
          receiverWalletAddress: formData.receiverWalletAddress || recipientAddress,
        };

        // Best-effort Soroban `submit_claim` + persist `contractClaimId`.
        // We never block the existing Supabase + treasury payout flow on on-chain failures.
        try {
          if (walletState.publicKey && signTransaction) {
            const receiptHashBytes32 = await computeReceiptHashBytes32(
              vatRefundDetails,
              refundAmount
            );

            if (receiptHashBytes32) {
              const contractClaimId = await submitClaimOnSorobanIfEnabled({
                claimant: walletState.publicKey,
                amountXlm: refundAmount,
                receiptHashBytes32,
                countryCode: claimCountryCode,
                signTransaction,
              });

              if (contractClaimId) {
                vatRefundDetails.contractClaimId = contractClaimId;
              }
            }
          }
        } catch (onchainErr) {
          console.warn('Soroban submit_claim skipped/failed (non-fatal):', onchainErr);
        }

        const pendingPayment = await createPayment({
          employee_id: "vat-refund",
          amount: refundAmount,
          token: "XLM",
          transaction_hash: undefined,
          status: "pending",
          payment_date: new Date().toISOString(),
        });
        refundId = pendingPayment.id;
        setPendingRefundId(refundId);
        console.log('✅ Created pending VAT refund record:', refundId);
        try {
          const { error: detailsError } = await supabase
            .from('payments')
            .update({
              vat_refund_details: vatRefundDetails
            })
            .eq('id', refundId);

          if (detailsError) {
            console.error('Error saving VAT refund details:', detailsError);
          } else {
            console.log('✅ Saved VAT refund details to Supabase');
          }
        } catch (detailsErr) {
          console.error('Failed to save VAT refund details (non-critical):', detailsErr);
        }
      } catch (dbError) {
        console.error("Failed to create pending VAT refund record:", dbError);
        throw new Error('Could not create refund record. Connect your wallet and try again.');
      }

      if (!refundId) {
        throw new Error('Could not create refund record.');
      }

      setStep('sign');

      const memo = buildRefundMemo();
      setQrValue('');

      console.log('🚀 Requesting treasury VAT refund payout:', {
        treasury: treasuryAddress,
        recipient: recipientAddress,
        amount,
        memo,
        refundId,
      });

      const tx = await executeTreasuryPayout(
        refundId,
        recipientAddress as string,
        amount,
        memo
      );

      console.log('Treasury payout confirmed:', tx);

      // Update pending refund record to completed, or create new one if pending wasn't created
      try {
        if (pendingRefundId) {
          // Update the existing pending record in Supabase
          const { error: updateError } = await supabase
            .from('payments')
            .update({
              transaction_hash: tx,
              status: 'completed',
              payment_date: new Date().toISOString()
            })
            .eq('id', pendingRefundId);

          if (updateError) {
            console.error('Error updating payment in Supabase:', updateError);
          } else {
            console.log('✅ Updated pending VAT refund to completed in Supabase:', pendingRefundId);
          }

          // Also update via usePayments hook for localStorage
          try {
            await updatePaymentStatus(pendingRefundId, 'completed', tx);
          } catch (hookError) {
            console.error('Error updating via hook (non-critical):', hookError);
          }
        } else {
          // Create new completed record if pending wasn't created
          const vatRefundDetails = {
            ...buildVatRefundDetails(),
            receiverWalletAddress: formData.receiverWalletAddress || recipientAddress,
          };

          const completedPayment = await createPayment({
            employee_id: "vat-refund",
            amount: refundAmount,
            token: "XLM",
            transaction_hash: tx,
            status: "completed",
            payment_date: new Date().toISOString(),
          });
          console.log('✅ Created completed VAT refund record:', completedPayment.id);

          // Save VAT refund details
          try {
            const { error: detailsError } = await supabase
              .from('payments')
              .update({
                vat_refund_details: vatRefundDetails
              })
              .eq('id', completedPayment.id);

            if (detailsError) {
              console.error('Error saving VAT refund details:', detailsError);
            } else {
              console.log('✅ Saved VAT refund details to Supabase');
            }
          } catch (detailsErr) {
            console.error('Failed to save VAT refund details (non-critical):', detailsErr);
          }
        }

        try {
          const earned = await earnPointsForVatClaim(refundAmount, tx);
          if (earned) {
            setLastEarnedPoints(earned.points);
            onClaimComplete?.();
          }
        } catch (pointsError) {
          console.error('Failed to award points (non-critical):', pointsError);
        }
      } catch (dbError) {
        console.error("Failed to update VAT refund payment:", dbError);
      }

      setTransactionHash(tx);
      // Update QR code to show transaction hash after confirmation
      setQrValue(`stellar://tx/${tx}`);
      setTransactionStatus("confirmed");
    } catch (error) {
      console.error("Error in handleApprove:", error);
      const raw = error instanceof Error ? error.message : 'An unexpected error occurred';
      const classified = classifyTreasuryError(raw);
      setErrorMessage(classified.userMessage);
      setTransactionStatus("rejected");
      setStep("sign");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSign = async () => {
    if (transactionStatus !== 'waiting') {
      if (transactionStatus === 'confirmed') {
        setStep('confirmation');
      }
      return;
    }

    if (!pendingRefundId) {
      setErrorMessage('Missing refund record. Please start again.');
      setTransactionStatus('rejected');
      return;
    }

    setIsLoading(true);
    try {
      if (!walletState.isConnected || !walletState.publicKey) {
        throw new Error('Wallet not connected. Please connect your Stellar wallet first.');
      }

      const recipientAddress = entryMode === 'manual'
        ? formData.receiverWalletAddress
        : (formData.receiverWalletAddress || walletState.publicKey || '');

      if (!recipientAddress || !isValidStellarAddress(recipientAddress)) {
        throw new Error('Valid recipient Stellar wallet address is required');
      }

      const memo = buildRefundMemo();

      const txHash = await executeTreasuryPayout(
        pendingRefundId,
        recipientAddress,
        refundAmount,
        memo
      );

      setTransactionHash(txHash);

      try {
        await updatePaymentStatus(pendingRefundId, 'completed', txHash);
      } catch (hookError) {
        console.error('Error updating via hook (non-critical):', hookError);
      }

      try {
        const earned = await earnPointsForVatClaim(refundAmount, txHash);
        if (earned) {
          setLastEarnedPoints(earned.points);
          onClaimComplete?.();
        }
      } catch (pointsError) {
        console.error('Failed to award points (non-critical):', pointsError);
      }

      setTransactionStatus('confirmed');
      setQrValue(`stellar://tx/${txHash}`);
    } catch (error) {
      console.error('Error in handleSign:', error);
      const raw = error instanceof Error ? error.message : 'An unexpected error occurred';
      const classified = classifyTreasuryError(raw);

      if (pendingRefundId) {
        try {
          await updatePaymentStatus(pendingRefundId, 'failed');
        } catch (dbError) {
          console.error('Failed to update VAT refund to failed:', dbError);
        }
      }

      setErrorMessage(classified.userMessage);
      setTransactionStatus('rejected');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePassportVerified = (
    result: PassportVerificationResult,
    autofill: { passportNo: string; nationality: string; dob: string }
  ) => {
    setPassportVerification(result);
    setFormData((prev) => ({
      ...prev,
      passportNo: autofill.passportNo || prev.passportNo,
      nationality: autofill.nationality || prev.nationality,
      dob: autofill.dob || prev.dob,
    }));
    if (['verified', 'partial', 'manual_review'].includes(result.status)) {
      setStep('upload');
    }
  };

  const handlePassportSkip = () => {
    setPassportSkipped(true);
    setStep('upload');
  };

  const handleReset = () => {
    setStep('passport');
    setPassportVerification(null);
    setPassportSkipped(false);
    setSelectedFile(null);
    setErrorMessage(null);
    setQrValue('');
    setTransactionStatus('waiting');
    setTransactionHash('');
    setRefundAmount(0);
    setLastEarnedPoints(null);
    setPendingRefundId(null);
    setFormData({
      vatRegNo: '',
      receiptNo: '',
      billAmount: '',
      vatAmount: '',
      passportNo: '',
      flightNo: '',
      nationality: '',
      dob: '',
      purchaseDate: '',
      merchantName: '',
      merchantAddress: '',
      receiverWalletAddress: ''
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'billAmount') {
      recalculateAmounts(value);
    }
  };

  const buildVatRefundDetails = () => ({
    claimCountryCode,
    claimCountryName: claimCountry.name,
    vatRegNo: formData.vatRegNo || undefined,
    receiptNo: formData.receiptNo || undefined,
    billAmount: formData.billAmount || undefined,
    vatAmount: formData.vatAmount || undefined,
    passportNo: formData.passportNo || undefined,
    flightNo: formData.flightNo || undefined,
    nationality: formData.nationality || undefined,
    dob: formData.dob || undefined,
    purchaseDate: formData.purchaseDate || undefined,
    merchantName: formData.merchantName || undefined,
    merchantAddress: formData.merchantAddress || undefined,
    receiverWalletAddress: formData.receiverWalletAddress || undefined,
    passportVerification: passportVerification
      ? {
          status: passportVerification.status,
          trustScore: passportVerification.trustScore,
          tier: passportVerification.tier,
          verifiedAt: passportVerification.verifiedAt,
          mrzValid: passportVerification.mrz?.checkDigitsValid ?? false,
        }
      : passportSkipped
        ? { status: 'manual', tier: 'manual' }
        : undefined,
  });

  const renderCountrySelector = () => (
    <div className="mb-6 rounded-xl border border-[var(--gem-brand)]/20 bg-[var(--gem-brand-soft)]/40 p-4">
      <label className="block text-sm font-semibold text-gray-900 mb-1">
        Country of purchase / tax claim <span className="text-red-500">*</span>
      </label>
      <p className="text-xs text-gray-600 mb-3">
        Where did you pay VAT or GST? Rates and refund amounts are calculated from this country&apos;s rules.
      </p>

      <div className="mb-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <img
          src={countryFlag(claimCountryCode)}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-gray-200"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{claimCountry.name}</p>
          <p className="text-xs text-gray-600">
            VAT {claimCountry.vatRate} · {netRefundShort(claimCountry.refundRate)} net refund
          </p>
        </div>
      </div>

      <label htmlFor="claim-country-select" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
        Change country
      </label>
      <div className="relative">
        <select
          id="claim-country-select"
          value={claimCountryCode}
          onChange={handleCountryChange}
          className="w-full appearance-none cursor-pointer rounded-lg border-2 border-dashed border-[var(--gem-brand)]/40 bg-white px-3 py-3 pr-10 text-sm font-medium text-gray-900 shadow-sm transition hover:border-[var(--gem-brand)] hover:bg-[var(--gem-brand-soft)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--gem-brand)] focus:border-[var(--gem-brand)]"
          required
          aria-label="Select a different country of purchase"
        >
          {REGIONS.filter((r) => r !== 'All').map((region) => (
            <optgroup key={region} label={region}>
              {VAT_COUNTRIES.filter((c) => c.region === region)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gem-brand)]"
          aria-hidden
        />
      </div>

      <p className="mt-2 text-xs text-[var(--gem-brand)]">
        {claimCountry.refundType} · Min spend: {claimCountry.minSpend}
      </p>
    </div>
  );

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.vatRegNo || !formData.receiptNo || !formData.billAmount || !formData.passportNo || !formData.receiverWalletAddress) {
      setErrorMessage('Please fill in all required fields including country and bill amount');
      return;
    }

    if (!formData.vatAmount || parseFloat(formData.vatAmount) <= 0) {
      setErrorMessage('Enter a valid bill amount so VAT can be calculated for your selected country');
      return;
    }

    // Validate wallet address format (Stellar address)
    if (!isValidStellarAddress(formData.receiverWalletAddress)) {
      setErrorMessage('Please enter a valid Stellar wallet address (G...)');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (refundAmount <= 0) {
        const bill = parseFloat(formData.billAmount);
        const { netRefund } = calculateClaimAmounts(bill, claimCountry);
        setRefundAmount(netRefund);
      }

      setStep('review');
    } catch (error) {
      setErrorMessage('Failed to process your request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const renderUploadTab = () => {
    switch (step) {
      case 'passport':
        return (
          <PassportVerificationPanel
            onVerified={handlePassportVerified}
            onSkip={handlePassportSkip}
            initialResult={passportVerification}
            walletAddress={(walletState.publicKey ?? formData.receiverWalletAddress) || undefined}
          />
        );

      case 'upload':
        return (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3 mb-2">
                <img
                  src="/xlm.png"
                  alt="XLM logo"
                  className="h-6 w-6 object-contain"
                />
                <h2 className="text-xl font-bold text-gray-900">Submit VAT Refund</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep('passport')}
                  className="text-sm text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]"
                >
                  ← Passport
                </button>
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setEntryMode('upload')}
                  className={`flex items-center px-4 py-2 text-sm ${entryMode === 'upload'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <FileUp className="w-4 h-4 mr-2" />
                  Upload Document
                </button>
                <button
                  onClick={() => setEntryMode('manual')}
                  className={`flex items-center px-4 py-2 text-sm ${entryMode === 'manual'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <FormInput className="w-4 h-4 mr-2" />
                  Manual Entry
                </button>
              </div>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              {entryMode === 'upload'
                ? 'Upload your VAT receipt document to process your refund. We support PDF, JPG, and PNG formats.'
                : 'Enter your VAT receipt details manually to process your refund.'}
            </p>

            <div className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--gem-brand)]/20 bg-[var(--gem-brand-soft)] px-4 py-3 text-sm text-[var(--gem-brand)]">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>
                Earn ~<strong>{estimatedPoints}</strong> traveler points when this claim completes
                {refundAmount > 0 ? ` (${refundAmount.toFixed(2)} XLM refund)` : ''}
              </span>
            </div>

            {renderCountrySelector()}

            {entryMode === 'upload' ? (
              <>
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center mb-6">
                  <Upload className="w-12 h-12 text-blue-500 mb-4" />
                  <p className="text-gray-700 mb-4 text-center">Drag and drop your document here or click to browse</p>
                  <label className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200">
                    Select File
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                    />
                  </label>
                  {selectedFile && (
                    <div className="mt-4 flex items-center text-sm text-gray-600">
                      <FileCheck className="w-5 h-5 mr-2 text-green-500" />
                      {selectedFile.name}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Purchase &amp; payment</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {billAmountLabel(claimMeta)} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="billAmount"
                        value={formData.billAmount}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`e.g. ${claimMeta.currencySymbol}1,250${billDecimals === 0 ? '' : '.00'}`}
                        step={billDecimals === 0 ? '1' : '0.01'}
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        VAT amount (auto, {claimMeta.currency})
                      </label>
                      <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900">
                        {formData.vatAmount
                          ? `${formatClaimMoney(parseFloat(formData.vatAmount), claimMeta)} (${claimCountry.vatRate})`
                          : 'Enter bill amount'}
                      </div>
                      {claimAmounts && (
                        <p className="mt-1 text-xs text-gray-500">{claimAmounts.calculationNote}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Wallet Address <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="receiverWalletAddress"
                        value={formData.receiverWalletAddress}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
                      <div className="p-2 bg-gray-100 border border-gray-300 rounded-lg">
                        <span className="text-sm font-medium text-gray-900">XLM (Stellar Lumens)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleUpload}
                    disabled={!selectedFile || !formData.receiverWalletAddress || !formData.billAmount || !formData.vatAmount || isLoading}
                    className={`bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200 ${!selectedFile || !formData.receiverWalletAddress || !formData.billAmount || !formData.vatAmount || isLoading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                  >
                    {isLoading ? 'Processing...' : 'Upload Document'}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-6">
                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {errorMessage}
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Receipt Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {billAmountLabel(claimMeta)} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="billAmount"
                        value={formData.billAmount}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`e.g. ${claimMeta.currencySymbol}1,250${billDecimals === 0 ? '' : '.00'}`}
                        step={billDecimals === 0 ? '1' : '0.01'}
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VAT Registration No. <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="vatRegNo"
                        value={formData.vatRegNo}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. GB123456789"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Receipt/Invoice No. <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="receiptNo"
                        value={formData.receiptNo}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. INV-12345"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        VAT amount (auto, {claimMeta.currency})
                      </label>
                      <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900">
                        {formData.vatAmount
                          ? `${formatClaimMoney(parseFloat(formData.vatAmount), claimMeta)} — ${claimCountry.vatRate}`
                          : 'Calculated when you enter bill amount'}
                      </div>
                      {claimAmounts && (
                        <p className="mt-1 text-xs text-gray-500">{claimAmounts.calculationNote}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Estimated refund ({claimMeta.currency})
                      </label>
                      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                        {refundAmount > 0
                          ? `${formatClaimMoney(refundAmount, claimMeta)} → ${refundAmount.toFixed(7)} XLM`
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                      <input
                        type="date"
                        name="purchaseDate"
                        value={formData.purchaseDate}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Wallet Address <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="receiverWalletAddress"
                        value={formData.receiverWalletAddress}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"
                        required
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
                    <div className="p-2 bg-gray-100 border border-gray-300 rounded-lg">
                      <span className="text-sm font-medium text-gray-900">XLM (Stellar Lumens)</span>
                    </div>
                  </div>

                  {refundAmount > 0 && (
                    <div className="mt-4 p-3 bg-gray-100 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Estimated refund:</span>
                        <span className="text-lg font-bold text-green-600">
                          {formatClaimMoney(refundAmount, claimMeta)} → {refundAmount.toFixed(7)} XLM
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="passportNo"
                        value={formData.passportNo}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. AB1234567"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Flight Number</label>
                      <input
                        type="text"
                        name="flightNo"
                        value={formData.flightNo}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. BA123"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country of Nationality</label>
                      <input
                        type="text"
                        name="nationality"
                        value={formData.nationality}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. United Kingdom"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Merchant Information</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Name</label>
                      <input
                        type="text"
                        name="merchantName"
                        value={formData.merchantName}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. ABC Store Ltd."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Address</label>
                      <input
                        type="text"
                        name="merchantAddress"
                        value={formData.merchantAddress}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. 123 High Street, London, UK"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                  >
                    {isLoading ? 'Processing...' : 'Submit Details'}
                  </button>
                </div>
              </form>
            )}
          </div>
        );

      case 'review':
        return (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/xlm.png"
                alt="XLM logo"
                className="h-6 w-6 object-contain"
              />
              <h2 className="text-xl font-bold text-gray-900">Review VAT Refund Details</h2>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
              {entryMode === 'upload' ? (
                <div className="flex items-start mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg mr-4">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedFile?.name}</h3>
                    <p className="text-sm text-gray-600">Uploaded just now</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg mr-4">
                    <FormInput className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Manual Entry</h3>
                    <p className="text-sm text-gray-600">Submitted just now</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="border-b border-gray-200 pb-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-3">Tax claim country</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-600">Country</p>
                      <p className="text-sm font-medium text-gray-900">{claimCountry.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Scheme</p>
                      <p className="text-sm font-medium text-gray-900">{claimCountry.refundType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Statutory VAT</p>
                      <p className="text-sm font-medium text-gray-900">{claimCountry.vatRate}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Net refund rate</p>
                      <p className="text-sm font-medium text-gray-900">{claimCountry.refundRate}</p>
                    </div>
                  </div>
                </div>

                {(passportVerification || formData.passportNo) && (
                  <div className="border-b border-gray-200 pb-4 mb-4">
                    <h4 className="font-medium text-gray-900 mb-3">Passport</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-gray-600">Passport Number</p>
                        <p className="text-sm font-medium text-gray-900">{formData.passportNo}</p>
                      </div>
                      {formData.nationality && (
                        <div>
                          <p className="text-sm text-gray-600">Nationality</p>
                          <p className="text-sm font-medium text-gray-900">{formData.nationality}</p>
                        </div>
                      )}
                      {passportVerification && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-600">Verification</p>
                          <p className="text-sm font-medium text-gray-900 capitalize">
                            {passportVerification.status.replace('_', ' ')} · {passportVerification.trustScore}% trust
                            {passportVerification.mrz?.checkDigitsValid ? ' · MRZ valid' : ''}
                          </p>
                        </div>
                      )}
                      {passportSkipped && !passportVerification && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-amber-700">Manually entered — not machine-verified</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {entryMode === 'manual' && (
                  <>
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-3">Receipt Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm text-gray-600">VAT Registration No.</p>
                          <p className="text-sm font-medium text-gray-900">{formData.vatRegNo}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Receipt/Invoice No.</p>
                          <p className="text-sm font-medium text-gray-900">{formData.receiptNo}</p>
                        </div>
                        {formData.billAmount && (
                          <div>
                            <p className="text-sm text-gray-600">Total Bill Amount</p>
                            <p className="text-sm font-medium text-gray-900">
                              {formatClaimMoney(parseFloat(formData.billAmount), claimMeta)}
                            </p>
                          </div>
                        )}
                        {formData.purchaseDate && (
                          <div>
                            <p className="text-sm text-gray-600">Purchase Date</p>
                            <p className="text-sm font-medium text-gray-900">{formData.purchaseDate}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-gray-600">Receiver Wallet Address</p>
                          <p className="text-sm font-medium text-gray-900 break-all">{formData.receiverWalletAddress}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Token</p>
                          <p className="text-sm font-medium text-gray-900">XLM (Stellar Lumens)</p>
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-3">Personal Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm text-gray-600">Passport Number</p>
                          <p className="text-sm font-medium text-gray-900">{formData.passportNo}</p>
                        </div>
                        {formData.flightNo && (
                          <div>
                            <p className="text-sm text-gray-600">Flight Number</p>
                            <p className="text-sm font-medium text-gray-900">{formData.flightNo}</p>
                          </div>
                        )}
                        {formData.nationality && (
                          <div>
                            <p className="text-sm text-gray-600">Country of Nationality</p>
                            <p className="text-sm font-medium text-gray-900">{formData.nationality}</p>
                          </div>
                        )}
                        {formData.dob && (
                          <div>
                            <p className="text-sm text-gray-600">Date of Birth</p>
                            <p className="text-sm font-medium text-gray-900">{formData.dob}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {(formData.merchantName || formData.merchantAddress) && (
                      <div className="border-b border-gray-200 pb-4 mb-4">
                        <h4 className="font-medium text-gray-900 mb-3">Merchant Information</h4>
                        <div className="grid grid-cols-1 gap-3">
                          {formData.merchantName && (
                            <div>
                              <p className="text-sm text-gray-600">Merchant Name</p>
                              <p className="text-sm font-medium text-gray-900">{formData.merchantName}</p>
                            </div>
                          )}
                          {formData.merchantAddress && (
                            <div>
                              <p className="text-sm text-gray-600">Merchant Address</p>
                              <p className="text-sm font-medium text-gray-900">{formData.merchantAddress}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Document Type:</span>
                  <span className="text-gray-900 font-medium">VAT Receipt</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Receiver Address:</span>
                  <span className="text-gray-900 font-medium break-all">{formData.receiverWalletAddress}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Token Type:</span>
                  <span className="text-gray-900 font-medium">{selectedToken}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 font-semibold">Total Refund:</span>
                  <span className="text-green-600 font-bold">{refundAmount.toFixed(2)} {selectedToken}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleReset}
                className="border border-gray-300 text-gray-700 font-medium py-2 px-6 rounded-lg transition-all duration-200 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleApprove}
                disabled={isLoading}
                className={`bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                {isLoading ? 'Processing...' : 'Approve & Continue'}
              </button>
            </div>
          </div>
        );

      case 'sign':
        return (
          <div className="overflow-hidden rounded-2xl border border-[var(--gem-border)] bg-white shadow-sm">
            <div className="border-b border-[var(--gem-border)] bg-gradient-to-r from-[var(--gem-brand-soft)]/60 to-white px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-[var(--gem-border)]">
                  <img src="/xlm.png" alt="" className="h-6 w-6 object-contain" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Treasury Payout</h2>
                  <p className="text-xs text-gray-500">Instant XLM refund to your wallet</p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {transactionStatus === 'waiting' ? (
                <div className="mx-auto max-w-md text-center">
                  <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-30" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                      <Clock className="h-9 w-9 text-white animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Sending your refund</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Paying from the Gemetra treasury — no wallet signature needed.
                  </p>

                  <div className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50 text-left shadow-sm">
                    <div className="border-b border-blue-100/80 bg-white/60 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Payout summary</p>
                    </div>
                    <div className="space-y-3 px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-blue-800">Amount</span>
                        <span className="text-lg font-bold text-blue-950">{refundAmount.toFixed(7)} {selectedToken}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-sm text-blue-800 shrink-0">To wallet</span>
                        <span className="text-right font-mono text-xs font-medium text-blue-950 break-all">
                          {formData.receiverWalletAddress || walletState.publicKey}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-blue-800">Network fee</span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          Paid by treasury
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-gray-500">
                    Treasury{' '}
                    <a
                      href={`https://stellar.expert/explorer/${getCurrentNetwork() === 'mainnet' ? 'public' : 'testnet'}/account/${treasuryAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[var(--gem-brand)] hover:underline"
                    >
                      {formatStellarAddress(treasuryAddress)}
                    </a>
                  </p>
                </div>
              ) : transactionStatus === 'confirmed' ? (
                <div className="mx-auto max-w-md text-center">
                  <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl" />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 shadow-xl ring-4 ring-emerald-100">
                      <CheckCircle className="h-12 w-12 text-white" strokeWidth={2.5} />
                    </div>
                    <Sparkles className="absolute -right-1 top-0 h-5 w-5 text-amber-400" aria-hidden />
                    <Sparkles className="absolute -left-2 bottom-2 h-4 w-4 text-emerald-300" aria-hidden />
                  </div>

                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Payment successful</p>
                  <h3 className="mt-1 text-2xl font-bold text-gray-900">Refund sent on Stellar</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {refundAmount.toFixed(7)} XLM has been sent to your wallet
                  </p>

                  <div className="mt-6 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm">
                    <div className="flex items-center justify-center gap-2">
                      <img src="/xlm.png" alt="" className="h-8 w-8 object-contain" />
                      <div className="text-left">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">You received</p>
                        <p className="text-2xl font-bold tabular-nums text-gray-900">{refundAmount.toFixed(7)} <span className="text-base font-semibold text-emerald-700">XLM</span></p>
                      </div>
                    </div>

                    {lastEarnedPoints != null && lastEarnedPoints > 0 && (
                      <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800">
                        <Sparkles className="h-4 w-4 shrink-0" />
                        <span>+{lastEarnedPoints} traveler points earned</span>
                      </div>
                    )}

                    <div className="mt-4 rounded-xl border border-emerald-100 bg-white/80 p-3">
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Transaction hash</p>
                      <a
                        href={getStellarExpertTxUrl(transactionHash || qrValue.slice(-16), getCurrentNetwork())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2.5 transition hover:bg-emerald-50"
                      >
                        <span className="truncate font-mono text-xs text-gray-800">
                          {transactionHash
                            ? `${transactionHash.slice(0, 12)}…${transactionHash.slice(-10)}`
                            : `${qrValue.slice(-16).slice(0, 16)}…`}
                        </span>
                        <ExternalLink className="h-4 w-4 shrink-0 text-emerald-600 group-hover:text-emerald-700" />
                      </a>
                    </div>
                  </div>

                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-4 py-2 text-xs font-medium text-blue-800">
                    <img src="/xlm.png" alt="" className="h-4 w-4 object-contain" />
                    Secured by Stellar · Powered by XLM
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-md text-center">
                  <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${isTreasuryLowBalanceError(undefined, errorMessage) ? 'bg-amber-100 ring-4 ring-amber-50' : 'bg-red-100 ring-4 ring-red-50'}`}>
                    <AlertCircle className={`h-10 w-10 ${isTreasuryLowBalanceError(undefined, errorMessage) ? 'text-amber-600' : 'text-red-500'}`} />
                  </div>
                  <p className={`text-xs font-bold uppercase tracking-widest ${isTreasuryLowBalanceError(undefined, errorMessage) ? 'text-amber-600' : 'text-red-600'}`}>
                    {isTreasuryLowBalanceError(undefined, errorMessage) ? 'Insufficient funds' : 'Payout failed'}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-gray-900">
                    {isTreasuryLowBalanceError(undefined, errorMessage) ? 'Treasury low balance' : 'Could not complete payout'}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {errorMessage || 'The transaction was rejected or failed to complete.'}
                  </p>
                  <div className={`mt-5 rounded-2xl border p-4 text-left text-sm ${isTreasuryLowBalanceError(undefined, errorMessage) ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-100 bg-red-50 text-red-800'}`}>
                    {isTreasuryLowBalanceError(undefined, errorMessage)
                      ? 'The platform treasury does not have enough XLM right now. Your claim has been saved — please contact support.'
                      : 'Please try again or contact support if the issue persists.'}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3 border-t border-[var(--gem-border)] bg-gray-50/50 px-6 py-4">
              <button
                onClick={handleReset}
                className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                {transactionStatus !== 'waiting' ? 'Back' : 'Cancel'}
              </button>
              {transactionStatus === 'waiting' ? (
                <button
                  onClick={handleSign}
                  disabled={isLoading}
                  className={`rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {isLoading ? 'Processing…' : 'Retry payout'}
                </button>
              ) : (
                <button
                  onClick={() => (transactionStatus === 'confirmed' ? setStep('confirmation') : handleReset())}
                  className={`rounded-xl px-5 py-2.5 text-sm font-medium transition ${
                    transactionStatus === 'confirmed'
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {transactionStatus === 'confirmed' ? 'Continue' : 'Try again'}
                </button>
              )}
            </div>
          </div>
        );

      case 'confirmation':
        return (
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="relative mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xl">
                  <CheckCircle className="w-12 h-12 text-white" />
                </div>
                <div className="absolute inset-0 w-24 h-24 bg-green-400 rounded-full mx-auto animate-ping opacity-20"></div>
              </div>
              <div className="flex items-center justify-center gap-3 mb-3">
                <img
                  src="/xlm.png"
                  alt="XLM logo"
                  className="h-7 w-7 object-contain"
                />
                <h2 className="text-2xl font-bold text-gray-900">VAT Refund Submitted Successfully</h2>
              </div>
              <p className="text-gray-600 text-base max-w-md mx-auto">
                Your VAT refund request has been successfully submitted and is being processed on the Stellar blockchain
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-6 mb-8 shadow-inner">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-300 pb-3">
                  <span className="text-gray-700 font-medium">Refund ID:</span>
                  <span className="text-gray-900 font-semibold text-lg">VAT-{Date.now().toString().slice(-7)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-300 pb-3">
                  <span className="text-gray-700 font-medium">Submission Type:</span>
                  <span className="text-gray-900 font-semibold">
                    {entryMode === 'upload' ? 'Document Upload' : 'Manual Entry'}
                  </span>
                </div>
                {entryMode === 'upload' && selectedFile && (
                  <div className="flex justify-between items-center border-b border-gray-300 pb-3">
                    <span className="text-gray-700 font-medium">Document:</span>
                    <span className="text-gray-900 font-semibold truncate max-w-xs">{selectedFile.name}</span>
                  </div>
                )}
                {entryMode === 'manual' && (
                  <>
                    <div className="flex justify-between items-center border-b border-gray-300 pb-3">
                      <span className="text-gray-700 font-medium">VAT Registration No:</span>
                      <span className="text-gray-900 font-semibold">{formData.vatRegNo}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-300 pb-3">
                      <span className="text-gray-700 font-medium">Receipt No:</span>
                      <span className="text-gray-900 font-semibold">{formData.receiptNo}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-300 pb-3">
                      <span className="text-gray-700 font-medium">Passport No:</span>
                      <span className="text-gray-900 font-semibold">{formData.passportNo}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center border-b border-gray-300 pb-3">
                  <span className="text-gray-700 font-medium">Refund Amount:</span>
                  <div className="flex items-center gap-2">
                    <img
                      src="/xlm.png"
                      alt="XLM"
                      className="h-5 w-5 object-contain"
                    />
                    <span className="text-green-600 font-bold text-lg">{selectedToken} {refundAmount.toFixed(7)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center border-b border-gray-300 pb-3">
                  <span className="text-gray-700 font-medium">Submission Date:</span>
                  <span className="text-gray-900 font-semibold">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                {transactionHash && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-300 pb-3">
                    <span className="text-gray-700 font-medium">Transaction Hash:</span>
                    <a
                      href={getStellarExpertTxUrl(transactionHash, getCurrentNetwork())}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-mono text-sm flex items-center gap-2 hover:text-blue-800 hover:underline bg-white px-3 py-1.5 rounded-lg border border-blue-200 transition-all"
                    >
                      <span className="truncate max-w-40">{transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}</span>
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    </a>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-700 font-medium">Status:</span>
                  <span className="inline-flex items-center gap-2 bg-green-100 text-green-700 font-semibold px-4 py-1.5 rounded-full">
                    <CheckCircle className="w-4 h-4" />
                    Completed
                  </span>
                </div>
              </div>
            </div>

            {(lastEarnedPoints ?? 0) > 0 && (
              <div className="mb-8 flex items-center justify-center gap-3 rounded-2xl border border-[var(--gem-brand)]/20 bg-[var(--gem-brand-soft)] px-6 py-4">
                <Sparkles className="h-5 w-5 text-[var(--gem-brand)]" />
                <div className="text-center sm:text-left">
                  <p className="font-semibold text-[var(--gem-text)]">+{lastEarnedPoints} traveler points earned</p>
                  <p className="text-xs text-[var(--gem-text-muted)]">Added to your Gemetra rewards balance</p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={handleReset}
                className="bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Submit Another Refund
              </button>
              <button
                onClick={() => onViewHistory?.()}
                className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-semibold py-3 px-8 rounded-lg transition-all duration-200 bg-white hover:bg-gray-50"
              >
                View my claims
              </button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-600">
                {errorMessage || 'An unexpected error occurred. Please try again.'}
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200"
              >
                Try Again
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <VATRefundWizardLayout step={step} claimCountryCode={claimCountryCode}>
      {renderUploadTab()}
    </VATRefundWizardLayout>
  );
};
