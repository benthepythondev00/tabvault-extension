import ExtPay from 'extpay';

// Initialize ExtPay with TabVault extension ID
const extpay = ExtPay('tabvault-sessions');

export interface UserPaymentStatus {
  paid: boolean;
  paidAt: Date | null;
  installedAt: Date;
  trialStartedAt: Date | null;
  email: string | null;
}

/**
 * Get the current user's payment status
 */
export async function getPaymentStatus(): Promise<UserPaymentStatus> {
  try {
    const user = await extpay.getUser();
    return {
      paid: user.paid,
      paidAt: user.paidAt,
      installedAt: user.installedAt,
      trialStartedAt: user.trialStartedAt,
      email: user.email,
    };
  } catch (error) {
    console.error('TabVault: Failed to get payment status:', error);
    return {
      paid: false,
      paidAt: null,
      installedAt: new Date(),
      trialStartedAt: null,
      email: null,
    };
  }
}

/**
 * Check if user has paid (Pro user)
 */
export async function isPro(): Promise<boolean> {
  const status = await getPaymentStatus();
  return status.paid;
}

/**
 * Open the payment page for the user to upgrade
 */
export function openPaymentPage(): void {
  extpay.openPaymentPage();
}

/**
 * Open the login page for returning users
 */
export function openLoginPage(): void {
  extpay.openLoginPage();
}

/**
 * Open the management page for users to manage their subscription
 */
export function openManagementPage(): void {
  extpay.openPaymentPage();
}

/**
 * Listen for payment status changes
 */
export function onPaymentStatusChange(callback: (user: UserPaymentStatus) => void): void {
  extpay.onPaid.addListener((user) => {
    callback({
      paid: user.paid,
      paidAt: user.paidAt,
      installedAt: user.installedAt,
      trialStartedAt: user.trialStartedAt,
      email: user.email,
    });
  });
}

/**
 * Start background listener for payment events
 * Call this in your background script
 */
export function startPaymentBackgroundListener(): void {
  extpay.startBackground();
}

export { extpay };
