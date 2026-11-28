import {z} from 'npm:zod@3.25.76';
/** The existing scheduler sends source=cron; it is metadata, never authorization. */
export const JourneyInput=z.object({source:z.literal('cron').optional(),dry_run:z.boolean().default(false),journey_id:z.string().uuid().nullish(),enroll_contact_id:z.string().uuid().nullish()}).strict();