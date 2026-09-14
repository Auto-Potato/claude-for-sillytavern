// Legacy chats have no explicit custom-name flag. Recognize only the host's
// known generated filenames; leave other names visible rather than discard them.
export function chatLabel(row) {
  const file = String(row.file || '').trim();
  const prefix = `${row.name} - `;
  const date = file.startsWith(prefix) ? file.slice(prefix.length) : '';
  const generated = /^\d{4}-\d{1,2}-\d{1,2}\s*@\s*\d{1,2}h\s*\d{1,2}m\s*\d{1,2}s\s*\d{1,3}ms$/.test(date);
  const unnamedGroup = row.group && /^\d{13}$/.test(file);
  const custom = file && !generated && !unnamedGroup && file !== row.name;
  return { title:custom ? file : row.name, subtitle:custom ? row.name : '' };
}
