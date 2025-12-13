// ExtPay content script for payment callbacks
// This is required by ExtPay to detect when user completes payment
import ExtPay from 'extpay';

export default defineContentScript({
  matches: ['https://extensionpay.com/*'],
  runAt: 'document_start',
  main() {
    // ExtPay handles the message passing internally when imported
    // This content script enables onPaid callbacks to work
    console.log('TabVault: ExtPay content script loaded');
  },
});
