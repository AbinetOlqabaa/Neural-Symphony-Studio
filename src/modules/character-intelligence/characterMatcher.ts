import type { CharacterEntry, ImageAnalysis } from '../../types/studio';

export interface MatchCandidate {
  characterId: string;
  characterName: string;
  score: number;
  reasons: string[];
  requiresHumanReview: boolean;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function evaluateCharacterMatch(
  analysis: ImageAnalysis,
  characters: CharacterEntry[]
): MatchCandidate[] {
  const attrs = analysis.visualAttributes;
  const hairTokens = tokenize(attrs.hairstyle);
  const clothTokens = tokenize(attrs.clothing);
  const faceTokens = tokenize(attrs.facialCharacteristics);
  const subjectTokens = tokenize(attrs.humanSubjects);

  const candidates: MatchCandidate[] = [];

  for (const char of characters) {
    const hairSim = jaccard(hairTokens, tokenize(char.hairstyle));
    const clothSim = jaccard(clothTokens, tokenize(char.clothing));
    const faceSim = jaccard(faceTokens, tokenize(char.facialDescription));
    const subjSim = jaccard(subjectTokens, tokenize(char.distinguishingCharacteristics));

    const weightedScore = Number(
      (faceSim * 0.4 + hairSim * 0.25 + clothSim * 0.2 + subjSim * 0.15).toFixed(2)
    );

    const reasons: string[] = [];
    if (faceSim >= 0.2) reasons.push(`Facial traits overlap (${Math.round(faceSim * 100)}%)`);
    if (hairSim >= 0.2) reasons.push(`Hairstyle similarity (${Math.round(hairSim * 100)}%)`);
    if (clothSim >= 0.2) reasons.push(`Clothing match (${Math.round(clothSim * 100)}%)`);

    if (weightedScore > 0.12) {
      candidates.push({
        characterId: char.id,
        characterName: char.name,
        score: weightedScore,
        reasons: reasons.length > 0 ? reasons : ['Partial attribute similarity'],
        // Conservative threshold: never auto-confirm uncertain matches without human review
        requiresHumanReview: weightedScore < 0.85,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export function mergeCharacters(
  characters: CharacterEntry[],
  primaryId: string,
  secondaryId: string
): CharacterEntry[] {
  if (primaryId === secondaryId) return characters;
  const primary = characters.find((c) => c.id === primaryId);
  const secondary = characters.find((c) => c.id === secondaryId);
  if (!primary || !secondary) return characters;

  const merged: CharacterEntry = {
    ...primary,
    referenceAssetIds: Array.from(new Set([...primary.referenceAssetIds, ...secondary.referenceAssetIds])),
    associatedAssetIds: Array.from(new Set([...primary.associatedAssetIds, ...secondary.associatedAssetIds])),
    associatedSceneIds: Array.from(new Set([...primary.associatedSceneIds, ...secondary.associatedSceneIds])),
    distinguishingCharacteristics: [primary.distinguishingCharacteristics, secondary.distinguishingCharacteristics]
      .filter(Boolean)
      .join(' | '),
    needsHumanReview: false,
    reviewedByHuman: true,
  };

  return characters.filter((c) => c.id !== secondaryId).map((c) => (c.id === primaryId ? merged : c));
}

export function splitCharacterAsset(
  characters: CharacterEntry[],
  characterId: string,
  assetId: string,
  newCharacterName: string
): CharacterEntry[] {
  const source = characters.find((c) => c.id === characterId);
  if (!source) return characters;

  const updatedSource: CharacterEntry = {
    ...source,
    referenceAssetIds: source.referenceAssetIds.filter((id) => id !== assetId),
    associatedAssetIds: source.associatedAssetIds.filter((id) => id !== assetId),
    primaryReferenceAssetId:
      source.primaryReferenceAssetId === assetId
        ? source.referenceAssetIds.find((id) => id !== assetId)
        : source.primaryReferenceAssetId,
  };

  const newEntry: CharacterEntry = {
    id: `char_${Date.now().toString(36)}`,
    name: newCharacterName.trim() || 'Separated Character',
    label: 'Separated Identity',
    referenceAssetIds: [assetId],
    primaryReferenceAssetId: assetId,
    distinguishingCharacteristics: source.distinguishingCharacteristics,
    facialDescription: source.facialDescription,
    hairstyle: source.hairstyle,
    clothing: source.clothing,
    accessories: source.accessories,
    approximateAgeCategory: source.approximateAgeCategory,
    typicalPose: source.typicalPose,
    appearanceConstraints: 'Verify distinct visual identity attributes for this separated character.',
    identityPreservationInstructions: 'Maintain distinct facial structure and silhouette separate from source character.',
    associatedAssetIds: [assetId],
    associatedSceneIds: [],
    matchConfidence: 1,
    needsHumanReview: true,
    reviewedByHuman: false,
  };

  return characters.map((c) => (c.id === characterId ? updatedSource : c)).concat(newEntry);
}
