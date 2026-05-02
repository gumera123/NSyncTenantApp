let promptHandler = null;

export const setPromptHandler = (handler) => {
  promptHandler = typeof handler === 'function' ? handler : null;

  return () => {
    if (promptHandler === handler) {
      promptHandler = null;
    }
  };
};

export const showPrompt = (payload) => {
  if (!promptHandler) {
    return false;
  }

  promptHandler(payload || {});
  return true;
};
