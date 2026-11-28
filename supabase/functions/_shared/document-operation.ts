export function documentOperationAllowed(roles: string[], userId: string, owner: unknown, action: string): boolean {
  if (action === 'purge' || action === 'soft_delete') return roles.includes('Super Admin');
  return action === 'restore' && (owner === userId || roles.some(r => ['Super Admin', 'Admin', 'Geschäftsführung', 'Buchhaltung', 'Order'].includes(r)));
}
export function ownDocumentStorage(bucket: unknown, path: unknown, id: string): path is string {
  return bucket === 'alixdocs-private' && typeof path === 'string' && path.startsWith(`docs/${id}/`) && !path.split('/').some(p => p === '..' || p === '.') && !/[\\%?#\x00-\x1f]/.test(path);
}
export const facsimileRoles = ['Super Admin', 'Admin', 'Vertrieb', 'Vertriebsleitung', 'Service', 'Order', 'SACHBEARBEITUNG', 'After Sales', 'Kundenservice', 'Angebotsersteller', 'Finance', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'];
