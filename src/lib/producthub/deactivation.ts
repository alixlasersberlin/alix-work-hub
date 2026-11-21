export function deactivatedGlobalChannels(before: Record<string, unknown>, patch: Record<string, unknown>): ('com' | 'de')[] {
  return (['com', 'de'] as const).filter(code => before[`active_${code}`] === true && patch[`active_${code}`] === false);
}

export function isChannelDeactivation(patch: Record<string, unknown>) {
  return patch.hold === true || patch.status === 'inactive';
}