export interface FilterCodec<T> {
  parse: (raw: string) => T | undefined;
  serialize: (value: T) => string;
}

export function enumCodec<T extends string>(allowed: readonly T[]): FilterCodec<T> {
  return {
    parse: (raw) => (allowed.includes(raw as T) ? (raw as T) : undefined),
    serialize: (value) => value,
  };
}

export function booleanCodec(): FilterCodec<boolean> {
  return {
    parse: (raw) => {
      if (raw === "true") return true;
      if (raw === "false") return false;
      return undefined;
    },
    serialize: (value) => String(value),
  };
}

export function numberCodec(): FilterCodec<number> {
  return {
    parse: (raw) => {
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    },
    serialize: (value) => String(value),
  };
}
