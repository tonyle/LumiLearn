import {parentPage} from '@/lib/parent-page';import {fail} from '@/lib/http';
// Bulk PDF rendering is intentionally disabled; individual worksheet PDF routes remain available.
export async function GET(){await parentPage();return fail('BULK_PRINT_REMOVED','Print one worksheet at a time from Assignments.',410);}
