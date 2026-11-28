export type Approval = { status:string; requested_by:string|null; approved_by:string|null; requires_dual_approval:boolean };
export function approvalDecision(approval:Approval,actor:string,action:string,comment:string|undefined,now:string):Record<string,unknown> {
  if (approval.status !== 'pending') throw new Error('Approval already processed');
  if (!['approve','reject','cancel'].includes(action)) throw new Error('Invalid action');
  if (action === 'cancel') return {status:'cancelled',comment};
  if (approval.requested_by === actor) throw new Error('Keine Selbstfreigabe');
  if (action === 'reject') return {status:'rejected',rejection_reason:comment || 'Ohne Angabe',approved_by:actor,approved_at:now,comment};
  if (approval.requires_dual_approval) {
    if (approval.approved_by === actor) throw new Error('Zweiter Genehmiger erforderlich');
    if (approval.approved_by) return {second_approver_id:actor,second_approved_at:now,status:'approved',comment};
    return {approved_by:actor,approved_at:now,status:'pending',comment};
  }
  return {approved_by:actor,approved_at:now,status:'approved',comment};
}