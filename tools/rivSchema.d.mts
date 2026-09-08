/** The engine's own property type names, with `enumType` normalised to `enum`. */
export type RivPropertyType =
  | 'none'
  | 'string'
  | 'number'
  | 'boolean'
  | 'color'
  | 'list'
  | 'enum'
  | 'trigger'
  | 'viewModel'
  | 'integer'
  | 'listIndex'
  | 'image'
  | 'artboard';

export interface RivProperty {
  readonly type: RivPropertyType;
  /** Present when `type` is `enum`: the authored values, in file order. */
  readonly values?: readonly string[];
  /** Present when `type` is `viewModel`: the referenced ViewModel's name, or null if unresolved. */
  readonly ref?: string | null;
}

export interface RivSchema {
  readonly valid: true;
  readonly artboards: readonly string[];
  readonly defaultArtboard: string | null;
  readonly stateMachines: Readonly<Record<string, readonly string[]>>;
  readonly viewModels: Readonly<Record<string, Readonly<Record<string, RivProperty>>>>;
  /** The engine's default ViewModel for the default artboard — what `useDefault: true` binds on the default artboard. */
  readonly defaultViewModel: string | null;
  /** Each artboard's default ViewModel — what a stage that selects an artboard by lift binds. */
  readonly defaultViewModelByArtboard: Readonly<Record<string, string | null>>;
}

export interface RivInvalid {
  readonly valid: false;
  readonly reason: string;
}

export const RIV_MAGIC: string;
export function isRivMagic(bytes: Uint8Array | ArrayBuffer): boolean;
export function readRivSchema(bytes: Uint8Array | ArrayBuffer): Promise<RivSchema | RivInvalid>;
export function readRivSchemaFile(filePath: string): Promise<RivSchema | RivInvalid>;
