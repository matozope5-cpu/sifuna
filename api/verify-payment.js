// api/verify-payment.js
import { MEGAPAY_CONFIG } from './megapay-config';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({ error: 'Reference is required' });
    }

    const payload = {
      api_key: MEGAPAY_CONFIG.apiKey,
      email: MEGAPAY_CONFIG.email,
      transaction_request_id: reference
    };

    const response = await fetch(`${MEGAPAY_CONFIG.baseUrl}/backend/v1/transactionstatus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    // 🔍 Log the full response to see what MegaPay returns
    console.log('MegaPay verification response:', JSON.stringify(result, null, 2));

    if (!response.ok) {
      throw new Error(result.message || result.error || 'Payment verification failed');
    }

    // --- Determine status from various possible fields ---
    let status = result.status || result.result_code || result.state || result.Status || '';

    // If status is numeric (e.g., 0 = success, 1 = pending, 2 = failed), map it
    if (typeof status === 'number') {
      // Adjust these numbers based on MegaPay's actual codes
      const numericMap = {
        0: 'COMPLETED',
        1: 'PENDING',
        2: 'FAILED',
        3: 'CANCELLED'
      };
      status = numericMap[status] || String(status);
    }

    // Normalize status string to uppercase for mapping
    const statusUpper = typeof status === 'string' ? status.toUpperCase() : '';

    // Map status to our internal statuses
    const statusMap = {
      'COMPLETED': 'COMPLETED',
      'SUCCESS': 'COMPLETED',
      'PAID': 'COMPLETED',
      'PENDING': 'PENDING',
      'FAILED': 'FAILED',
      'CANCELLED': 'CANCELLED',
      '0': 'COMPLETED',   // if returned as string
      '1': 'PENDING',
      '2': 'FAILED',
      '3': 'CANCELLED'
    };

    const mappedStatus = statusMap[statusUpper] || statusUpper || 'UNKNOWN';

    // If status is still unknown, log the raw data for debugging
    if (mappedStatus === 'UNKNOWN') {
      console.warn('Unknown status received from MegaPay:', result);
    }

    res.status(200).json({
      success: true,
      status: mappedStatus,
      data: result,
      // Also return raw status for frontend if needed
      raw_status: status
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      success: false
    });
  }
}