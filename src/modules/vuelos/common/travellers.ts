import { EntityManager } from 'typeorm';
import { FieldCipher } from './cifrado';
import { Traveller } from '../entities/traveller.entity';

export interface TravellerDocument {
  documentType: string;
  nationality: string;
  documentNumber: string;
}

/** "AB 123", "ab-123" and "AB123" are the same document (same normalisation as the duplicate check in business-rules). */
export const normalizeDocumentNumber = (value: string): string => value.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();

export const documentHashOf = (doc: TravellerDocument): string =>
  FieldCipher.blindIndex(`${doc.documentType.toUpperCase()}|${doc.nationality.toUpperCase()}|${normalizeDocumentNumber(doc.documentNumber)}`);

/**
 * The traveller of each document, created when new. Concurrent bookings of the same person insert the same hash: the unique
 * index lets one win (`ON CONFLICT DO NOTHING`) and all read the single row, so a person never exists twice.
 * Returns the traveller id by document hash.
 */
export async function ensureTravellers(manager: EntityManager, documents: TravellerDocument[]): Promise<Map<string, string>> {
  const byHash = new Map<string, TravellerDocument>();
  for (const doc of documents) byHash.set(documentHashOf(doc), doc);
  if (byHash.size === 0) return new Map();

  await manager
    .createQueryBuilder()
    .insert()
    .into(Traveller)
    .values([...byHash].map(([documentHash, doc]) => ({ documentHash, documentType: doc.documentType.toUpperCase(), nationality: doc.nationality.toUpperCase() })))
    .orIgnore()
    .execute();

  const rows = await manager.createQueryBuilder(Traveller, 't').where('t."documentHash" IN (:...hashes)', { hashes: [...byHash.keys()] }).getMany();
  return new Map(rows.map((t) => [t.documentHash, t.travellerId]));
}
