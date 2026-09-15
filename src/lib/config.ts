export const DEPOSIT_ADDRESSES = {
  BTC: 'bc1q4ulqydnrstew9hr2dkjaey5he2j2zyj83475mc',
  'USDT-ERC20': '0x18595c69b0e49dA32037E19246Fe88FA321De1C6',
} as const;

export const BTC_NETWORK = 'Bitcoin mainnet';
export const USDT_NETWORK = 'ERC-20 (Ethereum mainnet)';

/**
 * Bank identity. The bank name is always written out in full — account numbers
 * use `Shield Safe Bank-00000000`, never an abbreviation such as "SSB".
 */
export const BANK_NAME = 'Shield Safe Bank';
export const ACCOUNT_NUMBER_PREFIX = BANK_NAME;

/** Every account opens with at least this much in USD. */
export const WELCOME_CREDIT_USD = 10;

export const GOOGLE_CLIENT_ID = '24300395823-ahbmo1pjkvnchlobe1gmf0em88mhmjgt.apps.googleusercontent.com';
export const API_BASE = '/api';
