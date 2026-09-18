// URL do backend Express. Em desenvolvimento local, o `next dev` já ocupa a
// porta 3000, então rode o backend em outra porta (ex: PORT=4000).
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
