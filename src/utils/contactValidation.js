/**
 * Validate Philippine mobile numbers.
 * Accepts only:
 * - 09XXXXXXXXX (11 chars: 09 + 9 digits)
 * - +639XXXXXXXXX (13 chars: +639 + 9 digits)
 *
 * @param {string} contactNumber - The phone number to validate
 * @returns {boolean} True if valid, false otherwise
 */
export const validatePhilippineMobileNumber = (contactNumber) => {
  if (!contactNumber || typeof contactNumber !== 'string') {
    return false;
  }

  const trimmed = contactNumber.trim();

  // Check format 1: 09XXXXXXXXX (exactly 11 chars)
  const format1Regex = /^09\d{9}$/;
  if (format1Regex.test(trimmed)) {
    return true;
  }

  // Check format 2: +639XXXXXXXXX (exactly 13 chars)
  const format2Regex = /^\+639\d{9}$/;
  if (format2Regex.test(trimmed)) {
    return true;
  }

  return false;
};

/**
 * Get a user-friendly error message for invalid Philippine mobile number.
 * @returns {string} The error message
 */
export const getPhilippineMobileErrorMessage = () => {
  return 'Please enter a valid Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX';
};