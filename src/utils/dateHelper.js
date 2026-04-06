/**
 * Format a Date object to YYYY-MM-DD string
 * @param {Date} date - The date to format
 * @returns {string} Formatted date as YYYY-MM-DD
 */
export const formatDateToString = (date) => {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Parse a YYYY-MM-DD string to a Date object
 * @param {string} dateString - The date string in YYYY-MM-DD format
 * @returns {Date} The parsed date object, or today's date if invalid
 */
export const parseDateString = (dateString) => {
  if (!dateString) return new Date();
  
  const [year, month, day] = dateString.split('-').map(Number);
  
  if (!year || !month || !day) {
    return new Date();
  }
  
  return new Date(year, month - 1, day);
};