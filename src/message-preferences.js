// One-time defaults, not a recurring reset of the user's display choices.
export const messagePreferences = [
  ['timer_enabled', 'messageTimerEnabled', 'no-timer'],
  ['message_token_count_enabled', 'messageTokensEnabled', 'no-tokenCount'],
  ['mesIDDisplay_enabled', 'mesIDDisplayEnabled', 'no-mesIDDisplay'],
];

export function initializeMessagePreferences(settings, powerUser, doc, save) {
  if (settings.messageMetadataDefaults === 1) return;
  for (const [key, id, hiddenClass] of messagePreferences) {
    powerUser[key] = false;
    const input = doc.getElementById(id);
    if (input) input.checked = false;
    doc.body.classList.add(hiddenClass);
  }
  settings.messageMetadataDefaults = 1;
  save();
}
