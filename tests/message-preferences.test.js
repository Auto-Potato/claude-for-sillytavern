import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeMessagePreferences, messagePreferences } from '../src/message-preferences.js';

test('metadata defaults clear legacy enabled flags once and synchronize native controls', () => {
  const settings = {}, power = { unrelated: true };
  const inputs = new Map(messagePreferences.map(([key,id]) => {
    power[key] = true;
    return [id, { checked: true }];
  }));
  const classes = new Set();
  const doc = { getElementById: id => inputs.get(id), body: { classList: { add: name => classes.add(name) } } };
  let saves = 0;
  initializeMessagePreferences(settings, power, doc, () => saves++);
  for (const [key,id,hidden] of messagePreferences) {
    assert.equal(power[key], false);
    assert.equal(inputs.get(id).checked, false);
    assert.ok(classes.has(hidden));
  }
  assert.equal(power.unrelated, true);
  power.timer_enabled = true;
  inputs.get('messageTimerEnabled').checked = true;
  classes.delete('no-timer');
  initializeMessagePreferences(settings, power, doc, () => saves++);
  assert.equal(power.timer_enabled, true);
  assert.equal(inputs.get('messageTimerEnabled').checked, true);
  assert.equal(classes.has('no-timer'), false);
  assert.equal(saves, 1);
});

test('defaults do not require preference controls to be mounted', () => {
  const settings = {}, power = {};
  initializeMessagePreferences(settings, power, { getElementById: () => null, body: { classList: { add() {} } } }, () => {});
  assert.equal(settings.messageMetadataDefaults, 1);
  assert.deepEqual(Object.values(power), [false, false, false]);
});
