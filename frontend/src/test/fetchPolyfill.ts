import { fetch, FormData, Headers, Request, Response } from 'undici'

// Must run after nodeBlobFilePolyfill.ts and before anything imports MSW: jsdom's own
// fetch/File/Blob/FormData don't recognize each other consistently (a FormData built from a
// jsdom File fails multipart upload requests with a "Content-Type was not multipart/form-data"
// error even though the request looks correct), and MSW/undici's own modules cache whichever
// Blob/File is global at *their* import time — so this has to be a separate setup file listed
// after nodeBlobFilePolyfill.ts, not code merged into it.
Object.assign(globalThis, { fetch, FormData, Headers, Request, Response })
