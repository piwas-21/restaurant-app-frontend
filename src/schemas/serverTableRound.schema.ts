import { z } from 'zod';

// Matches Order.Notes persistence in the backend OrderConfiguration.
export const SERVER_TABLE_ROUND_NOTES_MAX_LENGTH = 1000;

export const serverTableRoundNotesSchema = z
  .string()
  .max(SERVER_TABLE_ROUND_NOTES_MAX_LENGTH, 'server.round.notes_too_long');
