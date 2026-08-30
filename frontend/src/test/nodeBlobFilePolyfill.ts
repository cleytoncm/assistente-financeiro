import { File, Blob } from 'node:buffer'

// Must run — with no other imports of its own — before fetchPolyfill.ts (which imports
// undici): undici's webidl Blob/File type checks capture whatever globalThis.Blob/File is
// current at the moment undici's own modules first load, not at the moment a value is checked.
// If jsdom's Blob/File were still active at that point, undici would forever reject Blobs built
// from the (correct, canonical) node:buffer constructors set up below.
Object.assign(globalThis, { File, Blob })
