import { getIdToken } from 'firebase/auth';
import { auth } from '../../firebaseConfig';

// Cloud Run endpoint URL - set this to your deployed Cloud Run service URL
const CLOUD_RUN_URL = process.env.REACT_APP_CLOUD_RUN_URL || 'http://localhost:3001';

/**
 * Add a task to the user's Google Calendar
 * @param {string} taskTitle - The title of the task
 * @param {string} dueDate - The due date in YYYY-MM-DD format
 * @param {string} boardTitle - Optional: The board title for context
 * @param {string} description - Optional: Task description
 * @returns {Promise<{ok: boolean, calendarEventId: string, calendarLink: string}>}
 */
export const addTaskToCalendar = async (taskTitle, dueDate, boardTitle = '', description = '') => {
  try {
    if (!auth.currentUser) {
      return {
        ok: false,
        error: 'User not authenticated',
        code: 'auth/not-signed-in',
      };
    }

    // Get Firebase ID token for authentication
    const idToken = await getIdToken(auth.currentUser);

    const response = await fetch(`${CLOUD_RUN_URL}/api/tasks/sync-calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken,
        taskTitle,
        dueDate,
        boardTitle,
        description,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Failed to add task to Google Calendar:', result);
      return {
        ok: false,
        error: result.message || 'Failed to sync with Google Calendar',
        code: result.error,
      };
    }

    return result;
  } catch (error) {
    console.error('Failed to add task to Google Calendar:', error);
    
    return {
      ok: false,
      error: error.message || 'Failed to sync with Google Calendar',
      code: 'network-error',
    };
  }
};

/**
 * Check if user has Google Calendar connected
 * @param {string} userId - The Firebase user ID
 * @returns {Promise<boolean>}
 */
export const hasGoogleCalendarConnected = async (userId) => {
  try {
    // This would require a separate callable function to check
    // For now, we can handle this in the app by checking user profile
    return false;
  } catch (error) {
    console.error('Error checking Google Calendar connection:', error);
    return false;
  }
};

/**
 * Format date to YYYY-MM-DD format for Google Calendar API
 * @param {Date} date - JavaScript Date object
 * @returns {string} - Formatted date string
 */
export const formatDateForCalendar = (date) => {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};
