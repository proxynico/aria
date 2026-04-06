import type { EntityIdentity, EntitySource } from "./types";

interface IdentityInput {
  id?: string;
  source: EntitySource;
  persistentId?: string;
  libraryId?: string;
  catalogId?: string;
  derivedId?: string;
}

export function buildIdentity(input: IdentityInput): EntityIdentity {
  const id = input.id
    ?? (input.persistentId ? createEntityRef(input.source, "persistent", input.persistentId) : undefined)
    ?? (input.libraryId ? createEntityRef(input.source, "library", input.libraryId) : undefined)
    ?? (input.catalogId ? createEntityRef(input.source, "catalog", input.catalogId) : undefined)
    ?? (input.derivedId ? createEntityRef(input.source, "derived", input.derivedId) : undefined);
  if (!id) {
    throw new Error("Entity identity requires at least one ID");
  }

  return {
    id,
    source: input.source,
    persistentId: input.persistentId,
    libraryId: input.libraryId,
    catalogId: input.catalogId,
  };
}

export function hasNativePersistentId(entity: EntityIdentity): entity is EntityIdentity & { persistentId: string } {
  return typeof entity.persistentId === "string" && entity.persistentId.length > 0;
}

export type EntityRefKind = "persistent" | "library" | "catalog" | "derived";

export interface EntityRef {
  source: EntitySource;
  kind: EntityRefKind;
  value: string;
}

export function createEntityRef(source: EntitySource, kind: EntityRefKind, value: string): string {
  return `${source}:${kind}:${value}`;
}

export function parseEntityRef(id: string): EntityRef | null {
  const match = id.match(/^(native|api):(persistent|library|catalog|derived):(.+)$/);
  if (!match) return null;
  return {
    source: match[1] as EntitySource,
    kind: match[2] as EntityRefKind,
    value: match[3],
  };
}
