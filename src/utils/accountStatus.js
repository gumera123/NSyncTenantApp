export function isAccountDeactivated(userData = {}) {
  const isActive = userData.isActive;
  const disabled = userData.disabled;
  const status = String(userData.status || userData.accountStatus || '').trim().toLowerCase();

  return (
    isActive === false ||
    String(isActive).trim().toLowerCase() === 'false' ||
    disabled === true ||
    String(disabled).trim().toLowerCase() === 'true' ||
    status === 'inactive' ||
    status === 'deactivated' ||
    status === 'disabled' ||
    status === 'deleted'
  );
}

export function getInactiveAccountMessage(userData = {}) {
  if (!userData) {
    return 'This account is unavailable.';
  }

  if (isAccountDeactivated(userData)) {
    return 'This account has been deactivated by the Super Admin.';
  }

  return '';
}
